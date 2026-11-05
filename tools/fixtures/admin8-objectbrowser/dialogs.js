/**
 * Copyright 2020-2026, Denis Haev <dogafox@gmail.com>
 *
 * MIT License
 *
 * Part of the object browser, see ./ObjectBrowserClass.tsx
 */
import React from 'react';
import { Utils } from '../Utils';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Fab, FormControlLabel, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, Switch, TextField, Tooltip, } from '@mui/material';
import { Check as IconCheck, Close as IconClose } from '@mui/icons-material';
import { IconExpert } from '../../icons/IconExpert';
import { getCustomValue, getName, getSelectIdIconFromObjects, onCtrlEnter } from './utils';
import { styles } from './styles';
import { DEFAULT_DATE_FORMAT } from './constants';
/**
 * Renders the error dialog.
 */
export function renderErrorDialog(that) {
    return that.state.error ? (React.createElement(Dialog, { open: !0, maxWidth: "sm", fullWidth: true, onClose: () => that.setState({ error: '' }), "aria-labelledby": "error-dialog-title", "aria-describedby": "error-dialog-description" },
        React.createElement(DialogTitle, { id: "alert-dialog-title" }, that.props.t('ra_Error')),
        React.createElement(DialogContent, null,
            React.createElement(DialogContentText, { id: "alert-dialog-description" }, that.state.error)),
        React.createElement(DialogActions, null,
            React.createElement(Button, { variant: "contained", onClick: () => that.setState({ error: '' }), color: "primary", autoFocus: true, startIcon: React.createElement(IconCheck, null) }, that.props.t('ra_Ok'))))) : null;
}
export function _renderDefinedList(that, isLast) {
    const cols = [...that.possibleCols];
    cols.unshift('id');
    if (that.props.columns && !that.props.columns.includes('buttons')) {
        const pos = cols.indexOf('buttons');
        if (pos !== -1) {
            cols.splice(pos, 1);
        }
    }
    return cols
        .filter(id => (isLast && (id === 'val' || id === 'buttons')) || (!isLast && id !== 'val' && id !== 'buttons'))
        .map(id => (React.createElement(ListItemButton, { onClick: () => {
            if (!that.state.columnsAuto && id !== 'id') {
                const columns = [...(that.state.columns || [])];
                const pos = columns.indexOf(id);
                if (pos === -1) {
                    columns.push(id);
                    columns.sort();
                }
                else {
                    columns.splice(pos, 1);
                }
                that.localStorage.setItem(`${that.props.dialogName || 'App'}.columns`, JSON.stringify(columns));
                that.calculateColumnsVisibility(null, columns);
                that.setState({ columns });
            }
        }, key: id },
        React.createElement(Checkbox, { edge: "start", disabled: id === 'id' || that.state.columnsAuto, checked: id === 'id' ||
                !!(that.state.columnsAuto ? that.visibleCols.includes(id) : that.state.columns?.includes(id)), disableRipple: true }),
        React.createElement(ListItemText, { primary: that.texts[`filter_${id}`] || that.props.t(`ra_${id}`) }))));
}
/**
 * Renders the columns' selector.
 */
