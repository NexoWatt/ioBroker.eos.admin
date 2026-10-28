/** A news condition is data: one comparison and one nonnegative integer. */
export function matchesObjectCount(count: unknown, expression: unknown): boolean {
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || typeof expression !== 'string' || expression.length > 64) return false;
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
