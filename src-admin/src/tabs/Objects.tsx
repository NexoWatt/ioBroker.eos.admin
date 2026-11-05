import React, { Component, type JSX } from 'react';

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    Button,
    IconButton,
    Snackbar,
} from '@mui/material';

// icons
import { Cancel as IconCancel, Delete as IconDeleteOne } from '@mui/icons-material';

import {
    type AdminConnection,
    type IobTheme,
    type ThemeName,
    type ThemeType,
    type Translate,
    Router,
    ObjectBrowser,
    type ObjectBrowserClass,
    type ObjectBrowserFilter,
    type TreeItemData,
} from '@iobroker/gui-components';

import type { ObjectsWorker } from '@/Workers/ObjectsWorker';

import ObjectCustomDialog from '../components/Object/ObjectCustomDialog';
import ObjectBrowserValue from '../components/Object/ObjectBrowserValue';
import ObjectBrowserEditObject from '../components/Object/ObjectBrowserEditObject';
import ObjectBrowserEditRole from '../components/Object/ObjectBrowserEditRole';
import ObjectAddNewObject from '../components/Object/ObjectAddNewObject';
import ObjectEditOfAccessControl from '../components/Object/ObjectEditOfAccessControl';
import ObjectViewFileDialog from '../components/Object/ObjectViewFileDialog';
import ObjectAliasEditor from '../components/Object/ObjectAliasEditor';
import ObjectMoveRenameDialog from '../components/Object/ObjectMoveRenameDialog';
import { ObjectImportFromTextDialog } from '@/components/Object/ObjectImportFromText';

const IconDeleteAll = IconDeleteOne;
const styles: Record<string, React.CSSProperties> = {
    buttonIcon: {
        marginRight: 4,
    },
    buttonAll: {
        color: '#FF0000',
    },
    id: {
        fontStyle: 'italic',
    },
    buttonText: {
        whiteSpace: 'nowrap',
    },
};

/** Modes of the object browser in the URL (`#tab-objects/<mode>/<id>`). Other names there, e.g. "system", are dialogs of the App */
const OBJECT_BROWSER_MODES = ['select', 'edit', 'settings', 'view'];

type BrowserProps = React.ComponentProps<typeof ObjectBrowser>;

type ObjectsNavigation = { mode: 'select' | 'edit' | 'settings' | 'viewFile'; id: string };

interface ObjectsProps {
    t: Translate;
    lang: ioBroker.Languages;
    socket: AdminConnection;
    themeName: ThemeName;
    themeType: ThemeType;
    theme: IobTheme;
    expertMode: boolean;
    isFloatComma: boolean;
    dateFormat: string;
    objectsWorker: ObjectsWorker;
    statesOnly?: boolean;
    prefix?: string;
}

interface ObjectsState {
    selected: string;
    name: string;
    toast: string;
    deleteObjectShow: { id: string; hasChildren: boolean; exists: boolean; childrenCount: number } | null;
}

export default class Objects extends Component<ObjectsProps, ObjectsState> {
    private readonly dialogName: string;
    private filters: ObjectBrowserFilter;
    private readonly t: Translate;
    private readonly wordCache: Record<string, string>;
    /** The last navigation target from the URL, it is kept while a dialog of the App is open */
    private navigateTo: ObjectsNavigation | null = null;

    // GUI's public extension contract accepts a generic Connection. These
    // dialogs intentionally use the AdminConnection already owned by this tab.
    // Stable adapters preserve component identity and make each contract checked.
    private readonly customDialog: NonNullable<BrowserProps['objectCustomDialog']> = props => (
        <ObjectCustomDialog
            {...props}
            socket={this.props.socket}
        />
    );

    private readonly valueDialog: NonNullable<BrowserProps['objectBrowserValue']> = props => (
        <ObjectBrowserValue
            {...props}
            socket={this.props.socket}
            width={props.width ?? 'md'}
        />
    );

