/**
 * Copyright 2020-2026, Denis Haev <dogafox@gmail.com>
 *
 * MIT License
 *
 * Part of the object browser, see ./ObjectBrowserClass.tsx
 */
import React from 'react';
import { Utils } from '../Utils';
import { Box, Checkbox, Grid, IconButton, Paper, Switch, Tooltip } from '@mui/material';
import { Delete as IconDelete, Edit as IconEdit, Error as IconError, Settings as IconConfig, Wifi as IconConnection, WifiOff as IconDisconnected, } from '@mui/icons-material';
import { IconCopy } from '../../icons/IconCopy';
import { IconDocument } from '../../icons/IconDocument';
import { IconDocumentReadOnly } from '../../icons/IconDocumentReadOnly';
import { IconClosed } from '../../icons/IconClosed';
import { IconOpen } from '../../icons/IconOpen';
import { Icon } from '../Icon';
import { ButtonIcon, colGrow, colWidth, binarySearch, findEnumsForObjectAsIds, findFunctionsForObject, findRoomsForObject, formatValue, getCustomValue, getIdFieldTooltip, getObjectTooltip, getValueStyle, isNonExpertId, COLOR_NAME_USERDATA, COLOR_NAME_ALIAS, COLOR_NAME_JAVASCRIPT, COLOR_NAME_SYSTEM, COLOR_NAME_SYSTEM_ADAPTER, ROW_HEIGHT, } from './utils';
import { styles } from './styles';
import { COLOR_NAME_CONNECTED_DARK, COLOR_NAME_CONNECTED_LIGHT, COLOR_NAME_DISCONNECTED_DARK, COLOR_NAME_DISCONNECTED_LIGHT, COLOR_NAME_ERROR_DARK, COLOR_NAME_ERROR_LIGHT, DEFAULT_DATE_FORMAT, ITEM_IMAGES, } from './constants';
export function renderTooltipAccessControl(that, acl) {
    // acl ={object,state,owner,ownerGroup}
    if (!acl) {
        return null;
    }
    const check = [
        {
            value: '0x400',
            valueNum: 0x400,
            title: 'read',
            group: 'Owner',
        },
        {
            value: '0x200',
            valueNum: 0x200,
            title: 'write',
            group: 'Owner',
        },
        {
            value: '0x40',
            valueNum: 0x40,
            title: 'read',
            group: 'Group',
        },
        {
            value: '0x20',
            valueNum: 0x20,
            title: 'write',
            group: 'Group',
        },
        {
            value: '0x4',
            valueNum: 0x4,
            title: 'read',
            group: 'Everyone',
        },
        {
            value: '0x2',
            valueNum: 0x2,
            title: 'write',
            group: 'Everyone',
        },
    ];
    const arrayTooltipText = [];
    const funcRenderStateObject = (value) => {
        const rights = acl[value];
        check.forEach((el, i) => {
            if (rights & el.valueNum) {
                arrayTooltipText.push(React.createElement("span", { key: value + i },
                    that.texts[`acl${el.group}_${el.title}_${value}`],
                    ",",
                    React.createElement("span", { style: value === 'object' ? styles.rightsObject : styles.rightsState }, el.value)));
            }
        });
    };
    arrayTooltipText.push(React.createElement("span", { key: "group" }, `${that.texts.ownerGroup}: ${(acl.ownerGroup || '').replace('system.group.', '')}`));
    arrayTooltipText.push(React.createElement("span", { key: "owner" }, `${that.texts.ownerUser}: ${(acl.owner || '').replace('system.user.', '')}`));
    funcRenderStateObject('object');
    if (acl.state) {
        funcRenderStateObject('state');
    }
    return arrayTooltipText.length ? (React.createElement("span", { style: styles.tooltipAccessControl }, arrayTooltipText.map(el => el))) : null;
}
export function renderColumnButtons(that, id, item) {
    if (!item.data.obj) {
        return that.props.onObjectDelete || that.props.objectEditOfAccessControl ? (React.createElement("div", { style: styles.buttonDiv },
            that.state.filter.expertMode && that.props.objectEditOfAccessControl ? (React.createElement(IconButton, { sx: {
                    ...styles.cellButtonsButton,
                    ...styles.cellButtonsEmptyButton,
                    ...styles.cellButtonMinWidth,
                }, onClick: () => that.setState({ modalEditOfAccess: true, modalEditOfAccessObjData: item.data }), size: "large" },
                React.createElement("div", { style: { height: 15 } }, "---"))) : null,
            that.props.onObjectDelete && item.children?.length && that.isDeleteAllowed(id) ? (React.createElement(IconButton, { sx: {
                    ...styles.cellButtonsButton,
                    ...styles.cellButtonsButtonAlone,
                }, size: "small", "aria-label": "delete", title: that.texts.deleteObject, onClick: () => {
                    // calculate the number of children
                    const keys = Object.keys(that.objects);
                    keys.sort();
                    let count = 0;
                    const start = `${id}.`;
                    for (let i = 0; i < keys.length; i++) {
                        if (keys[i].startsWith(start)) {
                            count++;
                        }
                        else if (keys[i] > start) {
                            break;
                        }
                    }
                    if (that.props.onObjectDelete) {
                        that.props.onObjectDelete(id, !!item.children?.length, false, count + 1);
                    }
                } },
                React.createElement(IconDelete, { style: styles.cellButtonsButtonIcon }))) : null)) : null;
    }
    item.data.aclTooltip =
        item.data.aclTooltip || renderTooltipAccessControl(that, item.data.obj.acl);
    const acl = item.data.obj.acl
        ? item.data.obj.type === 'state'
            ? item.data.obj.acl.state
            : item.data.obj.acl.object
        : 0;
    const aclSystemConfig = item.data.obj.acl &&
        (item.data.obj.type === 'state'
            ? that.systemConfig?.common.defaultNewAcl.state
            : that.systemConfig?.common.defaultNewAcl.object);
    const showEdit = !!item.data.obj && (that.state.filter.expertMode || isNonExpertId(item.data.id));
    return [
        that.state.filter.expertMode && that.props.objectEditOfAccessControl ? (React.createElement(Tooltip, { key: "acl", title: item.data.aclTooltip, slotProps: { popper: { sx: styles.tooltip } } },
            React.createElement(IconButton, { sx: {
                    ...styles.cellButtonsButton,
                    ...styles.cellButtonMinWidth,
                    opacity: 1,
                }, onClick: () => that.setState({ modalEditOfAccess: true, modalEditOfAccessObjData: item.data }), size: "large" },
                React.createElement("div", { style: styles.aclText }, Number.isNaN(Number(acl)) ? Number(aclSystemConfig).toString(16) : Number(acl).toString(16))))) : (React.createElement("div", { key: "aclEmpty", style: styles.cellButtonMinWidth })),
        showEdit ? (React.createElement(IconButton, { key: "edit", sx: {
                marginRight: '2px',
                ...styles.cellButtonsButton,
            }, size: "small", "aria-label": "edit", title: that.texts.editObject, onClick: () => {
                that.localStorage.setItem(`${that.props.dialogName || 'App'}.objectSelected`, id);
                that.setState({ editObjectDialog: id, editObjectAlias: false });
            } },
            React.createElement(IconEdit, { style: styles.cellButtonsButtonIcon }))) : (React.createElement(Box, { component: "div", key: "editDisabled", sx: styles.cellButtonsButton })),
        that.props.onObjectDelete &&
            (item.children?.length || !item.data.obj.common?.dontDelete) &&
            that.isDeleteAllowed(id) ? (React.createElement(IconButton, { key: "delete", sx: styles.cellButtonsButton, size: "small", "aria-label": "delete", onClick: () => {
                const keys = Object.keys(that.objects);
                keys.sort();
                let count = 0;
                const start = `${id}.`;
                for (let i = 0; i < keys.length; i++) {
                    if (keys[i].startsWith(start)) {
                        count++;
                    }
                    else if (keys[i] > start) {
                        break;
                    }
                }
                if (that.props.onObjectDelete) {
                    that.props.onObjectDelete(id, !!item.children?.length, !item.data.obj?.common?.dontDelete, count);
                }
            }, title: that.texts.deleteObject },
            React.createElement(IconDelete, { style: styles.cellButtonsButtonIcon }))) : null,
        that.props.objectCustomDialog &&
            that.info.hasSomeCustoms &&
            item.data.obj.type === 'state' &&
            // @ts-expect-error deprecated from js-controller 6
            item.data.obj.common?.type !== 'file' ? (React.createElement(IconButton, { sx: {
                ...styles.cellButtonsButton,
                ...(item.data.hasCustoms
                    ? that.styles.cellButtonsButtonWithCustoms
                    : styles.cellButtonsButtonWithoutCustoms),
            }, key: "custom", size: "small", "aria-label": "config", title: that.texts.customConfig, onClick: () => {
                that.localStorage.setItem(`${that.props.dialogName || 'App'}.objectSelected`, id);
                that.pauseSubscribe(true);
                that.props.router?.doNavigate(null, 'customs', id);
                that.setState({ customDialog: [id], customDialogAll: false });
            } },
            React.createElement(IconConfig, { style: styles.cellButtonsButtonIcon }))) : null,
    ];
}
/**
 * This function renders the value in different forms in the table
 *
 * @param that the object browser instance
 * @param id state ID
 * @param item Item
 * @param narrowStyleWithDetails if use mobile view
 */
