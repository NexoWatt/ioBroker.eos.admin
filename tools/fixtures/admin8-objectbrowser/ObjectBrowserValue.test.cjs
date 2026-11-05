"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const x_date_pickers_1 = require("@mui/x-date-pickers");
const AdapterDateFns_1 = require("@mui/x-date-pickers/AdapterDateFns");
const material_1 = require("@mui/material");
const icons_material_1 = require("@mui/icons-material");
const ObjectChart_1 = __importDefault(require("./ObjectChart"));
const utils_1 = require("./utils");
const Editor_1 = __importDefault(require("../Editor"));
const ctrlEnter_1 = require("@/helpers/ctrlEnter");
const eosObjectBrowserWrite_1 = require("./eosObjectBrowserWrite");
function editorText(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    try {
        return JSON.stringify(value) || '';
    }
    catch {
        return '';
    }
}
const styles = {
    dialogForm: { margin: 0 },
    formControl: {
        minWidth: 100,
    },
    quality: {
        width: 'calc(100% - 88px)',
    },
    expire: {
        ml: 1,
        width: 80,
    },
    readOnly: {
        backgroundColor: '#b74848',
    },
    readOnlyText: {
        color: '#b74848',
        marginLeft: 8,
    },
    wrapperButton: {
        '@media screen and (max-width: 465px)': {
            '& *': {
                fontSize: 12,
            },
        },
        '@media screen and (max-width: 380px)': {
            '& *': {
                fontSize: 11,
            },
        },
    },
    ackCheckbox: {
        marginLeft: 4,
    },
    dialog: {
        minHeight: Math.min(window.innerHeight - 50, 500),
    },
    tooltip: {
        pointerEvents: 'none',
    },
};
class ObjectBrowserValue extends react_1.Component {
    static hasStatesOptions(states) {
        return !!states && typeof states === 'object' && !Array.isArray(states) && Object.keys(states).length > 0;
    }
    /** The state value */
    propsValue;
    /** Chart start date */
    chartFrom;
    /** Ack flag of the state */
    ack;
    /** TextField Ref */
    inputRef = react_1.default.createRef();
    /** State quality */
    q;
    /** Expiration of the state */
    expire;
    writePending = false;
    constructor(props) {
        super(props);
        const policy = (0, eosObjectBrowserWrite_1.getManualWritePolicy)();
        const hasStatesOptions = ObjectBrowserValue.hasStatesOptions(this.props.states);
        const prepared = policy.prepareEditor(this.props.object, this.props.value);
        const type = hasStatesOptions ? 'states' : prepared.editorType;
        let value = prepared.value;
        this.propsValue = value;
        if (type === 'json' && typeof value !== 'string') {
            value = JSON.stringify(value == null ? null : value, null, 2);
            this.propsValue = value;
        }
        else if (type === 'number' && value == null) {
            value = '';
        }
        else if (type === 'string' && value == null) {
            value = '';
        }
        this.state = {
            type,
            chart: false,
            chartEnabled: (window._localStorage || window.localStorage).getItem('App.chartSetValue') !== 'false',
            fullScreen: (window._localStorage || window.localStorage).getItem('App.fullScreen') === 'true',
            targetValue: value,
            /** If input is invalid, set value button is disabled */
            valid: true,
            jsonError: false,
            writing: false,
        };
        this.ack = false;
        this.q = 0;
        this.expire = 0;
        this.inputRef = react_1.default.createRef();
        this.chartFrom = Date.now() - 3_600_000 * 2;
    }
    componentDidMount() {
        if (this.props.defaultHistory &&
            this.props.object?.common?.custom &&
            this.props.object.common.custom[this.props.defaultHistory]?.enabled) {
            void this.props.socket
                .getState(`system.adapter.${this.props.defaultHistory}.alive`)
                .then((state) => this.setState({ chart: !!state?.val }));
        }
        setTimeout(() => {
            if (this.inputRef?.current) {
                const el = this.inputRef.current;
                const value = el.value || '';
                const origType = el.type;
                // type number cannot be selected, so we perform a short workaround
                if (el.type === 'number') {
                    el.type = 'text';
                }
                el.setSelectionRange(0, value.length);
                if (origType === 'number') {
                    el.type = origType;
                }
            }
        }, 200);
    }
    static parseBoolean(value) {
        if (value === true || value === 1) {
            return true;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            return normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes';
        }
        return false;
    }
    async onUpdate(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (this.writePending || this.state.writing || !this.state.valid || this.state.jsonError) {
            return;
        }
        if (this.props.object.common?.write === false) {
            window.alert(`Cannot write state "${this.props.object._id}": common.write=false`);
            return;
        }
        try {
            const policy = (0, eosObjectBrowserWrite_1.getManualWritePolicy)();
            const behavior = policy.getWriteBehavior(this.props.object._id, this.props.object, undefined, this.props.expertMode);
            if (behavior === 'readonly' || behavior === 'expert-only' || behavior === 'file') {
                throw new Error('State writing is not permitted');
            }
            const value = policy.parseEditorValue(this.props.object, this.state.type, this.state.targetValue);
            this.writePending = true;
            this.setState({ writing: true });
            await Promise.resolve(this.props.onClose({
                val: value,
                ack: this.ack,
                q: this.q,
                expire: this.expire || undefined,
                editorType: this.state.type,
            }));
        }
        catch (error) {
            window.alert(`Cannot write state "${this.props.object._id}": ${error instanceof Error ? error.message : editorText(error)}`);
            this.writePending = false;
            this.setState({ writing: false });
        }
    }
    /** CTRL+ENTER triggers the same action as the "Set value" button */
    onCtrlEnter = () => {
        if (this.state.valid) {
            void this.onUpdate();
        }
    };
    /**
     * Check if a number value is valid according to the objects common properties
     *
     * @param options value and common information
     */
    static isNumberValid(options) {
        const { common, value } = options;
        if (value === '') {
            return false;
        }
        const numVal = Number(typeof value === 'string' ? value.replace(',', '.') : value);
        if (!Number.isFinite(numVal)) {
            return false;
        }
        if (typeof common.min === 'number' && numVal < common.min) {
            return false;
        }
        return !(typeof common.max === 'number' && numVal > common.max);
    }
    /**
     * Render time picker component for date type
     */
    renderTimePicker() {
        return (react_1.default.createElement(x_date_pickers_1.LocalizationProvider, { adapterLocale: utils_1.localeMap[this.props.lang], dateAdapter: AdapterDateFns_1.AdapterDateFns },
            react_1.default.createElement(x_date_pickers_1.DatePicker, { value: new Date(Number(this.state.targetValue)), onChange: value => {
                    if (!value) {
                        return;
                    }
                    this.setState({ targetValue: Math.round(value.getTime()) });
                } }),
            react_1.default.createElement(x_date_pickers_1.TimePicker, { value: new Date(Number(this.state.targetValue)), views: ['hours', 'minutes', 'seconds'], onChange: value => {
                    if (!value) {
                        return;
                    }
                    this.setState({ targetValue: Math.round(value.getTime()) });
                } })));
    }
    renderChart() {
        return (react_1.default.createElement(ObjectChart_1.default, { t: this.props.t, isFloatComma: this.props.isFloatComma, showJumpToEchart: false, lang: this.props.lang, socket: this.props.socket, obj: this.props.object, themeType: this.props.themeType, theme: this.props.theme, from: this.chartFrom, end: Date.now(), noToolbar: true, defaultHistory: this.props.defaultHistory, customsInstances: [], objects: {}, historyInstance: '' }));
    }
    static checkJsonError(value) {
        try {
            JSON.parse(value);
            return false;
        }
        catch {
            return true;
        }
    }
    renderJsonEditor() {
        return (react_1.default.createElement(Editor_1.default, { error: this.state.jsonError, onCtrlEnter: this.onCtrlEnter, editValueMode: true, themeType: this.props.themeType, defaultValue: editorText(this.state.targetValue), onChange: (newValue) => this.setState({
                targetValue: newValue,
                jsonError: ObjectBrowserValue.checkJsonError(newValue),
            }) }));
    }
    renderStates() {
        if (!ObjectBrowserValue.hasStatesOptions(this.props.states)) {
            return null;
        }
        if (this.props.type === 'number' &&
            this.props.object.common.max !== undefined &&
            this.props.object.common.min !== undefined) {
            const options = Object.keys(this.props.states || {}).map(key => ({
                label: this.props.states?.[key],
                value: key,
            }));
            const currentKey = this.state.targetValue &&
                typeof this.state.targetValue === 'object' &&
                'value' in this.state.targetValue
                ? this.state.targetValue.value
                : this.state.targetValue;
            const selectedOption = options.find(option => String(option.value) === editorText(currentKey)) ?? editorText(currentKey);
            return (react_1.default.createElement(material_1.Autocomplete, { style: styles.formControl, disablePortal: true, value: selectedOption, options: options, noOptionsText: "", freeSolo: true, isOptionEqualToValue: (option, value) => String(typeof option === 'string' ? option : option.value) ===
                    String(typeof value === 'string' ? value : value.value), getOptionLabel: option => typeof option === 'string' ? option : option.label || String(option.value), onChange: (e, value) => this.setState({ targetValue: value }), onInputChange: (e, value, reason) => {
                    if (reason === 'input') {
                        this.setState({ targetValue: value });
                    }
                }, onKeyUp: e => e.key === 'Enter' && this.onUpdate(e), renderInput: params => (react_1.default.createElement(material_1.TextField, { ...params, label: this.props.t('Value'), variant: "standard" })) }));
        }
        return (react_1.default.createElement(material_1.FormControl, { variant: "standard", style: styles.formControl },
            react_1.default.createElement(material_1.InputLabel, null, this.props.t('Value')),
            react_1.default.createElement(material_1.Select, { variant: "standard", value: this.state.targetValue == null
                    ? ''
                    : typeof this.state.targetValue === 'object' && 'value' in this.state.targetValue
                        ? editorText(this.state.targetValue.value)
                        : editorText(this.state.targetValue), onChange: e => this.setState({ targetValue: e.target.value }) }, Object.keys(this.props.states || {}).map((key, i) => (react_1.default.createElement(material_1.MenuItem, { key: i, value: key }, this.props.states?.[key]))))));
    }
    render() {
        const hasStatesOptions = ObjectBrowserValue.hasStatesOptions(this.props.states);
        const ackCheckbox = (react_1.default.createElement("div", { style: { display: 'flex', alignItems: 'center' } },
            react_1.default.createElement(material_1.FormControlLabel, { style: {
                    ...styles.formControl,
                    ...(!this.props.expertMode ? styles.ackCheckbox : undefined),
                }, control: react_1.default.createElement(material_1.Checkbox, { defaultChecked: false, onChange: e => (this.ack = e.target.checked) }), label: this.props.t('Acknowledged') }),
            react_1.default.createElement(material_1.Tooltip, { title: this.props.t('Acknowledged explanation'), slotProps: { popper: { sx: styles.tooltip } } },
                react_1.default.createElement(icons_material_1.Info, { color: "primary" }))));
        return (react_1.default.createElement(material_1.Dialog, { className: "eos-object-value-dialog", open: !0, maxWidth: this.state.type === 'number' || this.state.type === 'boolean' || this.state.type === 'states'
                ? this.state.chart && this.state.chartEnabled
                    ? 'lg'
                    : undefined
                : 'md', fullWidth: (this.state.type === 'json' && this.state.fullScreen) ||
                (this.state.type !== 'number' && this.state.type !== 'boolean' && this.state.type !== 'states') ||
                (this.state.chart && this.state.chartEnabled), fullScreen: this.state.type === 'json' && this.state.fullScreen, onClose: () => {
                if (!this.writePending) {
                    void this.props.onClose();
                }
            }, onKeyDown: e => (0, ctrlEnter_1.onCtrlEnter)(e, this.onCtrlEnter), "aria-labelledby": "edit-value-dialog-title", "aria-describedby": "edit-value-dialog-description", sx: {
                zIndex: 10000,
                '& .MuiDialog-paper': this.state.type === 'json' ? styles.dialog : undefined,
            } },
            react_1.default.createElement(material_1.DialogTitle, { id: "edit-value-dialog-title" },
                this.props.t('Write value'),
                this.props.object.common?.write === false ? (react_1.default.createElement("span", { style: styles.readOnlyText },
                    "(",
                    this.props.t('read only'),
                    ")")) : null,
                this.state.chart ? (react_1.default.createElement(material_1.Fab, { style: { float: 'right' }, size: "small", color: this.state.chartEnabled ? 'primary' : 'default', onClick: () => {
                        (window._localStorage ||
                            window.localStorage).setItem('App.chartSetValue', this.state.chartEnabled ? 'false' : 'true');
                        this.setState({ chartEnabled: !this.state.chartEnabled });
                    } },
                    react_1.default.createElement(icons_material_1.ShowChart, null))) : null,
                this.state.type === 'json' ? (react_1.default.createElement(material_1.IconButton, { style: { float: 'right' }, onClick: () => {
                        (window._localStorage ||
                            window.localStorage).setItem('App.fullScreen', this.state.fullScreen ? 'false' : 'true');
                        this.setState({ fullScreen: !this.state.fullScreen });
                    } }, this.state.fullScreen ? react_1.default.createElement(icons_material_1.FullscreenExit, null) : react_1.default.createElement(icons_material_1.Fullscreen, null))) : null),
            react_1.default.createElement(material_1.DialogContent, null,
                react_1.default.createElement("form", { noValidate: true, autoComplete: "off", 
                    // Without this, the browser submits the form - ENTER in a one line input or
                    // CTRL+ENTER in a text area is enough - and as the form has no `action`, the
                    // current address is requested anew: the whole GUI reloads. Returning false
                    // from a react handler does not prevent anything.
                    onSubmit: e => e.preventDefault(), style: { ...styles.dialogForm, height: '100%' } },
                    react_1.default.createElement(material_1.Grid, { container: true, direction: "row", spacing: 2, style: { height: '100%' } },
                        react_1.default.createElement(material_1.Grid
                        // the chart only exists from `md` upward, so below that the form gets
                        // the full width instead of leaving half the dialog empty
                        , { 
                            // the chart only exists from `md` upward, so below that the form gets
                            // the full width instead of leaving half the dialog empty
                            size: { xs: 12, md: this.state.chart && this.state.chartEnabled ? 6 : 12 }, style: { height: '100%' } },
                            react_1.default.createElement(material_1.Grid, { container: true, spacing: 2, style: { marginTop: 0, height: '100%' }, sx: { flexDirection: 'column' } },
                                this.props.expertMode ? (react_1.default.createElement(material_1.Grid, null,
                                    react_1.default.createElement(material_1.Grid, { container: true, direction: "row", spacing: 2, style: { marginTop: 0 } },
                                        this.props.expertMode ? (react_1.default.createElement(material_1.Grid, null,
                                            react_1.default.createElement(material_1.FormControl, { style: styles.formControl },
                                                react_1.default.createElement(material_1.InputLabel, { style: { marginTop: 10, marginLeft: -14 } }, this.props.t('Value type')),
                                                react_1.default.createElement(material_1.Select, { variant: "standard", value: this.state.type, onChange: e => {
                                                        this.setState({
                                                            type: e.target.value,
                                                            valid: e.target.value === 'number'
                                                                ? ObjectBrowserValue.isNumberValid({
                                                                    value: this.state.targetValue,
                                                                    common: this.props.object
                                                                        .common,
                                                                })
                                                                : true,
                                                            jsonError: false,
                                                        }, () => {
                                                            if (this.state.type === 'json') {
                                                                this.setState({
                                                                    targetValue: editorText(this.state.targetValue),
                                                                    jsonError: ObjectBrowserValue.checkJsonError(editorText(this.state.targetValue)),
                                                                });
                                                            }
                                                        });
                                                    } },
                                                    react_1.default.createElement(material_1.MenuItem, { value: "string" }, "String"),
                                                    react_1.default.createElement(material_1.MenuItem, { value: "number" }, "Number"),
                                                    react_1.default.createElement(material_1.MenuItem, { value: "boolean" }, "Boolean"),
                                                    react_1.default.createElement(material_1.MenuItem, { value: "json" }, "JSON/Object"),
                                                    hasStatesOptions ? (react_1.default.createElement(material_1.MenuItem, { value: "states" }, "States")) : null)))) : null,
                                        this.state.type === 'json' ? react_1.default.createElement(material_1.Grid, { sx: { flex: 1 } }) : null))) : null,
                                react_1.default.createElement(material_1.Grid, { sx: {
                                        flex: this.state.type === 'json' && this.state.fullScreen ? 1 : undefined,
                                    }, style: { paddingTop: 0 } }, this.state.type === 'boolean' ? (react_1.default.createElement(material_1.Typography, { component: "div", style: this.props.expertMode
                                        ? {
                                            marginTop: 20,
                                            width: '100%',
                                            backgroundColor: this.props.themeType === 'dark'
                                                ? '#595959'
                                                : '#dadada',
                                            borderRadius: 5,
                                            padding: 5,
                                        }
                                        : undefined },
                                    react_1.default.createElement(material_1.Grid, { component: "label", container: true, spacing: 1, sx: { alignItems: 'center' } },
                                        react_1.default.createElement(material_1.Grid, { style: { marginRight: 10 } },
                                            this.props.t('Value'),
                                            ":"),
                                        react_1.default.createElement(material_1.Grid, null, "FALSE"),
                                        react_1.default.createElement(material_1.Grid, null,
                                            react_1.default.createElement(material_1.Switch, { autoFocus: true, checked: ObjectBrowserValue.parseBoolean(this.state.targetValue), onKeyUp: e => e.key === 'Enter' && this.onUpdate(e), onChange: e => this.setState({ targetValue: e.target.checked }) })),
                                        react_1.default.createElement(material_1.Grid, null, "TRUE")))) : this.state.type === 'number' ? (react_1.default.createElement(material_1.TextField, { variant: "standard", fullWidth: true, autoFocus: true, error: !this.state.valid, type: "text", slotProps: {
                                        htmlInput: {
                                            inputMode: 'decimal',
                                            step: this.props.object.common.step,
                                            min: this.props.object.common.min,
                                            max: this.props.object.common.max,
                                        },
                                    }, inputRef: this.inputRef, helperText: this.props.t('Press ENTER to write the value, when focused'), value: editorText(this.state.targetValue), label: this.props.t('Value') +
                                        (this.props.object.common.min !== undefined ||
                                            this.props.object.common.unit === '%'
                                            ? `, ${this.props.t('min:')} ${this.props.object.common.min !== undefined ? this.props.object.common.min : 0}`
                                            : '') +
                                        (this.props.object.common.max !== undefined ||
                                            this.props.object.common.unit === '%'
                                            ? `, ${this.props.t('max:')} ${this.props.object.common.max !== undefined ? this.props.object.common.max : 100}`
                                            : ''), onKeyUp: e => e.key === 'Enter' && this.state.valid && this.onUpdate(e), onChange: e => {
                                        this.setState({
                                            targetValue: e.target.value,
                                            valid: ObjectBrowserValue.isNumberValid({
                                                value: e.target.value,
                                                common: this.props.object.common,
                                            }),
                                        });
                                    } })) : this.state.type === 'json' ? (this.renderJsonEditor()) : this.state.type === 'states' ? (this.renderStates()) : (react_1.default.createElement(material_1.TextField, { variant: "standard", fullWidth: true, inputRef: this.inputRef, autoFocus: true, helperText: this.props.t('Press CTRL+ENTER to write the value, when focused'), label: this.props.t('Value'), multiline: true, onKeyDown: e => e.ctrlKey && e.key === 'Enter' && this.onUpdate(e), defaultValue: editorText(this.propsValue), onChange: e => this.setState({ targetValue: e.target.value }) }))),
                                (this.props.role === 'date' || this.props.role?.startsWith('date.')) &&
                                    this.state.type === 'number' ? (react_1.default.createElement(material_1.Grid, { style: { display: 'flex', gap: '5px' }, size: { xs: 6 } }, this.renderTimePicker())) : null,
                                this.props.expertMode ? react_1.default.createElement(material_1.Grid, null, ackCheckbox) : null,
                                this.props.expertMode ? (react_1.default.createElement(material_1.Grid, null,
                                    react_1.default.createElement(material_1.FormControl, { variant: "standard", style: styles.quality },
                                        react_1.default.createElement(material_1.InputLabel, null, this.props.t('Quality')),
                                        react_1.default.createElement(material_1.Select, { variant: "standard", defaultValue: 0, onChange: e => (this.q = Number(e.target.value)) },
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x00 }, "0x00 - good"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x01 }, "0x01 - general problem"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x02 }, "0x02 - no connection problem"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x10 }, "0x10 - substitute value from controller"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x20 }, "0x20 - substitute initial value"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x40 }, "0x40 - substitute value from device or instance"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x80 }, "0x80 - substitute value from sensor"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x11 }, "0x11 - general problem by instance"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x41 }, "0x41 - general problem by device"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x81 }, "0x81 - general problem by sensor"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x12 }, "0x12 - instance not connected"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x42 }, "0x42 - device not connected"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x82 }, "0x82 - sensor not connected"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x44 }, "0x44 - device reports error"),
                                            react_1.default.createElement(material_1.MenuItem, { value: 0x84 }, "0x84 - sensor reports error"))),
                                    react_1.default.createElement(material_1.TextField, { variant: "standard", title: this.props.t('0 - no expiration'), sx: { '&.MuiTextField-root': styles.expire }, label: this.props.t('Expire'), type: "text", slotProps: {
                                            htmlInput: {
                                                inputMode: 'decimal',
                                                min: 0,
                                            },
                                        }, helperText: this.props.t('in seconds'), defaultValue: this.expire, onChange: e => (this.expire = Number(e.target.value)) }))) : null)),
                        this.state.chart && this.state.chartEnabled && this.state.type !== 'json' ? (react_1.default.createElement(material_1.Grid, { size: { xs: 12, md: 6 }, style: { minHeight: 300 }, 
                            // MUI breakpoints are min-width: without an `xs` entry the property
                            // stays unset below `sm` and the chart showed up on exactly the narrow
                            // screens it was meant to be hidden on.
                            sx: { display: { xs: 'none', md: 'inline-block' } } }, this.renderChart())) : null))),
            react_1.default.createElement(material_1.DialogActions, { sx: styles.wrapperButton },
                !this.props.expertMode ? ackCheckbox : null,
                !this.props.expertMode ? react_1.default.createElement("div", { style: { flexGrow: 1 } }) : null,
                react_1.default.createElement(material_1.Button, { variant: "contained", disabled: !this.state.valid ||
                        !!this.state.jsonError ||
                        this.state.writing ||
                        this.props.object.common?.write === false, onClick: e => this.onUpdate(e), color: "primary", startIcon: this.props.width !== 'xs' ? react_1.default.createElement(icons_material_1.Check, null) : undefined, style: this.props.object.common?.write === false ? styles.readOnly : undefined }, this.props.width !== 'xs' ? (this.state.writing ? (this.props.t('Please wait...')) : (this.props.t('Set value'))) : (react_1.default.createElement(icons_material_1.Check, { fontSize: "large" }))),
                react_1.default.createElement(material_1.Button, { variant: "contained", disabled: this.state.writing, onClick: () => {
                        if (!this.writePending) {
                            void this.props.onClose();
                        }
                    }, color: "grey", startIcon: this.props.width !== 'xs' ? react_1.default.createElement(icons_material_1.Close, null) : undefined }, this.props.width !== 'xs' ? this.props.t('Cancel') : react_1.default.createElement(icons_material_1.Close, { fontSize: "large" })))));
    }
}
exports.default = ObjectBrowserValue;