    private readonly editObjectDialog: NonNullable<BrowserProps['objectBrowserEditObject']> = props => (
        <ObjectBrowserEditObject
            {...props}
            socket={this.props.socket}
            width={props.width ?? 'md'}
        />
    );

    private readonly editRoleDialog: NonNullable<BrowserProps['objectBrowserEditRole']> = props => (
        <ObjectBrowserEditRole
            {...props}
            socket={this.props.socket}
        />
    );

    private readonly viewFileDialog: NonNullable<BrowserProps['objectBrowserViewFile']> = props => (
        <ObjectViewFileDialog
            {...props}
            socket={this.props.socket}
        />
    );

    private readonly aliasEditor: NonNullable<BrowserProps['objectBrowserAliasEditor']> = props => {
        if (props.obj.type !== 'state') {
            return (
                <Dialog
                    open
                    onClose={props.onClose}
                >
                    <DialogTitle>{this.t('Alias')}</DialogTitle>
                    <DialogContent>{this.t('Object is not a state')}</DialogContent>
                    <DialogActions>
                        <Button onClick={props.onClose}>{this.t('Close')}</Button>
                    </DialogActions>
                </Dialog>
            );
        }
        return (
            <ObjectAliasEditor
                {...props}
                obj={props.obj}
                socket={this.props.socket}
            />
        );
    };

    private static parseFilters(value: unknown): ObjectBrowserFilter {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        const result: ObjectBrowserFilter = {};
        const entries: [string, unknown][] = Object.entries(value);
        for (const [key, field] of entries) {
            if ((key === 'id' || key === 'name') && typeof field === 'string') {
                result[key] = field;
            }
            if (
                (key === 'room' || key === 'func' || key === 'role' || key === 'type' || key === 'custom') &&
                Array.isArray(field) &&
                field.every((item: unknown): item is string => typeof item === 'string')
            ) {
                result[key] = field;
            }
            if (key === 'expertMode' && typeof field === 'boolean') {
                result.expertMode = field;
            }
        }
        return result;
    }

    constructor(props: ObjectsProps) {
        super(props);

        this.dialogName = 'AdminObjects';

        const filtersStr: string =
            (window._localStorage || window.localStorage).getItem(`${this.dialogName || 'App'}.filters`) || '{}';

        try {
            this.filters = Objects.parseFilters(JSON.parse(filtersStr));
        } catch {
            this.filters = {};
        }

        const selected =
            (window._localStorage || window.localStorage).getItem(`${this.dialogName || 'App'}.selected`) || '';

        this.state = {
            selected,
            name: '',
            toast: '',
            deleteObjectShow: null,
            // suppressDeleteConfirm: false,
        };
        this.t = this.translate;
        this.wordCache = {};
    }

    /** The URL shows a dialog of the App (e.g., the system settings) and not a route of the object browser */
    private static isAppDialogOpen(): boolean {
        const dialog = Router.getLocation().dialog;
        return !!dialog && !OBJECT_BROWSER_MODES.includes(dialog);
    }

    translate: Translate = (word, ...args): string => {
        if (args.length) {
            return this.props.t(word, ...args);
        }

        if (!this.wordCache[word]) {
            this.wordCache[word] = this.props.t(word);
        }

        return this.wordCache[word];
    };

    onDelete(withChildren?: boolean): void {
        const id = this.state.deleteObjectShow?.id;
        if (!id) {
            return;
        }
        if (withChildren) {
            this.props.socket
                .delObjects(id, true)
                .then(() => this.setState({ toast: this.t('All deleted') }))
                .catch(e => window.alert(`Cannot delete object: ${e}`));

            this.setState({ deleteObjectShow: null });
        } else {
            this.props.socket.delObject(id, false).catch(e => window.alert(`Cannot delete object: ${e}`));
            this.setState({ deleteObjectShow: null });
        }
    }

