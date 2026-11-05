import React, { Component, type JSX } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-clouds_midnight';
import 'ace-builds/src-noconflict/theme-chrome';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

// Icons
import { Close as CloseIcon, Check as CheckIcon } from '@mui/icons-material';

import { Utils, type Translate, type ThemeName } from '@iobroker/gui-components';
import type { ioBrokerObject } from '@/types';

const styles: Record<string, React.CSSProperties> = {
    dialog: {
        height: '100%',
        maxHeight: '100%',
        maxWidth: '100%',
    },
    content: {
        textAlign: 'center',
    },
};

interface ObjectEditDialogProps {
    t: Translate;
    themeName: ThemeName;
    obj: ioBrokerObject;
    onClose: () => void;
}

interface ObjectEditDialogState {
    code: string;
    changed: boolean;
}

export default class ObjectEditDialog extends Component<ObjectEditDialogProps, ObjectEditDialogState> {
    constructor(props: ObjectEditDialogProps) {
        super(props);

        this.state = {
            code: JSON.stringify(this.props.obj._id, null, 2),
            changed: false,
        };
    }

    onSave(): void {
        this.props.onClose();
    }

    render(): JSX.Element {
        return (
            <Dialog
                style={styles.dialog}
                open={!0}
                onClose={() => this.props.onClose()}
                fullWidth
                fullScreen
                aria-labelledby="object-edit-dialog-title"
            >
                <DialogTitle id="object-edit-dialog-title">
                    {this.props.t('Edit object: %s', this.props.obj._id)}
                </DialogTitle>
                <DialogContent style={styles.content}>
                    <AceEditor
                        width="100%"
                        height="100%"
                        mode="json"
                        //  knows every dark theme, a comparison against the name
                        // would show a bright editor in e.g. 'modernDark'
                        theme={Utils.getThemeType(this.props.themeName) === 'dark' ? 'clouds_midnight' : 'chrome'}
                        value={this.state.code}
                        name="eos-object-edit-json"
                        onLoad={editor => editor.focus()}
                        onChange={code => this.setState({ code, changed: true })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        variant="contained"
                        color="primary"
                        disabled={!this.state.changed}
                        onClick={() => this.onSave()}
                        startIcon={<CheckIcon />}
                    >
                        {this.props.t('Save')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => this.props.onClose()}
                        startIcon={<CloseIcon />}
                        color="grey"
                    >
                        {this.props.t('Close')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}
