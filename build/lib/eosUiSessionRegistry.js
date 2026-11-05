"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EosUiSessionRegistry = void 0;
const node_crypto_1 = require("node:crypto");
/** No capability survives socket revocation, a role change, expiry or unsubscribe. */
class EosUiSessionRegistry {
    now;
    limit;
    entries = new Map();
    constructor(now = Date.now, limit = 256) {
        this.now = now;
        this.limit = limit;
    }
    get size() {
        return this.entries.size;
    }
    issue(clientId, identity, ttlSeconds) {
        this.prune();
        if (!clientId ||
            clientId.length > 256 ||
            !identity.socketId ||
            identity.socketId.length > 256 ||
            !/^system\.user\.[^\s]{1,128}$/.test(identity.user) ||
            !identity.epoch ||
            !Number.isFinite(ttlSeconds) ||
            ttlSeconds <= 0) {
            return undefined;
        }
        this.unsubscribe(clientId);
        if (this.entries.size >= this.limit) {
            return undefined;
        }
        const token = (0, node_crypto_1.randomBytes)(24).toString('hex');
        this.entries.set(token, {
            ...identity,
            clientId,
            expiresAt: this.now() + Math.min(ttlSeconds, 3600) * 1000,
        });
        return token;
    }
    get(token, resolveIdentity) {
        if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) {
            return undefined;
        }
        const entry = this.entries.get(token);
        if (!entry) {
            return undefined;
        }
        const identity = resolveIdentity(entry.socketId);
        if (entry.expiresAt <= this.now() ||
            !identity ||
            identity.epoch !== entry.epoch ||
            identity.user !== entry.user ||
            identity.socketId !== entry.socketId ||
            identity.mayExecute !== entry.mayExecute) {
            this.entries.delete(token);
            return undefined;
        }
        return entry;
    }
    unsubscribe(clientId) {
        for (const [token, entry] of this.entries) {
            if (entry.clientId === clientId) {
                this.entries.delete(token);
            }
        }
    }
    delete(token) {
        this.entries.delete(token);
    }
    clear() {
        this.entries.clear();
    }
    prune() {
        const now = this.now();
        for (const [token, entry] of this.entries) {
            if (entry.expiresAt <= now) {
                this.entries.delete(token);
            }
        }
    }
}
exports.EosUiSessionRegistry = EosUiSessionRegistry;
//# sourceMappingURL=eosUiSessionRegistry.js.map