    renderToast(): JSX.Element {
        return (
            <Snackbar
                key="toast"
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                open={!!this.state.toast}
                autoHideDuration={3000}
                onClose={() => this.setState({ toast: '' })}
                message={this.state.toast}
                action={
                    <IconButton
                        size="small"
                        aria-label="close"
                        color="inherit"
                        onClick={() => this.setState({ toast: '' })}
                    >
                        <IconCancel fontSize="small" />
                    </IconButton>
                }
            />
        );
    }

    renderDeleteDialog(): JSX.Element | null {
        if (!this.state.deleteObjectShow) {
            return null;
        }
        return (
            <Dialog
                key="delete"
                maxWidth="md"
                open={!0}
                onClose={() => this.setState({ deleteObjectShow: null })}
                aria-labelledby="delete-object-dialog-title"
                aria-describedby="delete-object-dialog-description"
            >
                <DialogTitle id="delete-object-dialog-title">
                    {this.state.deleteObjectShow.hasChildren ? this.t('Delete object(s)') : this.t('Delete object')}:{' '}
                    <span style={styles.id}>{this.state.deleteObjectShow.id}</span>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {this.t('Are you sure?')}
                        {/* <FormControlLabel
                            control={<Checkbox
                                checked={this.state.suppressDeleteConfirm}
                                onChange={() => {
                                    this.setState({suppressDeleteConfirm: true});

                                }}
                                name="checkedA" />
                            }
                            label="Secondary"
                        /> */}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    {this.state.deleteObjectShow.hasChildren ? (
                        <Button
                            variant="contained"
                            color="grey"
                            sx={{ '& .MuiButton-text': styles.buttonText }}
                            onClick={() => this.onDelete(true)}
                            startIcon={<IconDeleteAll style={styles.buttonAll} />}
                        >
                            {this.t('Delete with children', this.state.deleteObjectShow.childrenCount)}
                        </Button>
                    ) : null}
                    {this.state.deleteObjectShow.exists ? (
                        <Button
                            variant="contained"
                            sx={{ '& .MuiButton-text': styles.buttonText }}
                            onClick={() => this.onDelete(false)}
                            color="primary"
                            startIcon={<IconDeleteOne />}
                            autoFocus
                        >
                            {this.t('Delete one item')}
                        </Button>
                    ) : null}
                    <Button
                        variant="contained"
                        color="grey"
                        onClick={() => this.setState({ deleteObjectShow: null })}
                        startIcon={<IconCancel />}
                    >
                        {this.t('ra_Cancel')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    render(): (JSX.Element | null)[] {
        const eosRole = String(
            (window as Window & { NEXOWATT_EOS_ACCESS_ROLE?: string }).NEXOWATT_EOS_ACCESS_ROLE || 'unknown',
        ).toLowerCase();
        const readOnly = !['admin', 'service', 'installer'].includes(eosRole);

        // Derive the browser's navigation target from the URL hash `#tab-objects/<mode>/<id>`.
        // The ObjectBrowser stays URL-agnostic; we translate the route here and back (onNavigateTo).
        // A dialog of the App (e.g., the system settings) replaces the route of the browser in the URL.
        // Meanwhile, the last target is kept and nothing is reported, otherwise the browser would write
        // its selection back into the URL and close the dialog immediately.
        if (!Objects.isAppDialogOpen()) {
            const location = Router.getLocation();
            this.navigateTo =
                location.tab === 'tab-objects' && location.id
                    ? {
                          mode: (location.dialog === 'view'
                              ? 'viewFile'
                              : location.dialog || 'select') as ObjectsNavigation['mode'],
                          id: location.id,
                      }
                    : null;
        }
        const navigateTo = this.navigateTo;

        return [
            this.renderToast(),
            <ObjectBrowser
                key="browser"
                navigateTo={navigateTo}
                onNavigateTo={(nav: ObjectsNavigation | null) => {
                    if (Objects.isAppDialogOpen()) {
                        return;
                    }
                    if (!nav?.id) {
                        Router.doNavigate('tab-objects');
                    } else {
                        Router.doNavigate('tab-objects', nav.mode === 'viewFile' ? 'view' : nav.mode, nav.id);
                    }
                }}
                dialogName="admin"
                objectsWorker={this.props.objectsWorker}
                defaultFilters={this.filters}
                style={{ width: '100%', height: '100%' }}
                socket={this.props.socket}
                selected={navigateTo?.id || this.state.selected}
                expertMode={this.props.expertMode}
                isFloatComma={this.props.isFloatComma}
                dateFormat={this.props.dateFormat}
                t={this.t}
                lang={this.props.lang}
                themeName={this.props.themeName}
                themeType={this.props.themeType}
                theme={this.props.theme}
                objectCustomDialog={this.customDialog}
                objectBrowserValue={this.valueDialog}
                objectBrowserEditObject={this.editObjectDialog}
                objectBrowserEditRole={this.editRoleDialog}
                objectBrowserViewFile={this.viewFileDialog}
                objectBrowserAliasEditor={this.aliasEditor}
                objectMoveRenameDialog={ObjectMoveRenameDialog}
                objectBrowserInsertJsonObjects={ObjectImportFromTextDialog}
                router={Router}
                notEditable={readOnly}
                onObjectDelete={
                    readOnly
                        ? undefined
                        : (id: string, hasChildren: boolean, objectExists: boolean, childrenCount: number) =>
                              this.setState({
                                  deleteObjectShow: { id, hasChildren, exists: objectExists, childrenCount },
                              })
                }
                onFilterChanged={(filterConfig: ObjectBrowserFilter) => {
                    this.filters = filterConfig;
                    (window._localStorage || window.localStorage).setItem(
                        `${this.dialogName || 'App'}.filters`,
                        JSON.stringify(filterConfig),
                    );
                }}
                onSelect={(selected: string | string[]) => {
                    if (Array.isArray(selected)) {
                        (window._localStorage || window.localStorage).setItem(
                            `${this.dialogName || 'App'}.selected`,
                            selected[0] || '',
                        );
                    } else {
                        (window._localStorage || window.localStorage).setItem(
                            `${this.dialogName || 'App'}.selected`,
                            selected || '',
                        );
                    }
                }}
                objectEditBoolean={!readOnly}
                objectAddBoolean={!readOnly}
                objectStatesView
                objectImportExport={!readOnly}
                objectEditOfAccessControl={!readOnly}
                modalNewObject={(context: ObjectBrowserClass) => (
                    <ObjectAddNewObject
                        objects={context.objects}
                        expertMode={this.props.expertMode}
                        setObject={(id, data) =>
                            this.props.socket.setObject(id, data).catch(error => window.alert(error))
                        }
                        selected={context.state.modalNewObj?.id || ''}
                        initialType={context.state.modalNewObj?.initialType}
                        initialStateType={context.state.modalNewObj?.initialStateType}
                        onClose={() => context.setState({ modalNewObj: null })}
                        onApply={() => context.setState({ modalNewObj: null })}
                    />
                )}
                modalEditOfAccessControl={(context: ObjectBrowserClass, objData: TreeItemData) => (
                    <ObjectEditOfAccessControl
                        theme={this.props.theme}
                        themeType={this.props.themeType}
                        extendObject={(id: string, data: Partial<ioBroker.Object>): void => {
                            this.props.socket.extendObject(id, data).catch(error => window.alert(error));

                            objData.aclTooltip = undefined;
                        }}
                        selected={context.state.selected[0]}
                        // If an object is virtual, it has no obj attribute
                        modalEmptyId={objData.obj ? '' : objData.id}
                        objects={context.objects}
                        t={this.t}
                        onClose={() =>
                            context.setState({ modalEditOfAccess: false, modalEditOfAccessObjData: undefined })
                        }
                        onApply={() =>
                            context.setState({ modalEditOfAccess: false, modalEditOfAccessObjData: undefined })
                        }
                    />
                )}
            />,
            readOnly ? null : this.renderDeleteDialog(),
        ];
    }
}
