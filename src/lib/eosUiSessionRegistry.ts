import { randomBytes } from 'node:crypto';

/** Short-lived authority for a GUI page's pushed log-search results. */
export interface EosUiSession {
    readonly clientId: string;
    readonly user: string;
    readonly socketId: string;
    readonly epoch: string;
    readonly expiresAt: number;
    readonly mayExecute: boolean;
}

export interface EosUiIdentity {
    readonly user: string;
    readonly socketId: string;
    readonly epoch: string;
    readonly mayExecute: boolean;
}

/** No capability survives socket revocation, a role change, expiry or unsubscribe. */
export class EosUiSessionRegistry {
    private readonly entries = new Map<string, EosUiSession>();

    constructor(
        private readonly now: () => number = Date.now,
        private readonly limit = 256,
    ) {}

    get size(): number {
        return this.entries.size;
    }

    issue(clientId: string, identity: EosUiIdentity, ttlSeconds: number): string | undefined {
        this.prune();
        if (
            !clientId ||
            clientId.length > 256 ||
            !identity.socketId ||
            identity.socketId.length > 256 ||
            !/^system\.user\.[^\s]{1,128}$/.test(identity.user) ||
            !identity.epoch ||
            !Number.isFinite(ttlSeconds) ||
            ttlSeconds <= 0
        ) {
            return undefined;
        }
        this.unsubscribe(clientId);
        if (this.entries.size >= this.limit) {
            return undefined;
        }
        const token = randomBytes(24).toString('hex');
        this.entries.set(token, {
            ...identity,
            clientId,
            expiresAt: this.now() + Math.min(ttlSeconds, 3600) * 1000,
        });
        return token;
    }

    get(token: unknown, resolveIdentity: (socketId: string) => EosUiIdentity | undefined): EosUiSession | undefined {
        if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) {
            return undefined;
        }
        const entry = this.entries.get(token);
        if (!entry) {
            return undefined;
        }
        const identity = resolveIdentity(entry.socketId);
        if (
            entry.expiresAt <= this.now() ||
            !identity ||
            identity.epoch !== entry.epoch ||
            identity.user !== entry.user ||
            identity.socketId !== entry.socketId ||
            identity.mayExecute !== entry.mayExecute
        ) {
            this.entries.delete(token);
            return undefined;
        }
        return entry;
    }

    unsubscribe(clientId: string): void {
        for (const [token, entry] of this.entries) {
            if (entry.clientId === clientId) {
                this.entries.delete(token);
            }
        }
    }

    delete(token: string): void {
        this.entries.delete(token);
    }

    clear(): void {
        this.entries.clear();
    }

    private prune(): void {
        const now = this.now();
        for (const [token, entry] of this.entries) {
            if (entry.expiresAt <= now) {
                this.entries.delete(token);
            }
        }
    }
}
