import React from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-clouds_midnight';
import 'ace-builds/src-noconflict/theme-chrome';

// Icons
import { Close, ContentPaste } from '@mui/icons-material';

import { type IobTheme, type ThemeType, type Translate } from '@iobroker/gui-components';

import { onCtrlEnter, CTRL_ENTER_KEY } from '@/helpers/ctrlEnter';

const styles: Record<string, any> = {
    dialog: {
        height: '100%',
        maxHeight: '100%',
        maxWidth: '100%',
    },
    content: {
        textAlign: 'center',
    },
    error: (theme: IobTheme) => ({
        color: theme.palette.mode === 'dark' ? '#ff7777' : '#c20000',
    }),
    image: {
        height: '100%',
        width: 'auto',
    },
    text: {
        fontFamily: 'Lucida Console, Courier, monospace',
        width: '100%',
    },
    download: {
        textDecoration: 'none',
        textTransform: 'uppercase',
        fontSize: 14,
        color: 'white',
        border: '1px solid white',
        borderRadius: 5,
        padding: '8px 16px',
        marginRight: 8,
    },
};

interface ObjectImportFromTextDialogProps {
    t: Translate;
    onClose: (text?: string) => void;
    themeType: ThemeType;
}

export function ObjectImportFromTextDialog(props: ObjectImportFromTextDialogProps): React.JSX.Element {
    const [text, setText] = React.useState<string>('');
    // the command is registered once, so it has to reach the current state over a reference
    const onImportRef = React.useRef<() => void>(() => {});

    let error = false;
    try {
        JSON.parse(text);
    } catch {
        error = true;
    }

    /** CTRL+ENTER triggers the same action as the "Import objects" button */
    const onImport = (): void => {
        if (!error && text.trim()) {
            props.onClose(text);
        }
    };

    onImportRef.current = onImport;

    return (
        <Dialog
            style={styles.dialog}
            open={!0}
            maxWidth="lg"
            onClose={() => props.onClose()}
            onKeyDown={e => onCtrlEnter(e, onImport)}
            fullWidth
        >
            <DialogTitle>{props.t('Insert JSON with objects here')}</DialogTitle>
            <DialogContent style={{ minHeight: 500 }}>
                <AceEditor
                    width="100%"
                    height={'500px'}
                    mode="json"
                    theme={props.themeType === 'dark' ? 'clouds_midnight' : 'chrome'}
                    value={text}
                    onChange={newValue => setText(newValue)}
                    name="eos-object-import-json"
                    onLoad={editor => editor.focus()}
                    commands={[
                        {
                            name: 'eosImportObjects',
                            bindKey: CTRL_ENTER_KEY,
                            exec: () => onImportRef.current(),
                        },
                    ]}
                />
            </DialogContent>
            <DialogActions>
                <Tooltip title={props.t('Press CTRL+ENTER to confirm')}>
                    <span>
                        <Button
                            variant="contained"
                            disabled={error || !text.trim()}
                            onClick={() => props.onClose(text)}
                            startIcon={<ContentPaste />}
                            color="primary"
                        >
                            {props.t('Import objects')}
                        </Button>
                    </span>
                </Tooltip>
                <Button
                    variant="contained"
                    onClick={() => props.onClose()}
                    startIcon={<Close />}
                    color="grey"
                >
                    {props.t('Close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
