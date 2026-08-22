"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatOrchestrator = void 0;
exports.parseTextToolCalls = parseTextToolCalls;
const llmProvider_1 = require("./llmProvider");
const adminLocalTools_1 = require("./adminLocalTools");
const assistantKnowledge_1 = require("./assistantKnowledge");
const DEFAULT_MAX_TOOL_ROUNDS = 8;
const STEP_RESULT_PREVIEW = 1000;
/** Parse a tool-call's JSON argument string into an object, tolerating malformed input. */
function parseToolArgs(args) {
    if (!args) {
        return {};
    }
    try {
        const parsed = JSON.parse(args);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
function truncate(text, max) {
    return text.length > max ? `${text.substring(0, max)}…` : text;
}
/**
 * Recover tool calls that a model emitted as TEXT instead of as native `tool_calls`.
 *
 * Some models/endpoints (and Claude when it slips out of structured tool use) write the call in the
 * Anthropic text form, e.g. `<invoke name="install_adapter"><parameter name="adapter">growatt</parameter></invoke>`,
 * optionally wrapped in `<function_calls>…</function_calls>` and/or prefixed with the literal word
 * "call". When that happens the call is never executed and the raw XML leaks into the chat. This
 * parser turns those text blocks into real {@link OpenAIToolCall}s and strips them from the visible
 * content so the normal tool pipeline runs.
 */
function parseTextToolCalls(content) {
    if (!content || !content.includes('<invoke')) {
        return { content, toolCalls: [] };
    }
    const toolCalls = [];
    const invokeRe = /<invoke\s+name="([^"]+)"\s*>([\s\S]*?)<\/invoke>/g;
    let match;
    let index = 0;
    while ((match = invokeRe.exec(content)) !== null) {
        const name = match[1];
        const inner = match[2];
        const args = {};
        const paramRe = /<parameter\s+name="([^"]+)"\s*>([\s\S]*?)<\/parameter>/g;
        let param;
        while ((param = paramRe.exec(inner)) !== null) {
            args[param[1]] = param[2].trim();
        }
        toolCalls.push({
            id: `text_call_${index++}`,
            type: 'function',
            function: { name, arguments: JSON.stringify(args) },
        });
    }
    if (!toolCalls.length) {
        return { content, toolCalls: [] };
    }
    const cleaned = content
        .replace(/<invoke\s+name="[^"]+"\s*>[\s\S]*?<\/invoke>/g, '')
        .replace(/<\/?function_calls>/g, '')
        .replace(/^[ \t]*call[ \t]*$/gim, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return { content: cleaned, toolCalls };
}
class ChatOrchestrator {
    mcp;
    adapter;
    constructor(mcp, adapter) {
        this.mcp = mcp;
        this.adapter = adapter;
    }
    /** System prompt describing EOS Assist, tool usage and the authenticated role. */
    buildSystemPrompt(language, mode, uiContext, accessRole = 'enduser') {
        const roleText = accessRole === 'admin'
            ? 'Admin / NexoWatt Service with full service visibility'
            : accessRole === 'installer'
                ? 'Installer with commissioning and troubleshooting visibility'
                : 'End user with only explicitly permitted Smart Home and operating visibility';
        const lines = [
            'You are EOS Assist inside NexoWatt EOS.',
            'Your job is to answer questions about the user\'s ACTUAL EOS system and guide them through the',
            'NexoWatt EOS interface. You cover all settings and product areas: Cockpit/Overview, Modules,',
            'Services, Datapoints, Structure (rooms/functions), System logs, Access & Rights, EOS applications,',
            'System hosts, Files, NexoWatt Backup, licenses, devices, communication protocols and diagnostics.',
            '',
            `Authenticated role: ${roleText}.`,
            'Never reveal data or instructions outside that role. The tool layer enforces ACLs; if data is not',
            'available, state that it is not available to the current account instead of guessing.',
            '',
            'Rules:',
            '- For every system-specific question, use the available read tools and base the answer on their results.',
            '- Never invent installed modules, running services, settings, datapoint values, devices or errors.',
            '- Use NexoWatt EOS product terminology in normal answers. Do not present the underlying platform name',
            '  as the product. Technical package IDs or command names may appear only in `code` when strictly needed.',
            '- Explain results clearly and practically. Use short lists or tables for multiple devices or values.',
            '- Object and state IDs are case-sensitive; show necessary IDs in `monospace`.',
            '- You may navigate the EOS interface with navigate_admin_ui when the user explicitly asks to open a',
            '  page. Use these EOS routes: Cockpit `#tab-intro`, Modules `#tab-adapters`, Services `#tab-instances`,',
            '  Datapoints `#tab-objects`, Structure `#tab-enums`, System logs `#tab-logs`, Access & Rights',
            '  `#tab-users`, and instance configuration `#tab-instances/config/<module>.<instance>`.',
            '- Do not claim an action was completed unless a tool result confirms it.',
            `- Answer in the user\'s language. The current EOS language is "${language}".`,
        ];
        if (mode === 'act') {
            lines.push('- Changes are possible only through explicit write/action tools and confirmation. Propose the', '  smallest safe action and respect all EOS safety and role restrictions.');
        }
        else {
            lines.push('- This header assistant is READ-ONLY. It may inspect and explain the system, but it must not', '  change states, objects, settings, services, modules, passwords or backups.');
        }
        if (uiContext?.hash) {
            lines.push('', `The user is currently on EOS route \`${uiContext.hash}\`. Consider this context.`);
        }
        lines.push('', 'NexoWatt EOS knowledge:', (0, assistantKnowledge_1.renderAssistantKnowledge)());
        return { role: 'system', content: lines.join('\n') };
    }
    /** Assemble the tool list offered to the model for the given mode. */
    async buildTools(mode) {
        const mcpTools = await this.mcp.getTools();
        if (mode !== 'act') {
            // Read-only: read tools + navigation (navigation only changes the view, never data).
            return [...mcpTools.filter(tool => (0, adminLocalTools_1.toolKind)(tool.function.name) === 'read'), ...adminLocalTools_1.NAVIGATION_TOOL_DEFS];
        }
        return [...mcpTools, ...adminLocalTools_1.ADMIN_LOCAL_TOOL_DEFS, ...adminLocalTools_1.NAVIGATION_TOOL_DEFS];
    }
    /**
     * Run one user turn: drive the LLM ↔ tool loop, pausing for confirmation on write/action tools.
     *
     * @param params provider/model/key, the conversation, mode, approvals and limits
     * @returns either the final answer (`done`) or the actions awaiting confirmation (`confirm`)
     */
    async run(params) {
        const language = params.language || 'en';
        const mode = params.mode || 'read';
        const approvals = params.approvals || {};
        // Tools the user granted blanket approval for ("don't ask again") run without prompting.
        const autoApprove = new Set(params.autoApprove || []);
        const tools = await this.buildTools(mode);
        // Work on a copy. Strip any tool-call XML a model previously leaked into assistant TEXT so it
        // is not replayed as an example the model imitates — a single leak otherwise poisons the whole
        // conversation (the leaked `<invoke …>` keeps reappearing until "new chat").
        const messages = params.messages.map(message => message.role === 'assistant' && typeof message.content === 'string' && message.content.includes('<invoke')
            ? { ...message, content: parseTextToolCalls(message.content).content }
            : message);
        if (!messages.some(message => message.role === 'system')) {
            messages.unshift(this.buildSystemPrompt(language, mode, params.uiContext, params.accessRole));
        }
        const newMessages = [];
        const steps = [];
        const clientActions = [];
        const maxRounds = params.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
        for (let round = 0; round < maxRounds; round++) {
            const pending = unansweredToolCalls(messages);
            if (pending.length) {
                // A write/action tool call needs a decision unless the user already decided it
                // (approvals) or granted blanket approval for that tool (autoApprove).
                const needsDecision = (tc) => (0, adminLocalTools_1.toolKind)(tc.function.name) !== 'read' &&
                    !adminLocalTools_1.AUTO_RUN_TOOLS.has(tc.function.name) &&
                    approvals[tc.id] === undefined &&
                    // High-risk tools (arbitrary code) always ask, even with a blanket "don't ask again".
                    (!autoApprove.has(tc.function.name) || adminLocalTools_1.ALWAYS_CONFIRM_TOOLS.has(tc.function.name));
                const undecided = pending.filter(needsDecision);
                if (undecided.length) {
                    // Pause for confirmation — surface only the calls that actually need a decision.
                    const lastText = lastAssistantText(messages);
                    const pendingActions = undecided.map(tc => ({
                        id: tc.id,
                        tool: tc.function.name,
                        args: parseToolArgs(tc.function.arguments),
                        kind: (0, adminLocalTools_1.toolKind)(tc.function.name),
                    }));
                    return { status: 'confirm', content: lastText, newMessages, steps, pendingActions };
                }
                for (const toolCall of pending) {
                    // Auto-approved tools arrive here with no explicit decision and take the
                    // "approved" branch in executeToolCall (an explicit decline still wins).
                    const { message, step, clientAction } = await this.executeToolCall(toolCall, mode, approvals);
                    messages.push(message);
                    newMessages.push(message);
                    steps.push(step);
                    if (clientAction) {
                        clientActions.push(clientAction);
                    }
                }
                continue;
            }
            // No pending tool calls → ask the model what to do next.
            const response = await (0, llmProvider_1.chatCompletion)({
                provider: params.provider,
                model: params.model,
                apiKey: params.apiKey,
                baseUrl: params.baseUrl,
                messages,
                tools,
                allowSelfSignedCerts: params.allowSelfSignedCerts,
            });
            // Some models/endpoints emit tool calls as TEXT (the `<invoke …>` format) instead of as
            // native tool_calls. Recover those so the agent still works (and the raw syntax does not
            // leak into the chat).
            let responseContent = response.content || '';
            let responseToolCalls = response.tool_calls;
            if (!responseToolCalls?.length) {
                const recovered = parseTextToolCalls(responseContent);
                if (recovered.toolCalls.length) {
                    responseToolCalls = recovered.toolCalls;
                    responseContent = recovered.content;
                }
            }
            const assistantMessage = {
                role: 'assistant',
                content: responseContent,
                ...(responseToolCalls?.length ? { tool_calls: responseToolCalls } : {}),
            };
            messages.push(assistantMessage);
            newMessages.push(assistantMessage);
            if (!responseToolCalls?.length) {
                return { status: 'done', content: responseContent, newMessages, steps, clientActions };
            }
            // Loop: the next iteration handles the proposed tool calls (and may pause for confirmation).
        }
        // Round limit reached: force a final, tool-free answer so the user always gets a response.
        const finalResponse = await (0, llmProvider_1.chatCompletion)({
            provider: params.provider,
            model: params.model,
            apiKey: params.apiKey,
            baseUrl: params.baseUrl,
            messages,
            allowSelfSignedCerts: params.allowSelfSignedCerts,
        });
        const finalContent = finalResponse.content ||
            'I reached the maximum number of tool calls for this question. Please refine your request.';
        newMessages.push({ role: 'assistant', content: finalContent });
        return { status: 'done', content: finalContent, newMessages, steps, clientActions };
    }
    /** Execute one tool call (read directly, write/action only when approved) → `tool` message + step. */
    async executeToolCall(toolCall, mode, approvals) {
        const name = toolCall.function.name;
        const args = parseToolArgs(toolCall.function.arguments);
        const kind = (0, adminLocalTools_1.toolKind)(name);
        let text;
        let ok;
        let clientAction;
        if (kind === 'read') {
            ({ text, ok } = await this.callMcp(name, args));
        }
        else if (adminLocalTools_1.AUTO_RUN_TOOLS.has(name)) {
            // Safe, view-only tools (navigation) run in any mode without confirmation.
            const result = await (0, adminLocalTools_1.executeAdminLocalTool)(this.adapter, name, args);
            text = result.text;
            ok = !result.isError;
            clientAction = result.clientAction;
        }
        else if (mode !== 'act') {
            // Defensive: write/action tools are not offered in read mode.
            text = JSON.stringify({ ok: false, error: 'This action is not allowed in read-only mode.' });
            ok = false;
        }
        else if (approvals[toolCall.id] === false) {
            text = JSON.stringify({ ok: false, error: 'The user declined this action.' });
            ok = false;
        }
        else {
            // Approved write/action.
            if ((0, adminLocalTools_1.isAdminLocalTool)(name)) {
                const result = await (0, adminLocalTools_1.executeAdminLocalTool)(this.adapter, name, args);
                text = result.text;
                ok = !result.isError;
                clientAction = result.clientAction;
            }
            else {
                ({ text, ok } = await this.callMcp(name, args));
            }
        }
        return {
            message: { role: 'tool', tool_call_id: toolCall.id, content: text },
            step: { tool: name, args, ok, result: truncate(text, STEP_RESULT_PREVIEW) },
            ...(clientAction ? { clientAction } : {}),
        };
    }
    /** Call an MCP tool, turning a thrown error into an error result so the loop can continue. */
    async callMcp(name, args) {
        try {
            const result = await this.mcp.callTool(name, args);
            return { text: result.text, ok: !result.isError };
        }
        catch (e) {
            return {
                text: JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
                ok: false,
            };
        }
    }
}
exports.ChatOrchestrator = ChatOrchestrator;
/** The tool calls of the last assistant message that don't yet have a matching `tool` result. */
function unansweredToolCalls(messages) {
    let lastAssistant;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
            lastAssistant = messages[i];
            break;
        }
    }
    if (!lastAssistant?.tool_calls?.length) {
        return [];
    }
    const answered = new Set(messages.filter(m => m.role === 'tool' && m.tool_call_id).map(m => m.tool_call_id));
    return lastAssistant.tool_calls.filter(tc => !answered.has(tc.id));
}
/** Text content of the last assistant message (the explanation shown above confirmation cards). */
function lastAssistantText(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
            return typeof messages[i].content === 'string' ? messages[i].content : '';
        }
    }
    return '';
}
//# sourceMappingURL=chatOrchestrator.js.map