export function renderColumnsSelectorDialog(that) {
    if (!that.state.columnsSelectorShow) {
        return null;
    }
    return (React.createElement(Dialog, { onClose: () => that.setState({ columnsSelectorShow: false }), open: !0, sx: {
            '& .MuiPaper-root': Utils.getStyle(that.props.theme, styles.dialogColumns, styles[`transparent_${that.state.columnsDialogTransparent}`]),
        } },
        React.createElement(DialogTitle, { sx: styles.fontSizeTitle }, that.props.t('ra_Configure')),
        React.createElement(DialogContent, { sx: styles.fontSizeTitle },
            React.createElement(FormControlLabel, { style: styles.switchColumnAuto, control: React.createElement(Switch, { checked: that.state.foldersFirst, onChange: () => {
                        that.localStorage.setItem(`${that.props.dialogName || 'App'}.foldersFirst`, that.state.foldersFirst ? 'false' : 'true');
                        that.setState({ foldersFirst: !that.state.foldersFirst });
                    } }), label: that.props.t('ra_Folders always first') }),
            React.createElement(FormControlLabel, { style: styles.switchColumnAuto, control: React.createElement(Switch, { checked: that.state.linesEnabled, onChange: () => {
                        that.localStorage.setItem(`${that.props.dialogName || 'App'}.lines`, that.state.linesEnabled ? 'false' : 'true');
                        that.setState({ linesEnabled: !that.state.linesEnabled });
                    } }), label: that.props.t('ra_Show lines between rows') }),
            React.createElement(FormControlLabel, { style: styles.switchColumnAuto, control: React.createElement(Switch, { checked: that.state.columnsAuto, onChange: () => {
                        that.localStorage.setItem(`${that.props.dialogName || 'App'}.columnsAuto`, that.state.columnsAuto ? 'false' : 'true');
                        if (!that.state.columnsAuto) {
                            that.calculateColumnsVisibility(true);
                            that.setState({ columnsAuto: true });
                        }
                        else if (!that.state.columns) {
                            // The columns that are visible now become the manual selection.
                            // Without storing them, the selection would be empty after a
                            // reload and the table would show nothing but the ID column.
                            const columns = [...that.visibleCols];
                            that.localStorage.setItem(`${that.props.dialogName || 'App'}.columns`, JSON.stringify(columns));
                            that.calculateColumnsVisibility(false, columns);
                            that.setState({ columnsAuto: false, columns });
                        }
                        else {
                            that.calculateColumnsVisibility(false);
                            that.setState({ columnsAuto: false });
                        }
                    } }), label: that.props.t('ra_Auto (no custom columns)') }),
            React.createElement(List, null,
                _renderDefinedList(that, false),
                that.state.columnsForAdmin &&
                    Object.keys(that.state.columnsForAdmin)
                        .sort()
                        .map(adapter => that.state.columnsForAdmin?.[adapter].map(column => (React.createElement(ListItemButton, { onClick: () => {
                            if (!that.state.columnsAuto) {
                                const columns = [...(that.state.columns || [])];
                                const id = `_${adapter}_${column.path}`;
                                const pos = columns.indexOf(id);
                                if (pos === -1) {
                                    columns.push(id);
                                    columns.sort();
                                }
                                else {
                                    columns.splice(pos, 1);
                                }
                                that.calculateColumnsVisibility(null, columns);
                                that.localStorage.setItem(`${that.props.dialogName || 'App'}.columns`, JSON.stringify(columns));
                                that.setState({ columns });
                            }
                        }, key: `${adapter}_${column.name}` },
                        React.createElement(ListItemIcon, null,
                            React.createElement(Checkbox, { disabled: that.state.columnsAuto, edge: "start", checked: !that.state.columnsAuto &&
                                    that.state.columns?.includes(`_${adapter}_${column.path}`), disableRipple: true })),
                        React.createElement(ListItemText, { primary: `${column.name} (${adapter})` }))))),
                _renderDefinedList(that, true))),
        React.createElement(DialogActions, null,
            React.createElement(Button, { variant: "contained", onClick: () => that.setState({ columnsSelectorShow: false }), color: "primary", startIcon: React.createElement(IconClose, null) }, that.texts.close))));
}
export function renderExportDialog(that) {
    if (that.state.showExportDialog === false) {
        return null;
    }
    /** The "Only selected" button and CTRL+ENTER end up here */
    const onExportSelected = () => that.setState({ showExportDialog: false, showAllExportOptions: false }, () => that._exportObjects({
        isAll: false,
        noStatesByExportImport: that.state.noStatesByExportImport,
        beautify: that.state.beautifyJsonExport,
        excludeSystemRepositories: that.state.excludeSystemRepositoriesFromExport,
        excludeTranslations: that.state.excludeTranslations,
    }));
    return (React.createElement(Dialog, { open: !0, maxWidth: "lg", onKeyDown: e => onCtrlEnter(e, onExportSelected) },
        React.createElement(DialogTitle, null, that.props.t('ra_Select type of export')),
        React.createElement(DialogContent, null,
            React.createElement(DialogContentText, null, that.state.filter.expertMode || that.state.showAllExportOptions ? (React.createElement(React.Fragment, null,
                that.props.t('ra_You can export all objects or just the selected branch.'),
                React.createElement("br", null),
                that.props.t('ra_Selected %s object(s)', that.state.showExportDialog),
                React.createElement("br", null),
                React.createElement(FormControlLabel, { control: React.createElement(Checkbox, { checked: that.state.noStatesByExportImport, onChange: e => that.setState({ noStatesByExportImport: e.target.checked }) }), label: that.props.t('ra_Do not export values of states') }),
                React.createElement("br", null),
                that.props.t('These options can reduce the size of the export file:'),
                React.createElement(FormControlLabel, { control: React.createElement(Checkbox, { checked: that.state.beautifyJsonExport, onChange: e => that.setState({ beautifyJsonExport: e.target.checked }) }), label: that.props.t('Beautify JSON output') }),
                React.createElement("br", null),
                React.createElement(FormControlLabel, { control: React.createElement(Checkbox, { checked: that.state.excludeSystemRepositoriesFromExport, onChange: e => that.setState({ excludeSystemRepositoriesFromExport: e.target.checked }) }), label: that.props.t('Exclude system repositories from export JSON') }),
                React.createElement(FormControlLabel, { control: React.createElement(Checkbox, { checked: that.state.excludeTranslations, onChange: e => that.setState({ excludeTranslations: e.target.checked }) }), label: that.props.t('Exclude translations (except english) from export JSON') }))) : null)),
        React.createElement(DialogActions, null,
            that.state.filter.expertMode || that.state.showAllExportOptions ? (React.createElement(Button, { color: "grey", variant: "outlined", onClick: () => that.setState({ showExportDialog: false, showAllExportOptions: false }, () => that._exportObjects({
                    isAll: true,
                    noStatesByExportImport: that.state.noStatesByExportImport,
                    beautify: that.state.beautifyJsonExport,
                    excludeSystemRepositories: that.state.excludeSystemRepositoriesFromExport,
                    excludeTranslations: that.state.excludeTranslations,
                })) },
                React.createElement("span", { style: { marginRight: 8 } }, that.props.t('ra_All objects')),
                "(",
                Object.keys(that.objects).length,
                ")")) : (React.createElement(Button, { color: "grey", variant: "outlined", startIcon: React.createElement(IconExpert, null), onClick: () => that.setState({ showAllExportOptions: true }) }, that.props.t('ra_Advanced options'))),
            React.createElement(Tooltip, { title: that.props.t('ra_Press CTRL+ENTER to confirm') },
                React.createElement(Button, { color: "primary", variant: "contained", autoFocus: true, onClick: onExportSelected },
                    React.createElement("span", { style: { marginRight: 8 } }, that.props.t('ra_Only selected')),
                    "(",
                    that.state.showExportDialog,
                    ")")),
            React.createElement(Button, { color: "grey", variant: "contained", onClick: () => that.setState({ showExportDialog: false, showAllExportOptions: false }), startIcon: React.createElement(IconClose, null) }, that.props.t('ra_Cancel')))));
}
export function renderRenameDialog(that) {
    if (!that.state.showRenameDialog) {
        return null;
    }
    const ObjectMoveRenameDialog = that.props.objectMoveRenameDialog;
    return (React.createElement(ObjectMoveRenameDialog, { expertMode: !!that.props.expertMode, onClose: () => that.setState({ showRenameDialog: null }), id: that.state.showRenameDialog.id, childrenIds: that.state.showRenameDialog.childrenIds, theme: that.props.theme, socket: that.props.socket, t: that.props.t, objectType: that.objects[that.state.showRenameDialog.id]?.type }));
}
/**
 * The dialog that changes `common.name` of an object.
 *
 * It writes nothing but the name, so it needs neither the expert mode nor the big "Edit object"
 * dialog, where the name used to be hidden.
 *
 * A name that is translated stays translated: only the language of the GUI is written and everything
 * the adapter delivered in the other languages is kept.
 */
