'use strict';

/** A news condition is data: one comparison and one nonnegative integer. */
function matchesObjectCount(count, expression) {
    if (!Number.isSafeInteger(count) || count < 0 || typeof expression !== 'string' || expression.length > 64) return false;
    const match = /^(<=|>=|===|!==|==|!=|<|>)\s*(0|[1-9][0-9]{0,15})$/.exec(expression.trim());
    if (!match) return false;
    const expected = Number(match[2]);
    if (!Number.isSafeInteger(expected)) return false;
    switch (match[1]) {
        case '<': return count < expected;
        case '<=': return count <= expected;
        case '>': return count > expected;
        case '>=': return count >= expected;
        case '==': case '===': return count === expected;
        case '!=': case '!==': return count !== expected;
        default: return false;
    }
}

/** Bound both work and the strings used by the version-display consumer. */
function validateNodeReleaseIndex(value) {
    if (!Array.isArray(value) || value.length > 5000) throw new Error('EOS_NODE_INDEX_SCHEMA');
    const version = /^v?[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}(?:-[a-zA-Z0-9.-]{1,40})?$/;
    return value.filter(item => item && typeof item === 'object' &&
        typeof item.version === 'string' && typeof item.npm === 'string' &&
        version.test(item.version) && version.test(item.npm))
        .map(item => ({ version: item.version, npm: item.npm }));
}

module.exports = { matchesObjectCount, validateNodeReleaseIndex };
