/** EOS manual-value interaction contract, shared by the dialog and the pinned GUI source overlay. */
import type React from 'react';
import type { Connection, ObjectBrowserClass, TreeItem } from '@iobroker/gui-components';

type StateQuality = ioBroker.STATE_QUALITY[keyof ioBroker.STATE_QUALITY];
export type EditorType = 'states' | 'string' | 'number' | 'boolean' | 'json';
export type WriteBehavior = 'readonly' | 'expert-only' | 'file' | 'button' | 'switch' | 'dialog';
export interface ManualWritePolicy {
    getWriteBehavior(id: string, object: ioBroker.Object, item?: TreeItem, expertMode?: boolean): WriteBehavior;
    normalizeStates(states: unknown): Array<{ key: string; label: string }>;
    getBinaryOptions(object: ioBroker.Object): { off: ioBroker.StateValue; on: ioBroker.StateValue } | null;
    getDirectWriteValue(
        id: string,
        object: ioBroker.Object,
        item: TreeItem,
        value: unknown,
        behavior: WriteBehavior,
    ): ioBroker.StateValue;
    resolveDirectWriteValue(
        socket: Connection,
        id: string,
        object: ioBroker.Object,
        item: TreeItem,
        value: unknown,
        behavior: WriteBehavior,
    ): Promise<ioBroker.StateValue>;
    prepareEditor(object: ioBroker.Object, value: unknown): { editorType: EditorType; value: ioBroker.StateValue };
    parseEditorValue(object: ioBroker.Object, type: EditorType, value: unknown): ioBroker.StateValue;
    writeManualState(socket: Connection, id: string, value: ioBroker.StateValue): Promise<void>;
    toBoolean(value: unknown): boolean;
}

export function getManualWritePolicy(): ManualWritePolicy {
    const policy = (window as Window & { NEXOWATT_EOS_MANUAL_WRITE_POLICY?: ManualWritePolicy })
        .NEXOWATT_EOS_MANUAL_WRITE_POLICY;
    if (
        !policy ||
        [
            'getWriteBehavior',
            'normalizeStates',
            'getBinaryOptions',
            'getDirectWriteValue',
            'resolveDirectWriteValue',
            'prepareEditor',
            'parseEditorValue',
            'writeManualState',
            'toBoolean',
        ].some(key => typeof Reflect.get(policy, key) !== 'function')
    ) {
        throw new Error('EOS manual write policy is unavailable; writing is disabled');
    }
    return policy;
}

export function eosWriteBehavior(browser: ObjectBrowserClass, id: string, item?: TreeItem): WriteBehavior {
    const object = browser.objects[id];
    if (
        !object ||
        object.type !== 'state' ||
        object.common.write === false ||
        browser.props.notEditable ||
        (browser.props as typeof browser.props & { enableStateValueEdit?: boolean }).enableStateValueEdit === false
    ) {
        return 'readonly';
    }
    try {
        return getManualWritePolicy().getWriteBehavior(id, object, item, browser.state.filter.expertMode);
    } catch {
        return 'readonly';
    }
}

export function eosCanEditValue(browser: ObjectBrowserClass, id: string, item?: TreeItem): boolean {
    const behavior = eosWriteBehavior(browser, id, item);
    return behavior === 'button' || behavior === 'switch' || behavior === 'dialog';
}

export function eosOpenValue(browser: ObjectBrowserClass, id: string, item?: TreeItem): void {
    const object = browser.objects[id];
    if (object?.type === 'state' && String(object.common.type) === 'file' && browser.props.objectBrowserViewFile) {
        browser.setState({ viewFileDialog: id });
        return;
    }
    if (!object || !eosCanEditValue(browser, id, item)) {
        return;
    }
    browser.edit = { id, val: browser.states[id]?.val ?? object.common.def ?? null, ack: false, q: 0 };
    browser.setState({ updateOpened: true });
}

function updateVisibleValue(
    browser: ObjectBrowserClass,
    id: string,
    value: ioBroker.StateValue,
    ack: boolean,
    q: StateQuality,
): void {
    const now = Date.now();
    const previous = browser.states[id];
    // A missing state has no authenticated source metadata; wait for its real subscription update.
    if (previous) {
        browser.states[id] = {
            ...previous,
            val: value,
            ack,
            q,
            ts: now,
            lc: previous.val === value ? previous.lc : now,
        };
    }
    // Admin 8 caches formatted rows; invalidate both the tree value and row cache after a confirmed write.
    const invalidate = (item: TreeItem): void => {
        if (item.data.id === id) {
            delete item.data.state;
        }
        item.children?.forEach(invalidate);
    };
    if (browser.root) {
        invalidate(browser.root);
    }
    browser.forceUpdate();
}

