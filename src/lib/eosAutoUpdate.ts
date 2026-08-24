/**
 * NexoWatt stable adapter auto-update policy manager.
 *
 * This class does not install packages itself. It configures ioBroker's native
 * adapterAutoUpgrade manager so only installed NexoWatt adapters present in the
 * detected Stable repository receive the `major` policy. All other adapters and
 * existing user policies are preserved.
 *
 * Runtime status is deliberately stored in adapter states, never in the native
 * configuration of the running eos-admin instance. Changing an instance native
 * object causes ioBroker to restart that instance. Version 7.10.1 persisted a
 * fresh timestamp there during every startup and therefore created an endless
 * restart loop while the browser was still loading its JavaScript and CSS.
 */

export type NexoWattAutoUpdatePolicy = 'none' | 'patch' | 'minor' | 'major';

interface AdapterObjectLike {
    _id?: string;
    common?: Record<string, any>;
    native?: Record<string, any>;
}

interface NexoWattAutoUpdateAdapter {
    namespace: string;
    host?: string;
    log: {
        debug: (message: string) => void;
        info: (message: string) => void;
        warn: (message: string) => void;
        error: (message: string) => void;
    };
    getForeignObjectAsync: (id: string) => Promise<any>;
    setForeignObjectAsync: (id: string, object: any, options?: any) => Promise<any>;
    getObjectViewAsync: (design: string, search: string, params: any, options?: any) => Promise<any>;
    getStateAsync: (id: string) => Promise<any>;
    setStateAsync: (id: string, value: any, ack?: boolean) => Promise<any>;
    sendToHostAsync?: (host: string, command: string, message: any) => Promise<any>;
}

export interface NexoWattStableUpdateStatus {
    enabled: boolean;
    repository: string;
    managedAdapters: string[];
    availableStableAdapters: string[];
    lastSync: number;
    lastRepositoryRefresh: number;
    error: string;
    policy: 'major';
    source: 'ioBroker-native-auto-upgrade';
}

interface PersistedState {
    previousPolicies?: Record<string, NexoWattAutoUpdatePolicy | null>;
    previousRepositoryEnabled?: boolean | null;
    previousActiveRepo?: string[];
    selectedRepository?: string;
    ownsActiveRepoOrder?: boolean;
    managedAdapters?: string[];
    availableStableAdapters?: string[];
    lastSync?: number;
    lastRepositoryRefresh?: number;
    error?: string;
}

const ADMIN_USER = 'system.user.admin';
const POLICY: NexoWattAutoUpdatePolicy = 'major';
const RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_RECONCILE_DELAY_MS = 30_000;
const REPOSITORY_REFRESH_DELAY_MS = 2500;
const ENABLED_STATE_ID = 'info.nexowattStableUpdatesEnabled';
const STATUS_STATE_ID = 'info.nexowattStableUpdatesState';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const normalizedName = (value: unknown): string => String(value || '').trim().replace(/^system\.adapter\./, '').replace(/\.\d+$/, '');
const stableVersion = (value: unknown): boolean => /^\d+\.\d+\.\d+$/.test(String(value || '').trim());

export function isNexoWattRepositoryEntry(name: string, entry: any): boolean {
    const adapterName = normalizedName(entry?.name || name).toLowerCase();
    if (adapterName === 'eos-admin' || adapterName.startsWith('nexowatt-') || adapterName.startsWith('eos-')) return true;
    const evidence = JSON.stringify({
        name,
        adapterName,
        title: entry?.title,
        desc: entry?.desc,
        author: entry?.author,
        authors: entry?.authors,
        publisher: entry?.publisher,
        url: entry?.url,
        meta: entry?.meta,
        readme: entry?.readme,
        extIcon: entry?.extIcon,
        licenseInformation: entry?.licenseInformation,
    }).toLowerCase();
    return evidence.includes('nexowatt') || evidence.includes('github.com/nexowatt/');
}

export class NexoWattStableUpdateManager {
    private timer?: NodeJS.Timeout;
    private startupTimer?: NodeJS.Timeout;
    private reconcilePromise?: Promise<NexoWattStableUpdateStatus>;
    private refreshTimer?: NodeJS.Timeout;
    private retryTimer?: NodeJS.Timeout;
    private stopped = false;
    private cachedEnabled?: boolean;
    private cachedState: PersistedState = {};

