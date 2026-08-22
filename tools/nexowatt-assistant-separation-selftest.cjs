#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = msg => { console.error(`[NexoWatt EOS assistant integration] ${msg}`); process.exit(1); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const info = JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json'));
const runtime = info.runtimeEntry;
const shell = String(info.shellCacheTag || info.shellCacheVersion);
const app = read('src-admin/src/App.tsx');
const bundle = read(`adminWww/assets/bootstrap-COulQZax-${runtime}.js`);
const assist = read('adminWww/js/eos-assistant.js');
const assistSource = read('src-admin/public/js/eos-assistant.js');
const index = read('adminWww/index.html');
const mainSource = read('src/main.ts');
const mainBuild = read('build/main.js');
const orchestratorSource = read('src/lib/chat/chatOrchestrator.ts');
const orchestratorBuild = read('build/lib/chat/chatOrchestrator.js');
const mcpSource = read('src/lib/chat/mcpClientManager.ts');
const mcpBuild = read('build/lib/chat/mcpClientManager.js');

if (app.includes("import ChatPanel from './components/Chat/ChatPanel'")) fail('App.tsx still imports the upstream floating ChatPanel');
if (app.includes('<ChatPanel')) fail('App.tsx still renders the upstream floating ChatPanel');
if (bundle.includes('this.state.disableMcp===!1?jsxRuntimeExports.jsx(ChatPanel')) fail('active runtime still mounts the old floating ChatPanel');
if (assist !== assistSource) fail('EOS Assist source/build drift');
for (const marker of [
  "const VERSION = 'v93-header-eos-assist-live-system'",
  "root.id = 'eos-assist-root'",
  'eos-assist-header-root',
  "insertBefore(root, userAnchor)",
  "emit('eosAssistStatus'",
  "'eosAssist',",
  "emit('eosAssistSaveSettings'",
  "emit('eosAssistTestSettings'",
  'Neue Unterhaltung',
  'Systemhilfe',
]) if (!assist.includes(marker)) fail(`header assistant runtime marker missing: ${marker}`);
if (assist.includes('const answer = query =>')) fail('static canned-answer helper is still active');
if (assist.includes('/api/chat') || assist.includes('fetch(')) fail('header assistant bypasses the authenticated EOS socket');
if (assist.includes('bottom:')) fail('EOS Assist must not be rendered as a bottom floating control');
for (const marker of [
  'eosAssistMcpChats',
  'processEosAssistSocketRequest',
  'installEosAssistSocketCommands',
  "addCommandHandler('eosAssist'",
  "addCommandHandler('eosAssistStatus'",
  'defaultUser: userId',
  'allowSetState: false',
  'allowObjectChange: false',
  "mode: 'read'",
  'accessRole: role',
  "getForeignObjectAsync('system.ai')",
]) {
  if (!mainSource.includes(marker)) fail(`backend source marker missing: ${marker}`);
  const compiledMarker = marker.replace(/: userId/g, ': userId');
  if (!mainBuild.includes(compiledMarker) && !mainBuild.includes(marker.replace("'", '"'))) {
    fail(`backend build marker missing: ${marker}`);
  }
}
if (!mainSource.includes('listAiCredentials') || !mainBuild.includes('listAiCredentials')) fail('Admin/Service configuration cannot enumerate stored AI credentials');
for (const marker of [
  'You are EOS Assist inside NexoWatt EOS.',
  "accessRole?: 'admin' | 'installer' | 'enduser'",
  'For every system-specific question, use the available read tools',
  'This header assistant is READ-ONLY',
  'NexoWatt EOS knowledge:',
]) if (!orchestratorSource.includes(marker)) fail(`orchestrator source marker missing: ${marker}`);
for (const marker of ['You are EOS Assist inside NexoWatt EOS.', 'For every system-specific question, use the available read tools', 'This header assistant is READ-ONLY', 'NexoWatt EOS knowledge:']) {
  if (!orchestratorBuild.includes(marker)) fail(`orchestrator build marker missing: ${marker}`);
}
if (!mcpSource.includes("clientName: 'NexoWatt EOS Assist'") || !mcpBuild.includes("clientName: 'NexoWatt EOS Assist'")) fail('MCP client branding is not NexoWatt EOS Assist');
if (!index.includes(`eos-assistant.js?v=${shell}`)) fail('EOS Assist cache key mismatch');
if (!fs.existsSync(path.join(root, 'adminWww/img/eos/nexowatt-eos-brand-wide.png'))) fail('NexoWatt EOS brand logo asset missing');
console.log('[NexoWatt EOS assistant integration] OK');