export function renderNameDialog(that) {
    if (!that.state.showNameDialog) {
        return null;
    }
    const { id, originalName, name } = that.state.showNameDialog;
    const changed = name !== originalName;
    const onApply = () => {
        if (!changed) {
            return;
        }
        that.setState({ showNameDialog: null }, () => void that.setObjectName(id, name));
    };
    const currentName = that.objects[id]?.common?.name;
    const otherLanguages = currentName && typeof currentName === 'object'
        ? Object.keys(currentName).filter(language => language !== that.props.lang && currentName[language])
        : [];
    return (React.createElement(Dialog, { key: "nameDialog", open: !0, maxWidth: "sm", fullWidth: true, onClose: () => that.setState({ showNameDialog: null }), onKeyDown: e => onCtrlEnter(e, onApply), "aria-labelledby": "name-dialog-title" },
        React.createElement(DialogTitle, { id: "name-dialog-title" }, that.props.t('ra_Edit name')),
        React.createElement(DialogContent, null,
            React.createElement(TextField, { variant: "standard", fullWidth: true, autoFocus: true, label: that.texts.name, value: name, helperText: otherLanguages.length
                    ? that.props.t('ra_The name in %s stays unchanged', otherLanguages.join(', '))
                    : id, onChange: e => that.setState({ showNameDialog: { id, originalName, name: e.target.value } }), slotProps: {
                    input: {
                        endAdornment: name ? (React.createElement(IconButton, { size: "small", onClick: () => that.setState({ showNameDialog: { id, originalName, name: '' } }) },
                            React.createElement(IconClose, null))) : null,
                    },
                } })),
        React.createElement(DialogActions, null,
            React.createElement(Tooltip, { title: that.props.t('ra_Press CTRL+ENTER to confirm') },
                React.createElement("span", null,
                    React.createElement(Button, { variant: "contained", color: "primary", disabled: !changed, onClick: onApply, startIcon: React.createElement(IconCheck, null) }, that.props.t('ra_Save')))),
            React.createElement(Button, { variant: "contained", color: "grey", onClick: () => that.setState({ showNameDialog: null }), startIcon: React.createElement(IconClose, null) }, that.props.t('ra_Cancel')))));
}
export function renderInputJsonDialog(that) {
    if (!that.state.showImportDialog) {
        return null;
    }
    const ObjectBrowserInsertJsonObjects = that.props.objectBrowserInsertJsonObjects;
    return (React.createElement(ObjectBrowserInsertJsonObjects, { onClose: (text) => {
            that.setState({ showImportDialog: false });
            if (text) {
                void that.parseJsonFile(text);
            }
        }, themeName: that.props.themeName, themeType: that.props.themeType, t: that.props.t }));
}
export function renderEnumDialog(that) {
    if (!that.state.enumDialog) {
        return null;
    }
    const type = that.state.enumDialog.type;
    const item = that.state.enumDialog.item;
    const itemEnums = that.state.enumDialogEnums;
    const enumsOriginal = that.state.enumDialog.enumsOriginal;
    const enums = (type === 'room' ? that.info.roomEnums : that.info.funcEnums)
        .map(id => ({
        name: getName(that.objects[id]?.common?.name || id.split('.').pop() || '', that.props.lang),
        value: id,
        icon: getSelectIdIconFromObjects(that.objects, id, that.props.lang, that.imagePrefix),
    }))
        .sort((a, b) => (a.name > b.name ? 1 : -1));
    enums.forEach(_item => {
        if (_item.icon && typeof _item.icon === 'string') {
            _item.icon = (React.createElement(Box, { style: styles.enumIconDiv },
                React.createElement("img", { src: _item.icon, style: styles.enumIcon, alt: _item.name })));
        }
    });
    // const hasIcons = !!enums.find(item => item.icon);
    /** The button in the title and CTRL+ENTER end up here */
    const onApplyEnums = () => {
        if (enumsOriginal !== JSON.stringify(itemEnums)) {
            void that
                .syncEnum(item.data.id, type, itemEnums)
                .then(() => that.setState({ enumDialog: null, enumDialogEnums: null }));
        }
    };
    return (React.createElement(Dialog, { sx: { '& .MuiPaper-root': styles.enumDialog }, onClose: () => that.setState({ enumDialog: null }), onKeyDown: e => onCtrlEnter(e, onApplyEnums), "aria-labelledby": "enum-dialog-title", open: !0 },
        React.createElement(DialogTitle, { id: "enum-dialog-title", style: {
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                flexWrap: 'nowrap',
                gap: 8,
                paddingRight: 12,
            } },
            type === 'func' ? that.props.t('ra_Define functions') : that.props.t('ra_Define rooms'),
            React.createElement(Tooltip, { title: that.props.t('ra_Press CTRL+ENTER to confirm') },
                React.createElement("span", null,
                    React.createElement(Fab, { color: "primary", disabled: enumsOriginal === JSON.stringify(itemEnums), size: "small", onClick: onApplyEnums },
                        React.createElement(IconCheck, null))))),
        React.createElement(List, { sx: { '&.MuiList-root': styles.enumList } }, enums.map(_item => {
            let id;
            let name;
            let icon;
            if (typeof _item === 'object') {
                id = _item.value;
                name = _item.name;
                icon = _item.icon;
            }
            else {
                id = _item;
                name = _item;
            }
            const labelId = `checkbox-list-label-${id}`;
            return (React.createElement(ListItem, { sx: styles.headerCellSelectItem, key: id, onClick: () => {
                    const pos = itemEnums.indexOf(id);
                    const enumDialogEnums = JSON.parse(JSON.stringify(that.state.enumDialogEnums));
                    if (pos === -1) {
                        enumDialogEnums.push(id);
                        enumDialogEnums.sort();
                    }
                    else {
                        enumDialogEnums.splice(pos, 1);
                    }
                    that.setState({ enumDialogEnums });
                }, secondaryAction: icon },
                React.createElement(ListItemIcon, { sx: { '&.MuiListItemIcon-root': styles.enumCheckbox } },
                    React.createElement(Checkbox, { edge: "start", checked: itemEnums.includes(id), tabIndex: -1, disableRipple: true, slotProps: {
                            input: { 'aria-labelledby': labelId },
                        } })),
                React.createElement(ListItemText, { id: labelId }, name)));
        }))));
}
export function renderEditRoleDialog(that) {
    if (!that.state.roleDialog || !that.props.objectBrowserEditRole) {
        return null;
    }
    if (that.state.roleDialog && that.props.objectBrowserEditRole) {
        const ObjectBrowserEditRole = that.props.objectBrowserEditRole;
        return (React.createElement(ObjectBrowserEditRole, { key: "objectBrowserEditRole", id: that.state.roleDialog, socket: that.props.socket, t: that.props.t, roleArray: that.info.roles, commonType: that.info.objects[that.state.roleDialog]?.common?.type, onClose: (obj) => {
                if (obj && that.state.roleDialog) {
                    that.info.objects[that.state.roleDialog] = obj;
                }
                that.setState({ roleDialog: null });
            } }));
    }
    return null;
}
export function renderColumnsEditCustomDialog(that) {
    if (!that.state.columnsEditCustomDialog) {
        return null;
    }
    if (!that.customColumnDialog) {
        const value = getCustomValue(that.state.columnsEditCustomDialog.obj, that.state.columnsEditCustomDialog.it);
        that.customColumnDialog = {
            type: (that.state.columnsEditCustomDialog.it.type || typeof value),
            initValue: (value === null || value === undefined ? '' : value).toString(),
            value: (value === null || value === undefined ? '' : value).toString(),
        };
    }
    return (React.createElement(Dialog, { onClose: () => that.setState({ columnsEditCustomDialog: null }), onKeyDown: e => onCtrlEnter(e, () => {
            if (that.state.customColumnDialogValueChanged) {
                that.onColumnsEditCustomDialogClose(true);
            }
        }), maxWidth: "md", "aria-labelledby": "custom-dialog-title", open: !0 },
        React.createElement(DialogTitle, { id: "custom-dialog-title" }, `${that.props.t('ra_Edit object field')}: ${that.state.columnsEditCustomDialog.obj._id}`),
        React.createElement(DialogContent, null,
            React.createElement(DialogContentText, { id: "alert-dialog-description" }, that.customColumnDialog.type === 'boolean' ? (React.createElement(FormControlLabel, { control: React.createElement(Checkbox, { onKeyUp: e => e.key === 'Enter' && that.onColumnsEditCustomDialogClose(true), defaultChecked: that.customColumnDialog.value === 'true', onChange: e => {
                        const customColumnDialog = that.customColumnDialog;
                        customColumnDialog.value = e.target.checked.toString();
                        const changed = customColumnDialog.value !== customColumnDialog.initValue;
                        if (changed === !that.state.customColumnDialogValueChanged) {
                            that.setState({ customColumnDialogValueChanged: changed });
                        }
                    } }), label: `${that.state.columnsEditCustomDialog.it.name} (${that.state.columnsEditCustomDialog.it.pathText})` })) : (React.createElement(TextField, { variant: "standard", defaultValue: that.customColumnDialog.value, fullWidth: true, onKeyUp: e => e.key === 'Enter' && that.onColumnsEditCustomDialogClose(true), label: `${that.state.columnsEditCustomDialog.it.name} (${that.state.columnsEditCustomDialog.it.pathText})`, onChange: e => {
                    const customColumnDialog = that.customColumnDialog;
                    customColumnDialog.value = e.target.value;
                    const changed = customColumnDialog.value !== customColumnDialog.initValue;
                    if (changed === !that.state.customColumnDialogValueChanged) {
                        that.setState({ customColumnDialogValueChanged: changed });
                    }
                }, autoFocus: true })))),
        React.createElement(DialogActions, null,
            React.createElement(Tooltip, { title: that.props.t('ra_Press CTRL+ENTER to confirm') },
                React.createElement("span", null,
                    React.createElement(Button, { variant: "contained", onClick: () => that.onColumnsEditCustomDialogClose(true), disabled: !that.state.customColumnDialogValueChanged, color: "primary", startIcon: React.createElement(IconCheck, null) }, that.props.t('ra_Update')))),
            React.createElement(Button, { color: "grey", variant: "contained", onClick: () => that.onColumnsEditCustomDialogClose(), startIcon: React.createElement(IconClose, null) }, that.props.t('ra_Cancel')))));
}
export function renderToast(that) {
    return (React.createElement(Snackbar, { open: !!that.state.toast, autoHideDuration: 3000, onClick: () => that.setState({ toast: '' }), onClose: () => that.setState({ toast: '' }), message: that.state.toast, action: React.createElement(IconButton, { size: "small", "aria-label": "close", color: "inherit", onClick: () => that.setState({ toast: '' }) },
            React.createElement(IconClose, { fontSize: "small" })) }));
}
export function renderCustomDialog(that) {
    if (that.state.customDialog && that.props.objectCustomDialog && that.systemConfig) {
        const ObjectCustomDialog = that.props.objectCustomDialog;
        return (React.createElement(ObjectCustomDialog, { reportChangedIds: (changedIds) => (that.changedIds = [...changedIds]), objectIDs: that.state.customDialog, allVisibleObjects: !!that.state.customDialogAll, expertMode: that.state.filter.expertMode, isFloatComma: that.props.isFloatComma === undefined
                ? (that.systemConfig?.common.isFloatComma ?? true)
                : that.props.isFloatComma, t: that.props.t, lang: that.props.lang, socket: that.props.socket, themeName: that.props.themeName, themeType: that.props.themeType, theme: that.props.theme, objects: that.objects, customsInstances: that.info.customs, onClose: () => {
                that.pauseSubscribe(false);
                that.setState({ customDialog: null });
                if (that.changedIds) {
                    that.changedIds = null;
                    // update all changed IDs
                    that.forceUpdate();
                }
                that.props.router?.doNavigate('tab-objects');
            }, systemConfig: that.systemConfig }));
    }
    return null;
}
export function renderEditObjectDialog(that) {
    if (!that.state.editObjectDialog || !that.props.objectBrowserEditObject) {
        return null;
    }
    // Guard against opening the editor for a node without a real object (e.g. a virtual folder
    // that only exists because child states share an ID prefix). Its constructor reads obj._id.
    if (!that.objects[that.state.editObjectDialog]) {
        return null;
    }
    const ObjectBrowserEditObject = that.props.objectBrowserEditObject;
    return (React.createElement(ObjectBrowserEditObject, { key: that.state.editObjectDialog, obj: that.objects[that.state.editObjectDialog], roleArray: that.info.roles, objects: that.objects, dateFormat: that.props.dateFormat || that.systemConfig?.common.dateFormat || DEFAULT_DATE_FORMAT, isFloatComma: that.props.isFloatComma === undefined
            ? (that.systemConfig?.common.isFloatComma ?? true)
            : that.props.isFloatComma, themeType: that.props.themeType, theme: that.props.theme, socket: that.props.socket, dialogName: that.props.dialogName, aliasTab: that.state.editObjectAlias, t: that.props.t, expertMode: !!that.state.filter.expertMode, onNewObject: (obj) => that.props.socket
            .setObject(obj._id, obj)
            .then(() => that.setState({ editObjectDialog: obj._id, editObjectAlias: false }, () => that.onSelect(obj._id)))
            .catch(e => that.showError(`Cannot write object: ${e}`)), onClose: (obj) => {
            if (obj) {
                let updateAlias;
                if (that.state.editObjectDialog.startsWith('alias.')) {
                    if (JSON.stringify(that.objects[that.state.editObjectDialog].common?.alias) !==
                        JSON.stringify(obj.common?.alias)) {
                        updateAlias = that.state.editObjectDialog;
                    }
                }
                that.props.socket
                    .setObject(obj._id, obj)
                    .then(() => {
                    if (updateAlias && that.subscribes.has(updateAlias)) {
                        that.unsubscribe(updateAlias);
                        setTimeout(() => that.subscribe(updateAlias), 100);
                    }
                })
                    .catch(e => that.showError(`Cannot write object: ${e}`));
            }
            that.setState({ editObjectDialog: '', editObjectAlias: false });
        }, width: that.width }));
}
export function renderViewObjectFileDialog(that) {
    if (!that.state.viewFileDialog || !that.props.objectBrowserViewFile) {
        return null;
    }
    const ObjectBrowserViewFile = that.props.objectBrowserViewFile;
    return (React.createElement(ObjectBrowserViewFile, { key: "viewFile", obj: that.objects[that.state.viewFileDialog], socket: that.props.socket, t: that.props.t, onClose: () => that.setState({ viewFileDialog: '' }) }));
}
export function renderAliasEditorDialog(that) {
    if (!that.props.objectBrowserAliasEditor || !that.state.showAliasEditor) {
        return null;
    }
    const ObjectBrowserAliasEditor = that.props.objectBrowserAliasEditor;
    return (React.createElement(ObjectBrowserAliasEditor, { key: "editAlias", obj: that.objects[that.state.showAliasEditor], roleArray: that.info.roles, objects: that.objects, socket: that.props.socket, t: that.props.t, onClose: () => that.setState({ showAliasEditor: '' }), onRedirect: (id, timeout) => setTimeout(() => that.onSelect(id, false, () => that.expandAllSelected(() => {
            that.scrollToItem(id);
            setTimeout(() => that.setState({
                editObjectDialog: id,
                showAliasEditor: '',
                editObjectAlias: true,
            }), 300);
        })), timeout || 0) }));
}
export function renderAliasMenu(that) {
    if (!that.state.aliasMenu) {
        return null;
    }
    return (React.createElement(Menu, { key: "aliasmenu", open: !0, anchorEl: window.document.getElementById(`alias_${that.state.aliasMenu}`), onClose: () => that.setState({ aliasMenu: '' }) }, that.info.aliasesMap[that.state.aliasMenu].map((aliasId, i) => (React.createElement(MenuItem, { key: aliasId, onClick: () => that.onSelect(aliasId) },
        React.createElement(ListItemText, null, that.renderAliasLink(that.state.aliasMenu, i, {
            '& .admin-browser-arrow': {
                mr: '8px',
            },
        })))))));
}
export function renderEditValueDialog(that) {
    if (!that.state.updateOpened || !that.props.objectBrowserValue) {
        return null;
    }
    if (!that.edit.id) {
        console.error(`Invalid ID for edit: ${JSON.stringify(that.edit)}`);
        return null;
    }
    if (!that.objects[that.edit.id]) {
        console.error(`Something went wrong. Possibly the object ${that.edit.id} was deleted.`);
        return null;
    }
    // The value editor only understands 'states' | 'string' | 'number' | 'boolean' | 'json'. Without
    // `common.type` the type was taken from the value - but a state that was never written has
    // `val === null`, and `typeof null` is "object". The editor then got a type it does not know and
    // showed nothing at all, so such a state could not be edited.
    const valueType = typeof that.edit.val;
    const type = that.objects[that.edit.id].common?.type ||
        (valueType === 'number' || valueType === 'boolean' ? valueType : 'string');
    const role = that.objects[that.edit.id].common.role;
    const ObjectBrowserValue = that.props.objectBrowserValue;
    return (React.createElement(ObjectBrowserValue, { t: that.props.t, lang: that.props.lang, type: type, role: role || '', states: Utils.getStates(that.objects[that.edit.id]), themeType: that.props.themeType, theme: that.props.theme, expertMode: !!that.state.filter.expertMode, value: that.edit.val, socket: that.props.socket, object: that.objects[that.edit.id], defaultHistory: that.defaultHistory, dateFormat: that.props.dateFormat || that.systemConfig?.common.dateFormat || DEFAULT_DATE_FORMAT, isFloatComma: that.props.isFloatComma === undefined
            ? (that.systemConfig?.common.isFloatComma ?? true)
            : that.props.isFloatComma, onClose: (res) => {
            that.setState({ updateOpened: false });
            if (res) {
                that.onUpdate(res);
            }
        }, width: that.width }));
}
//# sourceMappingURL=dialogs.js.map