export async function eosUpdateValue(
    browser: ObjectBrowserClass,
    value: { val: ioBroker.StateValue; ack: boolean; q?: StateQuality; expire?: number },
): Promise<void> {
    const id = browser.edit.id;
    if (!eosCanEditValue(browser, id)) {
        throw new Error('State writing is not permitted');
    }
    const q = value.q || 0;
    if (value.ack === false && q === 0 && !value.expire) {
        await getManualWritePolicy().writeManualState(browser.props.socket, id, value.val);
    } else {
        await browser.props.socket.setState(id, {
            val: value.val,
            ack: value.ack,
            q,
            ...(value.expire ? { expire: value.expire } : {}),
        });
    }
    updateVisibleValue(browser, id, value.val, value.ack, q);
}

function openStateUrl(browser: ObjectBrowserClass, id: string): void {
    const value = browser.states[id]?.val;
    if (typeof value !== 'string') {
        return;
    }
    let url: URL;
    try {
        url = new URL(value, window.location.href);
    } catch {
        return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
    }
    if (browser.objects[id]?.common.role === 'url.self') {
        window.location.assign(url.href);
    } else {
        window.open(url.href, '_blank', 'noopener,noreferrer');
    }
}

export function eosValueCellProps(
    browser: ObjectBrowserClass,
    id: string,
    item: TreeItem,
): React.HTMLAttributes<HTMLDivElement> & {
    'data-eos-object-value-cell': string;
    'data-eos-object-writable': string;
    'data-eos-object-editable': string;
    'data-eos-object-direct-control': string;
    'data-eos-direct-control': string;
} {
    const behavior = eosWriteBehavior(browser, id, item);
    const writable = eosCanEditValue(browser, id, item);
    const file =
        item.data.obj?.type === 'state' &&
        String(item.data.obj.common.type) === 'file' &&
        !!browser.props.objectBrowserViewFile;
    const interactive = writable || file;
    return {
        'data-eos-object-value-cell': id,
        'data-eos-object-writable': writable ? '1' : '0',
        'data-eos-object-editable': behavior === 'dialog' ? '1' : '0',
        'data-eos-direct-control': behavior === 'button' || behavior === 'switch' ? '1' : '0',
        'data-eos-object-direct-control': behavior === 'button' || behavior === 'switch' ? '1' : '0',
        className: 'eos-object-value-cell',
        ...(interactive ? { tabIndex: 0, role: 'button' } : {}),
        onMouseDown: event => {
            if (interactive) {
                event.stopPropagation();
            }
        },
        onDoubleClick: event => {
            if (interactive) {
                event.stopPropagation();
            }
        },
        onKeyDown: event => {
            if (interactive && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.click();
            }
        },
        onClick: async event => {
            if (event.target instanceof Element && event.target.closest('.copyButton')) {
                return;
            }
            if (interactive) {
                event.stopPropagation();
            }
            if (file) {
                eosOpenValue(browser, id, item);
                return;
            }
            const role = browser.objects[id]?.common.role;
            if (
                (item.data.url && event.ctrlKey) ||
                (!writable && (role === 'url' || (event.ctrlKey && (role === 'url.blank' || role === 'url.self'))))
            ) {
                openStateUrl(browser, id);
                return;
            }
            if (!eosCanEditValue(browser, id, item)) {
                return;
            }
            const currentBehavior = eosWriteBehavior(browser, id, item);
            if (currentBehavior !== 'button' && currentBehavior !== 'switch') {
                eosOpenValue(browser, id, item);
                return;
            }
            event.preventDefault();
            try {
                const policy = getManualWritePolicy();
                const object = browser.objects[id];
                if (!object) {
                    return;
                }
                const value = await policy.resolveDirectWriteValue(
                    browser.props.socket,
                    id,
                    object,
                    item,
                    browser.states[id]?.val,
                    currentBehavior,
                );
                // Recheck after the awaited state read: permissions or expert mode may have changed.
                if (!eosCanEditValue(browser, id, item)) {
                    return;
                }
                await policy.writeManualState(browser.props.socket, id, value);
                if (currentBehavior === 'switch') {
                    updateVisibleValue(browser, id, value, false, 0);
                }
            } catch (error) {
                browser.showError(
                    `Cannot write state "${id}": ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        },
    };
}

export function eosSwitchChecked(object: ioBroker.Object, value: unknown): boolean {
    const on = getManualWritePolicy().getBinaryOptions(object)?.on;
    // Policy values are normalized to the declared state type. Preserve encoded false/true values.
    if (typeof on === 'boolean') {
        return getManualWritePolicy().toBoolean(value) === on;
    }
    if (typeof on === 'number') {
        return typeof value === 'number'
            ? value === on
            : typeof value === 'string' && Number(value.replace(',', '.')) === on;
    }
    return String(value) === String(on);
}

export function eosEditorStates(
    object: ioBroker.Object,
    supplied: Record<string, string> | null,
): Record<string, string> | null {
    if (supplied && !Array.isArray(supplied) && Object.keys(supplied).length) {
        return supplied;
    }
    const options = getManualWritePolicy().normalizeStates(object.common.states);
    return options.length ? Object.fromEntries(options.map(option => [option.key, option.label])) : null;
}