export function renderColumnValue(that, id, item, narrowStyleWithDetails) {
    const obj = item.data.obj;
    if (!obj || !that.states) {
        return null;
    }
    if (obj.common?.type === 'file') {
        return (React.createElement(Box, { component: "div", sx: { ...styles.cellValueText, ...styles.cellValueFile } }, "[file]"));
    }
    if (!that.states[id]) {
        if (obj.type === 'state') {
            // we are waiting for state
            that.recordState(id, id);
            that.states[id] = { val: null };
            that.subscribe(id);
        }
        return null;
    }
    that.recordState(id, id);
    const state = that.states[id];
    let info = item.data.state;
    if (!info) {
        const { valText } = formatValue({
            state,
            obj: obj,
            texts: that.texts,
            dateFormat: that.props.dateFormat || that.systemConfig?.common.dateFormat || DEFAULT_DATE_FORMAT,
            isFloatComma: that.props.isFloatComma === undefined
                ? (that.systemConfig?.common.isFloatComma ?? true)
                : that.props.isFloatComma,
        });
        const valTextRx = [];
        item.data.state = { valTextRx };
        valTextRx.push(React.createElement("span", { className: `newValueBrowser-${that.props.themeType || 'light'}`, key: `${valText.v.toString()}valText`, style: {
                whiteSpace: 'nowrap',
                display: 'inline-block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            } }, valText.v.toString()));
        if (valText.u) {
            valTextRx.push(React.createElement("span", { className: `newValueBrowser-${that.props.themeType || 'light'}`, style: styles.cellValueTextUnit, key: `${valText.v.toString()}unit` }, valText.u));
        }
        if (valText.s !== undefined) {
            valTextRx.push(React.createElement("span", { style: styles.cellValueTextState, className: `newValueBrowser-${that.props.themeType || 'light'}`, key: `${valText.v.toString()}states` },
                "(",
                valText.s,
                ")"));
        }
        if (!narrowStyleWithDetails) {
            const copyText = valText.c !== undefined ? valText.c : valText.v || '';
            valTextRx.push(React.createElement(IconCopy, { className: "copyButton", style: that.styles.iconCopy, onClick: e => that.onCopy(e, copyText), key: "cc" }));
        }
        // <IconEdit className="copyButton" style={{{ ...styles.cellButtonsValueButton, styles.cellButtonsValueButtonEdit)} key="ce" />
        info = item.data.state;
    }
    info.style = getValueStyle({
        state,
        isExpertMode: that.state.filter.expertMode,
        isButton: item.data.button,
        nonAckColor: that.props.theme.palette.nonAck,
    });
    let val = info.valTextRx;
    if (!that.state.filter.expertMode) {
        if (item.data.button) {
            val = [
                React.createElement(ButtonIcon, { key: "button", style: { color: info.style.color, ...styles.cellValueButton } }),
            ];
        }
        else if (item.data.switch) {
            val = [
                React.createElement(Switch, { key: "switch", sx: {
                        '& .MuiSwitch-thumb': { color: info.style.color },
                        '& .MuiSwitch-track': {
                            backgroundColor: !!that.states[id].val && that.state.selected.includes(id)
                                ? that.props.themeType === 'dark'
                                    ? '#FFF !important'
                                    : '#111 !important'
                                : undefined,
                        },
                    }, checked: !!that.states[id].val }),
            ];
        }
    }
    return (React.createElement(Tooltip, { key: "value", title: that.state.tooltipInfo?.el, slotProps: {
            popper: { sx: styles.cellValueTooltipBox },
            tooltip: { sx: styles.cellValueTooltip },
        }, onOpen: () => that.getTooltipInfo(id), onClose: () => that.state.tooltipInfo?.id === id && that.setState({ tooltipInfo: null }) },
        React.createElement(Box, { component: "div", style: info.style, className: item.data.url ? 'iob-link' : undefined, sx: {
                ...styles.cellValueText,
                height: narrowStyleWithDetails ? undefined : ROW_HEIGHT,
                '& .admin-button:active': {
                    transform: 'translate(0, 2px)',
                },
            } }, val)));
}
/**
 * Renders a custom value.
 */
export function renderCustomValue(that, obj, it, item) {
    const text = getCustomValue(obj, it);
    if (text !== null && text !== undefined) {
        if (it.edit && !that.props.notEditable && (!it.objTypes || it.objTypes.includes(obj.type))) {
            return (React.createElement(Box, { component: "div", style: {
                    ...styles.columnCustom,
                    ...styles.columnCustomEditable,
                    ...styles[`columnCustom_${it.align}`],
                }, onClick: () => that.setState({
                    columnsEditCustomDialog: { item, it, obj },
                    customColumnDialogValueChanged: false,
                }) }, text));
        }
        return (React.createElement(Box, { component: "div", style: {
                ...styles.columnCustom,
                ...styles[`columnCustom_${it.align}`],
            } }, text));
    }
    return null;
}
export function renderAliasLink(that, id, index, customStyle) {
    const _index = index || 0;
    // read the type of operation
    const aliasObj = that.objects[that.info.aliasesMap[id][_index]].common.alias.id;
    if (aliasObj) {
        return (React.createElement(Box, { component: "div", onClick: e => {
                e.stopPropagation();
                e.preventDefault();
                const aliasId = that.info.aliasesMap[id][_index];
                // if more than one alias, close the menu
                if (that.info.aliasesMap[id].length > 1) {
                    that.setState({ aliasMenu: '' });
                }
                that.onSelect(aliasId);
                setTimeout(() => that.expandAllSelected(() => that.scrollToItem(aliasId)), 100);
            }, sx: customStyle || that.styles.aliasAlone },
            React.createElement("span", { className: "admin-browser-arrow" }, typeof aliasObj === 'string' || (aliasObj.read === id && aliasObj.write === id)
                ? '↔'
                : aliasObj.read === id
                    ? '→'
                    : '←'),
            that.info.aliasesMap[id][_index]));
    }
    return null;
}
/**
 * Renders a leaf.
 */
export function renderLeaf(that, item, isExpanded, 
/**
 * Kept for the public `ObjectBrowserClass.renderLeaf`. `renderItem` counts the items now, so
 * that a row which is served from the memo is counted as well
 */
_counter) {
    const id = item.data.id;
    isExpanded = isExpanded === undefined ? that.state.expanded.includes(id) : isExpanded;
    // the row records the states it shows anew (see `ObjectBrowserClass.recordState`)
    delete that.rowStates[id];
    // icon
    let iconFolder;
    const obj = item.data.obj;
    const itemType = obj?.type;
    if (item.children ||
        itemType === 'folder' ||
        itemType === 'device' ||
        itemType === 'channel' ||
        itemType === 'meta') {
        iconFolder = isExpanded ? (React.createElement(IconOpen, { style: that.styles.cellIdIconFolder, onClick: () => that.toggleExpanded(id) })) : (React.createElement(IconClosed, { style: that.styles.cellIdIconFolder, onClick: () => that.toggleExpanded(id) }));
    }
    else if (obj && obj.common && obj.common.write === false && obj.type === 'state') {
        iconFolder = React.createElement(IconDocumentReadOnly, { style: that.styles.cellIdIconDocument });
    }
    else {
        iconFolder = React.createElement(IconDocument, { style: that.styles.cellIdIconDocument });
    }
    let iconItem = null;
    if (item.data.icon) {
        if (typeof item.data.icon === 'string') {
            if (item.data.icon.length < 3) {
                iconItem = (React.createElement("span", { className: "iconOwn", style: styles.cellIdIconOwn }, item.data.icon)); // utf-8 char
            }
            else {
                iconItem = (React.createElement(Icon, { style: styles.cellIdIconOwn, className: "iconOwn", src: item.data.icon, alt: "" }));
            }
        }
        else {
            iconItem = item.data.icon;
        }
    }
    const common = obj?.common;
    const typeImg = (obj?.type && ITEM_IMAGES[obj.type]) || React.createElement("div", { className: "itemIcon" });
    const paddingLeft = that.levelPadding * (item.data.level || 0);
    // recalculate rooms and function names if the language changed
    if (item.data.lang !== that.props.lang) {
        const { rooms, per } = findRoomsForObject(that.info, id, that.props.lang);
        item.data.rooms = rooms.join(', ');
        item.data.per = per;
        const { funcs, pef } = findFunctionsForObject(that.info, id, that.props.lang);
        item.data.funcs = funcs.join(', ');
        item.data.pef = pef;
        item.data.lang = that.props.lang;
    }
    const checkbox = that.props.multiSelect &&
        that.objects[id] &&
        (!that.props.types || that.props.types.includes(that.objects[id].type)) ? (React.createElement(Checkbox, { style: styles.checkBox, checked: that.state.selected.includes(id) })) : null;
    let valueEditable = !that.props.notEditable && itemType === 'state' && (that.state.filter.expertMode || common?.write !== false);
    if (that.props.objectBrowserViewFile && common?.type === 'file') {
        valueEditable = true;
    }
    const enumEditable = !that.props.notEditable &&
        that.objects[id] &&
        (that.state.filter.expertMode || itemType === 'state' || itemType === 'channel' || itemType === 'device');
    const checkVisibleObjectType = that.state.statesView && (itemType === 'state' || itemType === 'channel' || itemType === 'device');
    let newValue = '';
    const newValueTitle = [];
    if (checkVisibleObjectType) {
        newValue = that.states[id]?.from;
        if (newValue === undefined) {
            newValue = '&nbsp;';
        }
        else {
            newValue = newValue ? newValue.replace(/^system\.adapter\.|^system\./, '') : '';
            newValueTitle.push(`${that.texts.stateChangedFrom} ${newValue}`);
        }
        if (obj?.user) {
            const user = obj.user.replace('system.user.', '');
            newValue += `/${user}`;
            newValueTitle.push(`${that.texts.stateChangedBy} ${user}`);
        }
    }
    if (obj) {
        if (obj.from) {
            newValueTitle.push(`${that.texts.objectChangedFrom} ${obj.from.replace(/^system\.adapter\.|^system\./, '')}`);
        }
        if (obj.user) {
            newValueTitle.push(`${that.texts.objectChangedBy} ${obj.user.replace(/^system\.user\./, '')}`);
        }
        if (obj.ts) {
            newValueTitle.push(`${that.texts.objectChangedByUser} ${Utils.formatDate(new Date(obj.ts), that.props.dateFormat || that.systemConfig?.common.dateFormat || DEFAULT_DATE_FORMAT)}`);
        }
    }
    let readWriteAlias = false;
    let alias = null;
    if (id.startsWith('alias.') && common?.alias?.id) {
        readWriteAlias = typeof common.alias.id === 'object';
        if (readWriteAlias) {
            alias = (React.createElement("div", { style: styles.cellIdAliasReadWriteDiv },
                common.alias.id.read ? (React.createElement(Box, { component: "div", onClick: e => {
                        e.stopPropagation();
                        e.preventDefault();
                        that.onSelect(common.alias.id.read);
                        setTimeout(() => that.expandAllSelected(() => that.scrollToItem(common.alias.id.read)), 100);
                    }, sx: that.styles.aliasReadWrite },
                    "\u2190",
                    common.alias.id.read)) : null,
                common.alias.id.write ? (React.createElement(Box, { component: "div", onClick: e => {
                        e.stopPropagation();
                        e.preventDefault();
                        that.onSelect(common.alias.id.write);
                        setTimeout(() => that.expandAllSelected(() => that.scrollToItem(common.alias.id.write)), 100);
                    }, sx: that.styles.aliasReadWrite },
                    "\u2192",
                    common.alias.id.write)) : null));
        }
        else {
            alias = (React.createElement(Box, { component: "div", onClick: e => {
                    e.stopPropagation();
                    e.preventDefault();
                    that.onSelect(common.alias.id);
                    setTimeout(() => that.expandAllSelected(() => that.scrollToItem(common.alias.id)), 100);
                }, sx: that.styles.aliasAlone },
                "\u2192",
                common.alias.id));
        }
    }
    else if (that.info.aliasesMap[id]) {
        // Some alias points to that object. It can be more than one
        if (that.info.aliasesMap[id].length > 1) {
            // Show number of aliases and open a menu by click
            alias = (React.createElement(Box, { component: "div", id: `alias_${id}`, onClick: e => {
                    e.stopPropagation();
                    e.preventDefault();
                    that.setState({ aliasMenu: id });
                }, sx: that.styles.aliasAlone }, that.props.t('ra_%s links from aliases', that.info.aliasesMap[id].length)));
        }
        else {
            // Show name of alias and open it by click
            alias = renderAliasLink(that, id, 0);
        }
    }
    let checkColor = common?.color;
    let invertBackground;
    if (checkColor && !that.state.selected.includes(id)) {
        // Only a rough reference value for the distance check, so the type is enough. Asking for the
        // name meant that every theme beyond "dark" and "blue" - "modernDark" among them - was
        // compared against white and the contrast was judged wrongly.
        const background = that.props.themeType === 'dark' ? '#1f1f1f' : '#FFFFFF';
        const distance = Utils.colorDistance(checkColor, background);
        // console.log(`Distance: ${checkColor} - ${background} = ${distance}`);
        if (distance < 1000) {
            invertBackground = that.props.themeType === 'dark' ? '#9a9a9a' : '#565656';
        }
    }
    let bold = false;
    if (id === '0_userdata') {
        checkColor = COLOR_NAME_USERDATA(that.props.themeType);
        bold = true;
        invertBackground = false;
    }
    else if (id === 'alias') {
        checkColor = COLOR_NAME_ALIAS(that.props.themeType);
        bold = true;
        invertBackground = false;
    }
    else if (id === 'javascript') {
        checkColor = COLOR_NAME_JAVASCRIPT(that.props.themeType);
        bold = true;
        invertBackground = false;
    }
    else if (id === 'system') {
        checkColor = COLOR_NAME_SYSTEM(that.props.themeType);
        bold = true;
        invertBackground = false;
    }
    else if (id === 'system.adapter') {
        checkColor = COLOR_NAME_SYSTEM_ADAPTER(that.props.themeType);
        invertBackground = false;
    }
    else if (!checkColor || that.state.selected.includes(id)) {
        checkColor = 'inherit';
        invertBackground = false;
    }
    const icons = [];
    if (common?.statusStates) {
        const ids = {};
        Object.keys(common.statusStates).forEach(name => {
            let _id = common.statusStates[name];
            if (_id.split('.').length < 3) {
                _id = `${id}.${_id}`;
            }
            ids[name] = _id;
            if (!that.states[_id]) {
                if (that.objects[_id]?.type === 'state') {
                    that.recordState(id, _id);
                    that.states[_id] = { val: null };
                    that.subscribe(_id);
                }
            }
            else {
                that.recordState(id, _id);
            }
        });
        // calculate color
        // errorId has priority
        let colorSet = false;
        if (common.statusStates.errorId && that.states[ids.errorId] && that.states[ids.errorId].val) {
            checkColor = that.props.themeType === 'dark' ? COLOR_NAME_ERROR_DARK : COLOR_NAME_ERROR_LIGHT;
            invertBackground = false;
            colorSet = true;
            icons.push(React.createElement(IconError, { key: "error", 
                // title={that.texts.deviceError}
                style: that.styles.iconDeviceError }));
        }
        if (ids.onlineId && that.states[ids.onlineId]) {
            if (!colorSet) {
                if (that.states[ids.onlineId].val) {
                    checkColor =
                        that.props.themeType === 'dark' ? COLOR_NAME_CONNECTED_DARK : COLOR_NAME_CONNECTED_LIGHT;
                    invertBackground = false;
                    icons.push(React.createElement(IconConnection, { key: "conn", 
                        // title={that.texts.deviceError}
                        style: that.styles.iconDeviceConnected }));
                }
                else {
                    checkColor =
                        that.props.themeType === 'dark' ? COLOR_NAME_DISCONNECTED_DARK : COLOR_NAME_DISCONNECTED_LIGHT;
                    invertBackground = false;
                    icons.push(React.createElement(IconDisconnected, { key: "disc", 
                        // title={that.texts.deviceError}
                        style: that.styles.iconDeviceDisconnected }));
                }
            }
            else if (that.states[ids.onlineId].val) {
                icons.push(React.createElement(IconConnection, { key: "conn", 
                    // title={that.texts.deviceError}
                    style: that.styles.iconDeviceConnected }));
            }
            else {
                icons.push(React.createElement(IconDisconnected, { key: "disc", 
                    // title={that.texts.deviceError}
                    style: that.styles.iconDeviceDisconnected }));
            }
        }
        else if (ids.offlineId && that.states[ids.offlineId]) {
            if (!colorSet) {
                if (that.states[ids.offlineId].val) {
                    checkColor =
                        that.props.themeType === 'dark' ? COLOR_NAME_DISCONNECTED_DARK : COLOR_NAME_DISCONNECTED_LIGHT;
                    invertBackground = false;
                    icons.push(React.createElement(IconDisconnected, { key: "disc", 
                        // title={that.texts.deviceError}
                        style: that.styles.iconDeviceDisconnected }));
                }
                else {
                    checkColor =
                        that.props.themeType === 'dark' ? COLOR_NAME_CONNECTED_DARK : COLOR_NAME_CONNECTED_LIGHT;
                    invertBackground = false;
                    icons.push(React.createElement(IconConnection, { key: "conn", 
                        // title={that.texts.deviceError}
                        style: that.styles.iconDeviceConnected }));
                }
            }
            else if (that.states[ids.offlineId].val) {
                icons.push(React.createElement(IconDisconnected, { key: "disc", 
                    // title={that.texts.deviceError}
                    style: that.styles.iconDeviceDisconnected }));
            }
            else {
                icons.push(React.createElement(IconConnection, { key: "conn", 
                    // title={that.texts.deviceError}
                    style: that.styles.iconDeviceConnected }));
            }
        }
    }
    const q = checkVisibleObjectType ? Utils.quality2text(that.states[id]?.q || 0).join(', ') : null;
    let name = item.data?.title || '';
    let useDesc = false;
    if (that.state.showDescription) {
        const oTooltip = getObjectTooltip(item.data, that.props.lang);
        if (oTooltip) {
            name = [
                React.createElement("div", { key: "name", style: styles.cellNameDivDiv }, name),
                React.createElement("div", { key: "desc", style: styles.cellDescription }, oTooltip),
            ];
            useDesc = !!oTooltip;
        }
    }
    const narrowStyleWithDetails = that.width === 'xs' && that.state.focused === id;
    const colID = (React.createElement(Grid, { container: true, wrap: "nowrap", direction: "row", sx: styles.cellId, style: { width: colWidth('id'), flexGrow: colGrow('id'), paddingLeft } },
        React.createElement(Grid, { container: true, 
            // the icons must not be squeezed by a long name
            sx: { alignItems: 'center', flexShrink: 0 } },
            checkbox,
            iconFolder),
        React.createElement(Grid, { style: {
                ...styles.cellIdSpan,
                // only the name may shrink (it is cut with an ellipsis), and for that a flex item
                // needs `minWidth: 0`, otherwise its content defines the minimal width
                minWidth: 0,
                ...(invertBackground ? that.styles.invertedBackground : undefined),
                color: checkColor,
                fontWeight: bold ? 'bold' : undefined,
            } },
            React.createElement(Tooltip, { title: getIdFieldTooltip(item.data, that.props.lang), slotProps: { popper: { sx: styles.tooltip } } },
                React.createElement("div", null, item.data.name)),
            alias,
            icons),
        React.createElement("div", { style: { ...styles.grow, ...(invertBackground ? that.styles.invertedBackgroundFlex : {}) } }),
        React.createElement(Grid, { container: true, sx: { alignItems: 'center', flexShrink: 0 } }, iconItem),
        that.width !== 'xs' ? (React.createElement("div", { style: { flexShrink: 0 } },
            React.createElement(IconCopy, { className: narrowStyleWithDetails ? '' : 'copyButton', style: styles.cellCopyButton, onClick: e => that.onCopy(e, id) }))) : null));
    let colName = (narrowStyleWithDetails && name) || that.columnsVisibility.name ? (React.createElement(Box, { component: "div", sx: {
            ...styles.cellName,
            ...(useDesc ? styles.cellNameWithDesc : undefined),
            width: that.width !== 'xs' ? colWidth('name') : undefined,
            flexGrow: that.width !== 'xs' ? colGrow('name') : undefined,
            // padding and not margin: a margin is added to the width of the column and all
            // following columns would not match the header anymore
            pl: narrowStyleWithDetails ? 0 : '5px',
        } },
        name,
        !narrowStyleWithDetails && item.data?.title ? (React.createElement(Box, { style: { color: checkColor } },
            React.createElement(IconCopy, { className: "copyButton", style: styles.cellCopyButton, onClick: e => that.onCopy(e, item.data?.title) }))) : null)) : null;
    let colMiddle;
    if (!that.state.statesView) {
        colMiddle = [
            (narrowStyleWithDetails && obj?.type) || that.columnsVisibility.type
                ? {
                    el: (React.createElement("div", { key: "type", style: {
                            ...styles.cellType,
                            width: that.width !== 'xs' ? colWidth('type') : undefined,
                        } },
                        typeImg,
                        "\u00A0",
                        obj?.type)),
                    type: 'filter_type',
                }
                : null,
            (narrowStyleWithDetails && common) || that.columnsVisibility.role
                ? {
                    el: (React.createElement("div", { key: "role", style: {
                            ...styles.cellRole,
                            width: that.width !== 'xs' ? colWidth('role') : '100%',
                            cursor: that.state.filter.expertMode && enumEditable && that.props.objectBrowserEditRole
                                ? 'text'
                                : 'default',
                        }, onClick: !narrowStyleWithDetails &&
                            that.state.filter.expertMode &&
                            enumEditable &&
                            that.props.objectBrowserEditRole
                            ? () => that.setState({ roleDialog: item.data.id })
                            : undefined }, common?.role)),
                    type: 'filter_role',
                    onClick: narrowStyleWithDetails &&
                        that.state.filter.expertMode &&
                        enumEditable &&
                        that.props.objectBrowserEditRole
                        ? () => that.setState({ roleDialog: item.data.id })
                        : undefined,
                }
                : null,
            (narrowStyleWithDetails && common) || that.columnsVisibility.room
                ? {
                    el: (React.createElement("div", { key: "room", style: {
                            ...styles.cellRoom,
                            ...(item.data.per ? styles.cellEnumParent : {}),
                            width: that.width !== 'xs' ? colWidth('room') : '100%',
                            cursor: enumEditable ? 'text' : 'default',
                        }, onClick: !narrowStyleWithDetails && enumEditable
                            ? () => {
                                const enums = findEnumsForObjectAsIds(that.info, item.data.id, 'roomEnums');
                                that.setState({
                                    enumDialogEnums: enums,
                                    enumDialog: {
                                        item,
                                        type: 'room',
                                        enumsOriginal: JSON.stringify(enums),
                                    },
                                });
                            }
                            : undefined }, item.data.rooms)),
                    type: 'filter_room',
                    onClick: narrowStyleWithDetails && enumEditable
                        ? () => {
                            const enums = findEnumsForObjectAsIds(that.info, item.data.id, 'roomEnums');
                            that.setState({
                                enumDialogEnums: enums,
                                enumDialog: {
                                    item,
                                    type: 'room',
                                    enumsOriginal: JSON.stringify(enums),
                                },
                            });
                        }
                        : undefined,
                }
                : null,
            (narrowStyleWithDetails && common) || that.columnsVisibility.func
                ? {
                    el: (React.createElement("div", { key: "func", style: {
                            ...styles.cellFunc,
                            ...(item.data.pef ? styles.cellEnumParent : {}),
                            width: that.width !== 'xs' ? colWidth('func') : '100%',
                            cursor: enumEditable ? 'text' : 'default',
                        }, onClick: !narrowStyleWithDetails && enumEditable
                            ? () => {
                                const enums = findEnumsForObjectAsIds(that.info, item.data.id, 'funcEnums');
                                that.setState({
                                    enumDialogEnums: enums,
                                    enumDialog: {
                                        item,
                                        type: 'func',
                                        enumsOriginal: JSON.stringify(enums),
                                    },
                                });
                            }
                            : undefined }, item.data.funcs)),
                    type: 'filter_func',
                    onClick: narrowStyleWithDetails && enumEditable
                        ? () => {
                            const enums = findEnumsForObjectAsIds(that.info, item.data.id, 'funcEnums');
                            that.setState({
                                enumDialogEnums: enums,
                                enumDialog: {
                                    item,
                                    type: 'func',
                                    enumsOriginal: JSON.stringify(enums),
                                },
                            });
                        }
                        : undefined,
                }
                : null,
        ];
    }
    else {
        colMiddle = [
            (narrowStyleWithDetails && checkVisibleObjectType && that.states[id]?.from) ||
                that.columnsVisibility.changedFrom
                ? {
                    el: (React.createElement("div", { key: "from", style: {
                            ...styles.cellRole,
                            width: that.width !== 'xs' ? colWidth('changedFrom') : undefined,
                        }, title: newValueTitle.join('\n') }, checkVisibleObjectType && that.states[id]?.from ? newValue : null)),
                    type: 'from',
                }
                : null,
            (narrowStyleWithDetails && q) || that.columnsVisibility.qualityCode
                ? {
                    el: (React.createElement("div", { key: "q", style: {
                            ...styles.cellRole,
                            width: that.width !== 'xs' ? colWidth('qualityCode') : undefined,
                        }, title: q || '' }, q)),
                    type: 'quality',
                }
                : null,
            (narrowStyleWithDetails && checkVisibleObjectType && that.states[id]?.ts) ||
                that.columnsVisibility.timestamp
                ? {
                    el: (React.createElement("div", { key: "ts", style: {
                            ...styles.cellRole,
                            width: that.width !== 'xs' ? colWidth('timestamp') : undefined,
                        } }, checkVisibleObjectType && that.states[id]?.ts
                        ? Utils.formatDate(new Date(that.states[id].ts), that.props.dateFormat ||
                            that.systemConfig?.common.dateFormat ||
                            DEFAULT_DATE_FORMAT)
                        : null)),
                    type: 'ts',
                }
                : null,
            (narrowStyleWithDetails && checkVisibleObjectType && that.states[id]?.lc) ||
                that.columnsVisibility.lastChange
                ? {
                    el: (React.createElement("div", { key: "lc", style: {
                            ...styles.cellRole,
                            width: that.width !== 'xs' ? colWidth('lastChange') : undefined,
                        } }, checkVisibleObjectType && that.states[id]?.lc
                        ? Utils.formatDate(new Date(that.states[id].lc), that.props.dateFormat ||
                            that.systemConfig?.common.dateFormat ||
                            DEFAULT_DATE_FORMAT)
                        : null)),
                    type: 'lc',
                }
                : null,
        ];
    }
    let colCustom = that.adapterColumns?.map(it => (React.createElement("div", { style: {
            ...styles.cellAdapter,
            width: that.width !== 'xs' ? colWidth(it.id) : undefined,
        }, key: it.id, title: `${it.adapter} => ${it.pathText}` }, obj ? renderCustomValue(that, obj, it, item) : null))) || null;
    const columnValue = narrowStyleWithDetails || that.columnsVisibility.val
        ? renderColumnValue(that, id, item, narrowStyleWithDetails)
        : null;
    // A state that was never written has no value at all, so `renderColumnValue` returns null.
    // In the narrow layout that used to remove the whole cell - and with it the only way to tap
    // the value and open the editor. Keep the (empty) cell for editable states.
    const showValueCell = that.columnsVisibility.val || (narrowStyleWithDetails && (!!columnValue || valueEditable));
    /** Open the value editor - used by the value cell and by the edit button of the narrow details view */
    const editValue = () => {
        if (!obj || !that.states) {
            return;
        }
        if (common?.type === 'file') {
            that.setState({ viewFileDialog: id });
            return;
        }
        that.edit = {
            val: that.states[id] ? that.states[id].val : '',
            q: that.states[id] ? that.states[id].q || 0 : 0,
            ack: false,
            id,
        };
        that.setState({ updateOpened: true });
    };
    let colValue = showValueCell ? (React.createElement("div", { style: {
            ...styles.cellValue,
            width: that.width !== 'xs' ? colWidth('val') : '100%',
            // An empty inline-block has no height, so a state without a value would offer nothing
            // to tap on in the narrow details view.
            minHeight: narrowStyleWithDetails ? 20 : undefined,
            cursor: valueEditable
                ? common?.type === 'file'
                    ? 'zoom-in'
                    : item.data.button
                        ? 'grab'
                        : 'text'
                : 'default',
        }, onClick: e => {
            if (valueEditable) {
                if (!obj || !that.states) {
                    // return;
                }
                else if (common?.type === 'file') {
                    editValue();
                }
                else if (item.data.url && e.ctrlKey) {
                    if (that.states[id]?.val && typeof that.states[id].val === 'string') {
                        if (common?.role === 'url.self') {
                            window.location.href = that.states[id].val;
                        }
                        else {
                            const opened = window.open(that.states[id].val, '_blank');
                            opened?.focus();
                        }
                    }
                }
                else if (!that.state.filter.expertMode && item.data.button) {
                    // in non-expert mode control button directly
                    that.props.socket
                        .setState(id, true)
                        .catch(e => window.alert(`Cannot write state "${id}": ${e}`));
                }
                else if (!that.state.filter.expertMode && item.data.switch) {
                    // in non-expert mode control switch directly
                    that.props.socket
                        .setState(id, !that.states[id].val)
                        .catch(e => window.alert(`Cannot write state "${id}": ${e}`));
                }
                else {
                    editValue();
                }
            }
            else if (common?.role === 'url' || (common?.role === 'url.blank' && e.ctrlKey)) {
                if (that.states[id]?.val && typeof that.states[id].val === 'string') {
                    window.open(that.states[id].val, '_blank');
                }
            }
            else if (common?.role === 'url.self' && e.ctrlKey) {
                if (that.states[id]?.val && typeof that.states[id].val === 'string') {
                    window.location.href = that.states[id].val;
                }
            }
        } }, columnValue)) : null;
    let colButtons = narrowStyleWithDetails || that.columnsVisibility.buttons ? (React.createElement("div", { style: {
            ...styles.cellButtons,
            width: that.width !== 'xs' ? colWidth('buttons') : undefined,
        } }, renderColumnButtons(that, id, item))) : null;
    let colDetails = null;
    if (narrowStyleWithDetails) {
        /** Texts of the middle columns: the cells are always rendered, so an empty one must be detected here */
        const middleTexts = {
            filter_type: obj?.type,
            filter_role: common?.role,
            filter_room: item.data.rooms,
            filter_func: item.data.funcs,
        };
        const editTitles = {
            filter_role: 'ra_Edit role',
            filter_room: 'ra_Edit room',
            filter_func: 'ra_Edit function',
        };
        /** One line of the details: the label, the value (or a dash) and the buttons for it */
        const detailsLine = (key, label, value, actions = []) => (React.createElement("div", { key: key, style: styles.cellDetailsLine },
            React.createElement("span", { style: styles.cellDetailsName }, label),
            React.createElement(Box, { sx: styles.cellDetailsValue }, value || React.createElement("span", { style: styles.cellDetailsEmpty }, "\u2013")),
            actions.map(action => (React.createElement(Tooltip, { key: action.title, title: action.title, slotProps: { popper: { sx: styles.tooltip } } },
                React.createElement(IconButton, { size: "small", sx: styles.cellDetailsButton, onClick: action.onClick }, action.icon))))));
        const copyTitle = that.props.t('ra_Copy to clipboard');
        const copyIcon = React.createElement(IconCopy, { style: styles.cellDetailsIcon });
        const editIcon = React.createElement(IconEdit, { style: styles.cellDetailsIcon });
        if (!colCustom?.length) {
            colCustom = null;
        }
        // a folder without an object has nothing but its ID, so the header does not need a separator then
        const hasLines = !!colName || !!colMiddle?.some(it => it) || !!colCustom || that.objects[id]?.type === 'state';
        colDetails = (React.createElement(Paper
        // `renderItem` pushes this panel into the array of rows, so it needs its own key
        , { 
            // `renderItem` pushes this panel into the array of rows, so it needs its own key
            key: `details_${id}`, "data-details-of": id, elevation: 0, sx: styles.cellDetails },
            React.createElement("div", { style: {
                    ...styles.cellDetailsHeader,
                    ...(hasLines ? styles.cellDetailsHeaderWithLines : undefined),
                } },
                React.createElement(Box, { sx: styles.cellDetailsId }, id),
                React.createElement(Tooltip, { title: copyTitle, slotProps: { popper: { sx: styles.tooltip } } },
                    React.createElement(IconButton, { size: "small", sx: styles.cellDetailsButton, onClick: e => that.onCopy(e, id) }, copyIcon))),
            colName
                ? detailsLine('name', that.texts.name, colName, item.data?.title
                    ? [{ title: copyTitle, icon: copyIcon, onClick: e => that.onCopy(e, item.data?.title) }]
                    : [])
                : null,
            colMiddle?.map(it => it
                ? detailsLine(it.type, that.texts[it.type], it.type in middleTexts && !middleTexts[it.type] ? null : it.el, it.onClick
                    ? [
                        {
                            title: that.props.t(editTitles[it.type] || 'ra_Edit'),
                            icon: editIcon,
                            onClick: () => it.onClick?.(),
                        },
                    ]
                    : [])
                : null),
            colCustom ? React.createElement("div", { style: styles.cellDetailsLine }, colCustom) : null,
            that.objects[id]?.type === 'state'
                ? // an editable state without value has its own edit button here, so show a dash instead of the empty cell
                    detailsLine('value', that.texts.value, columnValue ? colValue : null, [
                        {
                            title: that.texts.copyState,
                            icon: copyIcon,
                            onClick: e => {
                                const { valText } = formatValue({
                                    state: that.states[id],
                                    obj: that.objects[id],
                                    texts: that.texts,
                                    dateFormat: that.props.dateFormat ||
                                        that.systemConfig?.common.dateFormat ||
                                        DEFAULT_DATE_FORMAT,
                                    isFloatComma: that.props.isFloatComma === undefined
                                        ? (that.systemConfig?.common.isFloatComma ?? true)
                                        : that.props.isFloatComma,
                                });
                                that.onCopy(e, valText.c !== undefined ? valText.c : valText.v.toString());
                            },
                        },
                        // Tapping the value itself only works when there is something to tap on -
                        // a state that was never written renders nothing
                        ...(valueEditable
                            ? [{ title: that.props.t('ra_Edit value'), icon: editIcon, onClick: editValue }]
                            : []),
                    ])
                : null,
            colButtons ? React.createElement(Box, { sx: styles.cellDetailsButtons }, colButtons) : null));
        colName = null;
        colMiddle = null;
        colCustom = null;
        colValue = null;
        colButtons = null;
    }
    const row = (React.createElement(Grid, { container: true, direction: "row", wrap: "nowrap", sx: Utils.getStyle(that.props.theme, styles.tableRow, that.state.linesEnabled && styles.tableRowLines, !that.props.dragEnabled && styles.tableRowNoDragging, alias && styles.tableRowAlias, readWriteAlias && styles.tableRowAliasReadWrite, that.state.focused === id && that.props.multiSelect && styles.tableRowFocused, !item.data.visible && styles.filteredOut, item.data.hasVisibleParent &&
            !item.data.visible &&
            !item.data.hasVisibleChildren &&
            styles.filteredParentOut, that.state.selected.includes(id) && styles.itemSelected, that.state.selectedNonObject === id && styles.itemSelected), key: id, id: id, onMouseDown: e => {
            that.onSelect(id);
            let isRightMB;
            if ('which' in e) {
                // Gecko (Firefox), WebKit (Safari/Chrome) & Opera
                isRightMB = e.which === 3;
            }
            else if ('button' in e) {
                // IE, Opera
                isRightMB = e.button === 2;
            }
            if (isRightMB) {
                that.contextMenu = {
                    item,
                    ts: Date.now(),
                };
            }
            else {
                that.contextMenu = null;
            }
        }, onDoubleClick: () => {
            if (!item.children) {
                that.onSelect(id, true);
            }
            else {
                that.toggleExpanded(id);
            }
        } },
        colID,
        colName,
        colMiddle?.map(it => it?.el),
        colCustom,
        colValue,
        colButtons));
    return { row, details: colDetails };
}
/**
 * One row of the table.
 *
 * Building a row is expensive: it assembles up to a dozen cells and merges its styles for every
 * one of them (`Utils.getStyle` returns a fresh object each time, which the style engine has to
 * serialize anew). Until now a single state change rebuilt EVERY open row, because the browser
 * answers a value with `forceUpdate()` on the whole table - with a few hundred rows open that
 * blocked the main thread for a fifth of a second per value, and on an installation whose adapters
 * report all the time the table never stood still.
 *
 * The memo keeps the row as it is unless one of the states it shows changed or something happened
 * that concerns every row (filter, columns, theme, selection, a rebuilt tree - all of which count up
 * the epoch).
 */
const ObjectBrowserRow = React.memo(function ObjectBrowserRow(props) {
    return props.build();
}, (prev, next) => prev.epoch === next.epoch && prev.stateVersion === next.stateVersion && prev.isExpanded === next.isExpanded);
/**
 * Renders ONE row - without its children.
 *
 * The table renders only the rows around the visible area (see `ObjectBrowserClass.getWindow`), so
 * the row of an item is built on its own and not as a part of the recursion over the tree.
 */
export function renderRow(that, root, isExpanded) {
    const id = root.data.id;
    const DragWrapper = that.props.DragWrapper;
    // Everything the row needs is built inside the memo: it does not run while the row is reused
    const build = () => {
        const result = renderLeaf(that, root, isExpanded);
        let leaf;
        if (that.props.dragEnabled && DragWrapper) {
            if (root.data.sumVisibility) {
                leaf = (React.createElement(DragWrapper, { key: id, item: root, style: styles.draggable }, result.row));
            }
            else {
                // change cursor
                leaf = (React.createElement("div", { key: id, style: styles.nonDraggable }, result.row));
            }
        }
        else {
            leaf = result.row;
        }
        return (React.createElement(React.Fragment, null,
            id ? leaf : null,
            result.details));
    };
    return (React.createElement(ObjectBrowserRow, { key: id || '__root__', build: build, epoch: that.renderEpoch, stateVersion: that.rowStateVersion[id] || 0, isExpanded: isExpanded === undefined ? binarySearch(that.state.expanded, id) : isExpanded }));
}
/**
 * Renders an item and all its expanded children.
 *
 * Kept for the public `ObjectBrowserClass.renderLeaf`. The table itself walks the flat list of
 * `flattenItems` and renders only the rows of the window.
 */
export function renderItem(that, root, isExpanded, counter) {
    const items = [];
    counter = counter || { count: 0 };
    counter.count++;
    items.push(renderRow(that, root, isExpanded));
    isExpanded = isExpanded === undefined ? binarySearch(that.state.expanded, root.data.id) : isExpanded;
    if (!root.data.id || isExpanded) {
        if (!that.state.foldersFirst) {
            if (root.children) {
                items.push(root.children.map(item => {
                    // do not render too many items in column editor mode
                    if (!that.state.columnsSelectorShow || counter.count < 15) {
                        if (item.data.sumVisibility) {
                            return renderItem(that, item, undefined, counter);
                        }
                    }
                    return null;
                }));
            }
        }
        else if (root.children) {
            // first only folder
            items.push(root.children.map(item => {
                if (item.children) {
                    // do not render too many items in column editor mode
                    if (!that.state.columnsSelectorShow || counter.count < 15) {
                        if (item.data.sumVisibility) {
                            return renderItem(that, item, undefined, counter);
                        }
                    }
                }
                return null;
            }));
            // then items
            items.push(root.children.map(item => {
                if (!item.children) {
                    // do not render too many items in column editor mode
                    if (!that.state.columnsSelectorShow || counter.count < 15) {
                        if (item.data.sumVisibility) {
                            return renderItem(that, item, undefined, counter);
                        }
                    }
                }
                return null;
            }));
        }
    }
    return items;
}
/**
 * Walks the tree in EXACTLY the order in which `renderItem` renders it and returns the rows as one
 * flat list.
 *
 * The table needs that list to render only the rows around the visible area and to know where a row
 * that is not rendered at the moment would be - `scrollToItem` and the keyboard navigation used to
 * read that from the DOM. Every change of the order in `renderItem` belongs here as well.
 */
export function flattenItems(that, root, result, counter) {
    result = result || [];
    counter = counter || { count: 0 };
    counter.count++;
    const isExpanded = binarySearch(that.state.expanded, root.data.id);
    result.push({ item: root, isExpanded });
    if ((!root.data.id || isExpanded) && root.children) {
        // do not render too many items in column editor mode
        const allowed = (item) => (!that.state.columnsSelectorShow || counter.count < 15) && !!item.data.sumVisibility;
        if (!that.state.foldersFirst) {
            for (const item of root.children) {
                if (allowed(item)) {
                    flattenItems(that, item, result, counter);
                }
            }
        }
        else {
            // first only folders
            for (const item of root.children) {
                if (item.children && allowed(item)) {
                    flattenItems(that, item, result, counter);
                }
            }
            // then items
            for (const item of root.children) {
                if (!item.children && allowed(item)) {
                    flattenItems(that, item, result, counter);
                }
            }
        }
    }
    return result;
}
//# sourceMappingURL=renderLeaf.js.map