import React, { useEffect, useRef, useState, type JSX } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { I18n } from '@iobroker/gui-components';
import { requestLicense, type EosLicenseStatus } from './eosLicenseApi';

export default function EosLicenseDialog(): JSX.Element {
    const de = I18n.getLanguage() === 'de';
    const tr = (german: string, english: string): string => (de ? german : english);
    const [status, setStatus] = useState<EosLicenseStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [token, setToken] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [confirmRemove, setConfirmRemove] = useState(false);
    const request = useRef<AbortController | null>(null);
    const mounted = useRef(false);

    const errorText = (code: string): string => {
        const messages: Record<string, string> = {
            LICENSE_MISSING: tr('Keine Lizenz aktiviert.', 'No license activated.'),
            LICENSE_VALID: tr('Lizenz gültig.', 'License valid.'),
            LICENSE_EXPIRED: tr('Lizenz abgelaufen.', 'License expired.'),
            LICENSE_UUID_MISMATCH: tr(
                'Die Lizenz gehört nicht zu dieser System-UUID.',
                'The license belongs to another system UUID.',
            ),
            LICENSE_UUID_CHANGED: tr(
                'Die System-UUID hat sich geändert. Bitte den Service kontaktieren.',
                'The system UUID changed. Contact support.',
            ),
            LICENSE_SIGNATURE_INVALID: tr('Die Lizenzsignatur ist ungültig.', 'The license signature is invalid.'),
            LICENSE_FORMAT: tr('Bitte einen gültigen NWL2-Lizenzcode eingeben.', 'Enter a valid NWL2 license code.'),
            LICENSE_ADMIN_REQUIRED: tr(
                'Die Lizenzverwaltung erfordert ein Administrator-Konto.',
                'License management requires an administrator account.',
            ),
            LICENSE_HTTPS_REQUIRED: tr(
                'Bitte den EOS Admin über HTTPS öffnen, um Lizenzen zu verwalten.',
                'Open EOS Admin over HTTPS to manage licenses.',
            ),
            LICENSE_CLOCK_ROLLBACK: tr('Bitte Systemdatum und Uhrzeit prüfen.', 'Check the system date and time.'),
            LICENSE_RATE_LIMIT: tr(
                'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.',
                'Too many requests. Wait briefly and try again.',
            ),
            TRUST_PERMISSIONS: tr(
                'Der öffentliche Herstellerschlüssel muss sicher eingerichtet werden.',
                'The public manufacturer key must be configured securely.',
            ),
            SERVICE_UNAVAILABLE: tr(
                'Lizenzverwaltung derzeit nicht bereit. Einrichtung und Herstellerschlüssel prüfen.',
                'License management is not ready. Check the setup and manufacturer key.',
            ),
        };
        return (
            messages[code] ||
            tr(
                'Anfrage fehlgeschlagen. Bitte Status erneut prüfen.',
                'Request failed. Refresh the status and try again.',
            )
        );
    };

    const run = async (action: 'status' | 'activate' | 'remove', activationCode?: string): Promise<void> => {
        if (request.current) {
            return;
        }
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const next = await requestLicense(action, controller.signal, activationCode);
            if (!mounted.current || request.current !== controller || controller.signal.aborted) {
                return;
            }
            setStatus(next);
            if (action === 'activate') {
                setMessage(
                    tr('Lizenz geprüft und verschlüsselt gespeichert.', 'License verified and stored encrypted.'),
                );
            }
            if (action === 'remove') {
                setMessage(tr('Lizenz entfernt.', 'License removed.'));
            }
        } catch (cause) {
            if (!mounted.current || request.current !== controller || controller.signal.aborted) {
                return;
            }
            // A rejected import keeps the server's previous license; the UI must not imply that it was removed.
            setStatus(null);
            setError(errorText(cause instanceof Error ? cause.message : 'SERVICE_UNAVAILABLE'));
        } finally {
            if (request.current === controller) {
                request.current = null;
                if (mounted.current) {
                    setBusy(false);
                }
            }
        }
    };

    useEffect(() => {
        mounted.current = true;
        void run('status');
        return () => {
            mounted.current = false;
            request.current?.abort();
            request.current = null;
        };
        // One request per mounted panel; later actions are explicit user requests.
    }, []);

    const features: Record<string, string> = {
        energy: tr('Energiemanagement', 'Energy management'),
        wallet: tr('Energie-Wertkonto', 'Energy wallet'),
        smartHome: 'Smart Home',
        microgridSlave: 'Microgrid Slave',
        microgridMaster: 'Microgrid Master',
        multisite: tr('Mehrere Standorte', 'Multiple sites'),
        billing: tr('Abrechnung', 'Billing'),
    };
    const details = [
        [tr('System-UUID', 'System UUID'), status?.uuid || '–'],
        [
            tr('Edition', 'Edition'),
            status?.edition === 'home' ? 'EOS Home' : status?.edition === 'pro' ? 'EOS Pro' : '–',
        ],
        [
            tr('Gültig bis', 'Valid until'),
            status?.valid
                ? status.expiresAt === null
                    ? tr('Dauerhaft', 'Perpetual')
                    : new Date(status.expiresAt).toLocaleString()
                : '–',
        ],
        [
            tr('Ladepunkte / Speicher', 'Charge points / batteries'),
            status?.valid ? `${status.limits.chargePoints} / ${status.limits.batteries}` : '–',
        ],
        [tr('Funktionen', 'Features'), status?.features.map(name => features[name] || name).join(', ') || '–'],
    ];

    return (
        <Box
            sx={{ height: '100%', overflow: 'auto', p: 3, boxSizing: 'border-box' }}
            data-eos-license-panel="1"
        >
            <Stack
                spacing={2}
                sx={{ maxWidth: 960, mx: 'auto' }}
            >
                <Typography variant="h5">{tr('EOS Lizenzverwaltung', 'EOS license management')}</Typography>
                <Typography>
                    {tr(
                        'Home und Pro zentral für dieses EOS-System verwalten.',
                        'Manage Home and Pro centrally for this EOS system.',
                    )}
                </Typography>
                {error ? (
                    <Alert
                        severity="error"
                        role="alert"
                    >
                        {error}
                    </Alert>
                ) : null}
                {message ? (
                    <Alert
                        severity="success"
                        role="status"
                    >
                        {message}
                    </Alert>
                ) : null}
                <Card variant="outlined">
                    <CardContent>
                        <Stack
                            direction="row"
                            spacing={2}
                            sx={{ mb: 2, alignItems: 'center' }}
                        >
                            <Typography variant="h6">{tr('Aktueller Status', 'Current status')}</Typography>
                            <Chip
                                label={
                                    busy
                                        ? tr('Wird geprüft …', 'Checking …')
                                        : status
                                          ? errorText(status.code)
                                          : tr('Nicht bestätigt', 'Unconfirmed')
                                }
                                color={status?.valid && !busy ? 'success' : 'default'}
                            />
                        </Stack>
                        <Box
                            component="dl"
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '190px 1fr' },
                                gap: 1,
                                '& dd': { m: 0, overflowWrap: 'anywhere' },
                                '& dt': { fontWeight: 600 },
                            }}
                        >
                            {details.map(([label, value]) => (
                                <React.Fragment key={label}>
                                    <Box component="dt">{label}</Box>
                                    <Box component="dd">{value}</Box>
                                </React.Fragment>
                            ))}
                        </Box>
                        <Button
                            data-eos-license-refresh="1"
                            disabled={busy}
                            onClick={() => void run('status')}
                        >
                            {tr('Status aktualisieren', 'Refresh status')}
                        </Button>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent>
                        <Typography
                            variant="h6"
                            gutterBottom
                        >
                            {tr('Lizenz aktivieren', 'Activate license')}
                        </Typography>
                        <Typography sx={{ mb: 2 }}>
                            {tr(
                                'Den für diese System-UUID ausgestellten NWL2-Code aus dem NexoWatt Key-Generator eingeben. Die Prüfung und verschlüsselte Speicherung erfolgen auf dem Gerät.',
                                'Enter the NWL2 code issued for this system UUID by the NexoWatt key generator. Verification and encrypted storage take place on this device.',
                            )}
                        </Typography>
                        <TextField
                            id="eos-license-code"
                            fullWidth
                            multiline
                            minRows={3}
                            disabled={busy}
                            label={tr('Neuer Lizenzcode', 'New license code')}
                            value={token}
                            onChange={event => setToken(event.target.value)}
                            autoComplete="off"
                            slotProps={{ htmlInput: { maxLength: 16384, spellCheck: false } }}
                        />
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{ my: 2 }}
                        >
                            <Button
                                data-eos-license-activate="1"
                                variant="contained"
                                disabled={busy || !token.trim()}
                                onClick={() => {
                                    const code = token;
                                    setToken('');
                                    void run('activate', code);
                                }}
                            >
                                {tr('Prüfen und aktivieren', 'Verify and activate')}
                            </Button>
                            <Button
                                data-eos-license-remove="1"
                                color="error"
                                disabled={busy}
                                onClick={() => setConfirmRemove(true)}
                            >
                                {tr('Lizenz entfernen', 'Remove license')}
                            </Button>
                        </Stack>
                        <Typography variant="body2">
                            {tr(
                                'Der gespeicherte Lizenzcode wird nicht zurück angezeigt. Ein ungültiger Import ersetzt keine gültige Lizenz. Die Lizenzaktionen werden sofort ausgeführt und benötigen kein „Speichern und schließen“.',
                                'The stored license code is never displayed. An invalid import does not replace a valid license. License actions take effect immediately and do not require Save & Close.',
                            )}
                        </Typography>
                    </CardContent>
                </Card>
                <Alert severity="info">
                    {tr(
                        'Ohne gültige Lizenz bleiben Lizenzverwaltung, Diagnose und Sicherheitswartung erreichbar. Angebundene Adapter erhalten ihre Freigabe über die zentrale Lizenzprüfung.',
                        'License management, diagnostics and security maintenance remain accessible without a valid license. Integrated adapters obtain authorization from the central license check.',
                    )}
                </Alert>
            </Stack>
            <Dialog
                open={confirmRemove}
                onClose={() => setConfirmRemove(false)}
            >
                <DialogTitle>{tr('Lizenz entfernen?', 'Remove license?')}</DialogTitle>
                <DialogContent>
                    {tr(
                        'Angebundene Adapter verlieren ihre Betriebsfreigabe. Stelle vorher den sicheren Anlagenzustand her.',
                        'Integrated adapters lose their operating authorization. Establish a safe plant state before continuing.',
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmRemove(false)}>{tr('Abbrechen', 'Cancel')}</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            setConfirmRemove(false);
                            void run('remove');
                        }}
                    >
                        {tr('Entfernen', 'Remove')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
