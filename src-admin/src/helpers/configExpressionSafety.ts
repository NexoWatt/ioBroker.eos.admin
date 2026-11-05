import { parse, type Token } from '../vendor/acorn/acorn.mjs';

/** Syntax only: never invoke an alias or pass it a value/socket in the browser. */
export function validateAliasSyntax(value: unknown): string | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    if (typeof value !== 'string' || value.length > 4096) {
        return 'Alias expression exceeds the supported size';
    }
    let tokens = 0;
    let nesting = 0;
    try {
        parse(`function alias(val) { ${value.includes('return') ? value : `return ${value}`}\n}`, {
            ecmaVersion: 2022,
            onToken: (token: Token): void => {
                if (++tokens > 1024) {
                    throw new Error('Alias token limit');
                }
                const label = token.type.label;
                if (['(', '[', '{', '${'].includes(label) && ++nesting > 64) {
                    throw new Error('Alias depth limit');
                }
                if ([')', ']', '}'].includes(label)) {
                    nesting--;
                }
            },
        });
        return null;
    } catch {
        return 'Alias syntax is invalid or exceeds the supported complexity';
    }
}

export type CustomSchemaSafety = { ok: true } | { ok: false; reason: string };
const EXECUTABLE_KEYS = new Set([
    'func',
    'defaultFunc',
    'validator',
    'hidden',
    'disabled',
    'calculateFunc',
    'condition',
]);
const PROTOTYPE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
/** Validate before any custom schema is handed to the upstream executable JSON-config renderer. */
export function validateStaticCustomSchema(schema: unknown): CustomSchemaSafety {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        return { ok: false, reason: 'Custom settings schema must be an object' };
    }
    const queue: Array<{ value: unknown; depth: number; fieldMap?: boolean }> = [{ value: schema, depth: 0 }];
    const seen = new Set<object>();
    let count = 0;
    let stringBytes = 0;
    while (queue.length) {
        const next = queue.pop();
        if (!next) {
            break;
        }
        if (++count > 10000 || next.depth > 48) {
            return { ok: false, reason: 'Custom settings schema exceeds safe complexity limits' };
        }
        const value = next.value;
        if (typeof value === 'string') {
            stringBytes += value.length * 2;
            if (stringBytes > 2 * 1024 * 1024 || value.length > 65536) {
                return { ok: false, reason: 'Custom settings schema exceeds safe size limits' };
            }
            if (value.includes('${') || value.includes('`')) {
                return { ok: false, reason: 'Executable custom settings are blocked; existing values are unchanged' };
            }
        } else if (value && typeof value === 'object') {
            if (
                seen.has(value) ||
                (!Array.isArray(value) &&
                    Object.getPrototypeOf(value) !== Object.prototype &&
                    Object.getPrototypeOf(value) !== null)
            ) {
                return { ok: false, reason: 'Custom settings schema has an unsupported data structure' };
            }
            seen.add(value);
            for (const key of Object.getOwnPropertyNames(value)) {
                if (Array.isArray(value) && key === 'length') {
                    continue;
                }
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if (PROTOTYPE_KEYS.has(key) || !descriptor || !('value' in descriptor)) {
                    return { ok: false, reason: 'Custom settings schema contains unsafe properties' };
                }
                const child: unknown = descriptor.value;
                if (
                    !next.fieldMap &&
                    ((['format', 'container', 'control'].includes(key) && child === 'html') ||
                        (key === 'html' && !!child))
                ) {
                    return {
                        ok: false,
                        reason: 'Custom settings with active HTML are blocked; existing values are unchanged',
                    };
                }
                if (!next.fieldMap && key === 'type' && (child === 'custom' || child === 'selectSendTo')) {
                    return {
                        ok: false,
                        reason: 'Custom settings that load executable components or dynamic options are blocked; existing values are unchanged',
                    };
                }
                if (
                    !next.fieldMap &&
                    EXECUTABLE_KEYS.has(key) &&
                    ((typeof child === 'string' && child.trim()) || (child && typeof child === 'object'))
                ) {
                    return {
                        ok: false,
                        reason: 'Executable custom settings are blocked; existing values are unchanged',
                    };
                }
                queue.push({ value: child, depth: next.depth + 1, fieldMap: !next.fieldMap && key === 'items' });
                if (queue.length > 10000) {
                    return { ok: false, reason: 'Custom settings schema exceeds safe complexity limits' };
                }
            }
        } else if (
            value !== null &&
            typeof value !== 'boolean' &&
            (typeof value !== 'number' || !Number.isFinite(value))
        ) {
            return { ok: false, reason: 'Custom settings schema contains non-JSON values' };
        }
    }
    return { ok: true };
}