    constructor(private readonly adapter: NexoWattAutoUpdateAdapter) {}

    private get instanceId(): string { return `system.adapter.${this.adapter.namespace}`; }

    async start(): Promise<NexoWattStableUpdateStatus> {
        this.stopped = false;
        const status = await this.getStatus(false);
        this.scheduleStartupReconcile();
        this.ensurePeriodicTimer();
        return status;
    }

    stop(): void {
        this.stopped = true;
        if (this.timer) clearInterval(this.timer);
        if (this.startupTimer) clearTimeout(this.startupTimer);
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.timer = undefined;
        this.startupTimer = undefined;
        this.refreshTimer = undefined;
        this.retryTimer = undefined;
    }

    async getStatus(refresh = false): Promise<NexoWattStableUpdateStatus> {
        if (refresh) return this.reconcile('status');
        const persisted = await this.readPersisted();
        return this.statusFromPersisted(persisted.enabled, persisted.state);
    }

    async setEnabled(enabled: boolean): Promise<NexoWattStableUpdateStatus> {
        this.stopped = false;
        if (this.startupTimer) {
            clearTimeout(this.startupTimer);
            this.startupTimer = undefined;
        }
        const persisted = await this.readPersisted();
        await this.persist(enabled, persisted.state);
        const status = await this.reconcile(enabled ? 'enabled' : 'disabled');
        this.ensurePeriodicTimer();
        return status;
    }

    async reconcile(reason = 'manual'): Promise<NexoWattStableUpdateStatus> {
        if (this.reconcilePromise) return this.reconcilePromise;
        this.reconcilePromise = this.reconcileInternal(reason).finally(() => { this.reconcilePromise = undefined; });
        return this.reconcilePromise;
    }

    private scheduleStartupReconcile(): void {
        if (this.startupTimer || this.stopped) return;
        this.startupTimer = setTimeout(() => {
            this.startupTimer = undefined;
            if (!this.stopped) {
                void this.reconcile('startup').catch(error =>
                    this.adapter.log.warn(`[NexoWatt stable updates] Startup reconciliation failed: ${error instanceof Error ? error.message : error}`),
                );
            }
        }, STARTUP_RECONCILE_DELAY_MS);
        this.startupTimer.unref?.();
    }

    private ensurePeriodicTimer(): void {
        if (this.timer || this.stopped) return;
        this.timer = setInterval(() => {
            if (!this.stopped) void this.reconcile('interval');
        }, RECONCILE_INTERVAL_MS);
        this.timer.unref?.();
    }

    private parseState(value: unknown): PersistedState | null {
        if (value && typeof value === 'object' && !Array.isArray(value)) return clone(value as PersistedState);
        if (typeof value !== 'string' || !value.trim()) return null;
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as PersistedState : null;
        } catch {
            return null;
        }
    }

    private async readPersisted(): Promise<{ enabled: boolean; state: PersistedState }> {
        // Legacy 7.10.1 values are read once as a migration fallback. They are
        // never written back to the instance native object.
        let legacyNative: Record<string, any> = {};
        try {
            const instance = await this.adapter.getForeignObjectAsync(this.instanceId);
            legacyNative = instance?.native || {};
        } catch (error) {
            this.adapter.log.debug(`[NexoWatt stable updates] Cannot read legacy native state: ${error instanceof Error ? error.message : error}`);
        }

        let enabled = this.cachedEnabled ?? (legacyNative.eosNexoWattAutoUpdate !== false);
        let state = Object.keys(this.cachedState).length
            ? clone(this.cachedState)
            : clone((legacyNative.eosNexoWattAutoUpdateState || {}) as PersistedState);

        try {
            const enabledState = await this.adapter.getStateAsync(ENABLED_STATE_ID);
            if (typeof enabledState?.val === 'boolean') enabled = enabledState.val;
        } catch (error) {
            this.adapter.log.debug(`[NexoWatt stable updates] Cannot read enabled state: ${error instanceof Error ? error.message : error}`);
        }

        try {
            const persistedState = await this.adapter.getStateAsync(STATUS_STATE_ID);
            const parsed = this.parseState(persistedState?.val);
            if (parsed) state = parsed;
        } catch (error) {
            this.adapter.log.debug(`[NexoWatt stable updates] Cannot read status state: ${error instanceof Error ? error.message : error}`);
        }

        this.cachedEnabled = enabled;
        this.cachedState = clone(state);
        return { enabled, state };
    }

    private statusFromPersisted(enabled: boolean, state: PersistedState): NexoWattStableUpdateStatus {
        return {
            enabled,
            repository: String(state.selectedRepository || ''),
            managedAdapters: Array.isArray(state.managedAdapters) ? state.managedAdapters.map(String).sort() : [],
            availableStableAdapters: Array.isArray(state.availableStableAdapters) ? state.availableStableAdapters.map(String).sort() : [],
            lastSync: Number(state.lastSync || 0),
            lastRepositoryRefresh: Number(state.lastRepositoryRefresh || 0),
            error: String(state.error || ''),
            policy: POLICY,
            source: 'ioBroker-native-auto-upgrade',
        };
    }

    private async reconcileInternal(reason: string): Promise<NexoWattStableUpdateStatus> {
        const persisted = await this.readPersisted();
        const { enabled } = persisted;
        const state = clone(persisted.state);
        if (this.stopped) return this.statusFromPersisted(enabled, state);
        try {
            if (!enabled) return await this.disable(state, reason);
            return await this.enable(state, reason);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknownError');
            state.error = message;
            state.lastSync = Date.now();
            if (!this.stopped) await this.persist(enabled, state);
            if (enabled && !this.stopped) this.scheduleRetry();
            if (!this.stopped) this.adapter.log.warn(`[NexoWatt stable updates] ${message}`);
            return this.statusFromPersisted(enabled, state);
        }
    }

    private async readInstalledAdapters(): Promise<Map<string, AdapterObjectLike>> {
        const view = await this.adapter.getObjectViewAsync('system', 'adapter', {
            startkey: 'system.adapter.',
            endkey: 'system.adapter.\u9999',
        }, { user: ADMIN_USER });
        const result = new Map<string, AdapterObjectLike>();
        for (const row of view?.rows || []) {
            const object = row?.value || row?.doc;
            const name = normalizedName(object?.common?.name || row?.id || object?._id);
            if (name && object?.common?.version) result.set(name, object);
        }
        return result;
    }

    private async readRepositorySelection(systemConfig: any): Promise<{ name: string; entries: Record<string, any>; stableNames: string[] }> {
        const repositories = await this.adapter.getForeignObjectAsync('system.repositories');
        const rows = repositories?.native?.repositories || {};
        const active = Array.isArray(systemConfig?.common?.activeRepo) ? systemConfig.common.activeRepo.map(String) : [];
        const candidates = Object.entries(rows).map(([name, repo]: [string, any]) => {
            const entries = repo?.json && typeof repo.json === 'object' ? repo.json : {};
            const stableNames = Object.entries(entries)
                .filter(([entryName, entry]) => stableVersion((entry as any)?.version) && isNexoWattRepositoryEntry(entryName, entry))
                .map(([entryName, entry]) => normalizedName((entry as any)?.name || entryName))
                .filter(Boolean);
            return { name, entries, stableNames: [...new Set(stableNames)].sort(), activeIndex: active.indexOf(name) };
        }).filter(row => row.stableNames.length > 0);
        if (!candidates.length) throw new Error('nexowattStableRepositoryNotFound');
        candidates.sort((a, b) => {
            const aa = a.activeIndex < 0 ? Number.MAX_SAFE_INTEGER : a.activeIndex;
            const bb = b.activeIndex < 0 ? Number.MAX_SAFE_INTEGER : b.activeIndex;
            return aa - bb || b.stableNames.length - a.stableNames.length || a.name.localeCompare(b.name);
        });
        return candidates[0];
    }

    private async enable(state: PersistedState, reason: string): Promise<NexoWattStableUpdateStatus> {
        const systemConfig = await this.adapter.getForeignObjectAsync('system.config');
        if (!systemConfig?.common) throw new Error('systemConfigUnavailable');
        const selected = await this.readRepositorySelection(systemConfig);
        const installed = await this.readInstalledAdapters();
        const managedNames = selected.stableNames.filter(name => installed.has(name)).sort();
        if (!managedNames.length) throw new Error('noInstalledNexoWattStableAdapters');
        if (this.stopped) return this.statusFromPersisted(true, state);

        state.previousPolicies ||= {};
        for (const name of managedNames) {
            if (this.stopped) return this.statusFromPersisted(true, state);
            if (!(name in state.previousPolicies)) {
                const current = installed.get(name)?.common?.automaticUpgrade;
                state.previousPolicies[name] = current == null ? null : current as NexoWattAutoUpdatePolicy;
            }
            await this.writeAdapterPolicy(name, POLICY);
        }

        const common = systemConfig.common;
        const activeRepo = Array.isArray(common.activeRepo) ? [...common.activeRepo] : [];
        const auto = common.adapterAutoUpgrade && typeof common.adapterAutoUpgrade === 'object'
            ? clone(common.adapterAutoUpgrade)
            : { repositories: {}, defaultPolicy: 'none' };
        auto.repositories = auto.repositories && typeof auto.repositories === 'object' ? { ...auto.repositories } : {};
        let systemConfigChanged = false;
        if (state.previousRepositoryEnabled === undefined) {
            state.previousRepositoryEnabled = Object.prototype.hasOwnProperty.call(auto.repositories, selected.name)
                ? Boolean(auto.repositories[selected.name])
                : null;
        }
        if (auto.repositories[selected.name] !== true) {
            auto.repositories[selected.name] = true;
            systemConfigChanged = true;
        }
        if (!auto.defaultPolicy) {
            auto.defaultPolicy = 'none';
            systemConfigChanged = true;
        }
        if (JSON.stringify(common.adapterAutoUpgrade) !== JSON.stringify(auto)) {
            common.adapterAutoUpgrade = auto;
            systemConfigChanged = true;
        }

        if (activeRepo[0] !== selected.name) {
            if (!state.previousActiveRepo) state.previousActiveRepo = [...activeRepo];
            state.ownsActiveRepoOrder = true;
            common.activeRepo = [selected.name, ...activeRepo.filter((name: string) => name !== selected.name)];
            systemConfigChanged = true;
        }
        if (systemConfigChanged && !this.stopped) {
            await this.adapter.setForeignObjectAsync('system.config', systemConfig, { user: ADMIN_USER });
        }

        state.selectedRepository = selected.name;
        state.availableStableAdapters = selected.stableNames;
        state.managedAdapters = managedNames;
        state.lastSync = Date.now();
        state.error = '';
        if (!this.stopped) await this.persist(true, state);
        if (!this.stopped) this.scheduleRepositoryRefresh(selected.name, state);
        if (!this.stopped) this.adapter.log.info(`[NexoWatt stable updates] Enabled for ${managedNames.join(', ')} from repository "${selected.name}" (${reason})`);
        return this.statusFromPersisted(true, state);
    }

    private async disable(state: PersistedState, reason: string): Promise<NexoWattStableUpdateStatus> {
        for (const [name, previous] of Object.entries(state.previousPolicies || {})) {
            if (this.stopped) return this.statusFromPersisted(false, state);
            const current = await this.adapter.getForeignObjectAsync(`system.adapter.${normalizedName(name)}`);
            if (current?.common?.automaticUpgrade === POLICY) await this.writeAdapterPolicy(name, previous);
        }
        const systemConfig = await this.adapter.getForeignObjectAsync('system.config');
        if (systemConfig?.common) {
            let systemConfigChanged = false;
            const auto = systemConfig.common.adapterAutoUpgrade && typeof systemConfig.common.adapterAutoUpgrade === 'object'
                ? clone(systemConfig.common.adapterAutoUpgrade)
                : null;
            if (auto && state.selectedRepository) {
                auto.repositories = auto.repositories && typeof auto.repositories === 'object' ? { ...auto.repositories } : {};
                if (auto.repositories[state.selectedRepository] === true) {
                    if (state.previousRepositoryEnabled === null || state.previousRepositoryEnabled === undefined) {
                        delete auto.repositories[state.selectedRepository];
                    } else {
                        auto.repositories[state.selectedRepository] = state.previousRepositoryEnabled;
                    }
                    systemConfigChanged = true;
                }
                if (JSON.stringify(systemConfig.common.adapterAutoUpgrade) !== JSON.stringify(auto)) {
                    systemConfig.common.adapterAutoUpgrade = auto;
                    systemConfigChanged = true;
                }
            }
            if (state.ownsActiveRepoOrder && Array.isArray(state.previousActiveRepo)
                && Array.isArray(systemConfig.common.activeRepo)
                && systemConfig.common.activeRepo[0] === state.selectedRepository) {
                systemConfig.common.activeRepo = [...state.previousActiveRepo];
                systemConfigChanged = true;
            }
            if (systemConfigChanged && !this.stopped) {
                await this.adapter.setForeignObjectAsync('system.config', systemConfig, { user: ADMIN_USER });
            }
        }
        state.previousPolicies = {};
        state.previousRepositoryEnabled = undefined;
        state.previousActiveRepo = undefined;
        state.ownsActiveRepoOrder = false;
        state.managedAdapters = [];
        state.lastSync = Date.now();
        state.error = '';
        if (!this.stopped) await this.persist(false, state);
        if (!this.stopped) this.adapter.log.info(`[NexoWatt stable updates] Disabled and previous policies restored (${reason})`);
        return this.statusFromPersisted(false, state);
    }

    private async writeAdapterPolicy(name: string, policy: NexoWattAutoUpdatePolicy | null): Promise<void> {
        const id = `system.adapter.${normalizedName(name)}`;
        const object = await this.adapter.getForeignObjectAsync(id);
        if (!object?.common || this.stopped) return;
        const current = object.common.automaticUpgrade as NexoWattAutoUpdatePolicy | undefined;
        if ((policy === null && current === undefined) || current === policy) return;
        if (policy === null) delete object.common.automaticUpgrade;
        else object.common.automaticUpgrade = policy;
        await this.adapter.setForeignObjectAsync(id, object, { user: ADMIN_USER });
    }

    private async persist(enabled: boolean, state: PersistedState): Promise<void> {
        if (this.stopped) return;
        this.cachedEnabled = enabled;
        this.cachedState = clone(state);

        const currentEnabled = await this.adapter.getStateAsync(ENABLED_STATE_ID).catch(() => null);
        if (currentEnabled?.val !== enabled) {
            await this.adapter.setStateAsync(ENABLED_STATE_ID, enabled, true);
        }

        const serialized = JSON.stringify(state);
        const currentState = await this.adapter.getStateAsync(STATUS_STATE_ID).catch(() => null);
        const currentSerialized = typeof currentState?.val === 'string'
            ? currentState.val
            : currentState?.val == null ? '' : JSON.stringify(currentState.val);
        if (currentSerialized !== serialized) {
            await this.adapter.setStateAsync(STATUS_STATE_ID, serialized, true);
        }
    }

    private scheduleRetry(): void {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined;
            if (!this.stopped) void this.reconcile('retry');
        }, 60_000);
        this.retryTimer.unref?.();
    }

    private scheduleRepositoryRefresh(repository: string, state: PersistedState): void {
        if (!this.adapter.sendToHostAsync || !this.adapter.host || this.stopped) return;
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = undefined;
            if (this.stopped) return;
            void this.adapter.sendToHostAsync?.(this.adapter.host as string, 'getRepository', { repo: repository, update: true })
                .then(async () => {
                    if (this.stopped) return;
                    const current = await this.readPersisted();
                    if (!current.enabled) return;
                    const nextState = { ...current.state, ...state, lastRepositoryRefresh: Date.now() };
                    await this.persist(true, nextState);
                })
                .catch(error => {
                    if (!this.stopped) this.adapter.log.warn(`[NexoWatt stable updates] Repository refresh failed: ${error instanceof Error ? error.message : error}`);
                });
        }, REPOSITORY_REFRESH_DELAY_MS);
        this.refreshTimer.unref?.();
    }
}
