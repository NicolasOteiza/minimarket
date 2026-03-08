const API_URL = (() => {
    const overrideRaw = String(window.localStorage.getItem('api_url') || '').trim();
    if (overrideRaw) {
        try {
            const parsed = new URL(overrideRaw, window.location.origin);
            const overrideHost = String(parsed.hostname || '').toLowerCase();
            const currentHost = String(window.location.hostname || '').toLowerCase();
            const isOverrideLocalhost = ['localhost', '127.0.0.1', '::1'].includes(overrideHost);
            const isCurrentLocalhost = ['localhost', '127.0.0.1', '::1'].includes(currentHost);
            if (!(isOverrideLocalhost && !isCurrentLocalhost)) {
                return parsed.href.endsWith('/') ? parsed.href : `${parsed.href}/`;
            }
        } catch (_) {}
    }
    if (window.location.port === '3001') {
        return `${window.location.origin}/`;
    }
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    const protocol = isLocalHost ? 'http:' : window.location.protocol;
    return `${protocol}//${window.location.hostname}:3001/`;
})();

let frontendErrorReportingBootstrapped = false;
let frontendLastErrorReportAt = 0;

function reportClientErrorToServer(payload = {}) {
    const now = Date.now();
    if ((now - frontendLastErrorReportAt) < 2500) return;
    frontendLastErrorReportAt = now;
    try {
        fetch(API_URL + 'api/error-report', {
            method: 'POST',
            headers: {
                ...withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
            },
            body: JSON.stringify({
                source: String(payload.source || 'frontend.unknown').slice(0, 120),
                message: String(payload.message || '').slice(0, 2000),
                stack: String(payload.stack || '').slice(0, 9000),
                url: window.location.href,
                method: payload.method || '',
                user_agent: navigator.userAgent || '',
                caja: String(localStorage.getItem('n_caja') || localStorage.getItem('caja') || ''),
                user: String(localStorage.getItem('id_user') || ''),
            }),
        }).catch(() => {});
    } catch (_) {
        // noop
    }
}

function setupFrontendErrorReporting() {
    if (frontendErrorReportingBootstrapped) return;
    frontendErrorReportingBootstrapped = true;

    window.addEventListener('error', (event) => {
        try {
            reportClientErrorToServer({
                source: 'frontend.window.error',
                message: event?.message || 'Error de frontend',
                stack: event?.error?.stack || '',
            });
        } catch (_) {}
    });

    window.addEventListener('unhandledrejection', (event) => {
        try {
            const reason = event?.reason;
            reportClientErrorToServer({
                source: 'frontend.unhandledrejection',
                message: reason?.message || String(reason || 'Promise rejected'),
                stack: reason?.stack || '',
            });
        } catch (_) {}
    });
}

(function setupCustomAlertUI() {
    if (window.__minimarketAlertUiInit) return;
    window.__minimarketAlertUiInit = true;

    const style = document.createElement('style');
    style.textContent = `
      #mm-alert-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: none; align-items: center; justify-content: center; z-index: 2147483000; padding: 16px; }
      #mm-alert-overlay.show { display: flex; }
      #mm-alert-box { width: min(520px, 94vw); background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; box-shadow: 0 20px 50px rgba(2,6,23,.25); overflow: hidden; }
      #mm-alert-head { padding: 12px 16px; color: #fff; font-weight: 700; letter-spacing: .2px; display: flex; align-items: center; gap: 8px; }
      #mm-alert-icon { width: 20px; text-align: center; font-size: 16px; }
      #mm-alert-title { font-size: 14px; }
      #mm-alert-message { padding: 16px; color: #0f172a; white-space: pre-wrap; line-height: 1.45; font-size: 14px; }
      #mm-alert-input-wrap { padding: 0 16px 14px; }
      #mm-alert-input { width: 100%; min-height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 14px; color: #0f172a; background: #fff; }
      #mm-alert-input.mm-alert-input-invalid { border-color: #dc2626; box-shadow: 0 0 0 2px rgba(220,38,38,.16); }
      #mm-alert-inline-error { margin-top: 6px; color: #b91c1c; font-size: 12px; font-weight: 600; min-height: 16px; }
      #mm-alert-inline-help { margin-top: 4px; color: #475569; font-size: 12px; min-height: 16px; }
      #mm-alert-inline-help.mm-alert-inline-help-warning { color: #b91c1c; font-weight: 600; }
      #mm-alert-actions { padding: 0 16px 16px; display: flex; justify-content: flex-end; gap: 10px; }
      #mm-alert-cancel { border: 1px solid #94a3b8; background: #f8fafc; color: #0f172a; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
      #mm-alert-cancel:hover { background: #eef2f7; }
      #mm-alert-close { border: 1px solid #1d4ed8; background: #2563eb; color: #fff; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
      #mm-alert-close:hover { background: #1d4ed8; }
      #mm-alert-box.mm-alert-success #mm-alert-head { background: linear-gradient(135deg, #15803d, #16a34a); }
      #mm-alert-box.mm-alert-success #mm-alert-close { border-color: #15803d; background: #16a34a; }
      #mm-alert-box.mm-alert-success #mm-alert-close:hover { background: #15803d; }
      #mm-alert-box.mm-alert-error #mm-alert-head { background: linear-gradient(135deg, #b91c1c, #dc2626); }
      #mm-alert-box.mm-alert-error #mm-alert-close { border-color: #b91c1c; background: #dc2626; }
      #mm-alert-box.mm-alert-error #mm-alert-close:hover { background: #b91c1c; }
      #mm-alert-box.mm-alert-warning #mm-alert-head { background: linear-gradient(135deg, #b45309, #d97706); }
      #mm-alert-box.mm-alert-warning #mm-alert-close { border-color: #b45309; background: #d97706; }
      #mm-alert-box.mm-alert-warning #mm-alert-close:hover { background: #b45309; }
      #mm-alert-box.mm-alert-input #mm-alert-head { background: linear-gradient(135deg, #0f766e, #0d9488); }
      #mm-alert-box.mm-alert-input #mm-alert-close { border-color: #0f766e; background: #0d9488; }
      #mm-alert-box.mm-alert-input #mm-alert-close:hover { background: #0f766e; }
      #mm-alert-box.mm-alert-info #mm-alert-head { background: linear-gradient(135deg, #1d4ed8, #2563eb); }
      body.dark #mm-alert-box { background: #111827; border-color: #334155; }
      body.dark #mm-alert-message { color: #e5e7eb; }
      body.dark #mm-alert-input { background: #0b1220; border-color: #334155; color: #e5e7eb; }
      body.dark #mm-alert-cancel { background: #1f2937; color: #e5e7eb; border-color: #334155; }
      body.dark #mm-alert-cancel:hover { background: #273449; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'mm-alert-overlay';
    overlay.innerHTML = `
      <div id="mm-alert-box" class="mm-alert-info" role="alertdialog" aria-modal="true" aria-labelledby="mm-alert-title">
        <div id="mm-alert-head">
          <span id="mm-alert-icon">i</span>
          <span id="mm-alert-title">Informacion</span>
        </div>
        <div id="mm-alert-message"></div>
        <div id="mm-alert-input-wrap" style="display:none;">
          <input id="mm-alert-input" type="text" />
          <div id="mm-alert-inline-help"></div>
          <div id="mm-alert-inline-error"></div>
        </div>
        <div id="mm-alert-actions">
          <button id="mm-alert-cancel" type="button" style="display:none;">Cancelar</button>
          <button id="mm-alert-close" type="button">Entendido</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const boxEl = overlay.querySelector('#mm-alert-box');
    const iconEl = overlay.querySelector('#mm-alert-icon');
    const titleEl = overlay.querySelector('#mm-alert-title');
    const messageEl = overlay.querySelector('#mm-alert-message');
    const inputWrapEl = overlay.querySelector('#mm-alert-input-wrap');
    const inputEl = overlay.querySelector('#mm-alert-input');
    const inlineHelpEl = overlay.querySelector('#mm-alert-inline-help');
    const inlineErrorEl = overlay.querySelector('#mm-alert-inline-error');
    const closeBtn = overlay.querySelector('#mm-alert-close');
    const cancelBtn = overlay.querySelector('#mm-alert-cancel');

    let activeResolver = null;
    let activeMode = 'alert';
    let activeDialogOptions = {};

    function setInlineError(message = '') {
        if (!inlineErrorEl) return;
        inlineErrorEl.textContent = String(message || '');
    }

    function setInlineHelp(message = '') {
        if (!inlineHelpEl) return;
        inlineHelpEl.textContent = String(message || '');
    }

    function applyPromptValidationState() {
        if (activeMode !== 'prompt') return true;
        const validate = typeof activeDialogOptions?.validate === 'function' ? activeDialogOptions.validate : null;
        const shouldDisableOkWhenInvalid = Boolean(activeDialogOptions?.disableOkWhenInvalid);
        if (!validate) {
            inputEl.classList.remove('mm-alert-input-invalid');
            if (shouldDisableOkWhenInvalid) closeBtn.disabled = false;
            setInlineError('');
            return true;
        }
        const value = String(inputEl.value || '');
        const validationMessage = validate(value);
        const isValid = !validationMessage;
        inputEl.classList.toggle('mm-alert-input-invalid', !isValid);
        const hideValidationMessage = Boolean(activeDialogOptions?.hideValidationMessage);
        setInlineError(isValid || hideValidationMessage ? '' : validationMessage);
        if (shouldDisableOkWhenInvalid) {
            closeBtn.disabled = !isValid;
        }
        return isValid;
    }

    function resolveDialog(value) {
        if (!activeResolver) return;
        const resolver = activeResolver;
        activeResolver = null;
        overlay.classList.remove('show');
        resolver(value);
    }

    function closeByDismiss() {
        if (activeDialogOptions?.disableCancel) {
            return;
        }
        if (activeMode === 'prompt') {
            resolveDialog(null);
            return;
        }
        if (activeMode === 'confirm') {
            resolveDialog(false);
            return;
        }
        resolveDialog(true);
    }

    overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) closeByDismiss();
    });

    document.addEventListener('keydown', (ev) => {
        if (!overlay.classList.contains('show')) return;
        if (ev.key === 'Escape') {
            ev.preventDefault();
            if (activeDialogOptions?.disableCancel) return;
            closeByDismiss();
        }
        if (ev.key === 'Enter') {
            ev.preventDefault();
            if (activeMode === 'prompt') {
                const value = String(inputEl.value || '');
                const validate = typeof activeDialogOptions?.validate === 'function' ? activeDialogOptions.validate : null;
                const validationMessage = validate ? validate(value) : '';
                if (validationMessage) {
                    setInlineError(validationMessage);
                    return;
                }
                setInlineError('');
                resolveDialog(value);
            } else {
                resolveDialog(true);
            }
        }
    });

    function detectType(rawMessage, forcedType = '') {
        const normalizedForced = String(forcedType || '').trim().toLowerCase();
        if (normalizedForced) return normalizedForced;

        const message = String(rawMessage || '').toLowerCase();
        if (/\[(error|err|danger)\]/.test(message)) return 'error';
        if (/\[(ok|success|exito|exitoso|exitosamente)\]/.test(message)) return 'success';
        if (/\[(warn|warning|aviso|advertencia)\]/.test(message)) return 'warning';
        if (/\[(input|ingresar|dato|formulario)\]/.test(message)) return 'input';

        if (/\berror\b|inval|invalid|no se pudo|fall|bloque|deneg|expirad|forbidden|token/.test(message)) return 'error';
        if (/guardad|actualiz|eliminad|cread|completad|enviad|correct|exito|exitosa|exitosa/.test(message)) return 'success';
        if (/debes|atencion|atenci[oó]n|selecciona|revisa|rango|faltan|obligatorio/.test(message)) return 'warning';
        if (/ingresa|escribe|completa|datos|formulario|captura/.test(message)) return 'input';

        return 'info';
    }

    function getTypeConfig(type) {
        switch (type) {
        case 'error':
            return { cls: 'mm-alert-error', icon: 'X', title: 'Error' };
        case 'success':
            return { cls: 'mm-alert-success', icon: 'OK', title: 'Correcto' };
        case 'warning':
            return { cls: 'mm-alert-warning', icon: '!', title: 'Atencion' };
        case 'input':
            return { cls: 'mm-alert-input', icon: '>', title: 'Ingreso de informacion' };
        default:
            return { cls: 'mm-alert-info', icon: 'i', title: 'Informacion' };
        }
    }

    function openDialog(options) {
        if (!messageEl || !boxEl || !titleEl || !iconEl || !closeBtn || !cancelBtn || !inputWrapEl || !inputEl) {
            return Promise.resolve(null);
        }

        const opts = options || {};
        const mode = String(opts.mode || 'alert');
        activeMode = mode;
        activeDialogOptions = opts;

        const detectedType = detectType(opts.message, opts.type || '');
        const cfg = getTypeConfig(detectedType);
        boxEl.classList.remove('mm-alert-info', 'mm-alert-success', 'mm-alert-error', 'mm-alert-warning', 'mm-alert-input');
        boxEl.classList.add(cfg.cls);

        iconEl.textContent = cfg.icon;
        titleEl.textContent = String(opts.title || cfg.title);
        messageEl.textContent = String(opts.message ?? '');

        closeBtn.textContent = String(opts.okText || (mode === 'alert' ? 'Entendido' : 'Aceptar'));
        cancelBtn.textContent = String(opts.cancelText || 'Cancelar');

        const disableCancel = Boolean(opts.disableCancel);
        const needsCancel = (mode === 'confirm' || mode === 'prompt') && !disableCancel;
        const needsInput = mode === 'prompt';

        cancelBtn.style.display = needsCancel ? '' : 'none';
        inputWrapEl.style.display = needsInput ? '' : 'none';

        inputEl.value = needsInput ? String(opts.defaultValue ?? '') : '';
        inputEl.placeholder = needsInput ? String(opts.placeholder || '') : '';
        inputEl.type = needsInput ? String(opts.inputType || 'text') : 'text';
        inputEl.inputMode = needsInput ? String(opts.inputMode || '') : '';
        inputEl.min = (needsInput && typeof opts.min !== 'undefined') ? String(opts.min) : '';
        inputEl.max = (needsInput && typeof opts.max !== 'undefined') ? String(opts.max) : '';
        inputEl.step = (needsInput && typeof opts.step !== 'undefined') ? String(opts.step) : '';
        setInlineHelp(needsInput ? String(opts.helpText || '') : '');
        if (inlineHelpEl) {
            inlineHelpEl.classList.toggle('mm-alert-inline-help-warning', Boolean(opts.helpStyle === 'warning'));
        }
        setInlineError('');
        inputEl.classList.remove('mm-alert-input-invalid');
        closeBtn.disabled = false;

        overlay.classList.add('show');

        return new Promise((resolve) => {
            activeResolver = resolve;
            setTimeout(() => {
                if (needsInput) {
                    inputEl.focus();
                    inputEl.select();
                    applyPromptValidationState();
                } else {
                    closeBtn.focus();
                }
            }, 0);
        });
    }

    closeBtn.addEventListener('click', () => {
        if (activeMode === 'prompt') {
            if (!applyPromptValidationState()) {
                return;
            }
            const value = String(inputEl.value || '');
            resolveDialog(value);
            return;
        }
        resolveDialog(true);
    });

    cancelBtn.addEventListener('click', () => {
        if (activeMode === 'prompt') {
            resolveDialog(null);
            return;
        }
        resolveDialog(false);
    });

    inputEl.addEventListener('input', () => {
        if (activeMode !== 'prompt') return;
        applyPromptValidationState();
    });

    window.__nativeAlert = window.alert.bind(window);
    window.__nativeConfirm = window.confirm.bind(window);
    window.__nativePrompt = window.prompt.bind(window);

    window.appNotify = function appNotify(message, type = '') {
        openDialog({ mode: 'alert', message, type });
    };

    window.appConfirm = function appConfirm(message, type = 'warning', options = {}) {
        return openDialog({ mode: 'confirm', message, type, ...options }).then((value) => Boolean(value));
    };

    window.appPrompt = function appPrompt(message, defaultValue = '', options = {}) {
        return openDialog({ mode: 'prompt', message, type: 'input', defaultValue, ...options }).then((value) => {
            if (value === null) return null;
            return String(value);
        });
    };

    window.alert = function customAlert(message) {
        openDialog({ mode: 'alert', message });
    };
})();

let isFinalizingSale = false;
let shiftStarted = false;
let shiftValidationRetryTimer = null;
let searchProductsDebounceTimer = null;
let searchProductsLastResults = [];
let searchSelectedProductId = null;
let salesBarcodeSuggestDebounceTimer = null;
let salesBarcodeSuggestCodes = new Set();
const SALES_CAMERA_PERMISSION_KEY = 'sales_camera_permission_prompt_v1';
let salesCameraPermissionInFlight = false;
let salesCameraScanStream = null;
let salesCameraScanRaf = null;
let salesCameraScanActive = false;
let salesBarcodeDetector = null;
let selectedCartIndex = -1;
let isClosingShift = false;
let scannerRuntimeSettings = {
    scanner_mode: 'keyboard',
    scanner_suffix: 'enter',
    scanner_prefix_to_strip: '',
    scanner_prefix_trim: true,
    scanner_only_numeric: true,
    scanner_auto_focus: true,
    scanner_beep_on_scan: false,
};
let cutCloseContext = {
    scope: null,
    esperadoEfectivo: 0,
    esperadoTarjeta: 0,
    resumenLoaded: false,
    sessionResumenLoaded: false,
};
const TICKET_COUNTER_API_MODE_KEY = 'ticket_counter_api_mode';
const SHIFT_OWNER_USER_KEY = 'turno_owner_user';
const SHIFT_OWNER_CAJA_KEY = 'turno_owner_caja';
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token';
let refreshInFlightPromise = null;
let fetchAuthInterceptorInitialized = false;

function getSessionToken() {
    const sessionToken = sessionStorage.getItem('token');
    if (sessionToken) return sessionToken;
    const localToken = localStorage.getItem('token');
    if (localToken) {
        sessionStorage.setItem('token', localToken);
        return localToken;
    }
    return null;
}

function getRefreshToken() {
    const sessionRefresh = sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (sessionRefresh) return sessionRefresh;
    const localRefresh = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (localRefresh) {
        sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, localRefresh);
        return localRefresh;
    }
    return null;
}

function setSessionTokens(accessToken, refreshToken) {
    if (accessToken) {
        sessionStorage.setItem('token', accessToken);
        localStorage.setItem('token', accessToken);
    }
    if (refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    }
}

async function revokeRefreshTokenSilently() {
    try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return;
        await fetch(API_URL + 'api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
    } catch (_) {
    }
}

function clearSessionTokens() {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

async function refreshAccessTokenIfNeeded() {
    if (refreshInFlightPromise) {
        return refreshInFlightPromise;
    }
    refreshInFlightPromise = (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return null;
        const response = await fetch(API_URL + 'api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.token || !data?.refresh_token) {
            return null;
        }
        setSessionTokens(data.token, data.refresh_token);
        return data.token;
    })();
    try {
        return await refreshInFlightPromise;
    } finally {
        refreshInFlightPromise = null;
    }
}

function isApiUrlRequest(url) {
    try {
        const absolute = new URL(url, window.location.origin);
        const apiBase = new URL(API_URL, window.location.origin);
        return absolute.origin === apiBase.origin && absolute.pathname.startsWith(apiBase.pathname + 'api/');
    } catch (_) {
        return false;
    }
}

function setupAuthFetchInterceptor() {
    if (fetchAuthInterceptorInitialized || typeof window.fetch !== 'function') return;
    fetchAuthInterceptorInitialized = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : (input?.url || '');
        const isApiRequest = isApiUrlRequest(url);
        const isRefreshRoute = typeof url === 'string' && url.includes('/api/auth/refresh');
        const isLoginRoute = typeof url === 'string' && url.includes('/api/login');
        const alreadyRetried = Boolean(init && init.__authRetried);

        const response = await originalFetch(input, init);
        if (!isApiRequest || isRefreshRoute || isLoginRoute || response.status !== 401 || alreadyRetried) {
            return response;
        }

        const newAccessToken = await refreshAccessTokenIfNeeded();
        if (!newAccessToken) {
            return response;
        }

        const retryInit = { ...(init || {}) };
        const retryHeaders = new Headers(retryInit.headers || {});
        retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);
        retryInit.headers = retryHeaders;
        retryInit.__authRetried = true;
        return originalFetch(input, retryInit);
    };
}

setupAuthFetchInterceptor();

function buildTicketCounterStorageKey() {
    const caja = localStorage.getItem('n_caja') || localStorage.getItem('caja');
    const cajero = localStorage.getItem('id_user');
    const turnoId = localStorage.getItem('turno_id_actual');
    if (!caja || !cajero || !turnoId) return null;
    return `ticket_counter_${caja}_${cajero}_${turnoId}`;
}

function getStoredTicketCounter() {
    const key = buildTicketCounterStorageKey();
    if (!key) return null;
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
}

function setStoredTicketCounter(nextTicketNumber) {
    const key = buildTicketCounterStorageKey();
    if (!key) return;
    const parsed = Number(nextTicketNumber);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    localStorage.setItem(key, String(Math.floor(parsed)));
}

function clearTicketCounterForCurrentShift() {
    const key = buildTicketCounterStorageKey();
    if (key) {
        localStorage.removeItem(key);
    }
}

function buildTicketPendingSyncStorageKey() {
    const key = buildTicketCounterStorageKey();
    return key ? `${key}_pending_sync` : null;
}

function getPendingTicketCounterSync() {
    const key = buildTicketPendingSyncStorageKey();
    if (!key) return null;
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function setPendingTicketCounterSync(nextTicketNumber) {
    const key = buildTicketPendingSyncStorageKey();
    if (!key) return;
    const parsed = Number(nextTicketNumber);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    localStorage.setItem(key, String(Math.floor(parsed)));
}

function clearPendingTicketCounterSync() {
    const key = buildTicketPendingSyncStorageKey();
    if (!key) return;
    localStorage.removeItem(key);
}

function getCurrentCajaId() {
    return String(localStorage.getItem('n_caja') || localStorage.getItem('caja') || '').trim();
}

function getCurrentUserId() {
    return String(localStorage.getItem('id_user') || '').trim();
}

function setLocalShiftOwnership() {
    const caja = getCurrentCajaId();
    const cajero = getCurrentUserId();
    if (!caja || !cajero) return;
    localStorage.setItem(SHIFT_OWNER_CAJA_KEY, caja);
    localStorage.setItem(SHIFT_OWNER_USER_KEY, cajero);
}

function hasLocalShiftContextForCurrentUser() {
    const turnoId = String(localStorage.getItem('turno_id_actual') || '').trim();
    const ownerCaja = String(localStorage.getItem(SHIFT_OWNER_CAJA_KEY) || '').trim();
    const ownerUser = String(localStorage.getItem(SHIFT_OWNER_USER_KEY) || '').trim();
    const caja = getCurrentCajaId();
    const cajero = getCurrentUserId();
    return Boolean(turnoId && ownerCaja && ownerUser && ownerCaja === caja && ownerUser === cajero);
}

function buildShiftSalesStorageKey() {
    const caja = getCurrentCajaId();
    const cajero = getCurrentUserId();
    const turnoId = String(localStorage.getItem('turno_id_actual') || '').trim();
    if (!caja || !cajero || !turnoId) return null;
    return `turno_has_sales_${caja}_${cajero}_${turnoId}`;
}

function setLocalShiftHasSales(hasSales) {
    const key = buildShiftSalesStorageKey();
    if (!key) return;
    localStorage.setItem(key, hasSales ? '1' : '0');
}

function localShiftHasSales() {
    const key = buildShiftSalesStorageKey();
    if (!key) return false;
    return localStorage.getItem(key) === '1';
}

function ensureLocalShiftSalesFlagInitialized() {
    const key = buildShiftSalesStorageKey();
    if (!key) return;
    if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, '0');
    }
}

function clearLocalShiftContext() {
    localStorage.removeItem('turno_monto_inicial');
    clearCartState();
    clearTicketCounterForCurrentShift();
    clearPendingTicketCounterSync();
    localStorage.removeItem('turno_id_actual');
    localStorage.removeItem('ticket_seed_shift_id');
    localStorage.removeItem(SHIFT_OWNER_CAJA_KEY);
    localStorage.removeItem(SHIFT_OWNER_USER_KEY);
}

async function fetchServerTicketCounter() {
    const caja = String(localStorage.getItem('n_caja') || localStorage.getItem('caja') || '').trim();
    const cajero = String(localStorage.getItem('id_user') || '').trim();
    if (!caja || !cajero) return null;
    const query = new URLSearchParams({ caja, cajero });
    const preferredMode = localStorage.getItem(TICKET_COUNTER_API_MODE_KEY) || 'legacy';
    if (preferredMode === 'v2') {
        try {
            const response = await fetch(API_URL + `api/ticket-counter?${query.toString()}`, {
                headers: withAuthHeaders(),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                localStorage.setItem(TICKET_COUNTER_API_MODE_KEY, 'v2');
                const numeroActual = Number(data?.numero_actual);
                return Number.isFinite(numeroActual) && numeroActual > 0 ? Math.floor(numeroActual) : null;
            }
        } catch (_) {
            return null;
        }
    }
    return null;
}

async function persistServerTicketCounter(nextTicketNumber) {
    const caja = String(localStorage.getItem('n_caja') || localStorage.getItem('caja') || '').trim();
    const cajero = String(localStorage.getItem('id_user') || '').trim();
    const turnoId = String(localStorage.getItem('turno_id_actual') || '').trim();
    const parsed = Number(nextTicketNumber);
    if (!caja || !cajero || !turnoId || !Number.isFinite(parsed) || parsed < 1) {
        return null;
    }

    const preferredMode = localStorage.getItem(TICKET_COUNTER_API_MODE_KEY) || 'legacy';
    if (preferredMode !== 'v2') {
        return Math.floor(parsed);
    }
    const response = await fetch(API_URL + 'api/ticket-counter', {
        method: 'PUT',
        headers: withAuthHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
            caja,
            cajero,
            turno_id: turnoId,
            numero_actual: Math.floor(parsed),
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) {
        localStorage.setItem(TICKET_COUNTER_API_MODE_KEY, 'legacy');
        return Math.floor(parsed);
    }
    if (!response.ok) {
        return null;
    }
    localStorage.setItem(TICKET_COUNTER_API_MODE_KEY, 'v2');
    const numeroActual = Number(data?.numero_actual);
    return Number.isFinite(numeroActual) && numeroActual > 0 ? Math.floor(numeroActual) : null;
}

function scheduleShiftStatusRetry() {
    if (shiftValidationRetryTimer) return;
    shiftValidationRetryTimer = setTimeout(async () => {
        shiftValidationRetryTimer = null;
        await ensureShiftStartedOnLoad();
    }, 2500);
}

function buildCartStorageKey() {
    const caja = localStorage.getItem('n_caja') || localStorage.getItem('caja');
    const cajero = localStorage.getItem('id_user');
    const turnoId = localStorage.getItem('turno_id_actual') || 'sin_turno';
    if (!caja || !cajero) return null;
    return `cart_state_${caja}_${cajero}_${turnoId}`;
}

function persistCartState() {
    const key = buildCartStorageKey();
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(cart || []));
    } catch (error) {
        console.error('No se pudo persistir carrito:', error);
    }
}

function restoreCartState() {
    const key = buildCartStorageKey();
    if (!key) return;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        cart = parsed.map((item) => ({
            ...item,
            quantity: Number(item.quantity || 0),
            precio_venta: Number(item.precio_venta || 0),
            is_common: Boolean(item.is_common),
        })).filter((item) => (item.id_producto || item.is_common) && item.quantity > 0);
    } catch (error) {
        console.error('No se pudo restaurar carrito:', error);
    }
}

function clearCartState() {
    const key = buildCartStorageKey();
    if (!key) return;
    localStorage.removeItem(key);
}

function parseStoredBoolean(key) {
    return localStorage.getItem(key) === 'true';
}

const USER_PERMISSION_DEFAULTS = {
    ventas_producto_comun: 1,
    ventas_aplicar_mayoreo: 0,
    ventas_aplicar_descuento: 0,
    ventas_historial: 1,
    ventas_entrada_efectivo: 1,
    ventas_salida_efectivo: 1,
    ventas_cobrar_ticket: 1,
    ventas_cobrar_credito: 0,
    ventas_cancelar_ticket: 0,
    ventas_eliminar_articulo: 0,
    ventas_facturar: 0,
    ventas_pago_servicio: 0,
    ventas_recarga_electronica: 0,
    ventas_buscar_producto: 1,
    clientes_admin: 0,
    clientes_asignar_venta: 0,
    clientes_credito_admin: 0,
    clientes_ver_cuentas: 0,
    productos_crear: 0,
    productos_modificar: 0,
    productos_eliminar: 0,
    productos_reporte_ventas: 0,
    productos_crear_promociones: 0,
    productos_modificar_varios: 0,
    inventario_agregar_mercancia: 0,
    inventario_reportes_existencia: 0,
    inventario_movimientos: 0,
    inventario_ajustar: 0,
    corte_turno: 1,
    corte_todos_turnos: 0,
    corte_dia: 0,
    corte_ver_ganancia_dia: 0,
    configuracion_acceso: 0,
    reportes_ver: 0,
    compras_crear_orden: 0,
    compras_recibir_orden: 0,
};

function readUserPermissions() {
    const raw = localStorage.getItem('user_permissions');
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        const merged = { ...USER_PERMISSION_DEFAULTS };
        Object.keys(merged).forEach((key) => {
            merged[key] = Number(parsed?.[key] || 0) === 1 ? 1 : 0;
        });
        return merged;
    } catch (_) {
        return null;
    }
}

function hasUserPermission(permissionKey) {
    if (!permissionKey) return true;
    const permissions = readUserPermissions();
    if (!permissions) return true;
    return Number(permissions[permissionKey] || 0) === 1;
}

function setVisibilityByPermission(element, allowed, mode = 'disable') {
    if (!element) return;
    if (mode === 'hide') {
        element.style.display = allowed ? '' : 'none';
        return;
    }
    if ('disabled' in element) {
        element.disabled = !allowed;
    }
    element.style.opacity = allowed ? '' : '0.65';
    element.style.pointerEvents = allowed ? '' : '';
}

function applyUserPermissionsToUI() {
    const permissions = readUserPermissions();
    if (!permissions) return;

    document.querySelectorAll('[data-permission-key]').forEach((element) => {
        const permissionKey = element.dataset.permissionKey || '';
        const mode = element.dataset.permissionMode || 'disable';
        const allowed = Number(permissions[permissionKey] || 0) === 1;
        setVisibilityByPermission(element, allowed, mode);
    });

    const hasAnyProductPermission =
        permissions.productos_crear ||
        permissions.productos_modificar ||
        permissions.productos_eliminar ||
        permissions.productos_reporte_ventas ||
        permissions.productos_crear_promociones ||
        permissions.productos_modificar_varios;
    setVisibilityByPermission(document.getElementById('nav-product-btn'), Boolean(hasAnyProductPermission), 'disable');

    const hasAnyInventoryPermission =
        permissions.inventario_agregar_mercancia ||
        permissions.inventario_reportes_existencia ||
        permissions.inventario_movimientos ||
        permissions.inventario_ajustar;
    setVisibilityByPermission(document.getElementById('nav-inventory-btn'), Boolean(hasAnyInventoryPermission), 'disable');

    const hasAnyShoppingPermission = permissions.compras_crear_orden || permissions.compras_recibir_orden;
    setVisibilityByPermission(document.getElementById('nav-shopping-btn'), Boolean(hasAnyShoppingPermission), 'disable');

    setVisibilityByPermission(document.getElementById('nav-configuration-btn'), Boolean(permissions.configuracion_acceso), 'disable');
    setVisibilityByPermission(document.getElementById('nav-reports-btn'), Boolean(permissions.reportes_ver), 'disable');
    setVisibilityByPermission(document.getElementById('nav-cut-btn'), Boolean(permissions.corte_turno || permissions.corte_dia || permissions.corte_todos_turnos), 'disable');
}

function applyShiftInitialAmountUI(amount) {
    const cutInitialInput = document.getElementById('cut-initial-amount');
    if (!cutInitialInput) return;
    const normalized = Number(amount || 0);
    cutInitialInput.value = Number.isFinite(normalized) ? normalized.toFixed(2) : '0.00';
    cutInitialInput.readOnly = true;
}

function refreshCutCloseButtonState() {
    const closeBtn = document.getElementById('cut-close-shift-btn');
    if (!closeBtn) return;
    const canCloseTurn = hasUserPermission('corte_turno');
    const shouldShow = Boolean(cutCloseContext.sessionResumenLoaded);
    closeBtn.classList.toggle('hidden', !shouldShow);
    closeBtn.disabled = !canCloseTurn || !shouldShow;
}

function normalizeSettingBool(value, fallback = false) {
    if (value === null || value === undefined) return fallback;
    return Boolean(Number(value));
}

async function fetchPaymentSettingsForCut() {
    try {
        const response = await fetch(API_URL + 'api/payment-settings', {
            headers: withAuthHeaders(),
        });
        if (!response.ok) {
            return null;
        }
        return await response.json().catch(() => null);
    } catch (error) {
        return null;
    }
}

async function fetchCutDepartmentBreakdown(scope = 'session') {
    const caja = localStorage.getItem('n_caja');
    const cajero = localStorage.getItem('id_user');
    if (!caja || !cajero) return [];

    try {
        const query = new URLSearchParams({ caja, cajero, scope });
        const response = await fetch(API_URL + `api/turno/departamentos?${query.toString()}`, {
            headers: withAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return [];
        }
        return Array.isArray(data.departamentos) ? data.departamentos : [];
    } catch (error) {
        return [];
    }
}

function getEnabledCutMethods(paymentSettings) {
    const cardEnabled = normalizeSettingBool(paymentSettings?.card_enabled, true);
    const mixedEnabled = normalizeSettingBool(paymentSettings?.mixed_enabled, true);
    const usdEnabled = normalizeSettingBool(paymentSettings?.usd_enabled, false);
    const transferEnabled = normalizeSettingBool(paymentSettings?.transfer_enabled, false);
    const checkEnabled = normalizeSettingBool(paymentSettings?.check_enabled, false);
    const voucherEnabled = normalizeSettingBool(paymentSettings?.voucher_enabled, false);

    const methods = [{ key: 'efectivo', label: 'Efectivo' }];
    if (cardEnabled || mixedEnabled) methods.push({ key: 'tarjeta', label: 'Tarjeta' });
    if (usdEnabled) methods.push({ key: 'dolares', label: 'Dolares' });
    if (transferEnabled) methods.push({ key: 'transferencia', label: 'Transferencia' });
    if (checkEnabled) methods.push({ key: 'cheque', label: 'Cheque' });
    if (voucherEnabled) methods.push({ key: 'vale', label: 'Vale' });
    return methods;
}

function renderCutEnabledPaymentBreakdown(summaryRows, paymentSettings, scopeLabel) {
    const cutSummary = document.getElementById('cut-summary');
    const cutBreakdown = document.getElementById('cut-breakdown');
    if (!cutSummary || !cutBreakdown) {
        return;
    }

    const enabledMethods = getEnabledCutMethods(paymentSettings);
    const totalsByMethod = new Map();
    enabledMethods.forEach((method) => {
        totalsByMethod.set(method.key, {
            label: method.label,
            total: 0,
            transacciones: 0,
        });
    });

    (summaryRows || []).forEach((row) => {
        const method = String(row.metodo_pago || '').toLowerCase().trim();
        const total = Number(row.total || 0);
        const transacciones = Number(row.transacciones || 0);
        if (method === 'mixto') {
            return;
        }
        if (!totalsByMethod.has(method)) {
            return;
        }
        const current = totalsByMethod.get(method);
        current.total += total;
        current.transacciones += transacciones;
    });

    const totalVentas = summaryRows.reduce((acc, row) => acc + Number(row.total || 0), 0);
    const totalTx = summaryRows.reduce((acc, row) => acc + Number(row.transacciones || 0), 0);
    if (cutCloseContext.scope === 'session') {
        const statusText = cutCloseContext.turnStatusLabel || '';
        cutSummary.textContent = `Fecha ${cutCloseContext.currentDate || ''}: ${totalVentas.toFixed(0)} en ${totalTx} ventas${statusText}`;
    } else if (cutCloseContext.scope === 'day') {
        cutSummary.textContent = `Fecha ${cutCloseContext.currentDate || ''}: ${totalVentas.toFixed(0)} en ${totalTx} ventas`;
    } else {
        cutSummary.textContent = `Fecha ${cutCloseContext.currentDate || ''}`;
    }
    cutBreakdown.innerHTML = '';
}

function renderCutFinancialSections(data = {}, options = {}) {
    const clearOnly = Boolean(options.clearOnly);
    const financial = data.resumen_financiero || {};
    const movements = data.movimientos || {};
    const departments = Array.isArray(data.departamentos) ? data.departamentos : [];
    const topProductsByDepartmentRows = Array.isArray(data.top_productos_departamento) ? data.top_productos_departamento : [];
    const rawSummaryRows = Array.isArray(data.resumen) ? data.resumen : [];

    const cashList = document.getElementById('cut-cash-detail-list');
    const cashTotal = document.getElementById('cut-cash-total');
    const profitList = document.getElementById('cut-profit-detail-list');
    const profitTotal = document.getElementById('cut-profit-total');
    const incomeList = document.getElementById('cut-session-income-list');
    const expenseList = document.getElementById('cut-session-expense-list');
    const departmentList = document.getElementById('cut-department-list');
    const topProductsByDepartmentList = document.getElementById('cut-top-products-by-department');

    if (clearOnly) {
        if (cashList) cashList.innerHTML = '';
        if (cashTotal) cashTotal.textContent = '';
        if (profitList) profitList.innerHTML = '';
        if (profitTotal) profitTotal.textContent = '';
        if (incomeList) incomeList.innerHTML = '';
        if (expenseList) expenseList.innerHTML = '';
        if (departmentList) departmentList.innerHTML = '';
        if (topProductsByDepartmentList) topProductsByDepartmentList.innerHTML = '';
        return;
    }

    const fallbackVentasEfectivo = rawSummaryRows.reduce((acc, row) => {
        const method = String(row.metodo_pago || '').toLowerCase();
        const total = Number(row.total || 0);
        if (method === 'efectivo') return acc + total;
        if (method === 'mixto') return acc + (total / 2);
        return acc;
    }, 0);
    const movementSummary = Array.isArray(movements.resumen) ? movements.resumen : [];
    const fallbackEntradas = movementSummary
        .filter((row) => row.tipo === 'entrada')
        .reduce((acc, row) => acc + Number(row.total || 0), 0);
    const fallbackSalidas = movementSummary
        .filter((row) => row.tipo === 'salida')
        .reduce((acc, row) => acc + Number(row.total || 0), 0);
    const fallbackAbonos = movementSummary
        .filter((row) => row.tipo === 'abono')
        .reduce((acc, row) => acc + Number(row.total || 0), 0);
    const fallbackTotalVendido = Number(data.totales?.total || 0);
    const fallbackGanancia = departments.reduce((acc, row) => acc + Number(row.ganancia || 0), 0);

    const fondoCaja = Number(financial.fondo_caja ?? data.monto_inicial ?? 0);
    const ventasEfectivo = Number(financial.ventas_efectivo ?? fallbackVentasEfectivo);
    const abonosEfectivo = Number(financial.abonos_efectivo ?? fallbackAbonos);
    const entradasDinero = Number(financial.entradas_dinero ?? fallbackEntradas);
    const salidasDinero = Number(financial.salidas_dinero ?? fallbackSalidas);
    const totalVendido = Number(financial.total_vendido ?? fallbackTotalVendido);
    const gananciaVentas = Number(financial.ganancia_ventas ?? fallbackGanancia);
    const dineroEnCaja = Number(
        financial.ventas_totales_dinero_en_caja
        ?? (fondoCaja + ventasEfectivo + abonosEfectivo + entradasDinero - salidasDinero)
    );

    if (cashList) {
        cashList.innerHTML = '';
        [
            `Fondo de caja (caja inicial): ${fondoCaja.toFixed(0)}`,
            `Ventas en efectivo: ${ventasEfectivo.toFixed(0)}`,
            `Abonos en efectivo: ${abonosEfectivo.toFixed(0)}`,
            `Entrada de dinero: ${entradasDinero.toFixed(0)}`,
            `Salida de dinero: ${salidasDinero.toFixed(0)}`,
        ].forEach((text) => {
            const li = document.createElement('li');
            li.textContent = text;
            cashList.appendChild(li);
        });
    }
    if (cashTotal) {
        cashTotal.textContent = `Total (Ventas Totales / Dinero en caja): $${dineroEnCaja.toFixed(0)}`;
    }

    if (profitList) {
        profitList.innerHTML = '';
        [
            `Total vendido: $${totalVendido.toFixed(0)}`,
            `Ganancia de productos vendidos: $${gananciaVentas.toFixed(0)}`,
        ].forEach((text) => {
            const li = document.createElement('li');
            li.textContent = text;
            profitList.appendChild(li);
        });
    }
    if (profitTotal) {
        profitTotal.textContent = `Total (Ganancia / Ventas): $${gananciaVentas.toFixed(0)}`;
    }

    if (incomeList) {
        incomeList.innerHTML = '';
        const incomeRows = Array.isArray(movements.detalle_ingresos) ? movements.detalle_ingresos : [];
        if (incomeRows.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Sin ingresos manuales registrados en el alcance seleccionado.';
            incomeList.appendChild(li);
        } else {
            incomeRows.forEach((row) => {
                const li = document.createElement('li');
                li.textContent = `${row.fecha || ''} | ${row.tipo || ''} | ${row.metodo || ''} | $${Number(row.monto || 0).toFixed(0)} ${row.descripcion ? `| ${row.descripcion}` : ''}`;
                incomeList.appendChild(li);
            });
        }
    }

    if (expenseList) {
        expenseList.innerHTML = '';
        const expenseRows = Array.isArray(movements.detalle_salidas) ? movements.detalle_salidas : [];
        if (expenseRows.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Sin salidas registradas en el alcance seleccionado.';
            expenseList.appendChild(li);
        } else {
            expenseRows.forEach((row) => {
                const li = document.createElement('li');
                li.textContent = `${row.fecha || ''} | ${row.metodo || ''} | $${Number(row.monto || 0).toFixed(0)} ${row.descripcion ? `| ${row.descripcion}` : ''}`;
                expenseList.appendChild(li);
            });
        }
    }

    if (departmentList) {
        departmentList.innerHTML = '';
        if (departments.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Sin ventas por departamento para el alcance seleccionado.';
            departmentList.appendChild(li);
        } else {
            departments.forEach((row) => {
                const li = document.createElement('li');
                li.textContent = `${row.departamento || 'Sin departamento'}: $${Number(row.total_vendido || 0).toFixed(0)}`;
                departmentList.appendChild(li);
            });
        }
    }

    if (topProductsByDepartmentList) {
        topProductsByDepartmentList.innerHTML = '';
        if (topProductsByDepartmentRows.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Sin ventas de productos por departamento en la sesion actual.';
            topProductsByDepartmentList.appendChild(li);
        } else {
            const grouped = {};
            topProductsByDepartmentRows.forEach((row) => {
                const departmentName = String(row.departamento || 'Sin departamento').trim() || 'Sin departamento';
                if (!grouped[departmentName]) {
                    grouped[departmentName] = [];
                }
                grouped[departmentName].push({
                    producto: String(row.producto || 'Producto').trim() || 'Producto',
                    cantidad: Number(row.cantidad_vendida || 0),
                });
            });

            Object.keys(grouped)
                .sort((a, b) => a.localeCompare(b, 'es'))
                .forEach((departmentName) => {
                    const topItems = grouped[departmentName]
                        .sort((a, b) => {
                            if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
                            return a.producto.localeCompare(b.producto, 'es');
                        })
                        .slice(0, 3);
                    if (!topItems.length) return;
                    const li = document.createElement('li');
                    li.textContent = `${departmentName}: ${topItems.map((item, idx) => `${idx + 1}. ${item.producto} (${item.cantidad.toFixed(0)})`).join(' | ')}`;
                    topProductsByDepartmentList.appendChild(li);
                });
        }
    }
}

function resetCutViewToInitialState() {
    const cutSummary = document.getElementById('cut-summary');
    const cutBreakdown = document.getElementById('cut-breakdown');
    const scopeInfo = document.getElementById('cut-close-scope-info');
    const breakdownList = document.getElementById('cut-close-breakdown');
    const detailBody = document.getElementById('cut-close-detail-body');
    const closeBtn = document.getElementById('cut-close-shift-btn');

    const today = cutCloseContext.currentDate || new Date().toISOString().slice(0, 10);
    if (cutSummary) cutSummary.textContent = `Fecha ${today}`;
    if (cutBreakdown) cutBreakdown.innerHTML = '';
    if (scopeInfo) scopeInfo.textContent = 'Selecciona una opcion para cargar el resumen de ventas.';
    if (breakdownList) breakdownList.innerHTML = '';
    if (detailBody) detailBody.innerHTML = '';
    if (closeBtn) closeBtn.disabled = true;

    cutCloseContext = {
        scope: null,
        esperadoEfectivo: 0,
        esperadoTarjeta: 0,
        resumenLoaded: false,
        sessionResumenLoaded: false,
        turnStatusLabel: '',
        currentDate: today,
    };

    renderCutFinancialSections({}, { clearOnly: true });
}

window.resetCutViewToInitialState = resetCutViewToInitialState;

function setSalesEnabledByShift(enabled) {
    const barcodeInput = document.getElementById('barcode');
    const addBtn = document.getElementById('searchCode');
    const openFinalizeBtn = document.getElementById('open-finalize-popup-btn');
    if (barcodeInput) barcodeInput.disabled = !enabled;
    if (addBtn) addBtn.disabled = !enabled;
    if (openFinalizeBtn) {
        openFinalizeBtn.disabled = !enabled || getCartTotalAmount() <= 0;
    }
    updateSalesSessionStrip();
}

function getSelectedPaymentMethod() {
    const activeTab = document.querySelector('.tabss .tab.active');
    if (activeTab?.dataset?.tab) return activeTab.dataset.tab;
    const firstVisible = document.querySelector('.tabss .tab:not(.hidden)');
    return firstVisible?.dataset?.tab || 'efectivo';
}

function parseMoneyInputValue(rawValue) {
    if (rawValue === null || rawValue === undefined) return 0;
    // CLP: tratamos montos como enteros, ignorando separadores de miles/moneda.
    const digitsOnly = String(rawValue).replace(/\D/g, '');
    if (!digitsOnly) return 0;
    const parsed = Number(digitsOnly);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getCartTotalAmount() {
    return cart.reduce((sum, item) => {
        const unitPrice = Number(item.precio_venta || 0);
        const quantity = Number(item.quantity || 0);
        return sum + unitPrice * quantity;
    }, 0);
}

function updateSalesSessionStrip() {
    const cajaEl = document.getElementById('sales-status-caja');
    const cajeroEl = document.getElementById('sales-status-cajero');
    const turnoEl = document.getElementById('sales-status-turno');
    if (!cajaEl && !cajeroEl && !turnoEl) return;

    const caja = String(localStorage.getItem('n_caja') || localStorage.getItem('caja') || '-').trim() || '-';
    const cajeroId = String(localStorage.getItem('id_user') || '-').trim() || '-';
    const profileRaw = localStorage.getItem('user_profile');
    let profile = {};
    try {
        profile = profileRaw ? JSON.parse(profileRaw) : {};
    } catch (_) {
        profile = {};
    }
    const cajeroNombre = String(profile?.nombre || profile?.username_login || '').trim();
    const cajeroLabel = cajeroNombre ? `${cajeroNombre} (${cajeroId})` : cajeroId;
    const turnoLabel = shiftStarted ? 'Abierto' : 'Sin iniciar';

    if (cajaEl) cajaEl.textContent = caja;
    if (cajeroEl) cajeroEl.textContent = cajeroLabel;
    if (turnoEl) turnoEl.textContent = turnoLabel;
}

function showPaymentWarning(message) {
    const warning = document.getElementById('payment-warning');
    if (!warning) return;
    warning.textContent = message;
    warning.classList.remove('hidden');
}

function clearPaymentWarning() {
    const warning = document.getElementById('payment-warning');
    if (!warning) return;
    warning.textContent = '';
    warning.classList.add('hidden');
}

function resetPaymentInputs() {
    const fields = [
        'efectivoEfectivo',
        'efectivoMixto',
        'tarjetaMixto',
        'referenciaTarjeta',
        'referenciaDolares',
        'referenciaTransferencia',
        'referenciaCheque',
        'referenciaVale',
    ];
    fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const changeFields = ['cambioEfectivo', 'cambioMixto'];
    changeFields.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.style.color = '';
        }
    });
}

function validatePaymentCoverage(totalAmount, metodoPago) {
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        return { ok: false, missingAmount: 0 };
    }
    const strictCash = Boolean(Number(window.salePaymentSettings?.cash_strict_amount ?? 0));

    if (metodoPago === 'efectivo') {
        if (!strictCash) {
            return { ok: true, missingAmount: 0 };
        }
        const efectivo = parseMoneyInputValue(document.getElementById('efectivoEfectivo')?.value);
        const missingAmount = totalAmount - efectivo;
        return {
            ok: missingAmount <= 0,
            missingAmount: Math.max(0, missingAmount),
        };
    }

    if (metodoPago === 'mixto') {
        const efectivo = parseMoneyInputValue(document.getElementById('efectivoMixto')?.value);
        const tarjeta = parseMoneyInputValue(document.getElementById('tarjetaMixto')?.value);
        const paidAmount = efectivo + tarjeta;
        const missingAmount = totalAmount - paidAmount;
        return {
            ok: missingAmount <= 0,
            missingAmount: Math.max(0, missingAmount),
        };
    }

    return { ok: true, missingAmount: 0 };
}

function buildPaymentAllocation(totalAmount, metodoPago) {
    const amount = Number(totalAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { monto_efectivo: 0, monto_tarjeta: 0 };
    }

    if (metodoPago === 'efectivo') {
        return { monto_efectivo: amount, monto_tarjeta: 0 };
    }
    if (metodoPago === 'tarjeta') {
        return { monto_efectivo: 0, monto_tarjeta: amount };
    }
    if (metodoPago === 'mixto') {
        let efectivo = parseMoneyInputValue(document.getElementById('efectivoMixto')?.value);
        let tarjeta = parseMoneyInputValue(document.getElementById('tarjetaMixto')?.value);
        const paid = efectivo + tarjeta;

        if (paid <= 0) {
            efectivo = amount / 2;
            tarjeta = amount - efectivo;
        } else if (Math.abs(paid - amount) > 0.01) {
            const factor = amount / paid;
            efectivo = efectivo * factor;
            tarjeta = amount - efectivo;
        }

        return {
            monto_efectivo: Number(efectivo.toFixed(2)),
            monto_tarjeta: Number(tarjeta.toFixed(2)),
        };
    }

    return { monto_efectivo: 0, monto_tarjeta: 0 };
}

async function printSaleTicket(ventaId, includeDetails) {
    const payload = {
        venta_id: ventaId,
    };
    if (typeof includeDetails !== 'undefined') {
        payload.include_details = includeDetails;
    }

    const response = await fetch(API_URL+'api/print/sale-ticket', {
        method: 'POST',
        headers: {
            ...withAuthHeaders({
                'Content-Type': 'application/json',
            }),
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'No se pudo imprimir el comprobante');
    }
    return data;
}

function withAuthHeaders(headers = {}) {
    const token = getSessionToken();
    if (token) {
        return { ...headers, Authorization: `Bearer ${token}` };
    }
    return headers;
}

function handleSessionExpiredRedirect(message = 'Sesion expirada. Vuelve a iniciar sesion.') {
    alert(message);
    revokeRefreshTokenSilently();
    clearSessionTokens();
    localStorage.removeItem('id_user');
    localStorage.removeItem('user_permissions');
    localStorage.removeItem('user_is_admin');
    localStorage.removeItem('estado_login');
    window.location.href = 'index.php';
}

function getActiveCajaCajero() {
    const caja = String(localStorage.getItem('n_caja') || localStorage.getItem('caja') || '').trim();
    const cajero = String(localStorage.getItem('id_user') || '').trim();
    if (!/^\d+$/.test(caja) || !/^\d+$/.test(cajero)) {
        return null;
    }
    return { caja, cajero };
}

async function fetchShiftStatus() {
    const session = getActiveCajaCajero();
    if (!session) {
        return { estado: 'sin_turno' };
    }
    const token = getSessionToken();
    if (!token) {
        return { estado: 'sesion_invalida' };
    }
    try {
        const { caja, cajero } = session;
        const query = new URLSearchParams({ caja, cajero });
        const response = await fetch(API_URL + `api/turno/estado?${query.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) {
                return { estado: 'sesion_invalida' };
            }
            return { estado: 'error_validacion_turno' };
        }
        return data;
    } catch (_) {
        return { estado: 'error_validacion_turno' };
    }
}

async function startShift(montoInicial) {
    const session = getActiveCajaCajero();
    if (!session) {
        throw new Error('Sesion de caja/cajero invalida');
    }
    const { caja, cajero } = session;
    const response = await fetch(API_URL + 'api/turno/iniciar', {
        method: 'POST',
        headers: {
            ...withAuthHeaders({
                'Content-Type': 'application/json',
            }),
        },
        body: JSON.stringify({
            numero_caja: caja,
            cajero,
            monto_inicial: montoInicial,
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('SESION_INVALIDA');
        }
        throw new Error(data.message || 'No se pudo iniciar turno');
    }
    return data;
}

async function ensureShiftStartedOnLoad() {
    const salesAnchor = document.getElementById('barcode');
    if (!salesAnchor) return;

    const session = getActiveCajaCajero();
    if (!session) return;

    if (localStorage.getItem('turno_id_actual') && !hasLocalShiftContextForCurrentUser()) {
        clearLocalShiftContext();
    }

    if (hasLocalShiftContextForCurrentUser()) {
        const localMontoInicial = Number(localStorage.getItem('turno_monto_inicial'));
        if (!Number.isFinite(localMontoInicial) || localMontoInicial < 0) {
            clearLocalShiftContext();
        } else {
            const localStatus = await fetchShiftStatus();
            if (localStatus.estado === 'abierto') {
                if (localStatus.id_corte) {
                    localStorage.setItem('turno_id_actual', String(localStatus.id_corte));
                }
                setLocalShiftOwnership();
                shiftStarted = true;
                applyShiftInitialAmountUI(localMontoInicial);
                setSalesEnabledByShift(true);
                ensureLocalShiftSalesFlagInitialized();
                await load_ticket();
                return;
            }
            if (localStatus.estado === 'error_validacion_turno') {
                shiftStarted = true;
                applyShiftInitialAmountUI(localMontoInicial);
                setSalesEnabledByShift(true);
                ensureLocalShiftSalesFlagInitialized();
                await load_ticket();
                scheduleShiftStatusRetry();
                return;
            }
            clearLocalShiftContext();
        }
    }

    const status = await fetchShiftStatus();
    if (status.estado === 'sesion_invalida') {
        clearLocalShiftContext();
        shiftStarted = false;
        setSalesEnabledByShift(false);
        handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion para vender.');
        return;
    }
    if (status.estado === 'error_validacion_turno') {
        const hasLocalTurnContext = Boolean(localStorage.getItem('turno_id_actual'));
        if (hasLocalTurnContext) {
            shiftStarted = true;
            setSalesEnabledByShift(true);
            scheduleShiftStatusRetry();
            return;
        }
        shiftStarted = false;
        setSalesEnabledByShift(false);
        scheduleShiftStatusRetry();
        return;
    }
    if (status.estado === 'abierto') {
        shiftStarted = true;
        if (status.id_corte) {
            localStorage.setItem('turno_id_actual', String(status.id_corte));
        }
        setLocalShiftOwnership();
        ensureLocalShiftSalesFlagInitialized();
        localStorage.setItem('turno_monto_inicial', String(Number(status.monto_inicial || 0)));
        applyShiftInitialAmountUI(status.monto_inicial || 0);
        setSalesEnabledByShift(true);
        await load_ticket();
        return;
    }

    if (status.estado === 'cerrado') {
        shiftStarted = false;
        setSalesEnabledByShift(false);
        alert('El turno de hoy ya esta cerrado para esta caja/cajero.');
        return;
    }

    setSalesEnabledByShift(false);
    while (true) {
        const answer = (typeof window.appPrompt === 'function')
            ? await window.appPrompt(
                'Ingresa el monto inicial de caja para iniciar turno:',
                '0',
                {
                    title: 'Inicio de turno',
                    okText: 'Iniciar turno',
                    placeholder: 'Monto entre 0 y 150000',
                    helpText: 'Ingresa un monto entero entre 0 y 150000.',
                    helpStyle: 'warning',
                    inputType: 'number',
                    inputMode: 'numeric',
                    min: 0,
                    max: 150000,
                    step: 1,
                    disableCancel: true,
                    disableOkWhenInvalid: true,
                    hideValidationMessage: true,
                    validate: (value) => {
                        const trimmed = String(value || '').replace(',', '.').trim();
                        if (!trimmed) return 'Debes ingresar un monto inicial.';
                        const amount = Number(trimmed);
                        if (!Number.isFinite(amount)) return 'Ingresa un valor numerico valido.';
                        if (!Number.isInteger(amount)) return 'Solo se permiten montos enteros.';
                        if (amount < 0 || amount > 150000) return 'El monto debe estar entre 0 y 150000.';
                        return '';
                    },
                }
            )
            : prompt('Ingresa el monto inicial de caja para iniciar turno:', '0');
        if (answer === null) continue;
        const parsed = Number(String(answer).replace(',', '.'));
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 150000) {
            alert('Monto inicial invalido. Debe ser un entero entre 0 y 150000.');
            continue;
        }
        try {
            const started = await startShift(parsed);
            shiftStarted = true;
            if (started.id_corte) {
                localStorage.setItem('turno_id_actual', String(started.id_corte));
            }
            setLocalShiftOwnership();
            setLocalShiftHasSales(false);
            localStorage.setItem('turno_monto_inicial', String(Number(started.monto_inicial || parsed)));
            applyShiftInitialAmountUI(started.monto_inicial || parsed);
            setSalesEnabledByShift(true);
            await load_ticket();
            await loadCurrentCut();
            break;
        } catch (error) {
            if (error.message === 'SESION_INVALIDA') {
                shiftStarted = false;
                setSalesEnabledByShift(false);
                alert('No se pudo validar sesion en este momento. Intenta recargar nuevamente.');
                return;
            }
            alert(error.message || 'No se pudo iniciar turno.');
            const refresh = await fetchShiftStatus();
            if (refresh.estado === 'sesion_invalida') {
                shiftStarted = false;
                setSalesEnabledByShift(false);
                alert('No se pudo validar sesion en este momento. Intenta recargar nuevamente.');
                return;
            }
            if (refresh.estado === 'error_validacion_turno') {
                shiftStarted = false;
                setSalesEnabledByShift(false);
                alert('No se pudo validar el estado del turno. Revisa la conexion e intenta nuevamente.');
                return;
            }
            if (refresh.estado === 'abierto') {
                shiftStarted = true;
                if (refresh.id_corte) {
                    localStorage.setItem('turno_id_actual', String(refresh.id_corte));
                }
                setLocalShiftOwnership();
                ensureLocalShiftSalesFlagInitialized();
                localStorage.setItem('turno_monto_inicial', String(Number(refresh.monto_inicial || 0)));
                applyShiftInitialAmountUI(refresh.monto_inicial || 0);
                setSalesEnabledByShift(true);
                await load_ticket();
                break;
            }
            if (refresh.estado === 'cerrado') {
                shiftStarted = false;
                setSalesEnabledByShift(false);
                alert('El turno de hoy ya esta cerrado para esta caja/cajero.');
                break;
            }
        }
    }
}


async function load_ticket(){
    const cajero = localStorage.getItem('id_user');
    const caja = localStorage.getItem('n_caja') || localStorage.getItem('caja');
    const n_ticket = document.getElementById('nticket');
    if (n_ticket) n_ticket.textContent = '1';
    if (!cajero || !caja || !n_ticket) return;

    const currentShiftId = localStorage.getItem('turno_id_actual');
    const seededShiftId = localStorage.getItem('ticket_seed_shift_id');
    if (currentShiftId && currentShiftId !== seededShiftId) {
        localStorage.setItem('ticket_seed_shift_id', currentShiftId);
        n_ticket.textContent = '1';
        setStoredTicketCounter(1);
    }
    
    try {
        const localCounter = getStoredTicketCounter();
        const pendingCounter = getPendingTicketCounterSync();
        const serverCounter = await fetchServerTicketCounter();

        let resolvedCounter = 1;
        if (localCounter && localCounter > resolvedCounter) resolvedCounter = localCounter;
        if (pendingCounter && pendingCounter > resolvedCounter) resolvedCounter = pendingCounter;
        if (serverCounter && serverCounter > resolvedCounter) resolvedCounter = serverCounter;

        n_ticket.textContent = String(resolvedCounter);
        setStoredTicketCounter(resolvedCounter);

        if (!serverCounter || serverCounter < resolvedCounter || (pendingCounter && pendingCounter >= resolvedCounter)) {
            const synced = await persistServerTicketCounter(resolvedCounter);
            if (synced) {
                n_ticket.textContent = String(synced);
                setStoredTicketCounter(synced);
                clearPendingTicketCounterSync();
            } else {
                setPendingTicketCounterSync(resolvedCounter);
            }
        } else if (pendingCounter) {
            clearPendingTicketCounterSync();
        }
    } catch (error) {
        console.error('Error DOM:', error);
        const fallback = getStoredTicketCounter() || 1;
        n_ticket.textContent = String(fallback);
        setStoredTicketCounter(fallback);
        setPendingTicketCounterSync(fallback);
    }
}

function normalizeBarcodeValue(value) {
    const raw = String(value || '').trim();
    const numeric = raw.replace(/[^0-9]/g, '');
    const numericNoLeadingZeros = numeric ? (numeric.replace(/^0+/, '') || '0') : '';
    return { raw, numeric, numericNoLeadingZeros };
}

function matchesBarcode(candidateCode, targetCode) {
    const a = normalizeBarcodeValue(candidateCode);
    const b = normalizeBarcodeValue(targetCode);
    if (!a.raw || !b.raw) return false;
    if (a.raw === b.raw) return true;
    if (a.numeric && b.numeric) {
        if (a.numeric === b.numeric) return true;
        if (a.numericNoLeadingZeros && b.numericNoLeadingZeros && a.numericNoLeadingZeros === b.numericNoLeadingZeros) {
            return true;
        }
    }
    return false;
}

function normalizeBarcodeByScannerSettings(value) {
    let raw = String(value || '');
    const fixedPrefix = String(scannerRuntimeSettings.scanner_prefix_to_strip || '').trim();
    if (fixedPrefix) {
        if (raw.startsWith(fixedPrefix)) {
            raw = raw.slice(fixedPrefix.length);
        } else if (raw.toUpperCase().startsWith(fixedPrefix.toUpperCase())) {
            raw = raw.slice(fixedPrefix.length);
        }
    }
    const trimmed = scannerRuntimeSettings.scanner_prefix_trim ? raw.trim() : raw;
    if (scannerRuntimeSettings.scanner_only_numeric) {
        return trimmed.replace(/[^0-9]/g, '');
    }
    return trimmed;
}

function handleBarcodeInputSanitize(inputEl) {
    if (!inputEl) return;
    const rawValue = String(inputEl.value || '');
    const hasTextSearchPattern = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(rawValue) || rawValue.includes(' ');
    if (hasTextSearchPattern) {
        const maybeTrimmed = scannerRuntimeSettings.scanner_prefix_trim ? rawValue.trimStart() : rawValue;
        if (inputEl.value !== maybeTrimmed) {
            inputEl.value = maybeTrimmed;
        }
        return;
    }
    const normalized = normalizeBarcodeByScannerSettings(rawValue);
    if (inputEl.value !== normalized) {
        inputEl.value = normalized;
    }
}
window.handleBarcodeInputSanitize = handleBarcodeInputSanitize;

function clearSalesBarcodeSuggestions() {
    const listEl = document.getElementById('sales-barcode-suggestions');
    if (listEl) {
        listEl.innerHTML = '';
    }
    salesBarcodeSuggestCodes = new Set();
}

async function performSalesBarcodeSuggestionSearch(queryText) {
    const listEl = document.getElementById('sales-barcode-suggestions');
    if (!listEl) return;

    const query = String(queryText || '').trim();
    if (!query || query.length < 2) {
        listEl.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(API_URL + `api/productos/search?q=${encodeURIComponent(query)}`, {
            headers: withAuthHeaders(),
        });
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        const rows = await response.json().catch(() => []);
        const normalizedRows = Array.isArray(rows) ? rows : [];

        listEl.innerHTML = '';
        salesBarcodeSuggestCodes = new Set();
        normalizedRows.slice(0, 20).forEach((row) => {
            const description = String(row.descripcion || '').trim();
            const code = String(row.codigo_barras || '').trim();
            if (!description || !code) return;
            const option = document.createElement('option');
            option.value = code;
            const price = Number(row.precio_venta || 0);
            option.label = `${description} | $${price.toFixed(0)}`;
            listEl.appendChild(option);
            salesBarcodeSuggestCodes.add(code);
        });
    } catch (_) {
        // noop
    }
}

function updateSalesBarcodeSuggestions(queryText) {
    const query = String(queryText || '');
    const hasTextSearchPattern = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(query) || query.includes(' ');
    if (!hasTextSearchPattern) {
        clearSalesBarcodeSuggestions();
        return;
    }
    if (salesBarcodeSuggestDebounceTimer) {
        clearTimeout(salesBarcodeSuggestDebounceTimer);
    }
    salesBarcodeSuggestDebounceTimer = setTimeout(() => {
        performSalesBarcodeSuggestionSearch(query);
    }, 220);
}
window.updateSalesBarcodeSuggestions = updateSalesBarcodeSuggestions;

function handleSalesBarcodeSelectionChange(value) {
    const selectedValue = String(value || '').trim();
    if (!selectedValue) return;
    if (!salesBarcodeSuggestCodes.has(selectedValue)) return;
    addToCart();
}
window.handleSalesBarcodeSelectionChange = handleSalesBarcodeSelectionChange;

function isLikelyMobileDeviceForCameraPrompt() {
    const ua = String(navigator.userAgent || '').toLowerCase();
    const mobileUa = /(android|iphone|ipad|ipod|mobile)/i.test(ua);
    const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const narrowScreen = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
    return mobileUa || (touchCapable && narrowScreen);
}

async function ensureSalesCameraPermissionPromptOnce() {
    if (!isLikelyMobileDeviceForCameraPrompt()) return;
    if (salesCameraPermissionInFlight) return;
    const alreadyPrompted = String(localStorage.getItem(SALES_CAMERA_PERMISSION_KEY) || '');
    if (alreadyPrompted === 'done' || alreadyPrompted === 'attempted') return;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') return;

    salesCameraPermissionInFlight = true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
        });
        try {
            const tracks = stream?.getTracks?.() || [];
            tracks.forEach((track) => {
                try { track.stop(); } catch (_) {}
            });
        } catch (_) {}
        localStorage.setItem(SALES_CAMERA_PERMISSION_KEY, 'done');
    } catch (_) {
        localStorage.setItem(SALES_CAMERA_PERMISSION_KEY, 'attempted');
    } finally {
        salesCameraPermissionInFlight = false;
    }
}

function setupSalesMobileCameraPermissionHook() {
    const input = document.getElementById('barcode');
    if (!input) return;
    const requestPermission = () => {
        ensureSalesCameraPermissionPromptOnce().catch(() => {});
    };
    input.addEventListener('focus', requestPermission);
    input.addEventListener('touchstart', requestPermission, { passive: true });
    input.addEventListener('click', requestPermission);
}

function setupSalesCameraScanButtonVisibility() {
    const btn = document.getElementById('sales-camera-scan-btn');
    if (!btn) return;
    btn.style.display = isLikelyMobileDeviceForCameraPrompt() ? 'inline-flex' : 'none';
}

function getSalesCameraPermissionHelpText() {
    const ua = String(navigator.userAgent || '').toLowerCase();
    const insecureMobile = isLikelyMobileDeviceForCameraPrompt() && String(window.location.protocol || '') !== 'https:' && String(window.location.hostname || '').toLowerCase() !== 'localhost';
    if (insecureMobile) {
        return 'En móviles, la cámara requiere HTTPS. Abre esta app con https:// (no http://IP). Luego vuelve a intentar el escáner.';
    }
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('safari')) {
        return 'Safari: toca el candado de la barra de direcciones, entra a Configuración del sitio y cambia Cámara a Permitir. Si sigue bloqueado, abre Ajustes > Safari > Cámara > Permitir.';
    }
    if (ua.includes('android') && ua.includes('chrome')) {
        return 'Chrome Android: toca el candado de la barra de direcciones > Permisos > Cámara > Permitir. Luego vuelve a esta pantalla y pulsa Reintentar escáner.';
    }
    return 'En el navegador, abre el candado del sitio y habilita Cámara en Permitir. Luego vuelve y pulsa Reintentar escáner.';
}

function openSalesCameraPermissionPopup(reasonText) {
    const popup = document.getElementById('salesCameraPermissionPopUp');
    if (!popup) return;
    const reasonEl = document.getElementById('sales-camera-permission-reason');
    const helpEl = document.getElementById('sales-camera-permission-help');
    if (reasonEl) {
        reasonEl.textContent = String(reasonText || 'Se requiere permiso de cámara para escanear códigos.');
    }
    if (helpEl) {
        helpEl.textContent = getSalesCameraPermissionHelpText();
    }
    popup.classList.remove('hidden');
    popup.style.display = 'flex';
}
window.openSalesCameraPermissionPopup = openSalesCameraPermissionPopup;

function closeSalesCameraPermissionPopup() {
    const popup = document.getElementById('salesCameraPermissionPopUp');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.style.display = '';
}
window.closeSalesCameraPermissionPopup = closeSalesCameraPermissionPopup;

async function requestSalesCameraPermissionFromPopup() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        openSalesCameraPermissionPopup('Tu navegador no soporta acceso a cámara desde esta página.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
        });
        try {
            const tracks = stream?.getTracks?.() || [];
            tracks.forEach((track) => {
                try { track.stop(); } catch (_) {}
            });
        } catch (_) {}
        localStorage.setItem(SALES_CAMERA_PERMISSION_KEY, 'done');
        closeSalesCameraPermissionPopup();
        setSalesCameraScanStatus('Permiso concedido. Puedes iniciar el escáner.');
    } catch (_) {
        openSalesCameraPermissionPopup('El permiso de cámara sigue bloqueado. Habilítalo en permisos del sitio y vuelve a intentar.');
    }
}
window.requestSalesCameraPermissionFromPopup = requestSalesCameraPermissionFromPopup;

function setSalesCameraScanStatus(message) {
    const el = document.getElementById('sales-camera-status');
    if (el) {
        el.textContent = String(message || '');
    }
}

function stopSalesCameraStream() {
    if (salesCameraScanRaf) {
        cancelAnimationFrame(salesCameraScanRaf);
        salesCameraScanRaf = null;
    }
    if (salesCameraScanStream) {
        try {
            const tracks = salesCameraScanStream.getTracks?.() || [];
            tracks.forEach((track) => {
                try { track.stop(); } catch (_) {}
            });
        } catch (_) {}
        salesCameraScanStream = null;
    }
    salesCameraScanActive = false;
    const video = document.getElementById('sales-camera-video');
    if (video) {
        try {
            video.pause();
            video.srcObject = null;
        } catch (_) {}
    }
}

function closeSalesCameraScanPopup() {
    stopSalesCameraStream();
    const popup = document.getElementById('salesCameraScanPopUp');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.style.display = '';
}
window.closeSalesCameraScanPopup = closeSalesCameraScanPopup;

async function handleSalesCameraBarcodeDetected(codeValue) {
    const code = normalizeBarcodeByScannerSettings(String(codeValue || '').trim());
    if (!code) return;
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) {
        barcodeInput.value = code;
    }
    closeSalesCameraScanPopup();
    await addToCart();
}

function startSalesCameraDetectionLoop() {
    if (!salesCameraScanActive) return;
    const video = document.getElementById('sales-camera-video');
    if (!video) return;

    const run = async () => {
        if (!salesCameraScanActive) return;
        try {
            if (video.readyState >= 2 && salesBarcodeDetector) {
                const found = await salesBarcodeDetector.detect(video);
                if (Array.isArray(found) && found.length > 0) {
                    const raw = String(found[0]?.rawValue || '').trim();
                    if (raw) {
                        await handleSalesCameraBarcodeDetected(raw);
                        return;
                    }
                }
            }
        } catch (_) {
            // noop
        }
        salesCameraScanRaf = requestAnimationFrame(run);
    };
    salesCameraScanRaf = requestAnimationFrame(run);
}

async function openSalesCameraScanPopup() {
    const popup = document.getElementById('salesCameraScanPopUp');
    const video = document.getElementById('sales-camera-video');
    if (!popup || !video) return;

    const insecureMobile = isLikelyMobileDeviceForCameraPrompt()
        && String(window.location.protocol || '') !== 'https:'
        && String(window.location.hostname || '').toLowerCase() !== 'localhost';
    if (insecureMobile) {
        openSalesCameraPermissionPopup('Este móvil está usando HTTP. Para usar cámara debes abrir la app en HTTPS.');
        return;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        openSalesCameraPermissionPopup('Este navegador no soporta acceso a cámara desde esta página.');
        return;
    }

    popup.classList.remove('hidden');
    popup.style.display = 'flex';
    setSalesCameraScanStatus('Solicitando acceso a cámara...');

    try {
        await ensureSalesCameraPermissionPromptOnce();
        salesCameraScanStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
        });
        video.srcObject = salesCameraScanStream;
        await video.play().catch(() => {});

        if ('BarcodeDetector' in window) {
            if (!salesBarcodeDetector) {
                salesBarcodeDetector = new window.BarcodeDetector({
                    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
                });
            }
            salesCameraScanActive = true;
            setSalesCameraScanStatus('Apunta al código de barras para escanear.');
            startSalesCameraDetectionLoop();
        } else {
            setSalesCameraScanStatus('Tu navegador no soporta lectura automática de códigos con cámara.');
        }
    } catch (_) {
        closeSalesCameraScanPopup();
        openSalesCameraPermissionPopup('No se pudo acceder a la cámara. Revisa permisos del navegador para este sitio.');
    }
}
window.openSalesCameraScanPopup = openSalesCameraScanPopup;

function handleBarcodeKeydown(event, inputEl) {
    if (!event) return;
    if (inputEl) {
        handleBarcodeInputSanitize(inputEl);
    }
    const suffix = scannerRuntimeSettings.scanner_suffix || 'enter';
    if (suffix === 'none') {
        return;
    }
    if (suffix === 'enter' && event.key === 'Enter') {
        event.preventDefault();
        addToCart();
        return;
    }
    if (suffix === 'tab' && event.key === 'Tab') {
        event.preventDefault();
        addToCart();
    }
}
window.handleBarcodeKeydown = handleBarcodeKeydown;

async function fetchScannerRuntimeSettings() {
    try {
        const response = await fetch(API_URL + 'api/scanner-settings', {
            headers: withAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        scannerRuntimeSettings = {
            ...scannerRuntimeSettings,
            scanner_mode: data.scanner_mode === 'serial' ? 'serial' : 'keyboard',
            scanner_suffix: ['enter', 'tab', 'none'].includes(String(data.scanner_suffix || 'enter')) ? String(data.scanner_suffix || 'enter') : 'enter',
            scanner_prefix_to_strip: String(data.scanner_prefix_to_strip || '').slice(0, 16),
            scanner_prefix_trim: Boolean(Number(data.scanner_prefix_trim)) || data.scanner_prefix_trim === true,
            scanner_only_numeric: !(data.scanner_only_numeric === 0 || data.scanner_only_numeric === '0' || data.scanner_only_numeric === false),
            scanner_auto_focus: !(data.scanner_auto_focus === 0 || data.scanner_auto_focus === '0' || data.scanner_auto_focus === false),
            scanner_beep_on_scan: Boolean(Number(data.scanner_beep_on_scan)) || data.scanner_beep_on_scan === true,
        };
    } catch (_) {
        // noop
    }
}

async function resolveProductByBarcode(barcode) {
    const response = await fetch(API_URL+`api/productos/code/${encodeURIComponent(barcode)}`, {
        headers: withAuthHeaders(),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) return { authError: true };
    if (response.ok && payload?.found && payload?.product) {
        return { product: payload.product };
    }

    const listResponse = await fetch(API_URL + 'api/productos', {
        headers: withAuthHeaders(),
    });
    const rows = await listResponse.json().catch(() => []);
    if (listResponse.status === 401) return { authError: true };
    if (!listResponse.ok || !Array.isArray(rows)) {
        return { error: payload?.message || payload?.error || 'No se pudo obtener el producto' };
    }

    const found = rows.find((row) => matchesBarcode(row.codigo_barras, barcode));
    if (!found) return { notFound: true };
    return { product: found };
}

async function resolveProductBySearchText(searchText) {
    const query = String(searchText || '').trim();
    if (!query) return { notFound: true };
    const response = await fetch(API_URL + `api/productos/search?q=${encodeURIComponent(query)}`, {
        headers: withAuthHeaders(),
    });
    const rows = await response.json().catch(() => []);
    if (response.status === 401) return { authError: true };
    if (!response.ok || !Array.isArray(rows)) {
        return { error: 'No se pudo buscar el producto por nombre' };
    }
    if (!rows.length) return { notFound: true };

    const normalizedQuery = query.toLowerCase();
    const exact = rows.find((row) => String(row.descripcion || '').trim().toLowerCase() === normalizedQuery);
    if (exact) return { product: exact };
    return { product: rows[0] };
}

async function addToCart() {
    if (!shiftStarted) {
        await ensureShiftStartedOnLoad();
        if (!shiftStarted) {
            alert('Debes iniciar turno ingresando el monto inicial de caja.');
            return;
        }
    }
    const barcodeInput = document.getElementById('barcode');
    const rawInput = String(barcodeInput?.value || '').trim();
    if (!rawInput) {
        alert("Por favor ingrese el código de un producto.");
        return;
    }
    const isNameSearch = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(rawInput) || rawInput.includes(' ');
    const barcode = isNameSearch ? '' : normalizeBarcodeByScannerSettings(rawInput);
    if (!isNameSearch && barcodeInput && barcodeInput.value !== barcode) {
        barcodeInput.value = barcode;
    }

    try {
        const lookup = isNameSearch
            ? await resolveProductBySearchText(rawInput)
            : await resolveProductByBarcode(barcode);
        if (lookup.authError) {
            alert('Sesion expirada. Vuelve a iniciar sesion.');
            window.location.href = 'index.php';
            return;
        }
        if (lookup.notFound) {
            alert('Producto no encontrado.');
            return;
        }
        if (lookup.error || !lookup.product) {
            alert(`Error: ${lookup.error || 'No se pudo obtener el producto'}`);
            return;
        }
        const product = lookup.product;
        const normalizedProduct = {
            ...product,
            precio_venta: Number(product.precio_venta || 0),
        };
        const useInventory = Number(normalizedProduct.utiliza_inventario || 0) === 1;
        const currentStock = Number(normalizedProduct.cantidad_actual || 0);
        const existingProduct = cart.find(item => item.id_producto === normalizedProduct.id_producto);
        const nextQty = existingProduct ? Number(existingProduct.quantity || 0) + 1 : 1;

        if (useInventory && (!Number.isFinite(currentStock) || currentStock <= 0)) {
            if (typeof window.appAlert === 'function') {
                await window.appAlert('Este producto no tiene stock o existencia disponible.', 'warning', {
                    title: 'Sin stock',
                    okText: 'Entendido',
                });
            } else {
                alert('Este producto no tiene stock o existencia disponible.');
            }
            return;
        }
        if (useInventory && nextQty > currentStock) {
            if (typeof window.appAlert === 'function') {
                await window.appAlert(`No puedes agregar más unidades. Stock disponible: ${currentStock.toFixed(0)}.`, 'warning', {
                    title: 'Stock insuficiente',
                    okText: 'Entendido',
                });
            } else {
                alert(`No puedes agregar más unidades. Stock disponible: ${currentStock.toFixed(0)}.`);
            }
            return;
        }

        if (existingProduct) {
            existingProduct.quantity += 1;
        } else {
            cart.push({ ...normalizedProduct, quantity: 1 });
        }

        updateCartUI();
        document.getElementById('barcode').value = '';
        clearSalesBarcodeSuggestions();
        if (scannerRuntimeSettings.scanner_auto_focus) {
            document.getElementById('barcode')?.focus();
        }
        if (scannerRuntimeSettings.scanner_beep_on_scan) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = ctx.createOscillator();
                oscillator.frequency.value = 980;
                oscillator.connect(ctx.destination);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.05);
            } catch (_) {}
        }
    } catch (error) {
        console.error("Error adding product to cart:", error);
        alert("Failed to add product to cart. Please try again.");
    }
}

// Actualizar la interfaz del carrito
function updateCartUI() {
    const cartTable = document.getElementById('cart-table-body');
    if (!cartTable) return;
    cartTable.innerHTML = '';
    if (selectedCartIndex >= cart.length) {
        selectedCartIndex = -1;
    }

    cart.forEach((item, index) => {
        const row = document.createElement('tr');
        const unitPrice = Number(item.precio_venta || 0);
        const quantity = Number(item.quantity || 0);
        const stock = Number(item.cantidad_actual || 0);
        const useInventory = Number(item.utiliza_inventario || 0) === 1;
        const existencia = useInventory ? stock.toFixed(0) : '-';

        row.innerHTML = `
            <td>${item.codigo_barras}</td>
            <td>${item.descripcion}</td>
            <td style="text-align: center;">$${unitPrice.toFixed(0)}</td>
            <td style="text-align: center;">${quantity}</td>
            <td style="text-align: right;">$${(unitPrice * quantity).toFixed(0)}</td>
            <td style="text-align: center;">${existencia}</td>
        `;
        row.style.cursor = 'pointer';
        if (index === selectedCartIndex) {
            row.classList.add('cart-row-selected');
        }
        row.addEventListener('click', () => {
            selectedCartIndex = index;
            updateCartUI();
        });
        cartTable.appendChild(row);
    });

    // Actualizar el total
    const totalAmount = cart.reduce((sum, item) => {
        const unitPrice = Number(item.precio_venta || 0);
        const quantity = Number(item.quantity || 0);
        return sum + unitPrice * quantity;
    }, 0);

    document.getElementById('total-amount').textContent = "$ "+totalAmount.toFixed(0);
    document.getElementById('montoAPagar').textContent = "$ "+totalAmount.toFixed(0);
    const cambioEfectivo = document.getElementById('cambioEfectivo');
    const cambioMixto = document.getElementById('cambioMixto');
    if (cambioEfectivo) cambioEfectivo.value = totalAmount > 0 ? "$ "+totalAmount.toFixed(0) : '';
    if (cambioMixto) cambioMixto.value = totalAmount > 0 ? "$ "+totalAmount.toFixed(0) : '';

    const openFinalizeBtn = document.getElementById('open-finalize-popup-btn');
    if (openFinalizeBtn) {
        const canCharge = hasUserPermission('ventas_cobrar_ticket');
        openFinalizeBtn.disabled = !canCharge || !shiftStarted || cart.length === 0 || totalAmount <= 0;
    }
    if (typeof window.refreshFinalizeButtonState === 'function') {
        window.refreshFinalizeButtonState();
    }
    updateSalesSessionStrip();
    persistCartState();
}

function removeSelectedCartItem() {
    if (!hasUserPermission('ventas_eliminar_articulo')) {
        return;
    }
    if (!Array.isArray(cart) || cart.length === 0) {
        alert('El carrito esta vacio.');
        return;
    }
    if (!Number.isInteger(selectedCartIndex) || selectedCartIndex < 0 || selectedCartIndex >= cart.length) {
        alert('Selecciona un producto del carrito para eliminar.');
        return;
    }
    cart.splice(selectedCartIndex, 1);
    selectedCartIndex = -1;
    if (cart.length === 0) {
        clearPaymentWarning();
        resetPaymentInputs();
        if (typeof cerrarPopUp === 'function') {
            cerrarPopUp('miPopUp');
        }
    }
    updateCartUI();
}

async function adjustSelectedCartQuantityByDelta(delta) {
    const step = Number(delta);
    if (!Number.isFinite(step) || step === 0) return;
    if (!Array.isArray(cart) || cart.length === 0) return;
    if (!Number.isInteger(selectedCartIndex) || selectedCartIndex < 0 || selectedCartIndex >= cart.length) {
        return;
    }

    const item = cart[selectedCartIndex];
    if (!item) return;
    const currentQty = Number(item.quantity || 0);
    const nextQty = currentQty + step;

    if (nextQty <= 0) {
        cart.splice(selectedCartIndex, 1);
        selectedCartIndex = -1;
        if (cart.length === 0) {
            clearPaymentWarning();
            resetPaymentInputs();
            if (typeof cerrarPopUp === 'function') {
                cerrarPopUp('miPopUp');
            }
        }
        updateCartUI();
        return;
    }

    const useInventory = Number(item.utiliza_inventario || 0) === 1;
    const currentStock = Number(item.cantidad_actual || 0);
    if (useInventory && nextQty > currentStock) {
        if (typeof window.appAlert === 'function') {
            await window.appAlert(`No puedes agregar más unidades. Stock disponible: ${currentStock.toFixed(0)}.`, 'warning', {
                title: 'Stock insuficiente',
                okText: 'Entendido',
            });
        } else {
            alert(`No puedes agregar más unidades. Stock disponible: ${currentStock.toFixed(0)}.`);
        }
        return;
    }

    item.quantity = nextQty;
    updateCartUI();
}

function setupCartQuantityKeyboardShortcuts() {
    document.addEventListener('keydown', async (event) => {
        const target = event.target;
        const tag = String(target?.tagName || '').toLowerCase();
        const isTypingContext = Boolean(
            target?.isContentEditable ||
            tag === 'input' ||
            tag === 'textarea' ||
            tag === 'select'
        );
        if (isTypingContext) return;
        if (document.getElementById('mm-alert-overlay')?.classList.contains('show')) return;
        if (document.getElementById('sales')?.classList.contains('hidden')) return;

        const key = String(event.key || '').toLowerCase();
        const isPlus = key === '+' || key === 'add';
        const isMinus = key === '-' || key === 'subtract';
        if (!isPlus && !isMinus) return;

        event.preventDefault();
        await adjustSelectedCartQuantityByDelta(isPlus ? 1 : -1);
    });
}

async function triggerChargeSaleShortcut() {
    if (!hasUserPermission('ventas_cobrar_ticket')) {
        return;
    }
    showSection('sales');
    if (!shiftStarted) {
        await ensureShiftStartedOnLoad();
        if (!shiftStarted) {
            return;
        }
    }
    if (getCartTotalAmount() <= 0) {
        if (typeof window.appAlert === 'function') {
            await window.appAlert('No hay productos en el carrito para cobrar.', 'warning', {
                title: 'Cobro',
                okText: 'Entendido',
            });
        } else {
            alert('No hay productos en el carrito para cobrar.');
        }
        return;
    }
    if (typeof mostrarPopUp === 'function') {
        mostrarPopUp('miPopUp');
    }
}

function isSalesChargePopupOpen() {
    const popup = document.getElementById('miPopUp');
    return Boolean(popup && !popup.classList.contains('hidden'));
}

function handleSalesChargePopupShortcuts(event) {
    if (!isSalesChargePopupOpen()) return false;
    const key = String(event.key || '').toLowerCase();
    if (key === 'escape') {
        event.preventDefault();
        if (typeof cerrarPopUp === 'function') {
            cerrarPopUp('miPopUp');
        }
        return true;
    }
    if (key === 'f1') {
        event.preventDefault();
        const btn = document.getElementById('finalize-sale-btn');
        if (btn && !btn.disabled) btn.click();
        return true;
    }
    if (key === 'f2') {
        event.preventDefault();
        const btn = document.getElementById('finalize-no-receipt-btn');
        if (btn && !btn.disabled) btn.click();
        return true;
    }
    return false;
}

function setupSystemFunctionKeyShortcuts() {
    document.addEventListener('keydown', async (event) => {
        if (handleSalesChargePopupShortcuts(event)) return;
        if (document.getElementById('mm-alert-overlay')?.classList.contains('show')) return;
        const target = event.target;
        const tag = String(target?.tagName || '').toLowerCase();
        const isTypingContext = Boolean(
            target?.isContentEditable ||
            tag === 'input' ||
            tag === 'textarea' ||
            tag === 'select'
        );
        const key = String(event.key || '').toLowerCase();
        if (key === 'f1') {
            event.preventDefault();
            showSection('sales');
            return;
        }
        if (key === 'f2') {
            event.preventDefault();
            showSection('product');
            return;
        }
        if (key === 'f12') {
            event.preventDefault();
            await triggerChargeSaleShortcut();
            return;
        }

        if (document.getElementById('sales')?.classList.contains('hidden')) return;
        if (isTypingContext) return;

        if (key === 'f10') {
            event.preventDefault();
            if (typeof openSearchProductPopup === 'function') openSearchProductPopup();
            return;
        }
        if (key === 'f7') {
            event.preventDefault();
            if (typeof openCashEntryPopup === 'function') openCashEntryPopup();
            return;
        }
        if (key === 'f8') {
            event.preventDefault();
            if (typeof openCashExitPopup === 'function') openCashExitPopup();
            return;
        }
        if (key === 'f9') {
            event.preventDefault();
            if (typeof openPriceCheckPopup === 'function') openPriceCheckPopup();
            return;
        }
        if (key === 'delete') {
            event.preventDefault();
            if (typeof removeSelectedCartItem === 'function') removeSelectedCartItem();
        }
    });
}

// Finalizar la venta
async function finalizeSale(printReceipt = true) {
    if (!hasUserPermission('ventas_cobrar_ticket')) {
        return;
    }
    if (!shiftStarted) {
        await ensureShiftStartedOnLoad();
        if (!shiftStarted) {
            alert('Debes iniciar turno antes de cobrar.');
            return;
        }
    }
    if (isFinalizingSale) {
        return;
    }

    const finalizeBtn = document.getElementById('finalize-sale-btn');
    const finalizeNoReceiptBtn = document.getElementById('finalize-no-receipt-btn');
    if (finalizeBtn) finalizeBtn.disabled = true;
    if (finalizeNoReceiptBtn) finalizeNoReceiptBtn.disabled = true;
    isFinalizingSale = true;

    const num_ticket = document.getElementById('nticket');
    const cajero = localStorage.getItem('id_user');
    const caja = localStorage.getItem('n_caja') || localStorage.getItem('caja');
    const metodo_pago = getSelectedPaymentMethod();
    const totalAmount = getCartTotalAmount();
    const paymentAllocation = buildPaymentAllocation(totalAmount, metodo_pago);

    const venta = {
        cajero: cajero,
        numero_ticket: num_ticket.textContent,
        numero_caja: caja,
        metodo_pago: metodo_pago,
        monto_efectivo: paymentAllocation.monto_efectivo,
        monto_tarjeta: paymentAllocation.monto_tarjeta,
        producto: cart,
    };

    if (!caja) {
        alert("No hay caja configurada para esta sesión.");
        isFinalizingSale = false;
        if (finalizeBtn) finalizeBtn.disabled = false;
        if (finalizeNoReceiptBtn) finalizeNoReceiptBtn.disabled = false;
        return;
    }
    if (cart.length === 0) {
        alert("El carrito está vacío. Añade productos antes de finalizar la compra.");
        isFinalizingSale = false;
        if (finalizeBtn) finalizeBtn.disabled = false;
        if (finalizeNoReceiptBtn) finalizeNoReceiptBtn.disabled = false;
        return;
    }

    clearPaymentWarning();
    const paymentCheck = validatePaymentCoverage(totalAmount, metodo_pago);
    if (!paymentCheck.ok) {
        showPaymentWarning(`No se puede finalizar: faltan ${paymentCheck.missingAmount.toFixed(0)} por cobrar.`);
        isFinalizingSale = false;
        if (finalizeBtn) finalizeBtn.disabled = false;
        if (finalizeNoReceiptBtn) finalizeNoReceiptBtn.disabled = false;
        return;
    }

    let num_tic = (parseInt(num_ticket.textContent) + 1);

    try {
        const response = await fetch(API_URL+'api/sales', {
            method: 'POST',
            headers: {
                ...withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
            },
            body: JSON.stringify(venta),
        });

        if (response.ok) {
            const data = await response.json();
            const serverNextTicket = Number(data?.next_ticket);
            const nextTicket = Number.isFinite(serverNextTicket) && serverNextTicket > 0
                ? Math.floor(serverNextTicket)
                : num_tic;
            num_ticket.textContent = nextTicket.toString();
            setStoredTicketCounter(nextTicket);
            setLocalShiftHasSales(true);
            clearPendingTicketCounterSync();
            cart = []; // Vaciar el carrito
            clearPaymentWarning();
            updateCartUI();
            resetPaymentInputs();
            if (typeof cerrarPopUp === 'function') {
                cerrarPopUp('miPopUp');
            }

            if (printReceipt) {
                try {
                    await printSaleTicket(data.venta_id);
                } catch (printError) {
                    console.error('Error al imprimir ticket:', printError);
                }
            }
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        console.error("Error al finalizar la venta:", error);
        alert("No se pudo finalizar la venta. Inténtelo de nuevo.");
    } finally {
        isFinalizingSale = false;
        if (finalizeBtn) finalizeBtn.disabled = false;
        if (finalizeNoReceiptBtn) finalizeNoReceiptBtn.disabled = false;
    }
}

function openCommonProductPopup() {
    if (!hasUserPermission('ventas_producto_comun')) return;
    const popup = document.getElementById('commonProductPopUp');
    if (!popup) return;
    const nameInput = document.getElementById('common-product-name');
    const priceInput = document.getElementById('common-product-price');
    const qtyInput = document.getElementById('common-product-qty');
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (qtyInput) qtyInput.value = '1';
    popup.classList.remove('hidden');
    popup.style.display = 'flex';
}

function closeCommonProductPopup() {
    const popup = document.getElementById('commonProductPopUp');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.style.display = '';
}

async function addCommonProductToCart() {
    if (!shiftStarted) {
        await ensureShiftStartedOnLoad();
        if (!shiftStarted) {
            alert('Debes iniciar turno antes de agregar productos.');
            return;
        }
    }

    const nameInput = document.getElementById('common-product-name');
    const priceInput = document.getElementById('common-product-price');
    const qtyInput = document.getElementById('common-product-qty');
    const name = (nameInput?.value || '').trim();
    const unitPrice = Number(priceInput?.value || 0);
    const qty = Number(qtyInput?.value || 0);

    if (!name) {
        alert('Ingresa un nombre para el producto comun.');
        return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        alert('Ingresa un precio unitario valido.');
        return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
        alert('Ingresa una cantidad valida.');
        return;
    }

    cart.push({
        id_producto: null,
        codigo_barras: 'COMUN',
        descripcion: name,
        precio_venta: unitPrice,
        quantity: qty,
        is_common: true,
    });

    updateCartUI();
    closeCommonProductPopup();
}

function openSearchProductPopup() {
    if (!hasUserPermission('ventas_buscar_producto')) return;
    const popup = document.getElementById('searchProductPopUp');
    const input = document.getElementById('search-product-input');
    const resultsBody = document.getElementById('search-product-results-body');
    searchSelectedProductId = null;
    searchProductsLastResults = [];
    if (resultsBody) {
        resultsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Escribe para buscar productos.</td></tr>';
    }
    if (input) input.value = '';
    if (!popup) return;
    popup.classList.remove('hidden');
    popup.style.display = 'flex';
    if (input) input.focus();
}

function closeSearchProductPopup() {
    const popup = document.getElementById('searchProductPopUp');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.style.display = '';
}

function openCashEntryPopup() {
    if (!hasUserPermission('ventas_entrada_efectivo')) return;
    const popup = document.getElementById('cashEntryPopUp');
    const amountInput = document.getElementById('cash-entry-amount');
    const entryKind = document.getElementById('cash-entry-kind');
    const descriptionInput = document.getElementById('cash-entry-description');
    if (amountInput) amountInput.value = '';
    if (entryKind) entryKind.value = 'sencillo';
    if (descriptionInput) descriptionInput.value = '';
    updateCashEntryDescriptionVisibility();
    if (!popup) return;
    popup.classList.remove('hidden');
    popup.style.display = 'flex';
    if (amountInput) amountInput.focus();
}

function closeCashEntryPopup() {
    const popup = document.getElementById('cashEntryPopUp');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.style.display = '';
}

function updateCashEntryDescriptionVisibility() {
    const entryKind = document.getElementById('cash-entry-kind');
    const wrapper = document.getElementById('cash-entry-description-wrapper');
    const descriptionInput = document.getElementById('cash-entry-description');
    if (!wrapper || !entryKind) return;
    const show = entryKind.value === 'otro';
    wrapper.classList.toggle('hidden', !show);
    if (!show && descriptionInput) {
        descriptionInput.value = '';
    }
}

function openCashExitPopup() {
    if (!hasUserPermission('ventas_salida_efectivo')) return;
    const popup = document.getElementById('cashExitPopUp');
    const amountInput = document.getElementById('cash-exit-amount');
    const descriptionInput = document.getElementById('cash-exit-description');
    if (amountInput) amountInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (!popup) return;
    popup.classList.remove('hidden');
    popup.style.display = 'flex';
    if (amountInput) amountInput.focus();
}

function closeCashExitPopup() {
    const popup = document.getElementById('cashExitPopUp');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.style.display = '';
}

function openPriceCheckPopup() {
    const popup = document.getElementById('priceCheckPopUp');
    const codeInput = document.getElementById('price-check-code');
    const nameEl = document.getElementById('price-check-name');
    const priceEl = document.getElementById('price-check-value');
    if (!popup) return;
    if (codeInput) codeInput.value = '';
    if (nameEl) nameEl.textContent = '';
    if (priceEl) priceEl.textContent = '$0';
    popup.classList.remove('hidden');
    popup.style.display = 'flex';
    if (codeInput) codeInput.focus();
}

function closePriceCheckPopup() {
    const popup = document.getElementById('priceCheckPopUp');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.style.display = '';
}

async function fetchSalesSessionHistory(limit = 400) {
    const caja = String(localStorage.getItem('n_caja') || localStorage.getItem('caja') || '').trim();
    const cajero = String(localStorage.getItem('id_user') || '').trim();
    const params = new URLSearchParams();
    if (caja) params.set('caja', caja);
    if (cajero) params.set('cajero', cajero);
    const parsedLimit = Number(limit);
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
        params.set('limit', String(Math.floor(parsedLimit)));
    }
    const response = await fetch(API_URL + `api/sales/session-history?${params.toString()}`, {
        headers: withAuthHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'No se pudo obtener historial de ventas.');
    }
    return data;
}

async function reprintLastSaleTicketOrInvoice() {
    try {
        const data = await fetchSalesSessionHistory(1);
        const rows = Array.isArray(data?.ventas) ? data.ventas : [];
        if (!rows.length) {
            await appAlert('No hay ventas en la sesión para reimprimir.', 'warning', { title: 'Reimpresión' });
            return;
        }
        const ventaId = Number(rows[0]?.id_venta || 0);
        if (!ventaId) {
            await appAlert('No se pudo identificar la última venta para reimprimir.', 'error', { title: 'Reimpresión' });
            return;
        }
        await printSaleTicket(ventaId, true);
        await appAlert(`Reimpresión enviada: venta #${rows[0]?.folio_ticket || rows[0]?.numero_ticket || ventaId}.`, 'success', { title: 'Reimpresión' });
    } catch (error) {
        console.error('Error al reimprimir última venta:', error);
        await appAlert(error.message || 'No se pudo reimprimir la última venta.', 'error', { title: 'Reimpresión' });
    }
}

function closeSalesSessionHistoryPopup() {
    const popup = document.getElementById('salesHistoryPopUp');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.style.display = '';
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) {
        barcodeInput.focus();
        barcodeInput.select?.();
    }
}

async function openSalesSessionHistoryPopup() {
    const popup = document.getElementById('salesHistoryPopUp');
    const body = document.getElementById('sales-history-body');
    const summary = document.getElementById('sales-history-summary');
    if (!popup || !body || !summary) return;

    popup.classList.remove('hidden');
    popup.style.display = 'flex';
    summary.textContent = 'Cargando ventas...';
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';

    try {
        const data = await fetchSalesSessionHistory(500);
        const rows = Array.isArray(data?.ventas) ? data.ventas : [];
        const isAdmin = Number(data?.is_admin || 0) === 1;
        summary.textContent = isAdmin
            ? `Administrador: mostrando ${rows.length} ventas de todas las cajas (más reciente primero).`
            : `Mostrando ${rows.length} ventas de tu sesión actual (más reciente primero).`;

        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay ventas para mostrar.</td></tr>';
            return;
        }

        body.innerHTML = rows.map((row) => {
            const total = Number(row.total || 0);
            return `
                <tr>
                    <td>${escapeHtml(normalizeText(row.fecha || '-'))}</td>
                    <td>${escapeHtml(normalizeText(row.folio_ticket || row.numero_ticket || String(row.id_venta || '-')))}</td>
                    <td style="text-align:center;">${escapeHtml(String(row.caja_id ?? '-'))}</td>
                    <td>${escapeHtml(normalizeText(row.cajero_nombre || '-'))}</td>
                    <td>${escapeHtml(normalizeText(row.metodo_pago || '-'))}</td>
                    <td style="text-align:right;">${total.toFixed(0)}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error al abrir historial de ventas:', error);
        summary.textContent = 'No se pudo cargar el historial de ventas.';
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;">Error al cargar ventas.</td></tr>';
    }
}

async function lookupProductPrice() {
    const codeInput = document.getElementById('price-check-code');
    const nameEl = document.getElementById('price-check-name');
    const priceEl = document.getElementById('price-check-value');
    const codigo = String(codeInput?.value || '').trim();
    if (!codigo) {
        if (nameEl) nameEl.textContent = 'Ingresa un codigo.';
        if (priceEl) priceEl.textContent = '$0';
        return;
    }

    try {
        const response = await fetch(API_URL + `api/productos/code/${encodeURIComponent(codigo)}`, {
            headers: withAuthHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            if (nameEl) nameEl.textContent = payload.message || payload.error || 'Producto no encontrado.';
            if (priceEl) priceEl.textContent = '$0';
            return;
        }
        if (!payload?.found || !payload?.product) {
            if (nameEl) nameEl.textContent = payload?.error || 'Producto no encontrado.';
            if (priceEl) priceEl.textContent = '$0';
            return;
        }
        const data = payload.product;
        const nombre = String(data.descripcion || '').trim();
        const precio = Number(data.precio_venta || 0);
        if (nameEl) nameEl.textContent = nombre || 'Producto';
        if (priceEl) priceEl.textContent = `$${precio.toFixed(0)}`;
    } catch (error) {
        console.error('Error consultando precio:', error);
        if (nameEl) nameEl.textContent = 'Error de conexion.';
        if (priceEl) priceEl.textContent = '$0';
    }
}

async function saveCashEntry() {
    return saveCashMovement('entrada');
}

async function saveCashExit() {
    return saveCashMovement('salida');
}

async function saveCashMovement(tipoMovimiento) {
    if (!shiftStarted) {
        await ensureShiftStartedOnLoad();
        if (!shiftStarted) {
            alert('Debes iniciar turno antes de registrar movimientos.');
            return;
        }
    }

    const caja = localStorage.getItem('n_caja') || localStorage.getItem('caja');
    const cajero = localStorage.getItem('id_user');
    const isExit = tipoMovimiento === 'salida';
    const amountInput = document.getElementById(isExit ? 'cash-exit-amount' : 'cash-entry-amount');
    const entryKind = document.getElementById('cash-entry-kind');
    const entryDescriptionInput = document.getElementById('cash-entry-description');
    const exitDescriptionInput = document.getElementById('cash-exit-description');
    const rawAmount = String(amountInput?.value || '').replace(/[^0-9]/g, '');
    const monto = Number(rawAmount || 0);
    const isOtherEntry = !isExit && (entryKind?.value || 'sencillo') === 'otro';
    const descripcion = isExit
        ? String(exitDescriptionInput?.value || '').trim()
        : (isOtherEntry ? String(entryDescriptionInput?.value || '').trim() : 'sencillo');

    if (!caja || !cajero) {
        alert('No hay sesión activa de caja/cajero.');
        return;
    }
    if (!Number.isFinite(monto) || monto <= 0) {
        alert('Ingresa un monto válido.');
        return;
    }
    if (isExit && !descripcion) {
        alert('Ingresa una descripcion para la salida.');
        return;
    }
    if (isOtherEntry && !descripcion) {
        alert('Ingresa una descripcion para el ingreso tipo otro.');
        return;
    }

    try {
        const payload = {
            numero_caja: caja,
            cajero,
            tipo: isExit ? 'salida' : 'entrada',
            metodo: 'efectivo',
            monto,
            descripcion,
        };
        const endpoints = [API_URL + 'api/cash-movements'];
        const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        const fallbackBase = `${isLocalHost ? 'http:' : window.location.protocol}//${window.location.hostname}:3001/`;
        const fallbackEndpoint = fallbackBase + 'api/cash-movements';
        if (!endpoints.includes(fallbackEndpoint)) {
            endpoints.push(fallbackEndpoint);
        }

        let data = {};
        let rawText = '';
        let response = null;
        for (let i = 0; i < endpoints.length; i += 1) {
            response = await fetch(endpoints[i], {
                method: 'POST',
                headers: {
                    ...withAuthHeaders({
                        'Content-Type': 'application/json',
                    }),
                },
                body: JSON.stringify(payload),
            });
            try {
                rawText = await response.text();
                data = rawText ? JSON.parse(rawText) : {};
            } catch (_) {
                data = {};
            }
            const cannotPost = response.status === 404 && /cannot post/i.test(String(rawText || ''));
            if (!cannotPost || i === endpoints.length - 1) {
                break;
            }
        }

        if (!response.ok) {
            if (response.status === 401) {
                handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
                return;
            }
            if (response.status === 409) {
                shiftStarted = false;
                setSalesEnabledByShift(false);
                alert(data.message || 'No hay turno abierto para registrar movimientos.');
                return;
            }
            const fallbackText = String(rawText || '').trim();
            alert(data.message || (fallbackText ? fallbackText.slice(0, 180) : 'No se pudo registrar el movimiento.'));
            return;
        }
        if (isExit) {
            closeCashExitPopup();
        } else {
            closeCashEntryPopup();
        }
        if (typeof loadCurrentCut === 'function') {
            await loadCurrentCut();
        }
    } catch (error) {
        console.error('Error guardando movimiento de caja:', error);
        alert('Error de conexión al registrar movimiento.');
    }
}

async function performProductSuggestionSearch(queryText) {
    const resultsBody = document.getElementById('search-product-results-body');
    if (!resultsBody) return;
    const query = String(queryText || '').trim();
    if (query.length < 2) {
        resultsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Escribe al menos 2 letras.</td></tr>';
        searchProductsLastResults = [];
        searchSelectedProductId = null;
        return;
    }

    try {
        const params = new URLSearchParams({ q: query });
        const response = await fetch(API_URL + `api/productos/search?${params.toString()}`, {
            headers: withAuthHeaders(),
        });
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        let rows = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(rows)) {
            rows = [];
        }
        if (Array.isArray(rows) && rows.length === 0) {
            const fallbackResp = await fetch(API_URL + 'api/productos', {
                headers: withAuthHeaders(),
            });
            if (fallbackResp.status === 401) {
                handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
                return;
            }
            const fallbackRows = await fallbackResp.json().catch(() => []);
            if (fallbackResp.ok && Array.isArray(fallbackRows)) {
                const q = query.toLowerCase();
                rows = fallbackRows.filter((item) =>
                    String(item.descripcion || '').toLowerCase().includes(q)
                ).slice(0, 20);
            }
        }

        searchProductsLastResults = (Array.isArray(rows) ? rows : []).map((r) => ({
            ...r,
            id_producto: Number(r.id_producto),
            precio_venta: Number(r.precio_venta || 0),
            cantidad_actual: Number(r.cantidad_actual || 0),
        }));
        searchSelectedProductId = null;

        if (searchProductsLastResults.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin coincidencias.</td></tr>';
            return;
        }

        resultsBody.innerHTML = '';
        searchProductsLastResults.forEach((row) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.descripcion || ''}</td>
                <td style="text-align:right;">$${Number(row.precio_venta || 0).toFixed(0)}</td>
                <td style="text-align:right;">${Number(row.cantidad_actual || 0).toFixed(0)}</td>
                <td style="text-align:center;"><input type="radio" name="search-product-choice" value="${row.id_producto}"></td>
            `;
            tr.addEventListener('click', () => {
                searchSelectedProductId = row.id_producto;
                const radio = tr.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
            });
            resultsBody.appendChild(tr);
        });
    } catch (error) {
        resultsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Error de conexión.</td></tr>';
        searchProductsLastResults = [];
        searchSelectedProductId = null;
    }
}

function searchProductsSuggestions(queryText) {
    if (searchProductsDebounceTimer) {
        clearTimeout(searchProductsDebounceTimer);
    }
    searchProductsDebounceTimer = setTimeout(() => {
        performProductSuggestionSearch(queryText);
    }, 220);
}

async function addSelectedSearchedProductToCart() {
    if (!shiftStarted) {
        await ensureShiftStartedOnLoad();
        if (!shiftStarted) {
            alert('Debes iniciar turno antes de agregar productos.');
            return;
        }
    }

    const selectedByRadio = document.querySelector('input[name="search-product-choice"]:checked');
    const selectedId = Number(selectedByRadio?.value || searchSelectedProductId || 0);
    if (!selectedId) {
        alert('Selecciona un producto de la lista.');
        return;
    }

    const selected = searchProductsLastResults.find((item) => Number(item.id_producto) === selectedId);
    if (!selected) {
        alert('Producto no válido.');
        return;
    }
    const useInventory = Number(selected.utiliza_inventario || 0) === 1;
    const currentStock = Number(selected.cantidad_actual || 0);

    const existingProduct = cart.find(item => Number(item.id_producto) === Number(selected.id_producto));
    const nextQty = existingProduct ? Number(existingProduct.quantity || 0) + 1 : 1;
    if (useInventory && (!Number.isFinite(currentStock) || currentStock <= 0)) {
        if (typeof window.appAlert === 'function') {
            await window.appAlert('Este producto no tiene stock o existencia disponible.', 'warning', {
                title: 'Sin stock',
                okText: 'Entendido',
            });
        } else {
            alert('Este producto no tiene stock o existencia disponible.');
        }
        return;
    }
    if (useInventory && nextQty > currentStock) {
        if (typeof window.appAlert === 'function') {
            await window.appAlert(`No puedes agregar más unidades. Stock disponible: ${currentStock.toFixed(0)}.`, 'warning', {
                title: 'Stock insuficiente',
                okText: 'Entendido',
            });
        } else {
            alert(`No puedes agregar más unidades. Stock disponible: ${currentStock.toFixed(0)}.`);
        }
        return;
    }

    if (existingProduct) {
        existingProduct.quantity = Number(existingProduct.quantity || 0) + 1;
    } else {
        cart.push({
            id_producto: Number(selected.id_producto),
            codigo_barras: selected.codigo_barras || '',
            descripcion: selected.descripcion || '',
            precio_venta: Number(selected.precio_venta || 0),
            utiliza_inventario: useInventory ? 1 : 0,
            cantidad_actual: currentStock,
            quantity: 1,
        });
    }

    updateCartUI();
    closeSearchProductPopup();
}

// Mostrar el recibo
function showReceipt(receipt) {
    const receiptDetails = document.getElementById('receipt-details');
    receiptDetails.innerHTML = ''; // Limpiar los detalles del recibo

    receipt.products.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name} - $${item.price} x ${item.quantity}`;
        receiptDetails.appendChild(li);
    });

    document.getElementById('receipt-total').textContent = receipt.total.toFixed(2);
    document.getElementById('receipt').classList.remove('hidden');
}

// FunciÃ³n para mostrar la secciÃ³n activa
function showSectioninventario(sectionId) {
    const sections = document.querySelectorAll('div > section');
    sections.forEach(section => section.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    if (sectionId === 'add') {
        loadProductSupplierOptions().catch(() => {});
    }
}

// FunciÃ³n para ocultar la secciÃ³n activa
function hideAllSections() {
    const sections = document.querySelectorAll('div > section');
    sections.forEach(section => section.classList.add('hidden'));
}

// FunciÃ³n para obtener los productos desde el backend
async function getProducts() {
    try {
        const response = await fetch(API_URL+'api/productos', {
            headers: withAuthHeaders(),
        });
        const products = await response.json();
        updateInventoryList(Array.isArray(products) ? products : []);
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}


// Actualiza la lista de productos en la vista de inventario
function updateInventoryList(products) {
    const inventoryList = document.getElementById('inventory-list');
    if (!inventoryList) {
        return;
    }
    inventoryList.innerHTML = ''; // Limpiar la lista antes de agregar nuevos productos
    products.forEach(product => {
        if (!Number(product.utiliza_inventario || 0)) return;
        const li = document.createElement('li');
        li.textContent = `${product.descripcion || product.name} - $${product.precio_venta || product.price} x ${product.cantidad_actual || product.quantity}`;
        inventoryList.appendChild(li);
    });
}

function setInventoryFeedback(message, type = 'info') {
    const box = document.getElementById('inventory-feedback');
    if (!box) return;
    box.textContent = String(message || '');
    box.classList.remove('feedback-error', 'feedback-ok', 'feedback-warning');
    if (type === 'error') box.classList.add('feedback-error');
    if (type === 'ok') box.classList.add('feedback-ok');
    if (type === 'warning') box.classList.add('feedback-warning');
}

function setInventoryPanelsVisibility(visible) {
    const panels = document.getElementById('inventory-edit-panels');
    const actions = document.getElementById('inventory-footer-actions');
    if (panels) panels.classList.toggle('hidden', !visible);
    if (actions) actions.classList.toggle('hidden', !visible);
}

function clearInventoryProductDetails() {
    selectedInventoryProduct = null;
    const map = {
        'inventory-product-cost': '',
        'inventory-product-profit': '',
        'inventory-product-sale': '',
        'inventory-stock-current': '',
        'inventory-stock-min': '',
        'inventory-stock-max': '',
        'inventory-restock-qty': '',
    };
    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });
    const btn = document.getElementById('inventory-save-btn');
    if (btn) btn.disabled = true;
    setInventoryPanelsVisibility(false);
}

function fillInventoryProductDetails(product) {
    const data = product || {};
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = String(value ?? '');
    };
    setValue('inventory-product-cost', Number(data.costo || 0).toFixed(0));
    setValue('inventory-product-profit', Number(data.ganancia || 0).toFixed(2));
    setValue('inventory-product-sale', Number(data.precio_venta || 0).toFixed(0));
    setValue('inventory-stock-current', Number(data.cantidad_actual || 0).toFixed(0));
    setValue('inventory-stock-min', Number(data.cantidad_minima || 0).toFixed(0));
    setValue('inventory-stock-max', Number(data.cantidad_maxima || 0).toFixed(0));
}

function clearInventoryView() {
    const codeInput = document.getElementById('inventory-code-input');
    if (codeInput) codeInput.value = '';
    clearInventoryProductDetails();
    setInventoryFeedback('Escanea un producto para consultar inventario.', 'info');
}

function cancelInventoryEdition() {
    clearInventoryView();
}

function fillInventorySearchDatalist(rows) {
    const list = document.getElementById('inventory-search-options');
    if (!list) return;
    list.innerHTML = '';
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const code = normalizeText(row.codigo_barras || '');
        const desc = normalizeText(row.descripcion || '');
        if (!code && !desc) return;
        const option = document.createElement('option');
        option.value = code || desc;
        option.label = code && desc ? `${code} - ${desc}` : (desc || code);
        list.appendChild(option);
    });
}

async function inventorySearchSuggest(value) {
    const query = normalizeText(value);
    if (query.length < 2) {
        fillInventorySearchDatalist([]);
        return;
    }
    const rows = await searchProductsForInput(query);
    fillInventorySearchDatalist(rows);
}

async function findInventoryProductByInput(inputValue) {
    const query = normalizeText(inputValue);
    if (!query) return null;

    const codeLookupResponse = await fetch(API_URL + `api/productos/code/${encodeURIComponent(query)}`, {
        headers: withAuthHeaders(),
    });
    const codeLookup = await codeLookupResponse.json().catch(() => ({}));
    if (codeLookupResponse.ok && codeLookup?.found && codeLookup?.product) {
        return codeLookup.product;
    }

    const matches = await searchProductsForInput(query);
    if (!matches.length) return null;
    const exact = matches.find((row) => normalizeText(row.descripcion).toLowerCase() === query.toLowerCase());
    return exact || matches[0];
}

async function loadInventoryProductByCode() {
    const codeInput = document.getElementById('inventory-code-input');
    const rawValue = String(codeInput?.value || '').trim();
    const normalizedValue = normalizeBarcodeByScannerSettings(rawValue) || normalizeText(rawValue);
    if (!normalizedValue) {
        setInventoryFeedback('Ingresa, escanea o busca un producto para consultar.', 'warning');
        return;
    }
    if (codeInput) codeInput.value = normalizedValue;

    try {
        const product = await findInventoryProductByInput(normalizedValue);
        if (!product) {
            clearInventoryProductDetails();
            setInventoryFeedback('Producto no encontrado.', 'error');
            return;
        }

        const useInventory = Number(product.utiliza_inventario || 0) === 1;
        if (!useInventory) {
            clearInventoryProductDetails();
            setInventoryFeedback(`El producto "${normalizeText(product.descripcion || 'Sin nombre')}" no tiene habilitada la opcion de inventario.`, 'warning');
            if (codeInput) {
                codeInput.value = '';
                setTimeout(() => {
                    try {
                        codeInput.focus();
                        codeInput.select();
                    } catch (_) {
                    }
                }, 0);
            }
            return;
        }

        fillInventoryProductDetails(product);
        setInventoryPanelsVisibility(true);
        const saveBtn = document.getElementById('inventory-save-btn');
        if (saveBtn) saveBtn.disabled = false;
        selectedInventoryProduct = product;
        setInventoryFeedback(`Producto cargado: ${normalizeText(product.descripcion || '')}.`, 'ok');
    } catch (error) {
        console.error('Error loadInventoryProductByCode:', error);
        clearInventoryProductDetails();
        setInventoryFeedback('No se pudo consultar el producto.', 'error');
    }
}

async function saveInventoryChanges() {
    if (!selectedInventoryProduct) {
        setInventoryFeedback('Primero carga un producto con inventario habilitado.', 'warning');
        return;
    }
    const stockCurrent = Number(String(document.getElementById('inventory-stock-current')?.value || '0').replace(',', '.'));
    const restockQty = Number(String(document.getElementById('inventory-restock-qty')?.value || '0').replace(',', '.'));
    if (!Number.isFinite(stockCurrent) || stockCurrent < 0) {
        setInventoryFeedback('Existencia actual invalida.', 'error');
        return;
    }
    if (!Number.isFinite(restockQty) || restockQty < 0) {
        setInventoryFeedback('La cantidad de reposicion no puede ser negativa.', 'warning');
        return;
    }

    const cost = toIntOrNull(document.getElementById('inventory-product-cost')?.value);
    const profit = toDecimalOrNull(document.getElementById('inventory-product-profit')?.value, 2);
    const salePrice = toIntOrNull(document.getElementById('inventory-product-sale')?.value);
    const minStock = toIntOrNull(document.getElementById('inventory-stock-min')?.value);
    const maxStock = toIntOrNull(document.getElementById('inventory-stock-max')?.value);

    if (cost === null || profit === null || salePrice === null || minStock === null || maxStock === null) {
        setInventoryFeedback('Completa correctamente los datos numericos del producto e inventario.', 'warning');
        return;
    }
    if (minStock < 0 || maxStock < 0) {
        setInventoryFeedback('Stock minimo y maximo no pueden ser negativos.', 'warning');
        return;
    }
    if (maxStock > 0 && minStock > maxStock) {
        setInventoryFeedback('Stock minimo no puede ser mayor al stock maximo.', 'warning');
        return;
    }

    const code = normalizeText(selectedInventoryProduct.codigo_barras || '');
    if (!code) {
        setInventoryFeedback('Codigo de producto invalido para actualizar inventario.', 'error');
        return;
    }

    const newQty = stockCurrent + restockQty;
    const payload = {
        descripcion: normalizeText(selectedInventoryProduct.descripcion || ''),
        formato_venta: normalizeText(selectedInventoryProduct.formato_venta || 'unidad'),
        precio_venta: salePrice,
        costo: cost,
        ganancia: profit,
        cantidad_actual: newQty,
        cantidad_minima: minStock,
        cantidad_maxima: maxStock,
        utiliza_inventario: 1,
        departamento: normalizeText(selectedInventoryProduct.departamento || ''),
        supplier_id: toPositiveIntOrNull(selectedInventoryProduct.supplier_id),
    };

    try {
        const response = await fetch(API_URL + `api/productos/${encodeURIComponent(code)}`, {
            method: 'PUT',
            headers: withAuthHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setInventoryFeedback(data.error || data.message || 'No se pudo aplicar la reposicion.', 'error');
            return;
        }

        clearInventoryProductDetails();
        const codeInput = document.getElementById('inventory-code-input');
        if (codeInput) codeInput.value = '';
        setInventoryFeedback(`Cambios guardados. Nuevo stock: ${Number(newQty).toFixed(0)}.`, 'ok');
    } catch (error) {
        console.error('Error saveInventoryChanges:', error);
        setInventoryFeedback('Error de conexion al actualizar inventario.', 'error');
    }
}

function prepareInventoryView() {
    const codeInput = document.getElementById('inventory-code-input');
    if (!codeInput) return;
    if (scannerRuntimeSettings.scanner_auto_focus) {
        setTimeout(() => codeInput.focus(), 0);
    }
    if (!selectedInventoryProduct) {
        setInventoryFeedback('Escanea un producto para consultar inventario.', 'info');
    }
}

async function loadProductSupplierOptions() {
    const select = document.getElementById('product-supplier');
    if (!select) return;
    const previous = String(select.value || '');
    try {
        const response = await fetch(API_URL + 'api/service-suppliers', {
            headers: withAuthHeaders(),
        });
        const rows = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(rows)) {
            throw new Error('No se pudo cargar proveedores');
        }
        const options = ['<option value=\"\">Sin proveedor</option>'];
        rows.forEach((row) => {
            const id = Number(row.id || 0);
            const name = String(row.name || '').trim();
            if (!id || !name) return;
            options.push(`<option value=\"${id}\">${name}</option>`);
        });
        select.innerHTML = options.join('');
        if (previous && select.querySelector(`option[value=\"${previous}\"]`)) {
            select.value = previous;
        }
    } catch (_) {
        select.innerHTML = '<option value=\"\">Sin proveedor</option>';
    }
}

// FunciÃ³n para modificar un producto
async function modifyProduct() {
    const code = prompt("Enter the product barcode to modify:");
    const name = prompt("Enter new name:");
    const price = parseFloat(prompt("Enter new price:"));
    const quantity = parseInt(prompt("Enter new quantity:"));

    if (code && name && !isNaN(price) && !isNaN(quantity)) {
        try {
            const response = await fetch(API_URL+`api/productos/${code}`, {
                method: 'PUT',
                headers: {
                    ...withAuthHeaders({
                        'Content-Type': 'application/json'
                    }),
                },
                body: JSON.stringify({ name, price, quantity })
            });
            const result = await response.json();
            alert(result.message);
            getProducts();
        } catch (error) {
            console.error('Error modifying product:', error);
        }
    }
}

// FunciÃ³n para buscar productos
async function searchProduct() {
    const searchQuery = document.getElementById('search-product').value;
    if (searchQuery) {
        try {
            const response = await fetch(API_URL+`api/productos/search?query=${searchQuery}`, {
                headers: withAuthHeaders(),
            });
            const products = await response.json();
            updateInventoryList(products);
        } catch (error) {
            console.error('Error searching for product:', error);
        }
    } else {
        getProducts();
    }
}

/* Llamar a getProducts cuando la secciÃ³n de inventario se muestra
document.getElementById('inventory').addEventListener('show', () => {
    getProducts();
});*/

// Fetch product by code
async function searchByCode() {
    const code = document.getElementById('product-code').value;
    if (!code) {
        alert("Please enter the product code.");
        return;
    }

    const response = await fetch(API_URL+`api/productos/code/${code}`, {
        headers: withAuthHeaders(),
    });
    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
        if (!payload?.found || !payload?.product) {
            alert(payload?.error || 'Producto no encontrado.');
            return;
        }
        const product = payload.product;
        alert(`Producto encontrado: ${product.descripcion}, Precio: ${product.precio_venta}, Cantidad: ${product.cantidad_actual}`);
    } else {
        alert(`Error: ${payload.error || payload.message || 'No se pudo consultar el producto'}`);
    }
}

// Fetch product by name
async function searchByName() {
    const name = document.getElementById('product-name').value;
    if (!name) {
        alert("Please enter the product name.");
        return;
    }

    const response = await fetch(API_URL+`api/productos/name/${name}`, {
        headers: withAuthHeaders(),
    });
    const product = await response.json();

    if (response.ok) {
            const normalizedProduct = {
                ...product,
                precio_venta: Number(product.precio_venta || 0),
            };
        alert(`Product found: ${product.name}, Price: ${product.price}, Quantity: ${product.quantity}`);
    } else {
        alert(`Error: ${product.error}`);
    }
}

// Add new product
async function addProduct() {
    const productCode = document.getElementById('product-code').value;
    const productName = document.getElementById('product-name').value;
    const formatoVenta = document.querySelector('input[name="formato_venta"]:checked').value;
    const costo = parseInt(document.getElementById('product-costo').value);
    const ganancia = parseInt(document.getElementById('product-ganancia').value) || 0;
    const precioVenta = parseInt(document.getElementById('product-price').value);
    const utilizaInventario = document.querySelector('input[name="utiliza_inv"]')?.checked || false;
    const cantidadActual = parseInt(document.getElementById('product-quantity').value) || 0;
    const cantidadMinima = parseInt(document.getElementById('product-quantity-min').value) || 0;
    const cantidadMaxima = parseInt(document.getElementById('product-quantity-max').value) || 0;
    const departamento = document.querySelector('select[name="dep"]').value;
    const supplierIdRaw = parseInt(document.getElementById('product-supplier')?.value || '', 10);
    const supplierId = Number.isInteger(supplierIdRaw) && supplierIdRaw > 0 ? supplierIdRaw : null;

    const productData = {
        codigo_barras: productCode,
        descripcion: productName,
        formato_venta: formatoVenta,
        costo,
        ganancia,
        precio_venta: precioVenta,
        utiliza_inventario: utilizaInventario,
        cantidad_actual: cantidadActual,
        cantidad_minima: cantidadMinima,
        cantidad_maxima: cantidadMaxima,
        departamento,
        supplier_id: supplierId,
    };

    try {
        const response = await fetch(API_URL+'api/productos', {
            method: 'POST',
            headers: {
                ...withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
            },
            body: JSON.stringify(productData),
        });

        const result = await response.json();

        if (response.ok) {
            const normalizedProduct = {
                ...product,
                precio_venta: Number(product.precio_venta || 0),
            };
            alert('Producto añadido exitosamente');
            claerAddProd();
            hideAllSections();
        } else {
            alert(`Error al añadir el producto: ${result.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al conectar con el servidor');
    }
}

function claerAddProd(){
    document.getElementById('product-code').value = "";
    document.getElementById('product-name').value = "";
    document.getElementById('radio-unidad').checked = true;
    parseInt(document.getElementById('product-costo').value = null);
    parseInt(document.getElementById('product-ganancia').value = null);
    parseInt(document.getElementById('product-price').value = null);
    //document.getElementById('checkbox-inventario').checked = false;
    parseInt(document.getElementById('product-quantity').value = null);
    parseInt(document.getElementById('product-quantity-min').value = null);
    parseInt(document.getElementById('product-quantity-max').value = null);
    document.querySelector('select[name="dep"]').value = "verduleria";
    const supplierSelect = document.getElementById('product-supplier');
    if (supplierSelect) supplierSelect.value = "";
}

// Update existing product
async function updateProduct() {
    const code = document.getElementById('product-code').value;
    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const quantity = parseInt(document.getElementById('product-quantity').value);

    if (!code || !name || isNaN(price) || isNaN(quantity)) {
        alert("Please fill in all fields correctly.");
        return;
    }

    const response = await fetch(API_URL+`api/productos/${code}`, {
        method: "PUT",
        headers: {
            ...withAuthHeaders({
                "Content-Type": "application/json",
            }),
        },
        body: JSON.stringify({ name, price, quantity }),
    });

    if (response.ok) {
            const normalizedProduct = {
                ...product,
                precio_venta: Number(product.precio_venta || 0),
            };
        alert("Product updated successfully!");
        getProducts();
    } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
    }
}

//update user 
async function updateUser() {
    const id = localStorage.getItem("id_user");
    const estado_usuario =  localStorage.getItem("estado_login")

    if (!id || !estado_usuario ) {
        alert("Please fill in all fields correctly.");
        return;
    }
    const response = await fetch(API_URL+`api/updateUser`, {
        method: "PUT",
        headers: {
            ...withAuthHeaders({
                "Content-Type": "application/json",
            }),
        },
        body: JSON.stringify({ id, estado_usuario }),
    });
    if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error}`);
    }

}

// Delete product by code
async function deleteProduct() {
    const code = document.getElementById('product-code-delete').value;
    if (!code) {
        alert("Please enter the product code.");
        return;
    }

    const response = await fetch(API_URL+`api/productos/${code}`, {
        method: "DELETE",
        headers: withAuthHeaders(),
    });

    if (response.ok) {
            const normalizedProduct = {
                ...product,
                precio_venta: Number(product.precio_venta || 0),
            };
        alert("Product deleted successfully!");
        getProducts();
    } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
    }
}

// -------------agrega sesiones de usuarios conectado al backend
async function addConnectedUser() {
    const numero_caja = localStorage.getItem('n_caja');
    const user_id = localStorage.getItem('id_user');

    const connectedData = { numero_caja: numero_caja, user_id: user_id}
    try{
        const response = await fetch(API_URL+'api/connect', {
            method: 'POST',
            headers: {
                ...withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
            },
            body: JSON.stringify(connectedData)
        });
    } catch (error) {
    console.error("Error al crear la sesion: ", error);
    }
}

// ------------agrega logout de usuarios desconectado al backend
async function deleteConnectedUser() {
  
    const numero_caja = localStorage.getItem('n_caja');
    const user_id = localStorage.getItem('id_user');

    const connectedData = { numero_caja: numero_caja, user_id: user_id}
    /*console.log("data enviada a server.js");
    console.log(connectedData);*/
     try{
        const response = await fetch(API_URL+'api/disconnect', {
            method: 'POST',
            headers: {
                ...withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
            },
            body: JSON.stringify(connectedData)
        });
    } catch (error) {
    console.error("Error al crear la sesion: ", error);
    }
}

// -------------agrega sesiones de usuarios conectado al backend
async function addCajaConnected() {
    const numero_caja = localStorage.getItem('n_caja');
    const nombre_caja = localStorage.getItem('nombre_caja');
    const fingerprint = String(localStorage.getItem('device_fp') || '').trim();

    const connectedData = {
        numero_caja: numero_caja,
        nombre_caja: nombre_caja,
        estado: 1,
        fingerprint: fingerprint || null,
    };
    //console.log(connectedData);
    try{
        const response = await fetch(API_URL+'api/addCaja', {
            method: 'POST',
            headers: {
                ...withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
            },
            body: JSON.stringify(connectedData)
        });
    }catch (error){
    console.error("Error al crear la sesion: ", error);
    }
}

// -------------agrega la info(configuracion) del sistema al backend
async function addInfo() {

    const inventario        = parseStoredBoolean('inventario');
    const credito           = parseStoredBoolean('credito');
    const producto_comun    = parseStoredBoolean('producto_comun');
    const margen_ganancia   = parseStoredBoolean('margen_ganancia');
    const monto_ganancia    = localStorage.getItem('monto_ganancia');
    const redondeo          = parseStoredBoolean('redondeo');
    const monto_redondeo    = localStorage.getItem('monto_redondeo');
    const mensaje           = parseStoredBoolean('mensaje');
    const data_mensaje      = localStorage.getItem('data_mensaje');
    const time_mensaje      = localStorage.getItem('time_mensaje');

    const nombre_local      = localStorage.getItem('nombre_local');
    const telefono_local    = localStorage.getItem('telefono_local');
    const mail_local        = localStorage.getItem('mail_local');
    const tipo_local        = localStorage.getItem('tipo_local');

    const connectedData = { 
        nombre_local:       nombre_local, 
        telefono_local:     telefono_local,
        mail_local:         mail_local, 
        tipo_local:         tipo_local,

        inventario:         inventario, 
        credito:            credito, 
        producto_comun:     producto_comun,
        margen_ganancia:    margen_ganancia, 
        monto_ganancia:     monto_ganancia, 
        redondeo:           redondeo,
        monto_redondeo:     monto_redondeo, 
        mensaje:            mensaje, 
        data_mensaje:       data_mensaje,
        time_mensaje:       time_mensaje, 
        
        
    }
    try{
        const response = await fetch(API_URL+'api/addInfo', {
            method: 'POST',
            headers: {
                ...withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
            },
            body: JSON.stringify(connectedData)
        });
    }catch (error){
    console.error("Error al crear la sesion: ", error);
    }
}

//---------------obtener informacion del negocio del backend
async function getInfo() {
    try {
        const response = await fetch(API_URL+'api/getInfo', {
            headers: withAuthHeaders(),
        });
        const info = await response.json();
        return info;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

//---------------obtener informacion del negocio del backend
async function getCajas() {
    try {
        const response = await fetch(API_URL+'api/getCajas', {
            headers: withAuthHeaders(),
        });
        const cajas = await response.json();
        return cajas;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

function getTodayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

async function loadReportFilters() {
    const fromInput = document.getElementById('report-date-from');
    const toInput = document.getElementById('report-date-to');
    const cajaSelect = document.getElementById('report-caja-filter');
    const cajeroSelect = document.getElementById('report-cajero-filter');
    const cashierPeriodSelect = document.getElementById('report-cashier-period');
    const globalPeriodSelect = document.getElementById('report-global-period');

    if (!fromInput || !toInput || !cajaSelect || !cajeroSelect) {
        return;
    }

    const today = getTodayIsoDate();
    if (!fromInput.value) fromInput.value = today;
    if (!toInput.value) toInput.value = today;

    try {
        const cajas = await getCajas();
        cajaSelect.innerHTML = '<option value="">Todas</option>';
        if (Array.isArray(cajas)) {
            cajas.forEach((caja) => {
                const option = document.createElement('option');
                option.value = caja.n_caja;
                option.textContent = `${caja.n_caja} - ${caja.nombre_caja}`;
                cajaSelect.appendChild(option);
            });
        }

        const usersResp = await fetch(API_URL+'api/usuarios', {
            headers: withAuthHeaders(),
        });
        const users = await usersResp.json();
        cajeroSelect.innerHTML = '<option value="">Todos</option>';
        if (usersResp.ok && Array.isArray(users)) {
            users.forEach((u) => {
                const option = document.createElement('option');
                option.value = u.id;
                option.textContent = `${u.nombre} (${u.user})`;
                cajeroSelect.appendChild(option);
            });
        }

        if (cashierPeriodSelect && !cashierPeriodSelect.value) {
            cashierPeriodSelect.value = 'daily';
        }
        if (globalPeriodSelect && !globalPeriodSelect.value) {
            globalPeriodSelect.value = 'monthly';
        }
    } catch (error) {
        console.error('Error loading report filters:', error);
    }
}

function getReportFilterValues() {
    const fromInput = document.getElementById('report-date-from');
    const toInput = document.getElementById('report-date-to');
    const cajaSelect = document.getElementById('report-caja-filter');
    const cajeroSelect = document.getElementById('report-cajero-filter');
    const today = getTodayIsoDate();

    return {
        desde: fromInput?.value || today,
        hasta: toInput?.value || today,
        caja: cajaSelect?.value || '',
        cajero: cajeroSelect?.value || '',
    };
}

function buildReportFilterQuery() {
    const filters = getReportFilterValues();
    const query = new URLSearchParams({
        desde: filters.desde,
        hasta: filters.hasta,
    });
    if (filters.caja) query.set('caja', filters.caja);
    if (filters.cajero) query.set('cajero', filters.cajero);
    return query;
}

function buildReportChartsQuery() {
    const query = buildReportFilterQuery();
    const cashierPeriod = document.getElementById('report-cashier-period')?.value || 'daily';
    const globalPeriod = document.getElementById('report-global-period')?.value || 'monthly';
    query.set('cashier_period', cashierPeriod === 'monthly' ? 'monthly' : 'daily');
    query.set('global_period', globalPeriod === 'annual' ? 'annual' : 'monthly');
    return query;
}

async function applyReportFilters() {
    const filters = getReportFilterValues();
    if (filters.desde > filters.hasta) {
        alert('El rango de fechas es inválido: "Desde" no puede ser mayor a "Hasta".');
        return;
    }
    await loadReports(filters);
}

async function downloadCsvFromEndpoint(endpoint, defaultName) {
    const filters = getReportFilterValues();
    if (filters.desde > filters.hasta) {
        alert('El rango de fechas es inválido: "Desde" no puede ser mayor a "Hasta".');
        return;
    }

    const query = buildReportFilterQuery();
    try {
        const response = await fetch(API_URL+`${endpoint}?${query.toString()}`, {
            headers: withAuthHeaders(),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'No se pudo exportar CSV');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = defaultName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting csv:', error);
        alert(error.message || 'Error al exportar CSV');
    }
}

async function exportSalesCsv() {
    const today = getTodayIsoDate();
    await downloadCsvFromEndpoint('api/export/ventas.csv', `ventas_${today}.csv`);
}

async function exportCutsCsv() {
    const today = getTodayIsoDate();
    await downloadCsvFromEndpoint('api/export/cortes.csv', `cortes_${today}.csv`);
}

function formatMoney(value) {
    const amount = Number(value || 0);
    return amount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function renderEmptyChart(container, message = 'Sin datos para el periodo seleccionado.') {
    if (!container) return;
    container.innerHTML = `<div class="report-chart-empty">${message}</div>`;
}

function renderSingleSeriesBars(container, items, valueKey = 'total') {
    if (!container) return;
    const normalized = (Array.isArray(items) ? items : [])
        .map((item) => ({
            label: String(item?.label || '').trim(),
            value: Number(item?.[valueKey] || 0),
        }))
        .filter((item) => item.label && item.value > 0);
    if (!normalized.length) {
        renderEmptyChart(container);
        return;
    }

    const total = normalized.reduce((acc, item) => acc + item.value, 0);
    const colors = ['#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#ef4444', '#0ea5e9', '#84cc16', '#f97316', '#14b8a6', '#e11d48', '#6366f1', '#22c55e'];
    let start = 0;
    const slices = normalized.map((item, index) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        const end = start + pct;
        const color = colors[index % colors.length];
        const segment = `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
        start = end;
        return segment;
    }).join(', ');
    const legend = normalized.map((item, index) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        return `
            <li>
                <span class="swatch" style="background:${colors[index % colors.length]};"></span>
                <span class="label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
                <span class="value">$${formatMoney(item.value)} (${pct.toFixed(1)}%)</span>
            </li>
        `;
    }).join('');

    container.innerHTML = `
        <div class="report-pie-layout">
            <div class="report-pie" style="background: conic-gradient(${slices});"></div>
            <ul class="report-pie-legend">${legend}</ul>
        </div>
    `;
}

function renderDualSeriesBars(container, items, firstKey = 'efectivo', secondKey = 'tarjeta') {
    if (!container) return;
    const firstTotal = (Array.isArray(items) ? items : []).reduce((acc, item) => acc + Number(item?.[firstKey] || 0), 0);
    const secondTotal = (Array.isArray(items) ? items : []).reduce((acc, item) => acc + Number(item?.[secondKey] || 0), 0);
    const total = firstTotal + secondTotal;
    if (total <= 0) {
        renderEmptyChart(container);
        return;
    }

    const firstPct = (firstTotal / total) * 100;
    const slices = `#16a34a 0% ${firstPct.toFixed(2)}%, #2563eb ${firstPct.toFixed(2)}% 100%`;
    container.innerHTML = `
        <div class="report-pie-layout">
            <div class="report-pie" style="background: conic-gradient(${slices});"></div>
            <ul class="report-pie-legend">
                <li>
                    <span class="swatch" style="background:#16a34a;"></span>
                    <span class="label">Efectivo</span>
                    <span class="value">$${formatMoney(firstTotal)} (${firstPct.toFixed(1)}%)</span>
                </li>
                <li>
                    <span class="swatch" style="background:#2563eb;"></span>
                    <span class="label">Tarjetas</span>
                    <span class="value">$${formatMoney(secondTotal)} (${(100 - firstPct).toFixed(1)}%)</span>
                </li>
            </ul>
        </div>
    `;
}

async function downloadReportChartDetail(chartName) {
    const filters = getReportFilterValues();
    if (filters.desde > filters.hasta) {
        alert('El rango de fechas es invalido: "Desde" no puede ser mayor a "Hasta".');
        return;
    }

    const query = buildReportChartsQuery();
    query.set('chart', chartName);

    try {
        const response = await fetch(API_URL + `api/reportes/chart-detail.csv?${query.toString()}`, {
            headers: withAuthHeaders(),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'No se pudo descargar el detalle del grafico');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${chartName}_${getTodayIsoDate()}.xlsx`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting chart detail csv:', error);
        alert(error.message || 'Error al descargar detalle del grafico');
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function getBusinessDisplayInfo() {
    const storedLogo =
        localStorage.getItem('logo_data') ||
        localStorage.getItem('logo_url') ||
        localStorage.getItem('business_logo') ||
        '';
    const defaultLogo = `${window.location.origin}/img/cajero-automatico.png`;

    try {
        const info = await getInfo();
        const first = Array.isArray(info) && info.length ? info[0] : null;
        if (first) {
            return {
                nombre: first.nombre || 'Minimarket',
                telefono: first.telefono || '',
                mail: first.mail || '',
                tipo: first.tipo_local || '',
                logo: storedLogo || defaultLogo,
            };
        }
    } catch (error) {
        console.error('Error loading business info for pdf:', error);
    }

    return {
        nombre: localStorage.getItem('nombre_local') || 'Minimarket',
        telefono: localStorage.getItem('telefono_local') || '',
        mail: localStorage.getItem('mail_local') || '',
        tipo: localStorage.getItem('tipo_local') || '',
        logo: storedLogo || defaultLogo,
    };
}

function buildPrintableHtml(title, headers, rows, options = {}) {
    const {
        business = { nombre: 'Minimarket', telefono: '', mail: '', tipo: '', logo: '' },
        filtersText = '',
        summary = [],
        signatures = ['Firma Cajero', 'Firma Supervisor'],
    } = options;

    const headerHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const bodyHtml = rows.map((cols) => {
        const colsHtml = cols.map((c) => `<td>${escapeHtml(c)}</td>`).join('');
        return `<tr>${colsHtml}</tr>`;
    }).join('');
    const summaryHtml = summary.map((item) => `
      <div class="card">
        <div class="label">${escapeHtml(item.label)}</div>
        <div class="value">${escapeHtml(item.value)}</div>
      </div>
    `).join('');
    const signaturesHtml = signatures.map((s) => `
      <div class="signature-item">
        <div class="line"></div>
        <div class="name">${escapeHtml(s)}</div>
      </div>
    `).join('');

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 20mm 12mm 18mm 12mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; }
    .print-header { position: fixed; top: 0; left: 0; right: 0; background: #fff; border-bottom: 1px solid #dbe3ea; padding: 8px 0 10px; }
    .print-footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #dbe3ea; padding: 6px 0 0; font-size: 10px; color: #666; display: flex; justify-content: space-between; }
    .page-num::after { content: counter(page); }
    .container { padding: 0 8px; }
    .doc { margin-top: 122px; margin-bottom: 62px; padding: 0 8px; }
    .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }
    .brand-wrap { display: flex; gap: 10px; align-items: center; }
    .logo { width: 48px; height: 48px; object-fit: contain; border: 1px solid #d5dde5; border-radius: 6px; background: #fff; }
    .brand h1 { margin: 0; font-size: 24px; letter-spacing: 0.2px; }
    .brand p { margin: 3px 0 0; color: #555; font-size: 12px; }
    .meta { text-align: right; font-size: 11px; color: #444; }
    .doc-title { margin: 10px 0 6px; font-size: 18px; }
    .filters { margin: 0 0 12px; font-size: 12px; color: #444; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; margin: 10px 0 14px; }
    .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px; background: #fafafa; }
    .card .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.4px; }
    .card .value { font-size: 14px; margin-top: 4px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #d6d6d6; padding: 6px 7px; text-align: left; }
    th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 28px; }
    .signature-item .line { border-top: 1px solid #111; margin-top: 24px; }
    .signature-item .name { margin-top: 4px; font-size: 11px; color: #444; text-align: center; }
    .small { margin-top: 10px; font-size: 10px; color: #666; }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="container header">
      <div class="brand-wrap">
        <img class="logo" src="${escapeHtml(business.logo || '')}" alt="Logo">
        <div class="brand">
          <h1>${escapeHtml(business.nombre)}</h1>
          <p>${business.tipo ? `Tipo: ${escapeHtml(business.tipo)}` : ''}</p>
          <p>${business.telefono ? `Tel: ${escapeHtml(business.telefono)}` : ''} ${business.mail ? `| ${escapeHtml(business.mail)}` : ''}</p>
        </div>
      </div>
      <div class="meta">
        <div>Documento: ${escapeHtml(title)}</div>
        <div>Generado: ${escapeHtml(new Date().toLocaleString())}</div>
      </div>
    </div>
  </div>
  <div class="print-footer">
    <div>Sistema Minimarket - Reporte operativo</div>
    <div>Pagina <span class="page-num"></span></div>
  </div>
  <div class="doc">
    <h2 class="doc-title">${escapeHtml(title)}</h2>
    <p class="filters">${escapeHtml(filtersText)}</p>
    <div class="summary-grid">${summaryHtml}</div>
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
    <div class="signatures">${signaturesHtml}</div>
    <div class="small">Documento interno de cierre y control</div>
  </div>
</body>
</html>`;
}

function openPrintWindow(html) {
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) {
        alert('El navegador bloqueó la ventana emergente. Habilítala para exportar PDF.');
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
        win.print();
    }, 300);
}

async function exportSalesPdf() {
    const filters = getReportFilterValues();
    if (filters.desde > filters.hasta) {
        alert('El rango de fechas es inválido.');
        return;
    }

    const query = buildReportFilterQuery();
    try {
        const business = await getBusinessDisplayInfo();
        const response = await fetch(API_URL+`api/reportes/ventas-detalle?${query.toString()}`, {
            headers: withAuthHeaders(),
        });
        const rows = await response.json();
        if (!response.ok) {
            throw new Error(rows.message || 'No se pudo generar PDF de ventas');
        }

        const printableRows = rows.map((r) => [
            r.fecha,
            r.numero_ticket,
            r.caja_id,
            `${r.cajero_nombre} (${r.usuario_id})`,
            r.metodo_pago,
            Number(r.total || 0).toFixed(0),
        ]);

        const totalVentas = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
        const byPay = rows.reduce((acc, r) => {
            const key = r.metodo_pago || 'otro';
            acc[key] = (acc[key] || 0) + Number(r.total || 0);
            return acc;
        }, {});
        const nonCashTotal = Object.keys(byPay).reduce((sum, key) => {
            if (key === 'efectivo') return sum;
            return sum + Number(byPay[key] || 0);
        }, 0);

        const html = buildPrintableHtml(
            'Reporte de Ventas',
            ['Fecha', 'Ticket', 'Caja', 'Cajero', 'Metodo Pago', 'Total'],
            printableRows,
            {
                business,
                filtersText: `Rango: ${filters.desde} a ${filters.hasta} | Caja: ${filters.caja || 'Todas'} | Cajero: ${filters.cajero || 'Todos'}`,
                summary: [
                    { label: 'Transacciones', value: String(rows.length) },
                    { label: 'Total Ventas', value: formatMoney(totalVentas) },
                    { label: 'Efectivo', value: formatMoney(byPay.efectivo || 0) },
                    { label: 'No efectivo', value: formatMoney(nonCashTotal) },
                ],
                signatures: ['Firma Cajero', 'Firma Supervisor'],
            }
        );
        openPrintWindow(html);
    } catch (error) {
        console.error('Error exporting sales pdf:', error);
        alert(error.message || 'Error al exportar PDF de ventas');
    }
}

async function exportCutsPdf() {
    const filters = getReportFilterValues();
    if (filters.desde > filters.hasta) {
        alert('El rango de fechas es inválido.');
        return;
    }

    const query = buildReportFilterQuery();
    try {
        const business = await getBusinessDisplayInfo();
        const response = await fetch(API_URL+`api/corte/historial?${query.toString()}`, {
            headers: withAuthHeaders(),
        });
        const rows = await response.json();
        if (!response.ok) {
            throw new Error(rows.message || 'No se pudo generar PDF de cortes');
        }

        const printableRows = rows.map((r) => [
            r.fecha,
            r.caja_id,
            `${r.cajero_nombre || ''} (${r.usuario_id})`,
            Number(r.total_ventas || 0).toFixed(0),
            Number(r.monto_inicial || 0).toFixed(0),
            Number(r.monto_declarado || 0).toFixed(0),
            Number(r.diferencia_efectivo || 0).toFixed(0),
            r.estado,
        ]);

        const totalVentas = rows.reduce((acc, r) => acc + Number(r.total_ventas || 0), 0);
        const totalDiff = rows.reduce((acc, r) => acc + Number(r.diferencia_efectivo || 0), 0);
        const cerrados = rows.filter((r) => String(r.estado) === 'cerrado').length;

        const html = buildPrintableHtml(
            'Historial de Cortes',
            ['Fecha', 'Caja', 'Cajero', 'Ventas', 'Inicial', 'Declarado', 'Diferencia', 'Estado'],
            printableRows,
            {
                business,
                filtersText: `Rango: ${filters.desde} a ${filters.hasta} | Caja: ${filters.caja || 'Todas'} | Cajero: ${filters.cajero || 'Todos'}`,
                summary: [
                    { label: 'Cierres', value: String(rows.length) },
                    { label: 'Cierres Cerrados', value: String(cerrados) },
                    { label: 'Total Ventas', value: formatMoney(totalVentas) },
                    { label: 'Diferencia Neta', value: formatMoney(totalDiff) },
                ],
                signatures: ['Firma Cajero', 'Firma Administrador'],
            }
        );
        openPrintWindow(html);
    } catch (error) {
        console.error('Error exporting cuts pdf:', error);
        alert(error.message || 'Error al exportar PDF de cortes');
    }
}

async function loadReports(filters = null) {
    const dailyContainer = document.getElementById('report-chart-daily');
    const departmentContainer = document.getElementById('report-chart-department');
    const monthlyContainer = document.getElementById('report-chart-monthly');
    const cashierContainer = document.getElementById('report-chart-cashier');
    const globalContainer = document.getElementById('report-chart-global');
    if (!dailyContainer || !departmentContainer || !monthlyContainer || !cashierContainer || !globalContainer) {
        return;
    }

    const values = filters || getReportFilterValues();
    if (values.desde > values.hasta) {
        renderEmptyChart(dailyContainer, 'Rango de fechas invalido.');
        renderEmptyChart(departmentContainer, 'Rango de fechas invalido.');
        renderEmptyChart(monthlyContainer, 'Rango de fechas invalido.');
        renderEmptyChart(cashierContainer, 'Rango de fechas invalido.');
        renderEmptyChart(globalContainer, 'Rango de fechas invalido.');
        return;
    }

    const query = buildReportChartsQuery();

    try {
        const response = await fetch(API_URL + `api/reportes/charts?${query.toString()}`, {
            headers: withAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'No se pudo cargar los graficos');
        }

        const dailyData = Array.isArray(data.daily_payment) ? data.daily_payment : [];
        if (dailyData.length) renderDualSeriesBars(dailyContainer, dailyData, 'efectivo', 'tarjeta');
        else renderEmptyChart(dailyContainer);

        const departmentData = Array.isArray(data.department_sales) ? data.department_sales : [];
        if (departmentData.length) renderSingleSeriesBars(departmentContainer, departmentData, 'total');
        else renderEmptyChart(departmentContainer);

        const monthlyData = Array.isArray(data.monthly_payment) ? data.monthly_payment : [];
        if (monthlyData.length) renderDualSeriesBars(monthlyContainer, monthlyData, 'efectivo', 'tarjeta');
        else renderEmptyChart(monthlyContainer);

        const cashierData = Array.isArray(data.cashier_sales) ? data.cashier_sales : [];
        if (cashierData.length) renderSingleSeriesBars(cashierContainer, cashierData, 'total');
        else renderEmptyChart(cashierContainer);

        const globalData = Array.isArray(data.all_cashiers_sales) ? data.all_cashiers_sales : [];
        if (globalData.length) renderSingleSeriesBars(globalContainer, globalData, 'total');
        else renderEmptyChart(globalContainer);
    } catch (error) {
        renderEmptyChart(dailyContainer, 'Error al cargar grafico de ventas diarias.');
        renderEmptyChart(departmentContainer, 'Error al cargar grafico por departamento.');
        renderEmptyChart(monthlyContainer, 'Error al cargar grafico de ventas mensuales.');
        renderEmptyChart(cashierContainer, 'Error al cargar grafico por cajero.');
        renderEmptyChart(globalContainer, 'Error al cargar grafico global de cajeros.');
        console.error('Error loading reports:', error);
    }
}

async function loadCurrentCut() {
    if (!hasUserPermission('corte_turno') && !hasUserPermission('corte_dia') && !hasUserPermission('corte_todos_turnos')) {
        return;
    }
    const cutSummary = document.getElementById('cut-summary');
    const cutBreakdown = document.getElementById('cut-breakdown');
    if (!cutSummary || !cutBreakdown) {
        return;
    }
    refreshCutCloseButtonState();

    const caja = localStorage.getItem('n_caja');
    const cajero = localStorage.getItem('id_user');
    const query = new URLSearchParams();
    if (caja) query.set('caja', caja);
    if (cajero) query.set('cajero', cajero);

    try {
        const response = await fetch(API_URL+`api/corte/actual?${query.toString()}`, {
            headers: withAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'No se pudo cargar el corte');
        }

        const closeStatus = data.cerrado ? ' (turno cerrado)' : ' (turno abierto)';
        cutCloseContext.turnStatusLabel = closeStatus;
        cutCloseContext.currentDate = data.fecha || new Date().toISOString().slice(0, 10);
        cutSummary.innerHTML = `Fecha ${cutCloseContext.currentDate}`;
        cutBreakdown.innerHTML = '';
        const scopeInfo = document.getElementById('cut-close-scope-info');
        const breakdownList = document.getElementById('cut-close-breakdown');
        const detailBody = document.getElementById('cut-close-detail-body');
        if (scopeInfo) scopeInfo.textContent = 'Selecciona una opcion para cargar el resumen de ventas.';
        if (breakdownList) breakdownList.innerHTML = '';
        if (detailBody) detailBody.innerHTML = '';
        cutCloseContext.scope = null;
        cutCloseContext.resumenLoaded = false;
        cutCloseContext.sessionResumenLoaded = false;
        cutCloseContext.esperadoTarjeta = 0;
        refreshCutCloseButtonState();
    } catch (error) {
        const today = new Date().toISOString().slice(0, 10);
        cutCloseContext.currentDate = today;
        cutSummary.innerHTML = `Fecha ${today}`;
        cutBreakdown.innerHTML = '';
        const scopeInfo = document.getElementById('cut-close-scope-info');
        const breakdownList = document.getElementById('cut-close-breakdown');
        const detailBody = document.getElementById('cut-close-detail-body');
        if (scopeInfo) scopeInfo.textContent = 'Selecciona una opcion para cargar el resumen de ventas.';
        if (breakdownList) breakdownList.innerHTML = '';
        if (detailBody) detailBody.innerHTML = '';
        cutCloseContext.scope = null;
        cutCloseContext.resumenLoaded = false;
        cutCloseContext.sessionResumenLoaded = false;
        cutCloseContext.esperadoTarjeta = 0;
        refreshCutCloseButtonState();
        console.error('Error loading cut:', error);
    }
}

async function loadCutSummaryForClose(scope = 'session', options = {}) {
    const silent = Boolean(options?.silent);
    if (scope === 'session' && !hasUserPermission('corte_turno')) {
        return false;
    }
    if (scope === 'day' && !hasUserPermission('corte_dia')) {
        return false;
    }
    const caja = localStorage.getItem('n_caja');
    const cajero = localStorage.getItem('id_user');
    const scopeInfo = document.getElementById('cut-close-scope-info');
    const breakdownList = document.getElementById('cut-close-breakdown');
    const detailBody = document.getElementById('cut-close-detail-body');

    if (!scopeInfo || !breakdownList || !detailBody) {
        return false;
    }
    if (!caja || !cajero) {
        if (!silent) {
            alert('No hay sesion de caja/cajero activa.');
        }
        return false;
    }

    try {
        const query = new URLSearchParams({ caja, cajero, scope });
        const response = await fetch(API_URL + `api/turno/resumen?${query.toString()}`, {
            headers: withAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (silent) {
                scopeInfo.textContent = data.message || 'No se pudo cargar resumen para cierre.';
            } else {
                alert(data.message || 'No se pudo cargar resumen para cierre.');
            }
            return false;
        }

        const totalVentas = Number(data.totales?.total || 0);
        const totalTx = Number(data.totales?.transacciones || 0);
        const paymentSettings = await fetchPaymentSettingsForCut();
        const departmentRows = await fetchCutDepartmentBreakdown(scope);
        data.departamentos = departmentRows;
        const scopeLabel = scope === 'session' ? 'sesion actual' : 'dia completo';
        renderCutEnabledPaymentBreakdown(data.resumen || [], paymentSettings, scopeLabel);
        if (scope === 'session') {
            renderCutFinancialSections(data);
        } else {
            renderCutFinancialSections({}, { clearOnly: true });
        }
        scopeInfo.textContent = scope === 'session'
            ? `Resumen cargado: sesion actual (${totalTx} ventas, total ${totalVentas.toFixed(0)}).`
            : `Resumen cargado: dia completo (${totalTx} ventas, total ${totalVentas.toFixed(0)}).`;

        breakdownList.innerHTML = '';
        const detailHint = document.createElement('li');
        detailHint.textContent = 'El desglose por forma de pago se muestra en el panel izquierdo.';
        breakdownList.appendChild(detailHint);

        detailBody.innerHTML = '';
        (data.detalle || []).forEach((row) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.fecha || ''}</td>
                <td>${row.numero_ticket || ''}</td>
                <td>${row.metodo_pago || ''}</td>
                <td style="text-align:right;">${Number(row.total || 0).toFixed(0)}</td>
            `;
            detailBody.appendChild(tr);
        });
        if (!data.detalle || data.detalle.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="4" style="text-align:center;">Sin ventas para el alcance seleccionado.</td>';
            detailBody.appendChild(tr);
        }

        cutCloseContext = {
            scope,
            esperadoEfectivo: Number(data.esperado_efectivo || 0),
            esperadoTarjeta: Number(data.esperado_tarjeta || data.resumen_financiero?.ventas_tarjeta || 0),
            resumenLoaded: true,
            sessionResumenLoaded: scope === 'session' ? true : cutCloseContext.sessionResumenLoaded,
            turnStatusLabel: cutCloseContext.turnStatusLabel || '',
            currentDate: cutCloseContext.currentDate || data.fecha || new Date().toISOString().slice(0, 10),
        };
        refreshCutCloseButtonState();
        refreshCloseShiftDifference();
        return true;
    } catch (error) {
        console.error('Error loading cut summary for close:', error);
        if (silent) {
            scopeInfo.textContent = 'Error al cargar resumen para cierre.';
        } else {
            alert('Error al cargar resumen para cierre.');
        }
        return false;
    }
}

function refreshCloseShiftDifference() {
    const declaredInput = document.getElementById('cut-declared-amount');
    const declaredCardInput = document.getElementById('cut-declared-card-amount');
    const diffInput = document.getElementById('cut-difference-preview');
    const cardDiffInput = document.getElementById('cut-card-difference-preview');
    const info = document.getElementById('cut-close-popup-info');
    if (!declaredInput || !declaredCardInput || !diffInput || !cardDiffInput || !info) {
        return;
    }
    const declarado = Number(declaredInput.value || 0);
    const declaradoTarjeta = Number(declaredCardInput.value || 0);
    const esperado = Number(cutCloseContext.esperadoEfectivo || 0);
    const esperadoTarjeta = Number(cutCloseContext.esperadoTarjeta || 0);
    const diff = declarado - esperado;
    const diffTarjeta = declaradoTarjeta - esperadoTarjeta;
    diffInput.value = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`;
    diffInput.style.color = diff < 0 ? 'red' : (diff > 0 ? 'green' : 'inherit');
    cardDiffInput.value = `${diffTarjeta >= 0 ? '+' : ''}${diffTarjeta.toFixed(2)}`;
    cardDiffInput.style.color = diffTarjeta < 0 ? 'red' : (diffTarjeta > 0 ? 'green' : 'inherit');
    info.textContent = '';
}

function applyCloseShiftModeUI(mode) {
    const declaredRow = document.getElementById('cut-declared-row');
    const declaredCardRow = document.getElementById('cut-declared-card-row');
    const diffRow = document.getElementById('cut-difference-row');
    const cardDiffRow = document.getElementById('cut-card-difference-row');
    const declaredInput = document.getElementById('cut-declared-amount');
    const declaredCardInput = document.getElementById('cut-declared-card-amount');
    const diffInput = document.getElementById('cut-difference-preview');
    const cardDiffInput = document.getElementById('cut-card-difference-preview');
    const info = document.getElementById('cut-close-popup-info');
    const autoAdjust = mode !== 'sin_ajuste';
    const esperado = Number(cutCloseContext.esperadoEfectivo || 0);
    const esperadoTarjeta = Number(cutCloseContext.esperadoTarjeta || 0);

    if (declaredRow) declaredRow.style.display = autoAdjust ? '' : 'none';
    if (declaredCardRow) declaredCardRow.style.display = autoAdjust ? '' : 'none';
    if (diffRow) diffRow.style.display = autoAdjust ? '' : 'none';
    if (cardDiffRow) cardDiffRow.style.display = autoAdjust ? '' : 'none';
    if (declaredInput) {
        declaredInput.readOnly = !autoAdjust;
        if (!autoAdjust) declaredInput.value = esperado.toFixed(2);
    }
    if (declaredCardInput) {
        declaredCardInput.readOnly = !autoAdjust;
        if (!autoAdjust) declaredCardInput.value = esperadoTarjeta.toFixed(2);
    }
    if (diffInput && !autoAdjust) {
        diffInput.value = '0.00';
        diffInput.style.color = 'inherit';
    }
    if (cardDiffInput && !autoAdjust) {
        cardDiffInput.value = '0.00';
        cardDiffInput.style.color = 'inherit';
    }
    if (info && !autoAdjust) {
        info.textContent = '';
    } else {
        refreshCloseShiftDifference();
    }
}

async function openCloseShiftDialog() {
    if (!hasUserPermission('corte_turno')) {
        return;
    }
    if (!cutCloseContext.sessionResumenLoaded) {
        alert('Primero carga el resumen de sesion antes de cerrar turno.');
        return;
    }
    const overlay = document.getElementById('cut-close-popup');
    if (!overlay) return;
    const cutSettings = await fetchCutSettingsForShift();
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    applyCloseShiftModeUI(cutSettings.mode);
}

function closeCloseShiftDialog() {
    const overlay = document.getElementById('cut-close-popup');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.style.display = '';
}

async function confirmCloseShiftFromDialog() {
    if (isClosingShift) {
        return;
    }
    const declaredInput = document.getElementById('cut-declared-amount');
    const declaredCardInput = document.getElementById('cut-declared-card-amount');
    const declarado = Number(declaredInput?.value || 0);
    const declaradoTarjeta = Number(declaredCardInput?.value || 0);
    await closeCurrentShift(declarado, declaradoTarjeta);
}

async function fetchCutSettingsForShift() {
    try {
        const response = await fetch(API_URL + 'api/cut-settings', {
            headers: withAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { mode: 'ajuste_auto' };
        }
        return {
            mode: data.mode === 'sin_ajuste' ? 'sin_ajuste' : 'ajuste_auto',
        };
    } catch (error) {
        return { mode: 'ajuste_auto' };
    }
}

async function closeCurrentShift(declaredOverride = null, declaredCardOverride = null) {
    if (isClosingShift) {
        return;
    }
    isClosingShift = true;
    const confirmBtn = document.getElementById('cut-confirm-close-btn');
    if (confirmBtn) confirmBtn.disabled = true;

    const caja = localStorage.getItem('n_caja');
    const cajero = localStorage.getItem('id_user');
    const montoInicialInput = document.getElementById('cut-initial-amount');
    const obsInput = document.getElementById('cut-notes');
    const montoInicial = Number(localStorage.getItem('turno_monto_inicial') || montoInicialInput?.value || 0);
    const montoDeclarado = declaredOverride === null
        ? Number(document.getElementById('cut-declared-amount')?.value || 0)
        : Number(declaredOverride);
    const montoDeclaradoTarjeta = declaredCardOverride === null
        ? Number(document.getElementById('cut-declared-card-amount')?.value || 0)
        : Number(declaredCardOverride);
    const observaciones = (obsInput?.value || '').trim();
    const cutSettings = await fetchCutSettingsForShift();
    const usesAutoAdjust = cutSettings.mode !== 'sin_ajuste';

    if (!caja || !cajero) {
        alert('No hay sesión de caja/cajero activa.');
        isClosingShift = false;
        if (confirmBtn) confirmBtn.disabled = false;
        return;
    }
    if (!Number.isFinite(montoInicial) || montoInicial < 0) {
        alert('Monto inicial inválido.');
        isClosingShift = false;
        if (confirmBtn) confirmBtn.disabled = false;
        return;
    }
    if (usesAutoAdjust && (!Number.isFinite(montoDeclarado) || montoDeclarado < 0)) {
        alert('Monto declarado inválido.');
        isClosingShift = false;
        if (confirmBtn) confirmBtn.disabled = false;
        return;
    }
    if (usesAutoAdjust && (!Number.isFinite(montoDeclaradoTarjeta) || montoDeclaradoTarjeta < 0)) {
        alert('Monto declarado de tarjeta inválido.');
        isClosingShift = false;
        if (confirmBtn) confirmBtn.disabled = false;
        return;
    }

    try {
        const shiftSalesKey = buildShiftSalesStorageKey();
        const response = await fetch(API_URL+'api/corte/cerrar', {
            method: 'POST',
            headers: {
                ...withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
            },
            body: JSON.stringify({
                numero_caja: caja,
                cajero,
                monto_inicial: montoInicial,
                monto_declarado: usesAutoAdjust ? montoDeclarado : 0,
                monto_declarado_tarjeta: usesAutoAdjust ? montoDeclaradoTarjeta : 0,
                observaciones,
            }),
        });
        const data = await response.json();

        if (!response.ok) {
            alert(data.message || 'No se pudo cerrar el turno');
            isClosingShift = false;
            if (confirmBtn) confirmBtn.disabled = false;
            return;
        }

        const diff = Number(data.diferencia_efectivo || 0);
        if (usesAutoAdjust) {
            const diffCard = Number(data.diferencia_tarjeta || 0);
            alert(`Turno cerrado: total ${Number(data.total_ventas || 0).toFixed(0)} en ${data.transacciones || 0} ventas. Diferencia efectivo: ${diff >= 0 ? '+' : ''}${diff.toFixed(0)}. Diferencia tarjeta: ${diffCard >= 0 ? '+' : ''}${diffCard.toFixed(0)}`);
        } else {
            alert(`Turno cerrado: total ${Number(data.total_ventas || 0).toFixed(0)} en ${data.transacciones || 0} ventas.`);
        }
        closeCloseShiftDialog();
        shiftStarted = false;
        clearLocalShiftContext();
        if (shiftSalesKey) {
            localStorage.removeItem(shiftSalesKey);
        }
        setSalesEnabledByShift(false);
        cutCloseContext = { scope: null, esperadoEfectivo: 0, esperadoTarjeta: 0, resumenLoaded: false, sessionResumenLoaded: false };
        refreshCutCloseButtonState();
        const scopeInfo = document.getElementById('cut-close-scope-info');
        const breakdownList = document.getElementById('cut-close-breakdown');
        const detailBody = document.getElementById('cut-close-detail-body');
        const cashList = document.getElementById('cut-cash-detail-list');
        const cashTotal = document.getElementById('cut-cash-total');
        const profitList = document.getElementById('cut-profit-detail-list');
        const profitTotal = document.getElementById('cut-profit-total');
        const incomeList = document.getElementById('cut-session-income-list');
        const expenseList = document.getElementById('cut-session-expense-list');
        const departmentList = document.getElementById('cut-department-list');
        const topProductsByDepartmentList = document.getElementById('cut-top-products-by-department');
        if (scopeInfo) scopeInfo.textContent = 'Selecciona una opcion para cargar el resumen de ventas.';
        if (breakdownList) breakdownList.innerHTML = '';
        if (detailBody) detailBody.innerHTML = '';
        if (cashList) cashList.innerHTML = '';
        if (cashTotal) cashTotal.textContent = '';
        if (profitList) profitList.innerHTML = '';
        if (profitTotal) profitTotal.textContent = '';
        if (incomeList) incomeList.innerHTML = '';
        if (expenseList) expenseList.innerHTML = '';
        if (departmentList) departmentList.innerHTML = '';
        if (topProductsByDepartmentList) topProductsByDepartmentList.innerHTML = '';
        try {
            await deleteConnectedUser();
        } catch (logoutError) {
            console.error('Error during disconnect after shift close:', logoutError);
        }
        clearSessionTokens();
        localStorage.removeItem('id_user');
        localStorage.removeItem('user_permissions');
        localStorage.removeItem('user_is_admin');
        localStorage.removeItem('estado_login');
        window.location.href = 'index.php';
        return;
    } catch (error) {
        console.error('Error closing shift:', error);
        alert('Error al cerrar el turno.');
        isClosingShift = false;
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

/* consulta el servidor para obtener la cantidad de equipos conectados.
async function getConnectedDevices() {
    try {
        const response = await fetch(API_URL+'devices'); // Consultar al backend
        const data = await response.json();
        return (parseInt(data.connected));
    } catch (error) {
        console.error("Error al obtener la cantidad de dispositivos:", error);
    }
}*/

// Llamar a la funciÃ³n cada 5 segundos para actualizar el nÃºmero de equipos conectados
//setInterval(getConnectedDevices, 5000);


// Llamar una vez al cargar la pÃ¡gina
//document.addEventListener('DOMContentLoaded', getConnectedDevices);

/*document.getElementById("info").textContent =
                `Sistema Operativo: ${getDeviceInfo().sistemaOperativo}, ` +
                `Dispositivo: ${getDeviceInfo().tipoDispositivo}, ` +
                `Navegador: ${getDeviceInfo().navegador}`;

*/

//-------------muestra los popup de la vista de configuracion en una ventana nueva
function mostrarPopUp(popUp) {
    //console.log("mostrar popup");
  if (popUp === 'miPopUp' && !hasUserPermission('ventas_cobrar_ticket')) {
    return;
  }
  if (popUp === 'miPopUp' && getCartTotalAmount() <= 0) {
    return;
  }
  if (popUp === 'miPopUp' && typeof window.reloadSalePaymentSettings === 'function') {
    window.reloadSalePaymentSettings();
  }
  clearPaymentWarning();
  document.getElementById(popUp).classList.remove("hidden");
}

function focusBarcodeInputForNextScan() {
    const barcodeInput = document.getElementById('barcode');
    if (!barcodeInput) return;
    setTimeout(() => {
        try {
            barcodeInput.focus();
            barcodeInput.select();
        } catch (_) {
        }
    }, 0);
}

//-------------oculta los popup de la vista de configuracion de una ventana abierta
function cerrarPopUp(popUp) {
    //console.log("cerrar popup");
  clearPaymentWarning();
  document.getElementById(popUp).classList.add("hidden");
  if (popUp === 'miPopUp') {
      focusBarcodeInputForNextScan();
  }
}

function mostrarMensaje(mensaje) {
    //console.log("mensaje popup");
  document.getElementById("mensajePopUp").textContent = mensaje;
  mostrarPopUp();
}

function persistLocalUserSessionSnapshot(usernameInput, loginData) {
    const userId = Number(loginData?.id || 0);
    if (!userId) return;
    const snapshot = {
        id: userId,
        username_login: String(usernameInput || '').trim(),
        nombre: String(loginData?.username || '').trim(),
        caja: String(localStorage.getItem('n_caja') || '').trim(),
        primer_login_local: localStorage.getItem('user_profile') ? null : new Date().toISOString(),
        ultimo_login_local: new Date().toISOString(),
    };
    localStorage.setItem('user_profile', JSON.stringify(snapshot));
}

// -------------valida y crea la sesion del usuario
async function login(){
    const username = (document.getElementById('username').value || '').trim();
    const password = document.getElementById('password').value || '';
    const numeroCaja = String(localStorage.getItem('n_caja') || '').trim();
    const deviceHash = String(localStorage.getItem('device_fp') || '').trim();
    const turnoOwnerCaja = String(localStorage.getItem('turno_owner_caja') || '').trim();
    const turnoOwnerUser = String(localStorage.getItem('turno_owner_user') || '').trim();
    const loginError = document.getElementById('login-error');
    if (loginError) {
        loginError.classList.add('hidden');
        loginError.textContent = '';
    }
    if (!username || !password) {
        if (loginError) {
            loginError.textContent = 'Debe ingresar usuario y contraseña.';
            loginError.classList.remove('hidden');
        }
        return;
    }
    try {
        const response = await fetch(API_URL +'api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, numero_caja: numeroCaja || null, device_hash: deviceHash || null }),
        });

        if (response.ok) {
          const data = await response.json();
          const loggedUserId = String(Number(data?.id || 0) || '');
          if (numeroCaja && turnoOwnerCaja === numeroCaja && turnoOwnerUser && loggedUserId && turnoOwnerUser !== loggedUserId) {
            if (loginError) {
                loginError.textContent = 'Caja con turno abierto: solo el cajero que abrio el turno puede ingresar hasta cerrar caja.';
                loginError.classList.remove('hidden');
            }
            return;
          }
          // Guardar token o sesiÃ³n
          setSessionTokens(data.token, data.refresh_token || null);
          localStorage.setItem('user', username);// Opcional: guardar el nombre de usuario
          localStorage.setItem('id_user', data.id);
          localStorage.setItem('username', data.username);
          localStorage.setItem('estado_login','1');
          localStorage.setItem('user_is_admin', String(Number(data.es_administrador || 0)));
          localStorage.setItem('user_permissions', JSON.stringify(data.permisos || {}));
          persistLocalUserSessionSnapshot(username, data);
          localStorage.setItem('user_sync_pending', '1');

          try {
            await addConnectedUser();
            await updateUser();
            localStorage.removeItem('user_sync_pending');
          } catch (sessionError) {
            console.warn('No se pudo sincronizar estado de sesion, se continuara con el login:', sessionError);
          }

          /*console.log(`token: ${data.token}`);
          console.log(`user: ${username}`);
          console.log(`id_user: ${data.id}`);
          console.log(`username: ${data.username}`);
          */
          window.location.href = 'home.php'; // Redirigir al sistema principal
        } else {
            const errorData = await response.json().catch(() => ({}));
            if (loginError) {
                loginError.textContent = errorData.message || 'Usuario o contraseña incorrecta.';
                loginError.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error during login:', error);
        if (loginError) {
            loginError.textContent = 'No se pudo conectar con el servidor de login.';
            loginError.classList.remove('hidden');
        }
    }
}
                  
// -------------------------PRODUCTOS (V2)-------------------------
let selectedProductForModify = null;
let selectedProductForDelete = null;
let selectedCatalogProductCode = '';
let catalogRowsCache = [];
let selectedPromotionProductIds = new Set();
let selectedInventoryProduct = null;
let shoppingOrderState = { order: null, items: [] };
let shoppingReceiveState = { selectedOrderId: null, selectedOrder: null, pendingOrders: [], items: [] };

function parseLocalBoolFlexible(key) {
    const raw = String(localStorage.getItem(key) || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function getConfiguredDefaultProfitPercent() {
    const marginEnabled = parseLocalBoolFlexible('margen_ganancia');
    const storedAmount = Number(localStorage.getItem('monto_ganancia'));
    if (!marginEnabled) return 0;
    if (!Number.isFinite(storedAmount) || storedAmount < 0) return 0;
    return storedAmount;
}

async function syncProfitConfigFromServer() {
    try {
        const rows = await getInfo();
        const current = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (!current) return;
        const enabled = Boolean(Number(current.margen_ganancia || 0));
        const amount = Number(current.monto_ganancia || 0);
        localStorage.setItem('margen_ganancia', enabled ? 'true' : 'false');
        localStorage.setItem('monto_ganancia', String(Number.isFinite(amount) && amount > 0 ? amount : 0));
        applyDefaultProfitToProductForms();
    } catch (_) {
        // Silencioso: se mantiene localStorage actual.
    }
}

function applyDefaultProfitToProductForms() {
    const defaultProfit = getConfiguredDefaultProfitPercent();
    const addProfitInput = document.getElementById('product-ganancia');
    const editProfitInput = document.getElementById('product-edit-profit');
    if (addProfitInput) addProfitInput.value = String(defaultProfit);
    if (editProfitInput && !selectedProductForModify) editProfitInput.value = String(defaultProfit);
    updateSalePriceByMargin('product-costo', 'product-ganancia', 'product-price');
    if (!selectedProductForModify) {
        updateSalePriceByMargin('product-edit-cost', 'product-edit-profit', 'product-edit-price');
    }
}

function syncAddInventoryFieldsState() {
    const useInventory = document.getElementById('product-use-inventory');
    const qtyInput = document.getElementById('product-quantity');
    const minInput = document.getElementById('product-quantity-min');
    const maxInput = document.getElementById('product-quantity-max');
    if (!useInventory || !qtyInput || !minInput || !maxInput) return;

    const enabled = Boolean(useInventory.checked);
    [qtyInput, minInput, maxInput].forEach((input) => {
        input.disabled = !enabled;
        if (!enabled) input.value = '0';
    });
}

function refreshSuppliersOnProductContext() {
    const addSection = document.getElementById('add');
    const modifySection = document.getElementById('modify');
    const addVisible = addSection && !addSection.classList.contains('hidden');
    const modifyVisible = modifySection && !modifySection.classList.contains('hidden');
    if (addVisible || modifyVisible) {
        loadProductSupplierOptions().catch(() => {});
    }
}

function setupAddInventoryToggle() {
    const useInventory = document.getElementById('product-use-inventory');
    if (!useInventory) return;
    useInventory.addEventListener('change', syncAddInventoryFieldsState);
    syncAddInventoryFieldsState();
}

function normalizeText(value) {
    return String(value || '').trim();
}

function toIntOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toDecimalOrNull(value, decimals = 2) {
    const normalized = String(value ?? '').replace(',', '.').trim();
    if (!normalized) return null;
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    const factor = 10 ** Math.max(0, Number(decimals) || 0);
    return Math.round(n * factor) / factor;
}

function toPositiveIntOrNull(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const parsed = Math.trunc(n);
    return parsed > 0 ? parsed : null;
}

function calculateSalePriceFromCost(costValue, profitPercentValue) {
    const cost = Number(costValue);
    const profit = Number(profitPercentValue);
    if (!Number.isFinite(cost) || cost < 0) return null;
    const safeProfit = Number.isFinite(profit) && profit >= 0 ? profit : 0;
    return Math.round(cost * (1 + (safeProfit / 100)));
}

function updateSalePriceByMargin(costInputId, profitInputId, salePriceInputId) {
    const costInput = document.getElementById(costInputId);
    const profitInput = document.getElementById(profitInputId);
    const salePriceInput = document.getElementById(salePriceInputId);
    if (!costInput || !profitInput || !salePriceInput) return;
    const computed = calculateSalePriceFromCost(costInput.value, profitInput.value);
    if (computed === null) return;
    salePriceInput.value = String(computed);
}

function updateProfitBySalePrice(costInputId, salePriceInputId, profitInputId) {
    const costInput = document.getElementById(costInputId);
    const salePriceInput = document.getElementById(salePriceInputId);
    const profitInput = document.getElementById(profitInputId);
    if (!costInput || !salePriceInput || !profitInput) return;

    const cost = Number(costInput.value);
    const salePrice = Number(salePriceInput.value);
    if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(salePrice)) {
        return;
    }

    const rawPercent = ((salePrice - cost) / cost) * 100;
    const normalizedPercent = Math.max(0, rawPercent);
    profitInput.value = String(Number(normalizedPercent.toFixed(2)));
}

function setupProductPriceAutoCalc() {
    const bindings = [
        { costId: 'product-costo', profitId: 'product-ganancia', saleId: 'product-price' },
        { costId: 'product-edit-cost', profitId: 'product-edit-profit', saleId: 'product-edit-price' },
        { costId: 'inventory-product-cost', profitId: 'inventory-product-profit', saleId: 'inventory-product-sale' },
    ];
    bindings.forEach((bind) => {
        const costInput = document.getElementById(bind.costId);
        const profitInput = document.getElementById(bind.profitId);
        const saleInput = document.getElementById(bind.saleId);
        if (!costInput || !profitInput) return;
        const recalc = () => updateSalePriceByMargin(bind.costId, bind.profitId, bind.saleId);
        costInput.addEventListener('input', recalc);
        profitInput.addEventListener('input', recalc);
        if (saleInput) {
            saleInput.addEventListener('input', () => updateProfitBySalePrice(bind.costId, bind.saleId, bind.profitId));
            saleInput.addEventListener('change', () => updateProfitBySalePrice(bind.costId, bind.saleId, bind.profitId));
        }
    });
}

function toTitleCaseWords(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\b([a-z\u00c0-\u00ff])/g, (match) => match.toUpperCase());
}

function setupProductDescriptionTitleCase() {
    const fields = ['product-name', 'product-edit-name'];
    fields.forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', () => {
            const start = input.selectionStart;
            const formatted = toTitleCaseWords(input.value);
            if (formatted !== input.value) {
                input.value = formatted;
                if (typeof start === 'number') {
                    input.setSelectionRange(start, start);
                }
            }
        });
    });
}

function getProductSearchDatalist() {
    return document.getElementById('product-search-options');
}

function fillProductSearchDatalist(rows) {
    const datalist = getProductSearchDatalist();
    if (!datalist) return;
    datalist.innerHTML = '';
    (rows || []).forEach((row) => {
        const code = normalizeText(row.codigo_barras);
        const desc = normalizeText(row.descripcion);
        if (!code && !desc) return;
        const option = document.createElement('option');
        option.value = code || desc;
        option.label = code && desc ? `${code} - ${desc}` : (code || desc);
        datalist.appendChild(option);
    });
}

async function searchProductsForInput(query) {
    const q = normalizeText(query);
    if (!q) return [];
    const response = await fetch(API_URL + `api/productos/search?q=${encodeURIComponent(q)}`, {
        headers: withAuthHeaders(),
    });
    if (!response.ok) return [];
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
}

async function findProductByCodeOrText(inputValue) {
    const query = normalizeText(inputValue);
    if (!query) return null;

    const byCodeResponse = await fetch(API_URL + `api/productos/code/${encodeURIComponent(query)}`, {
        headers: withAuthHeaders(),
    });
    const byCodeData = await byCodeResponse.json().catch(() => ({}));
    if (byCodeResponse.ok && byCodeData?.found && byCodeData?.product) {
        return byCodeData.product;
    }

    const matches = await searchProductsForInput(query);
    return matches.length ? matches[0] : null;
}

async function loadDepartmentOptions(targetId, selectedName = '') {
    const select = document.getElementById(targetId);
    if (!select) return;
    try {
        const response = await fetch(API_URL + 'api/departamentos', {
            headers: withAuthHeaders(),
        });
        const rows = await response.json().catch(() => []);
        const list = Array.isArray(rows) ? rows : [];
        select.innerHTML = list.map((row) => {
            const name = normalizeText(row.nombre || row.departamento || '');
            const selected = normalizeText(selectedName) === name ? ' selected' : '';
            return `<option value="${name}"${selected}>${name}</option>`;
        }).join('');
    } catch (_) {
        select.innerHTML = '';
    }
}

async function loadProductSupplierOptions() {
    const targets = ['product-supplier', 'product-supplier-edit'];
    let rows = [];
    try {
        const response = await fetch(API_URL + 'api/service-suppliers', {
            headers: withAuthHeaders(),
        });
        rows = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(rows)) rows = [];
    } catch (_) {
        rows = [];
    }

    targets.forEach((id) => {
        const select = document.getElementById(id);
        if (!select) return;
        const previous = String(select.value || '');
        const html = ['<option value="">Sin proveedor</option>'];
        rows.forEach((row) => {
            const supplierId = Number(row.id || 0);
            const name = normalizeText(row.name);
            if (!supplierId || !name) return;
            html.push(`<option value="${supplierId}">${name}</option>`);
        });
        select.innerHTML = html.join('');
        if (previous && select.querySelector(`option[value="${previous}"]`)) {
            select.value = previous;
        }
    });
}

async function loadPromotionProductsSelect() {
    const select = document.getElementById('promo-products');
    if (!select) return;
    try {
        const response = await fetch(API_URL + 'api/productos', {
            headers: withAuthHeaders(),
        });
        const rows = await response.json().catch(() => []);
        const list = Array.isArray(rows) ? rows : [];
        const previous = String(select.value || '');
        select.innerHTML = '<option value="">Selecciona un producto para agregar</option>';
        list.forEach((row) => {
            const id = Number(row.id_producto || 0);
            const code = normalizeText(row.codigo_barras);
            const desc = normalizeText(row.descripcion);
            if (!id || !desc) return;
            const option = document.createElement('option');
            option.value = String(id);
            option.textContent = `${code ? `${code} - ` : ''}${desc}`;
            select.appendChild(option);
        });
        if (previous && select.querySelector(`option[value="${previous}"]`)) {
            select.value = previous;
        } else {
            select.value = '';
        }
        renderPromotionSelectedProducts();
    } catch (_) {
        select.innerHTML = '';
    }
}

function renderPromotionSelectedProducts() {
    const list = document.getElementById('promo-selected-products');
    const select = document.getElementById('promo-products');
    if (!list || !select) return;
    list.innerHTML = '';
    const ids = Array.from(selectedPromotionProductIds);
    if (!ids.length) {
        const li = document.createElement('li');
        li.textContent = 'Sin productos seleccionados.';
        list.appendChild(li);
        return;
    }

    ids.forEach((id) => {
        const option = select.querySelector(`option[value="${id}"]`);
        const label = option ? option.textContent : `Producto ${id}`;
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.gap = '8px';
        li.innerHTML = `<span>${escapeHtml(label)}</span><button class="btn" type="button" data-remove-promo-id="${id}">Quitar</button>`;
        list.appendChild(li);
    });

    list.querySelectorAll('button[data-remove-promo-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.removePromoId || 0);
            if (id > 0) {
                selectedPromotionProductIds.delete(id);
                renderPromotionSelectedProducts();
            }
        });
    });
}

function addSelectedPromotionProduct() {
    const select = document.getElementById('promo-products');
    if (!select) return;
    const id = Number(select.value || 0);
    if (!id) return;
    selectedPromotionProductIds.add(id);
    select.value = '';
    renderPromotionSelectedProducts();
}

function clearPromotionSelection() {
    selectedPromotionProductIds = new Set();
    const select = document.getElementById('promo-products');
    if (select) select.value = '';
    renderPromotionSelectedProducts();
}

function onPromotionTypeChange() {
    const type = String(document.getElementById('promo-type')?.value || 'single');
    const discountInput = document.getElementById('promo-discount');
    const discountRow = discountInput ? discountInput.closest('.form-row') : null;
    const minQtyInput = document.getElementById('promo-min-qty');
    const comboPriceRow = document.getElementById('promo-combo-price-row');

    if (type === 'combo') {
        if (discountRow) discountRow.classList.add('hidden');
        if (comboPriceRow) comboPriceRow.classList.remove('hidden');
        if (minQtyInput) {
            minQtyInput.value = '1';
            minQtyInput.min = '1';
        }
    } else {
        if (discountRow) discountRow.classList.remove('hidden');
        if (comboPriceRow) comboPriceRow.classList.add('hidden');
        if (minQtyInput) {
            minQtyInput.value = '2';
            minQtyInput.min = '2';
        }
    }
}

async function loadDepartmentsView() {
    await loadDepartmentOptions('product-department-add');
    await loadDepartmentOptions('product-department-edit');
    const list = document.getElementById('department-list');
    if (!list) return;
    try {
        const response = await fetch(API_URL + 'api/departamentos', {
            headers: withAuthHeaders(),
        });
        const rows = await response.json().catch(() => []);
        const departments = Array.isArray(rows) ? rows : [];
        list.innerHTML = '';
        if (!departments.length) {
            const li = document.createElement('li');
            li.textContent = 'No hay departamentos registrados.';
            list.appendChild(li);
            return;
        }
        departments.forEach((row) => {
            const li = document.createElement('li');
            li.textContent = normalizeText(row.nombre || row.departamento || 'Sin nombre').toUpperCase();
            list.appendChild(li);
        });
    } catch (_) {
        list.innerHTML = '<li>No se pudo cargar la lista de departamentos.</li>';
    }
}

async function loadPromotions() {
    const wrap = document.getElementById('promo-list');
    if (!wrap) return;
    try {
        const response = await fetch(API_URL + 'api/promociones', {
            headers: withAuthHeaders(),
        });
        const rows = await response.json().catch(() => []);
        const promotions = Array.isArray(rows) ? rows : [];
        if (!promotions.length) {
            wrap.textContent = 'Sin promociones.';
            return;
        }
        wrap.innerHTML = promotions.map((promo) => {
            const items = Array.isArray(promo.productos) ? promo.productos : [];
            const names = items.map((it) => normalizeText(it.descripcion)).filter(Boolean).join(', ');
            const isCombo = String(promo.promo_type || 'single') === 'combo';
            const typeText = isCombo
                ? `Combo (${Number(promo.combo_price || 0).toFixed(0)})`
                : `Por cantidad (${Number(promo.discount_percent || 0)}%)`;
            return `
                <div style="padding:6px 0; border-bottom:1px solid #e5e7eb;">
                    <strong>${escapeHtml(promo.nombre)}</strong>
                    <div>Tipo: ${escapeHtml(typeText)} | Mínimo: ${Number(promo.min_qty || 2)}</div>
                    <div>Productos: ${escapeHtml(names || 'Sin productos')}</div>
                </div>
            `;
        }).join('');
    } catch (_) {
        wrap.textContent = 'No se pudieron cargar las promociones.';
    }
}

function fillModifyFormFromProduct(product) {
    selectedProductForModify = product || null;
    if (!product) return;
    document.getElementById('product-edit-name').value = normalizeText(product.descripcion);
    document.getElementById('product-edit-price').value = Number(product.precio_venta || 0);
    document.getElementById('product-edit-cost').value = Number(product.costo || 0);
    const configuredDefaultProfit = getConfiguredDefaultProfitPercent();
    const currentProfit = Number(product.ganancia);
    document.getElementById('product-edit-profit').value = Number.isFinite(currentProfit) ? currentProfit : configuredDefaultProfit;
    const formatById = (() => {
        const id = Number(product.id_formato || 0);
        if (id === 1) return 'unidad';
        if (id === 2) return 'granel';
        if (id === 3) return 'pack';
        return '';
    })();
    const formatNameRaw = normalizeText(product.formato_venta || formatById || '').toLowerCase();
    const formatName = (formatNameRaw === 'botellas') ? 'unidad' : formatNameRaw;
    const editUnidad = document.getElementById('radio-edit-unidad');
    const editKilo = document.getElementById('radio-edit-kilo');
    const editPack = document.getElementById('radio-edit-pack');
    if (editUnidad) editUnidad.checked = (formatName === 'unidad' || !formatName || (formatName !== 'granel' && formatName !== 'pack'));
    if (editKilo) editKilo.checked = formatName === 'granel';
    if (editPack) editPack.checked = formatName === 'pack';
    loadDepartmentOptions('product-department-edit', normalizeText(product.departamento || product.nombre_departamento || ''));
    const supplierSelect = document.getElementById('product-supplier-edit');
    if (supplierSelect) supplierSelect.value = String(product.supplier_id || '');
    const taxExemptEdit = document.getElementById('product-edit-tax-exempt');
    if (taxExemptEdit) taxExemptEdit.checked = Number(product.exento_iva || 0) === 1;
    const useInventoryEdit = document.getElementById('product-edit-use-inventory');
    if (useInventoryEdit) useInventoryEdit.checked = Number(product.utiliza_inventario || 0) === 1;
    const searchInput = document.getElementById('product-modify-search');
    if (searchInput) searchInput.disabled = true;
    setModifyFormVisibility(true);
}

function fillDeleteInfo(product) {
    const box = document.getElementById('product-remove-info');
    if (!box) return;
    if (!product) {
        box.textContent = 'Selecciona un producto para eliminar.';
        return;
    }
    const qty = Number(product.cantidad_actual || 0);
    const supplier = normalizeText(product.supplier_name || '');
    box.innerHTML = `
        <div><strong>Código:</strong> ${escapeHtml(normalizeText(product.codigo_barras))}</div>
        <div><strong>Descripción:</strong> ${escapeHtml(normalizeText(product.descripcion))}</div>
        <div><strong>Stock actual:</strong> ${qty}</div>
        <div><strong>Proveedor:</strong> ${escapeHtml(supplier || 'Sin proveedor')}</div>
    `;
}

function setAddProductFeedback(message, type = 'error') {
    const box = document.getElementById('product-add-feedback');
    if (!box) return;
    const text = String(message || '').trim();
    if (!text) {
        box.textContent = '';
        box.classList.add('hidden');
        box.classList.remove('feedback-error', 'feedback-ok');
        return;
    }
    box.textContent = text;
    box.classList.remove('hidden');
    box.classList.remove('feedback-error', 'feedback-ok');
    box.classList.add(type === 'ok' ? 'feedback-ok' : 'feedback-error');
}

function clearProductAddForm() {
    document.getElementById('product-code').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('radio-unidad').checked = true;
    document.getElementById('product-costo').value = '';
    document.getElementById('product-ganancia').value = String(getConfiguredDefaultProfitPercent());
    document.getElementById('product-price').value = '';
    document.getElementById('product-use-inventory').checked = false;
    document.getElementById('product-quantity').value = '';
    document.getElementById('product-quantity-min').value = '';
    document.getElementById('product-quantity-max').value = '';
    const supplier = document.getElementById('product-supplier');
    if (supplier) supplier.value = '';
    const taxExempt = document.getElementById('product-tax-exempt');
    if (taxExempt) taxExempt.checked = false;
    syncAddInventoryFieldsState();
    setAddProductFeedback('');
    const codeInput = document.getElementById('product-code');
    if (codeInput) {
        setTimeout(() => {
            try {
                codeInput.focus();
                codeInput.select();
            } catch (_) {
            }
        }, 0);
    }
}

function clearProductModifyForm() {
    selectedProductForModify = null;
    const searchInput = document.getElementById('product-modify-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.disabled = false;
    }
    document.getElementById('product-edit-name').value = '';
    document.getElementById('product-edit-price').value = '';
    document.getElementById('product-edit-cost').value = '';
    document.getElementById('product-edit-profit').value = String(getConfiguredDefaultProfitPercent());
    const editUnidad = document.getElementById('radio-edit-unidad');
    const editKilo = document.getElementById('radio-edit-kilo');
    const editPack = document.getElementById('radio-edit-pack');
    if (editUnidad) editUnidad.checked = false;
    if (editKilo) editKilo.checked = false;
    if (editPack) editPack.checked = false;
    const supplier = document.getElementById('product-supplier-edit');
    if (supplier) supplier.value = '';
    const taxExemptEdit = document.getElementById('product-edit-tax-exempt');
    if (taxExemptEdit) taxExemptEdit.checked = false;
    const useInventoryEdit = document.getElementById('product-edit-use-inventory');
    if (useInventoryEdit) useInventoryEdit.checked = false;
    setModifyFormVisibility(false);
}

function setModifyFormVisibility(visible) {
    const formBody = document.getElementById('product-modify-form-body');
    const emptyState = document.getElementById('product-modify-empty-state');
    if (formBody) formBody.classList.toggle('hidden', !visible);
    if (emptyState) emptyState.classList.toggle('hidden', visible);
}

function cancelProductOperation(sectionId) {
    if (sectionId === 'add') {
        clearProductAddForm();
    }
    if (sectionId === 'modify') {
        clearProductModifyForm();
    }
    hideAllSections();
}

function focusFirstInputInProductSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section || section.classList.contains('hidden')) return;
    const firstField = section.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
    if (!firstField) return;
    setTimeout(() => {
        try {
            firstField.focus();
            if (typeof firstField.select === 'function' && firstField.tagName?.toLowerCase() === 'input') {
                firstField.select();
            }
        } catch (_) {
        }
    }, 0);
}

function showSectioninventario(sectionId) {
    const root = document.getElementById('products-panel');
    if (!root) return;
    root.querySelectorAll('.product-section').forEach((section) => section.classList.add('hidden'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');

    if (sectionId === 'add') {
        applyDefaultProfitToProductForms();
        syncProfitConfigFromServer();
        loadDepartmentOptions('product-department-add');
        loadProductSupplierOptions();
        const codeInput = document.getElementById('product-code');
        if (codeInput) {
            setTimeout(() => {
                try {
                    codeInput.focus();
                    codeInput.select();
                } catch (_) {
                }
            }, 0);
        }
    }
    if (sectionId === 'modify') {
        setModifyFormVisibility(false);
        const searchInput = document.getElementById('product-modify-search');
        if (searchInput) searchInput.disabled = false;
        applyDefaultProfitToProductForms();
        syncProfitConfigFromServer();
        loadDepartmentOptions('product-department-edit');
        loadProductSupplierOptions();
        focusFirstInputInProductSection(sectionId);
    }
    if (sectionId === 'remove') {
        focusFirstInputInProductSection(sectionId);
    }
    if (sectionId === 'dep') {
        loadDepartmentsView();
        focusFirstInputInProductSection(sectionId);
    }
    if (sectionId === 'promo') {
        loadPromotionProductsSelect();
        loadPromotions();
        focusFirstInputInProductSection(sectionId);
    }
    if (sectionId === 'catalog') {
        loadCatalogTable();
    }
}

function hideAllSections() {
    const root = document.getElementById('products-panel');
    if (!root) return;
    root.querySelectorAll('.product-section').forEach((section) => section.classList.add('hidden'));
}

async function redirectToInventoryForExistingProduct(code) {
    if (typeof showSection === 'function') {
        showSection('inventory');
    }
    const inventoryInput = document.getElementById('inventory-code-input');
    if (inventoryInput) {
        inventoryInput.value = code;
    }
    if (typeof loadInventoryProductByCode === 'function') {
        await loadInventoryProductByCode();
    }
    if (inventoryInput) {
        setTimeout(() => {
            try {
                inventoryInput.focus();
                inventoryInput.select();
            } catch (_) {
            }
        }, 0);
    }
}

async function redirectToModifyForExistingProduct(code) {
    showSectioninventario('modify');
    const modifyInput = document.getElementById('product-modify-search');
    if (modifyInput) {
        modifyInput.value = code;
    }
    if (typeof loadProductForModify === 'function') {
        await loadProductForModify();
    }
}

async function handleExistingProductCodeOnAdd(redirectPrompt = true) {
    const codeInput = document.getElementById('product-code');
    const rawCode = normalizeText(codeInput?.value || '');
    const code = normalizeBarcodeByScannerSettings(rawCode) || rawCode;
    if (!code) return false;
    if (codeInput && codeInput.value !== code) codeInput.value = code;

    try {
        const response = await fetch(API_URL + `api/productos/code/${encodeURIComponent(code)}`, {
            headers: withAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.found) return false;

        const product = data?.product || null;
        const inventoryEnabled = Number(product?.utiliza_inventario || 0) === 1;
        const msg = `El código ${code} ya está registrado.`;
        setAddProductFeedback('');

        if (inventoryEnabled) {
            if (!redirectPrompt) {
                if (typeof window.appAlert === 'function') {
                    await window.appAlert(
                        `${msg} Este producto usa inventario. Para aumentar stock, ve a Inventario.`,
                        'warning',
                        { title: 'Producto existente', okText: 'Entendido' }
                    );
                } else {
                    alert(`${msg} Este producto usa inventario. Para aumentar stock, ve a Inventario.`);
                }
                return true;
            }

            let goInventory = false;
            if (typeof window.appConfirm === 'function') {
                goInventory = await window.appConfirm(
                    `${msg} Este producto tiene inventario activo. ¿Quieres ir a Inventario para aumentar stock?`,
                    'warning',
                    { title: 'Producto existente', okText: 'Ir a Inventario', cancelText: 'Cerrar' }
                );
            } else {
                goInventory = confirm(`${msg}\n\nEste producto tiene inventario activo.\n¿Quieres ir a Inventario para aumentar stock?`);
            }
            if (goInventory) {
                await redirectToInventoryForExistingProduct(code);
            }
            return true;
        }

        let goModify = false;
        if (typeof window.appConfirm === 'function') {
            goModify = await window.appConfirm(
                `${msg} Este producto no tiene inventario activo. Si quiere habilitar inventario debe modificar el producto en la pestaña Modificar. ¿Quieres ir a Modificar producto?`,
                'info',
                { title: 'Producto existente', okText: 'Ir a Modificar', cancelText: 'Cancelar' }
            );
        } else {
            goModify = confirm(`${msg}\n\nEste producto no tiene inventario activo.\nSi quiere habilitar inventario debe modificar el producto en la pestaña Modificar.\n¿Quieres ir a Modificar producto?`);
        }
        if (goModify) {
            await redirectToModifyForExistingProduct(code);
        }
        return true;
    } catch (_) {
        return false;
    }
}

async function addProduct() {
    if (await handleExistingProductCodeOnAdd(true)) {
        return;
    }

    const payload = {
        codigo_barras: normalizeText(document.getElementById('product-code').value),
        descripcion: normalizeText(document.getElementById('product-name').value),
        formato_venta: document.querySelector('input[name="formato_venta"]:checked')?.value || 'unidad',
        costo: toIntOrNull(document.getElementById('product-costo').value),
        ganancia: toDecimalOrNull(document.getElementById('product-ganancia').value, 2) ?? 0,
        precio_venta: toIntOrNull(document.getElementById('product-price').value),
        utiliza_inventario: document.getElementById('product-use-inventory').checked ? 1 : 0,
        cantidad_actual: toIntOrNull(document.getElementById('product-quantity').value) ?? 0,
        cantidad_minima: toIntOrNull(document.getElementById('product-quantity-min').value) ?? 0,
        cantidad_maxima: toIntOrNull(document.getElementById('product-quantity-max').value) ?? 0,
        departamento: normalizeText(document.getElementById('product-department-add').value),
        supplier_id: toPositiveIntOrNull(document.getElementById('product-supplier')?.value),
        exento_iva: document.getElementById('product-tax-exempt')?.checked ? 1 : 0,
    };

    if (!payload.codigo_barras || !payload.descripcion || payload.costo === null || payload.ganancia === null || payload.precio_venta === null || !payload.departamento) {
        setAddProductFeedback('Completa los campos obligatorios: código, descripción, costo, ganancia, precio de venta y departamento.', 'error');
        return;
    }
    setAddProductFeedback('');

    try {
        const response = await fetch(API_URL + 'api/productos', {
            method: 'POST',
            headers: withAuthHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 409 && String(data.code || '') === 'PRODUCT_CODE_EXISTS') {
                await handleExistingProductCodeOnAdd(true);
                return;
            }
            setAddProductFeedback(data.message || data.error || 'No se pudo guardar el producto.', 'error');
            return;
        }
        clearProductAddForm();
        setAddProductFeedback('Producto guardado correctamente.', 'ok');
        await loadPromotionProductsSelect();
        await loadCatalogTable();
    } catch (error) {
        console.error('Error addProduct:', error);
        setAddProductFeedback('No se pudo guardar el producto.', 'error');
    }
}

async function loadProductForModify() {
    const query = normalizeText(document.getElementById('product-modify-search').value);
    if (!query) {
        setModifyFormVisibility(false);
        alert('Ingresa un código o descripción para buscar.');
        return;
    }
    const product = await findProductByCodeOrText(query);
    if (!product) {
        clearProductModifyForm();
        alert('Producto no encontrado.');
        return;
    }
    fillModifyFormFromProduct(product);
}

async function saveModifiedProduct() {
    const code = normalizeText(selectedProductForModify?.codigo_barras || '');
    if (!code) {
        alert('Debes cargar un producto primero.');
        return;
    }
    const payload = {
        descripcion: normalizeText(document.getElementById('product-edit-name').value),
        precio_venta: toIntOrNull(document.getElementById('product-edit-price').value),
        costo: toIntOrNull(document.getElementById('product-edit-cost').value),
        ganancia: toDecimalOrNull(document.getElementById('product-edit-profit').value, 2) ?? 0,
        formato_venta: document.querySelector('input[name="formato_venta_edit"]:checked')?.value || 'unidad',
        cantidad_actual: selectedProductForModify ? Number(selectedProductForModify.cantidad_actual || 0) : 0,
        cantidad_minima: selectedProductForModify ? Number(selectedProductForModify.cantidad_minima || 0) : 0,
        cantidad_maxima: selectedProductForModify ? Number(selectedProductForModify.cantidad_maxima || 0) : 0,
        utiliza_inventario: document.getElementById('product-edit-use-inventory')?.checked ? 1 : 0,
        departamento: normalizeText(document.getElementById('product-department-edit').value),
        supplier_id: toPositiveIntOrNull(document.getElementById('product-supplier-edit')?.value),
        exento_iva: document.getElementById('product-edit-tax-exempt')?.checked ? 1 : 0,
    };

    if (!payload.descripcion || payload.precio_venta === null || payload.costo === null || !payload.departamento) {
        alert('Completa los campos obligatorios para guardar cambios.');
        return;
    }

    try {
        const response = await fetch(API_URL + `api/productos/${encodeURIComponent(code)}`, {
            method: 'PUT',
            headers: withAuthHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(data.message || data.error || 'No se pudo actualizar el producto.');
            return;
        }
        alert('Producto actualizado correctamente.');
        clearProductModifyForm();
        await loadCatalogTable();
    } catch (error) {
        console.error('Error saveModifiedProduct:', error);
        alert('No se pudo actualizar el producto.');
    }
}

async function loadProductForDelete() {
    const query = normalizeText(document.getElementById('product-remove-search').value);
    if (!query) {
        alert('Ingresa un código o descripción para buscar.');
        return;
    }
    const product = await findProductByCodeOrText(query);
    if (!product) {
        selectedProductForDelete = null;
        fillDeleteInfo(null);
        alert('Producto no encontrado.');
        return;
    }
    selectedProductForDelete = product;
    fillDeleteInfo(product);
}

function clearProductDeleteSelection() {
    selectedProductForDelete = null;
    const searchInput = document.getElementById('product-remove-search');
    if (searchInput) searchInput.value = '';
    fillDeleteInfo(null);
}

async function deleteLoadedProduct() {
    if (!selectedProductForDelete) {
        alert('Primero selecciona un producto.');
        return;
    }
    const code = normalizeText(selectedProductForDelete.codigo_barras);
    if (!code) {
        alert('Producto inválido.');
        return;
    }
    const confirmDelete = (typeof window.appConfirm === 'function')
        ? await window.appConfirm(
            `¿Eliminar el producto "${selectedProductForDelete.descripcion}"?`,
            'warning',
            {
                title: 'Confirmar eliminacion',
                okText: 'Eliminar',
                cancelText: 'Cancelar',
            }
        )
        : confirm(`¿Eliminar el producto "${selectedProductForDelete.descripcion}"?`);
    if (!confirmDelete) return;

    try {
        const response = await fetch(API_URL + `api/productos/${encodeURIComponent(code)}`, {
            method: 'DELETE',
            headers: withAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(data.message || data.error || 'No se pudo eliminar el producto.');
            return;
        }
        alert('Producto eliminado correctamente.');
        clearProductDeleteSelection();
        await loadCatalogTable();
    } catch (error) {
        console.error('Error deleteLoadedProduct:', error);
        alert('No se pudo eliminar el producto.');
    }
}

function setupDepartmentNameUppercase() {
    const input = document.getElementById('department-name');
    if (!input) return;
    input.addEventListener('input', () => {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const upper = String(input.value || '').toUpperCase();
        if (upper !== input.value) {
            input.value = upper;
            if (typeof start === 'number' && typeof end === 'number') {
                input.setSelectionRange(start, end);
            }
        }
    });
}

async function createDepartment() {
    const name = normalizeText(document.getElementById('department-name').value).toUpperCase();
    if (!name) {
        alert('Ingresa el nombre del departamento.');
        return;
    }
    try {
        const response = await fetch(API_URL + 'api/departamentos', {
            method: 'POST',
            headers: withAuthHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ nombre: name }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(data.message || data.error || 'No se pudo crear el departamento.');
            return;
        }
        document.getElementById('department-name').value = '';
        await loadDepartmentsView();
        alert('Departamento guardado.');
    } catch (error) {
        console.error('Error createDepartment:', error);
        alert('No se pudo crear el departamento.');
    }
}

async function createPromotion() {
    const name = normalizeText(document.getElementById('promo-name').value);
    const promoType = String(document.getElementById('promo-type')?.value || 'single');
    const minQty = toIntOrNull(document.getElementById('promo-min-qty').value);
    const discount = toIntOrNull(document.getElementById('promo-discount').value);
    const comboPrice = toIntOrNull(document.getElementById('promo-combo-price')?.value);
    const productIds = Array.from(selectedPromotionProductIds).filter((id) => Number(id) > 0);

    if (!name || !productIds.length) {
        alert('Completa nombre y selecciona productos.');
        return;
    }
    if (promoType === 'single') {
        if (!minQty || minQty < 2 || !discount || discount < 1 || discount > 100) {
            alert('Para promoción por cantidad indica mínimo (>=2) y descuento válido.');
            return;
        }
    } else if (promoType === 'combo') {
        if (productIds.length < 2) {
            alert('El combo requiere al menos 2 productos distintos.');
            return;
        }
        if (!comboPrice || comboPrice <= 0) {
            alert('Ingresa el precio final del combo.');
            return;
        }
    } else {
        alert('Tipo de promoción no válido.');
        return;
    }
    try {
        const response = await fetch(API_URL + 'api/promociones', {
            method: 'POST',
            headers: withAuthHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                nombre: name,
                promo_type: promoType,
                min_qty: promoType === 'combo' ? 1 : minQty,
                discount_percent: promoType === 'combo' ? 0 : discount,
                combo_price: promoType === 'combo' ? comboPrice : null,
                product_ids: productIds,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(data.message || data.error || 'No se pudo guardar la promoción.');
            return;
        }
        document.getElementById('promo-name').value = '';
        const promoTypeInput = document.getElementById('promo-type');
        if (promoTypeInput) promoTypeInput.value = 'single';
        document.getElementById('promo-min-qty').value = '2';
        document.getElementById('promo-discount').value = '10';
        const comboPriceInput = document.getElementById('promo-combo-price');
        if (comboPriceInput) comboPriceInput.value = '';
        onPromotionTypeChange();
        clearPromotionSelection();
        await loadPromotions();
        alert('Promoción guardada.');
    } catch (error) {
        console.error('Error createPromotion:', error);
        alert('No se pudo guardar la promoción.');
    }
}

async function importProductsFile() {
    const input = document.getElementById('product-import-file');
    const status = document.getElementById('product-import-status');
    const file = input?.files?.[0];
    if (!file) {
        alert('Selecciona un archivo para importar.');
        return;
    }
    const fileName = String(file.name || '').toLowerCase();
    const format = fileName.endsWith('.json') ? 'json' : 'csv';
    if (status) status.textContent = 'Importando...';
    try {
        const text = await file.text();
        const response = await fetch(API_URL + 'api/productos/import', {
            method: 'POST',
            headers: withAuthHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                format,
                data: text,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || data.error || 'No se pudo importar.');
        }
        if (status) status.textContent = `Importación completada. Creados: ${Number(data.inserted || 0)}.`;
        await loadCatalogTable();
        await loadPromotionProductsSelect();
    } catch (error) {
        if (status) status.textContent = error.message || 'No se pudo importar.';
    }
}

async function exportProductsFile(format) {
    const normalized = format === 'json' ? 'json' : 'csv';
    try {
        const response = await fetch(API_URL + `api/productos/export.${normalized}`, {
            headers: withAuthHeaders(),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'No se pudo exportar.');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `productos_${date}.${normalized}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert(error.message || 'No se pudo exportar.');
    }
}

async function downloadProductsTemplate(format) {
    const normalized = format === 'json' ? 'json' : 'csv';
    try {
        const response = await fetch(API_URL + `api/productos/template.${normalized}`, {
            headers: withAuthHeaders(),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'No se pudo descargar la plantilla.');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = normalized === 'json' ? 'plantilla_productos.json' : 'plantilla_productos.csv';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert(error.message || 'No se pudo descargar la plantilla.');
    }
}

function renderCatalogTableRows(rows) {
    const body = document.getElementById('catalog-table-body');
    if (!body) return;
    const list = Array.isArray(rows) ? rows : [];
    body.innerHTML = '';
    if (!list.length) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;">Sin datos.</td></tr>';
        return;
    }
    list.forEach((row) => {
        const tr = document.createElement('tr');
        const code = normalizeText(row.codigo_barras);
        const inventoryEnabled = Number(row.utiliza_inventario || 0) === 1 ? 'Si' : 'No';
        tr.innerHTML = `
            <td style="text-align:center;"><input type="radio" name="catalog-selected" value="${escapeHtml(code)}"></td>
            <td>${escapeHtml(code)}</td>
            <td>${escapeHtml(normalizeText(row.descripcion))}</td>
            <td>${Number(row.precio_venta || 0).toFixed(0)}</td>
            <td>${Number(row.cantidad_actual || 0).toFixed(0)}</td>
            <td>${inventoryEnabled}</td>
            <td>${escapeHtml(normalizeText(row.supplier_name || 'Sin proveedor'))}</td>
        `;
        body.appendChild(tr);
    });
    body.querySelectorAll('input[name="catalog-selected"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            selectedCatalogProductCode = String(radio.value || '');
        });
    });
}

function filterCatalogTable(queryValue) {
    const query = normalizeText(queryValue).toLowerCase();
    if (!query) {
        renderCatalogTableRows(catalogRowsCache);
        return;
    }
    const filtered = (catalogRowsCache || []).filter((row) => {
        const code = normalizeText(row.codigo_barras).toLowerCase();
        const desc = normalizeText(row.descripcion).toLowerCase();
        return code.includes(query) || desc.includes(query);
    });
    renderCatalogTableRows(filtered);
}

async function loadCatalogTable() {
    const body = document.getElementById('catalog-table-body');
    if (!body) return;
    try {
        const response = await fetch(API_URL + 'api/productos/catalog', {
            headers: withAuthHeaders(),
        });
        const rows = await response.json().catch(() => []);
        catalogRowsCache = Array.isArray(rows) ? rows : [];
        selectedCatalogProductCode = '';
        const searchInput = document.getElementById('catalog-search-input');
        const query = normalizeText(searchInput?.value || '');
        if (query) {
            filterCatalogTable(query);
        } else {
            renderCatalogTableRows(catalogRowsCache);
        }
    } catch (_) {
        catalogRowsCache = [];
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;">No se pudo cargar catálogo.</td></tr>';
    }
}

async function editSelectedCatalogProduct() {
    const selected = selectedCatalogProductCode || String(document.querySelector('input[name="catalog-selected"]:checked')?.value || '');
    if (!selected) {
        alert('Selecciona un producto del catálogo.');
        return;
    }
    showSectioninventario('modify');
    const search = document.getElementById('product-modify-search');
    if (search) search.value = selected;
    await loadProductForModify();
}

function setupProductSearchAutocomplete() {
    const bindInput = (id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', async () => {
            const query = normalizeText(input.value);
            if (query.length < 2) return;
            const rows = await searchProductsForInput(query);
            fillProductSearchDatalist(rows);
        });
    };
    bindInput('product-modify-search');
    bindInput('product-remove-search');
}

function setShoppingFeedback(message, type = 'info', receive = false) {
    const id = receive ? 'shopping-receive-feedback' : 'shopping-feedback';
    const box = document.getElementById(id);
    if (!box) return;
    const text = String(message || '').trim();
    if (!text) {
        box.textContent = '';
        box.classList.add('hidden');
        box.classList.remove('feedback-error', 'feedback-ok', 'feedback-warning');
        return;
    }
    box.textContent = text;
    box.classList.remove('hidden');
    box.classList.remove('feedback-error', 'feedback-ok', 'feedback-warning');
    if (type === 'ok') box.classList.add('feedback-ok');
    else if (type === 'error') box.classList.add('feedback-error');
    else if (type === 'warning') box.classList.add('feedback-warning');
}

function updateShoppingSendButtonState() {
    const sendBtn = document.getElementById('shopping-send-close-btn');
    const buyerSelect = document.getElementById('shopping-buyer-select');
    if (!sendBtn || !buyerSelect) return;
    const buyerId = Number(buyerSelect.value || 0);
    const canSend = buyerId > 0;
    sendBtn.disabled = !canSend;
    sendBtn.classList.toggle('hidden', !canSend);
}

function setShoppingMode(mode = '') {
    const createSection = document.getElementById('shopping-create-section');
    const receiveSection = document.getElementById('shopping-receive-section');
    const requestsSection = document.getElementById('shopping-requests-section');
    if (createSection) createSection.classList.toggle('hidden', mode !== 'create');
    if (receiveSection) receiveSection.classList.toggle('hidden', mode !== 'receive');
    if (requestsSection) requestsSection.classList.toggle('hidden', mode !== 'requests');
}

function applyShoppingCreateWorkspaceState() {
    const hasActive = Boolean(shoppingOrderState.order && Number(shoppingOrderState.order.id || 0) > 0);
    const emptyBox = document.getElementById('shopping-create-empty');
    const workspace = document.getElementById('shopping-create-workspace');
    if (emptyBox) {
        emptyBox.classList.toggle('hidden', hasActive);
    }
    if (workspace) {
        workspace.classList.toggle('hidden', !hasActive);
    }
}

function fillShoppingProductsDatalist(rows) {
    const list = document.getElementById('shopping-product-options');
    if (!list) return;
    list.innerHTML = '';
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const code = normalizeText(row.codigo_barras || '');
        const desc = normalizeText(row.descripcion || '');
        if (!code && !desc) return;
        const opt = document.createElement('option');
        opt.value = code || desc;
        opt.label = code && desc ? `${code} - ${desc}` : (desc || code);
        list.appendChild(opt);
    });
}

async function shoppingSuggestProducts(value) {
    const query = normalizeText(value);
    if (query.length < 2) {
        fillShoppingProductsDatalist([]);
        return;
    }
    const rows = await searchProductsForInput(query);
    fillShoppingProductsDatalist(rows);
}

function renderShoppingOrderTable() {
    const body = document.getElementById('shopping-order-body');
    if (!body) return;
    const items = Array.isArray(shoppingOrderState.items) ? shoppingOrderState.items : [];
    body.innerHTML = '';
    if (!items.length) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;">Sin productos en la orden activa.</td></tr>';
        return;
    }
    items.forEach((item) => {
        const tr = document.createElement('tr');
        const itemId = Number(item.id || 0);
        const requested = Number.parseFloat(item.requested_qty ?? 0) || 0;
        const received = Number.parseFloat(item.received_qty ?? 0) || 0;
        const pending = requested - received;
        tr.innerHTML = `
            <td>${escapeHtml(normalizeText(item.barcode))}</td>
            <td>${escapeHtml(normalizeText(item.description))}</td>
            <td style="text-align:right;">${requested.toFixed(2)}</td>
            <td style="text-align:right;">${received.toFixed(2)}</td>
            <td style="text-align:right;">${pending.toFixed(2)}</td>
            <td>${escapeHtml(normalizeText(item.requester_names || item.last_requested_by_name || '-'))}</td>
            <td style="text-align:center;">
                <button class="btn" type="button" style="padding:4px 8px; font-size:12px;" onclick="removeShoppingOrderItem(${itemId})">Eliminar</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

async function removeShoppingOrderItem(itemId) {
    const parsedId = Number(itemId || 0);
    if (!parsedId || !shoppingOrderState.order) {
        setShoppingFeedback('No se pudo identificar el producto a eliminar.', 'warning');
        return;
    }

    const confirmDelete = (typeof window.appConfirm === 'function')
        ? await window.appConfirm(
            '¿Eliminar este producto de la orden activa?',
            'warning',
            { title: 'Eliminar producto', okText: 'Eliminar', cancelText: 'Cancelar' }
        )
        : window.confirm('¿Eliminar este producto de la orden activa?');
    if (!confirmDelete) return;

    try {
        const response = await fetch(API_URL + `api/purchase-order/items/${parsedId}`, {
            method: 'DELETE',
            headers: withAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo eliminar el producto de la orden.', 'error');
            return;
        }
        shoppingOrderState = {
            order: data.order || shoppingOrderState.order || null,
            items: Array.isArray(data.items) ? data.items : [],
        };
        renderShoppingOrderTable();
        applyShoppingCreateWorkspaceState();
        updateShoppingSendButtonState();
        setShoppingFeedback('Producto eliminado de la orden activa.', 'ok');
    } catch (_) {
        setShoppingFeedback('Error de conexión al eliminar producto de la orden.', 'error');
    }
}

async function loadShoppingBuyers() {
    const select = document.getElementById('shopping-buyer-select');
    if (!select) return;
    try {
        const response = await fetch(API_URL + 'api/service-buyers', { headers: withAuthHeaders() });
        const rows = await response.json().catch(() => []);
        const buyers = Array.isArray(rows) ? rows.filter((r) => Number(r.is_active || 0) === 1) : [];
        select.innerHTML = '<option value="">Selecciona encargado</option>';
        buyers.forEach((buyer) => {
            const id = Number(buyer.id || 0);
            if (!id) return;
            const name = normalizeText(buyer.name || `Encargado ${id}`);
            const email = normalizeText(buyer.email || '');
            const opt = document.createElement('option');
            opt.value = String(id);
            opt.textContent = email ? `${name} (${email})` : name;
            select.appendChild(opt);
        });
        select.onchange = () => updateShoppingSendButtonState();
        updateShoppingSendButtonState();
    } catch (_) {
        select.innerHTML = '<option value="">Sin encargados disponibles</option>';
        select.onchange = () => updateShoppingSendButtonState();
        updateShoppingSendButtonState();
    }
}

async function loadShoppingOrderActive() {
    try {
        const response = await fetch(API_URL + 'api/purchase-order/active', { headers: withAuthHeaders() });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return false;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo cargar orden activa.', 'error');
            return false;
        }
        shoppingOrderState = {
            order: data.order || null,
            items: Array.isArray(data.items) ? data.items : Object.values(data.items || {}),
        };
        renderShoppingOrderTable();
        applyShoppingCreateWorkspaceState();
        if (shoppingOrderState.order) {
            setShoppingFeedback('Orden activa cargada.', 'ok');
        } else {
            setShoppingFeedback('');
            const createSection = document.getElementById('shopping-create-section');
            const receiveSection = document.getElementById('shopping-receive-section');
            const isCreateVisible = Boolean(createSection && !createSection.classList.contains('hidden'));
            const isReceiveVisible = Boolean(receiveSection && !receiveSection.classList.contains('hidden'));
            if (isCreateVisible || isReceiveVisible) {
                await openShoppingRequestsView();
            }
        }
        return Boolean(shoppingOrderState.order);
    } catch (error) {
        setShoppingFeedback('Error de conexión al cargar orden activa.', 'error');
        return false;
    }
}

async function addShoppingItemFromInput() {
    if (!shoppingOrderState.order) {
        setShoppingFeedback('No hay una orden activa. Debes crear una nueva orden.', 'warning');
        return;
    }
    const input = document.getElementById('shopping-product-input');
    const rawValue = String(input?.value || '').trim();
    const query = normalizeBarcodeByScannerSettings(rawValue) || normalizeText(rawValue);
    if (!query) {
        setShoppingFeedback('Ingresa o escanea un producto.', 'warning');
        return;
    }
    try {
        const product = await findProductByCodeOrText(query);
        if (!product) {
            setShoppingFeedback('Producto no encontrado.', 'error');
            return;
        }
        const code = normalizeText(product.codigo_barras);
        const desc = normalizeText(product.descripcion || code || 'Producto');
        const existing = (shoppingOrderState.items || []).find((item) => normalizeText(item.barcode) === code);
        const isEditingExisting = Boolean(existing);
        const currentRequested = Number.parseFloat(existing?.requested_qty ?? 0) || 0;
        const defaultQty = isEditingExisting ? String(currentRequested) : '1';
        const qtyRaw = (typeof window.appPrompt === 'function')
            ? await window.appPrompt(
                isEditingExisting
                    ? `El producto ya est\u00e1 en la orden.\n\nProducto: ${desc}\nCodigo: ${code}\nCantidad solicitada actual: ${currentRequested.toFixed(2)}\n\nIngresa la nueva cantidad total solicitada:`
                    : `Producto: ${desc}\nCodigo: ${code}\n\nIngresa la cantidad a encargar:`,
                defaultQty,
                {
                    title: isEditingExisting ? 'Producto ya agregado' : 'Agregar a orden de compra',
                    inputType: 'number',
                    inputMode: 'decimal',
                    placeholder: 'Ej: 12',
                    okText: 'Guardar',
                    cancelText: 'Cancelar',
                    validate: (value) => {
                        const n = Number(String(value || '').replace(',', '.'));
                        if (!Number.isFinite(n) || n <= 0) return 'Ingresa una cantidad valida mayor a 0';
                        return '';
                    },
                }
            )
            : prompt(
                isEditingExisting
                    ? `El producto ya esta en la orden.\nProducto: ${desc}\nCodigo: ${code}\nCantidad actual: ${currentRequested.toFixed(2)}\nNueva cantidad total:`
                    : `Producto: ${desc}\nCodigo: ${code}\nCantidad a encargar:`,
                defaultQty
            );
        if (qtyRaw === null) return;
        const qty = Number(String(qtyRaw).replace(',', '.'));
        if (!Number.isFinite(qty) || qty <= 0) {
            setShoppingFeedback('Cantidad invalida.', 'warning');
            return;
        }

        const response = await fetch(API_URL + 'api/purchase-order/items', {
            method: 'POST',
            headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                barcode: code,
                description: desc,
                product_id: Number(product.id_producto || 0) || null,
                qty,
                replace_qty: isEditingExisting ? qty : null,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo agregar a la orden.', 'error');
            return;
        }
        if (input) input.value = '';
        if (Array.isArray(data.items)) {
            shoppingOrderState = {
                order: data.order || shoppingOrderState.order || null,
                items: data.items,
            };
            renderShoppingOrderTable();
        } else {
            await loadShoppingOrderActive();
        }
        setShoppingFeedback(isEditingExisting ? 'Cantidad solicitada actualizada en la orden.' : 'Producto agregado a la orden de compra.', 'ok');
        if (input) {
            setTimeout(() => {
                try {
                    input.focus();
                } catch (_) {
                }
            }, 0);
        }
    } catch (_) {
        setShoppingFeedback('No se pudo agregar el producto.', 'error');
    }
}

async function assignShoppingOrderAndEmail() {
    if (!shoppingOrderState.order) {
        setShoppingFeedback('No hay una orden activa para enviar.', 'warning');
        return;
    }
    const buyerSelect = document.getElementById('shopping-buyer-select');
    const noteInput = document.getElementById('shopping-assignment-note');
    const sendBtn = document.getElementById('shopping-send-close-btn');
    const buyerId = Number(buyerSelect?.value || 0);
    const note = normalizeText(noteInput?.value || '');
    if (!buyerId) {
        setShoppingFeedback('Selecciona un encargado de compra.', 'warning');
        return;
    }
    try {
        if (sendBtn) sendBtn.disabled = true;
        showShoppingBusyOverlay('Enviando correo y cerrando orden...');
        const response = await fetch(API_URL + 'api/purchase-order/assign-email', {
            method: 'POST',
            headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ buyer_id: buyerId, note }),
        });
        const data = await response.json().catch(() => ({}));
        hideShoppingBusyOverlay();
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo enviar la orden.', 'error');
            return;
        }
        const shouldPrint = (typeof window.appConfirm === 'function')
            ? await window.appConfirm(
                'La orden fue enviada y cerrada.\n\n¿Quieres imprimir una copia en impresora de hoja (carta/oficio)?',
                'info',
                {
                    title: 'Imprimir orden',
                    okText: 'Sí, imprimir',
                    cancelText: 'No imprimir',
                }
            )
            : confirm('¿Quieres imprimir una copia de la orden en impresora normal (carta/oficio)?');
        if (shouldPrint) {
            const printPayload = data.print_payload || {
                order_id: shoppingOrderState.order?.id || 0,
                requested_by: localStorage.getItem('username') || 'Usuario del sistema',
                buyer_name: buyerSelect?.selectedOptions?.[0]?.textContent || '',
                buyer_email: '',
                note,
                items: shoppingOrderState.items || [],
            };
            printShoppingOrderDocument(printPayload);
        }
        setShoppingFeedback(data.message || 'Orden enviada por correo y cerrada.', 'ok');
        shoppingOrderState = { order: null, items: [] };
        renderShoppingOrderTable();
        applyShoppingCreateWorkspaceState();
        await loadShoppingRequestsSummary();
        setShoppingMode('requests');
    } catch (_) {
        hideShoppingBusyOverlay();
        setShoppingFeedback('Error de conexión al enviar orden.', 'error');
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function buildShoppingOrderPrintHtml(payload = {}) {
    const orderId = Number(payload.order_id || 0);
    const dateText = payload.date ? new Date(payload.date).toLocaleString('es-CL') : new Date().toLocaleString('es-CL');
    const requestedBy = escapeHtml(normalizeText(payload.requested_by || 'Usuario del sistema'));
    const buyerName = escapeHtml(normalizeText(payload.buyer_name || ''));
    const buyerEmail = escapeHtml(normalizeText(payload.buyer_email || ''));
    const note = escapeHtml(normalizeText(payload.note || ''));
    const items = Array.isArray(payload.items) ? payload.items : [];
    const rowsHtml = items.map((item, idx) => {
        const requested = Number(item.requested_qty || 0);
        const received = Number(item.received_qty || 0);
        const pending = Number(item.pending_qty || Math.max(0, requested - received));
        const requesterNames = escapeHtml(normalizeText(item.requester_names || '-'));
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
            <tr style="background:${bg};">
                <td>${idx + 1}</td>
                <td>${escapeHtml(normalizeText(item.description || ''))}</td>
                <td>${escapeHtml(normalizeText(item.barcode || ''))}</td>
                <td style="text-align:right;">${requested.toFixed(2)}</td>
                <td style="text-align:right;">${received.toFixed(2)}</td>
                <td style="text-align:right; font-weight:700;">${pending.toFixed(2)}</td>
                <td>${requesterNames}</td>
            </tr>
        `;
    }).join('');
    const totalRequested = items.reduce((acc, item) => acc + Number(item.requested_qty || 0), 0);
    const totalReceived = items.reduce((acc, item) => acc + Number(item.received_qty || 0), 0);
    const totalPending = items.reduce((acc, item) => acc + Number(item.pending_qty || 0), 0);

    return `<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Orden de compra #${orderId || '-'}</title>
    <style>
        @page { size: auto; margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
        .header { border-bottom: 2px solid #1e3a8a; margin-bottom: 12px; padding-bottom: 8px; }
        .title { font-size: 22px; font-weight: 800; margin: 0; }
        .meta { font-size: 12px; margin-top: 4px; color: #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 6px; font-size: 12px; vertical-align: top; }
        th { background: #e2e8f0; text-align: left; }
        tfoot td { background: #eff6ff; font-weight: 700; }
        .note { margin-top: 10px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <p class="title">Orden de compra #${orderId || '-'}</p>
        <div class="meta">Fecha: ${escapeHtml(dateText)}</div>
        <div class="meta">Solicitada por: ${requestedBy}</div>
        <div class="meta">Encargado: ${buyerName || '-'}</div>
        <div class="meta">Correo encargado: ${buyerEmail || '-'}</div>
    </div>
    ${note ? `<div class="note"><strong>Observación:</strong> ${note}</div>` : ''}
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Producto</th>
                <th>Código</th>
                <th>Solicitado</th>
                <th>Recibido</th>
                <th>Pendiente</th>
                <th>Solicitado por</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center;">Sin productos.</td></tr>'}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="3">Totales</td>
                <td style="text-align:right;">${totalRequested.toFixed(2)}</td>
                <td style="text-align:right;">${totalReceived.toFixed(2)}</td>
                <td style="text-align:right;">${totalPending.toFixed(2)}</td>
                <td></td>
            </tr>
        </tfoot>
    </table>
</body>
</html>`;
}

function printShoppingOrderDocument(payload = {}) {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
        setShoppingFeedback('No se pudo abrir la ventana de impresión. Revisa bloqueo de popups.', 'warning');
        return;
    }
    const html = buildShoppingOrderPrintHtml(payload);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        try {
            printWindow.print();
        } catch (_) {
            // noop
        }
    }, 250);
}

function ensureShoppingBusyOverlay() {
    let overlay = document.getElementById('shopping-busy-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'shopping-busy-overlay';
    overlay.innerHTML = `
        <div id="shopping-busy-box" role="status" aria-live="polite">
            <div id="shopping-busy-spinner" aria-hidden="true"></div>
            <div id="shopping-busy-text">Enviando correo, por favor espera...</div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function showShoppingBusyOverlay(message = 'Enviando correo, por favor espera...') {
    const overlay = ensureShoppingBusyOverlay();
    const textEl = overlay.querySelector('#shopping-busy-text');
    if (textEl) textEl.textContent = String(message || 'Procesando...');
    overlay.classList.add('show');
}

function hideShoppingBusyOverlay() {
    const overlay = document.getElementById('shopping-busy-overlay');
    if (!overlay) return;
    overlay.classList.remove('show');
}

function getShoppingReceiveItemStatus(item) {
    const requested = Number(item.requested_qty || 0);
    const received = Number(item.received_qty || 0);
    if (received <= 0) {
        return { css: 'shopping-status-missing', icon: 'X', text: 'Pendiente sin ingreso' };
    }
    if (Math.abs(received - requested) < 0.000001) {
        return { css: 'shopping-status-complete', icon: '✓', text: 'Ingreso exacto (igual a lo solicitado)' };
    }
    if (received > requested) {
        return { css: 'shopping-status-partial', icon: '✓', text: 'Ingreso mayor a lo solicitado' };
    }
    return { css: 'shopping-status-short', icon: '✓', text: 'Ingreso menor a lo solicitado' };
}

function areBarcodesEquivalent(a, b) {
    const left = normalizeText(a || '');
    const right = normalizeText(b || '');
    if (!left || !right) return false;
    if (left === right) return true;
    const leftDigits = left.replace(/\D/g, '');
    const rightDigits = right.replace(/\D/g, '');
    if (!leftDigits || !rightDigits) return false;
    const leftNorm = leftDigits.replace(/^0+/, '') || '0';
    const rightNorm = rightDigits.replace(/^0+/, '') || '0';
    return leftNorm === rightNorm;
}

function renderShoppingReceiveItemsTable() {
    const body = document.getElementById('shopping-receive-items-body');
    if (!body) return;
    const items = Array.isArray(shoppingReceiveState.items) ? shoppingReceiveState.items : [];
    body.innerHTML = '';
    if (!items.length) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;">Selecciona una compra para ver detalle.</td></tr>';
        return;
    }
    items.forEach((item) => {
        const requested = Number(item.requested_qty || 0);
        const received = Number(item.received_qty || 0);
        const pending = Math.max(0, requested - received);
        const st = getShoppingReceiveItemStatus(item);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td title="${escapeHtml(st.text)}"><span class="shopping-status-badge ${st.css}">${st.icon}</span></td>
            <td>${escapeHtml(normalizeText(item.barcode || ''))}</td>
            <td>${escapeHtml(normalizeText(item.description || ''))}</td>
            <td style="text-align:right;">${requested.toFixed(2)}</td>
            <td style="text-align:right;">${received.toFixed(2)}</td>
            <td style="text-align:right;">${pending.toFixed(2)}</td>
        `;
        body.appendChild(tr);
    });
}

function setShoppingReceiveDetailVisible(visible) {
    const detailColumn = document.getElementById('shopping-receive-detail-column');
    if (!detailColumn) return;
    detailColumn.classList.toggle('hidden', !Boolean(visible));
}

function renderShoppingReceiveOrdersTable() {
    const body = document.getElementById('shopping-receive-orders-body');
    if (!body) return;
    const list = Array.isArray(shoppingReceiveState.pendingOrders) ? shoppingReceiveState.pendingOrders : [];
    body.innerHTML = '';
    if (!list.length) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin compras pendientes.</td></tr>';
        return;
    }
    list.forEach((row) => {
        const requested = Number.parseFloat(row.requested_qty ?? 0) || 0;
        const received = Number.parseFloat(row.received_qty ?? 0) || 0;
        const pending = Math.max(0, requested - received);
        const selected = Number(shoppingReceiveState.selectedOrderId || 0) === Number(row.id || 0);
        const tr = document.createElement('tr');
        tr.style.background = selected ? '#eff6ff' : '';
        tr.innerHTML = `
            <td>#${Number(row.id || 0)}</td>
            <td style="text-align:right;">${Number(row.items_count || 0)}</td>
            <td style="text-align:right;">${pending.toFixed(2)}</td>
            <td style="text-align:center;"><button class="btn" type="button" data-order-id="${Number(row.id || 0)}">Ver</button></td>
        `;
        const btn = tr.querySelector('button[data-order-id]');
        if (btn) {
            btn.addEventListener('click', async () => {
                await loadShoppingReceiveOrderDetail(Number(row.id || 0));
            });
        }
        body.appendChild(tr);
    });
}

async function loadShoppingReceiveOrderDetail(orderId) {
    if (!orderId) return;
    try {
        const response = await fetch(API_URL + `api/purchase-order/${orderId}/detail`, { headers: withAuthHeaders() });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo cargar detalle de la compra.', 'error', true);
            return;
        }
        shoppingReceiveState.selectedOrderId = Number(data.order?.id || 0) || null;
        shoppingReceiveState.selectedOrder = data.order || null;
        shoppingReceiveState.items = Array.isArray(data.items) ? data.items : [];
        setShoppingReceiveDetailVisible(Boolean(shoppingReceiveState.selectedOrderId));
        const selectedOrderEl = document.getElementById('shopping-receive-selected-order');
        if (selectedOrderEl) {
            selectedOrderEl.textContent = shoppingReceiveState.selectedOrderId
                ? `Pedido seleccionado: #${shoppingReceiveState.selectedOrderId}`
                : 'Sin pedido seleccionado.';
        }
        renderShoppingReceiveOrdersTable();
        renderShoppingReceiveItemsTable();
        setShoppingFeedback(`Orden #${shoppingReceiveState.selectedOrderId} cargada para recepción.`, 'ok', true);
        const input = document.getElementById('shopping-receive-input');
        if (input) {
            input.value = '';
            setTimeout(() => {
                try {
                    input.focus();
                    input.select();
                } catch (_) {
                }
            }, 0);
        }
    } catch (_) {
        setShoppingFeedback('Error de conexión al cargar detalle de la compra.', 'error', true);
    }
}

async function refreshShoppingReceiveOrders(autoselect = true) {
    try {
        const response = await fetch(API_URL + 'api/purchase-orders/summary', { headers: withAuthHeaders() });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo cargar compras pendientes.', 'error', true);
            return;
        }
        const pending = Array.isArray(data.pending_orders) ? data.pending_orders : [];
        shoppingReceiveState.pendingOrders = pending;
        renderShoppingReceiveOrdersTable();
        if (!pending.length) {
            shoppingReceiveState.selectedOrderId = null;
            shoppingReceiveState.selectedOrder = null;
            shoppingReceiveState.items = [];
            setShoppingReceiveDetailVisible(false);
            const selectedOrderEl = document.getElementById('shopping-receive-selected-order');
            if (selectedOrderEl) {
                selectedOrderEl.textContent = 'Sin pedido seleccionado.';
            }
            renderShoppingReceiveItemsTable();
            setShoppingFeedback('No hay compras pendientes por ingresar.', 'warning', true);
            return;
        }
        const keepSelected = pending.some((row) => Number(row.id) === Number(shoppingReceiveState.selectedOrderId || 0));
        if (keepSelected) {
            await loadShoppingReceiveOrderDetail(Number(shoppingReceiveState.selectedOrderId));
            return;
        }
        if (autoselect) {
            await loadShoppingReceiveOrderDetail(Number(pending[0].id || 0));
        } else {
            shoppingReceiveState.selectedOrderId = null;
            shoppingReceiveState.selectedOrder = null;
            shoppingReceiveState.items = [];
            setShoppingReceiveDetailVisible(false);
            renderShoppingReceiveItemsTable();
            const selectedOrderEl = document.getElementById('shopping-receive-selected-order');
            if (selectedOrderEl) {
                selectedOrderEl.textContent = 'Sin pedido seleccionado.';
            }
        }
    } catch (_) {
        setShoppingFeedback('Error de conexión al cargar compras pendientes.', 'error', true);
    }
}

async function openShoppingReceiveFromInput() {
    const input = document.getElementById('shopping-receive-input');
    const raw = String(input?.value || '').trim();
    const query = normalizeBarcodeByScannerSettings(raw) || normalizeText(raw);
    if (!query) {
        setShoppingFeedback('Ingresa o escanea un producto para recepción.', 'warning', true);
        return;
    }
    if (!shoppingReceiveState.selectedOrderId) {
        setShoppingFeedback('Selecciona primero una compra pendiente.', 'warning', true);
        return;
    }
    if (!Array.isArray(shoppingReceiveState.items) || !shoppingReceiveState.items.length) {
        await loadShoppingReceiveOrderDetail(Number(shoppingReceiveState.selectedOrderId || 0));
    }
    const normalizedQuery = normalizeText(query).toLowerCase();
    const items = Array.isArray(shoppingReceiveState.items) ? shoppingReceiveState.items : [];
    let match = items.find((item) => areBarcodesEquivalent(item.barcode, query));
    if (!match) {
        const byDescExact = items.find((item) => normalizeText(item.description).toLowerCase() === normalizedQuery);
        if (byDescExact) {
            match = byDescExact;
        } else {
            const byDesc = items.filter((item) => normalizeText(item.description).toLowerCase().includes(normalizedQuery));
            if (byDesc.length === 1) {
                match = byDesc[0];
            } else if (byDesc.length > 1) {
                setShoppingFeedback('Hay varios productos que coinciden. Escribe el nombre completo o escanea el código exacto.', 'warning', true);
                if (input) {
                    input.focus();
                    input.select();
                }
                return;
            }
        }
    }
    if (!match) {
        await loadShoppingReceiveOrderDetail(Number(shoppingReceiveState.selectedOrderId || 0));
        const refreshedItems = Array.isArray(shoppingReceiveState.items) ? shoppingReceiveState.items : [];
        match = refreshedItems.find((item) => areBarcodesEquivalent(item.barcode, query));
    }
    if (!match) {
        setShoppingFeedback(`Ese producto no pertenece a la compra seleccionada. Código: ${normalizeText(query)}`, 'warning', true);
        if (input) {
            input.value = '';
            input.focus();
        }
        return;
    }
    const requested = Number(match.requested_qty || 0);
    const received = Number(match.received_qty || 0);
    const pending = Math.max(0, requested - received);
    const qtyRaw = (typeof window.appPrompt === 'function')
        ? await window.appPrompt(
            `Producto: ${normalizeText(match.description)}\nSolicitado: ${requested.toFixed(2)}\nRecibido: ${received.toFixed(2)}\nPendiente: ${pending.toFixed(2)}\n\nCantidad que llegó ahora:`,
            '',
            {
                title: 'Recepción de producto',
                inputType: 'number',
                inputMode: 'decimal',
                placeholder: 'Ej: 6',
                okText: 'Guardar recepción',
                cancelText: 'Cancelar',
                disableOkWhenInvalid: true,
                validate: (value) => {
                    const n = Number(String(value || '').replace(',', '.'));
                    if (!String(value || '').trim()) return 'Debes ingresar la cantidad que llegó';
                    if (!Number.isFinite(n) || n <= 0) return 'Ingresa una cantidad válida mayor a 0';
                    return '';
                },
            }
        )
        : prompt(`Producto: ${normalizeText(match.description)}\nPendiente: ${pending.toFixed(2)}\nCantidad que llegó:`, '');
    if (qtyRaw === null) return;
    const qty = Number(String(qtyRaw).replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
        setShoppingFeedback('Cantidad recibida inválida.', 'warning', true);
        return;
    }

    try {
        const response = await fetch(API_URL + 'api/purchase-order/receive', {
            method: 'POST',
            headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                order_id: shoppingReceiveState.selectedOrderId,
                barcode: query,
                qty_received: qty,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo guardar recepción.', 'error', true);
            return;
        }
        if (input) input.value = '';
        await refreshShoppingReceiveOrders(true);
        const msg = data.order_ready_to_close
            ? 'Todos los productos fueron ingresados. Ya puedes cerrar el pedido.'
            : (data.inventory_message || data.message || 'Recepción guardada.');
        setShoppingFeedback(msg, 'ok', true);
        if (input) {
            setTimeout(() => {
                try {
                    input.focus();
                    input.select();
                } catch (_) {
                }
            }, 0);
        }
    } catch (_) {
        setShoppingFeedback('Error de conexión al registrar recepción.', 'error', true);
    }
}

async function closeSelectedShoppingReceiveOrder() {
    const orderId = Number(shoppingReceiveState.selectedOrderId || 0);
    if (!orderId) {
        setShoppingFeedback('Selecciona un pedido para cerrar.', 'warning', true);
        return;
    }
    try {
        let response = await fetch(API_URL + 'api/purchase-order/close', {
            method: 'POST',
            headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ order_id: orderId }),
        });
        let data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (response.status === 409) {
            const missingList = Array.isArray(data.missing_items) ? data.missing_items : [];
            const missingText = missingList.length
                ? missingList.map((it) => {
                    const pending = Number(it.pending_qty || 0).toFixed(2);
                    return `- ${normalizeText(it.description || it.barcode || 'Producto')} (faltan: ${pending})`;
                }).join('\n')
                : '- Hay productos pendientes';
            const confirmForce = (typeof window.appConfirm === 'function')
                ? await window.appConfirm(
                    `Aún faltan productos por ingresar:\n\n${missingText}\n\n¿Deseas cerrar el pedido de todas formas?`,
                    'warning',
                    {
                        title: 'Cerrar pedido incompleto',
                        okText: 'Confirmar cierre',
                        cancelText: 'Cancelar',
                    }
                )
                : confirm('Aún faltan productos por ingresar. ¿Deseas cerrar el pedido de todas formas?');
            if (!confirmForce) {
                setShoppingFeedback('Cierre cancelado. Pedido sigue abierto.', 'warning', true);
                return;
            }
            response = await fetch(API_URL + 'api/purchase-order/close', {
                method: 'POST',
                headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ order_id: orderId, force_close: 1 }),
            });
            data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
                return;
            }
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo cerrar el pedido.', 'error', true);
            return;
        }
        setShoppingFeedback(data.message || 'Pedido cerrado.', 'ok', true);
        await refreshShoppingReceiveOrders(true);
        await loadShoppingRequestsSummary();
    } catch (_) {
        setShoppingFeedback('Error de conexión al cerrar el pedido.', 'error', true);
    }
}

function renderShoppingOrdersSummaryRows(rows, bodyId, isClosed = false) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const list = Array.isArray(rows) ? rows : [];
    body.innerHTML = '';
    if (!list.length) {
        body.innerHTML = `<tr><td colspan="6" style="text-align:center;">${isClosed ? 'Sin solicitudes cerradas.' : 'Sin pendientes.'}</td></tr>`;
        return;
    }
    list.forEach((row) => {
        const requested = Number.parseFloat(row.requested_qty ?? 0) || 0;
        const received = Number.parseFloat(row.received_qty ?? 0) || 0;
        const diff = requested - received;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${Number(row.id || 0)}</td>
            <td style="text-align:right;">${Number(row.items_count || 0)}</td>
            <td style="text-align:right;">${requested.toFixed(2)}</td>
            <td style="text-align:right;">${received.toFixed(2)}</td>
            <td style="text-align:right;">${diff.toFixed(2)}</td>
            <td>${escapeHtml(String((isClosed ? (row.assignment_sent_at || row.updated_at) : row.updated_at) || '').replace('T', ' ').slice(0, 19) || '-')}</td>
        `;
        body.appendChild(tr);
    });
}

function renderShoppingClosedRequestsRows(rows) {
    const body = document.getElementById('shopping-requests-closed-body');
    if (!body) return;
    const list = Array.isArray(rows) ? rows : [];
    body.innerHTML = '';
    if (!list.length) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;">Sin solicitudes cerradas.</td></tr>';
        return;
    }
    list.forEach((row) => {
        const requested = Number.parseFloat(row.requested_qty ?? 0) || 0;
        const received = Number.parseFloat(row.received_qty ?? 0) || 0;
        const isComplete = String(row.reception_result || '') === 'complete';
        const badgeClass = isComplete ? 'shopping-status-complete' : 'shopping-status-missing';
        const badgeIcon = isComplete ? '✓' : 'X';
        const closedAt = String(row.reception_closed_at || row.updated_at || '').replace('T', ' ').slice(0, 19) || '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="shopping-status-badge ${badgeClass}">${badgeIcon}</span></td>
            <td>#${Number(row.id || 0)}</td>
            <td style="text-align:right;">${Number(row.items_count || 0)}</td>
            <td style="text-align:right;">${requested.toFixed(2)}</td>
            <td style="text-align:right;">${received.toFixed(2)}</td>
            <td>${escapeHtml(closedAt)}</td>
            <td style="text-align:center;"><button class="btn" type="button" data-request-id="${Number(row.id || 0)}">Ver</button></td>
        `;
        const btn = tr.querySelector('button[data-request-id]');
        if (btn) {
            btn.addEventListener('click', async () => {
                await loadShoppingRequestDetail(Number(row.id || 0));
            });
        }
        body.appendChild(tr);
    });
}

function renderShoppingRequestDetail(order, items) {
    const header = document.getElementById('shopping-request-detail-header');
    const body = document.getElementById('shopping-request-detail-body');
    if (!body) return;
    const list = Array.isArray(items) ? items : [];
    if (header) {
        if (!order) {
            header.textContent = 'Selecciona una solicitud cerrada para ver el detalle.';
        } else {
            const state = String(order.reception_result || '') === 'complete' ? 'Recepción completa' : 'Recepción cerrada con faltantes';
            header.textContent = `Solicitud #${Number(order.id || 0)} - ${state}`;
        }
    }
    body.innerHTML = '';
    if (!order || !list.length) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;">Sin detalle para mostrar.</td></tr>';
        return;
    }
    list.forEach((item) => {
        const requested = Number(item.requested_qty || 0);
        const received = Number(item.received_qty || 0);
        const pending = Math.max(0, requested - received);
        const status = getShoppingReceiveItemStatus(item);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="shopping-status-badge ${status.css}">${status.icon}</span></td>
            <td>${escapeHtml(normalizeText(item.barcode || ''))}</td>
            <td>${escapeHtml(normalizeText(item.description || ''))}</td>
            <td style="text-align:right;">${requested.toFixed(2)}</td>
            <td style="text-align:right;">${received.toFixed(2)}</td>
            <td style="text-align:right;">${pending.toFixed(2)}</td>
        `;
        body.appendChild(tr);
    });
}

async function loadShoppingRequestDetail(orderId) {
    if (!orderId) return;
    try {
        const response = await fetch(API_URL + `api/purchase-order/${orderId}/detail`, { headers: withAuthHeaders() });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo cargar detalle de la solicitud.', 'error');
            return;
        }
        renderShoppingRequestDetail(data.order || null, data.items || []);
    } catch (_) {
        setShoppingFeedback('Error de conexión al cargar detalle de solicitud.', 'error');
    }
}

async function loadShoppingRequestsSummary() {
    try {
        const response = await fetch(API_URL + 'api/purchase-orders/summary', { headers: withAuthHeaders() });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo cargar solicitudes de compra.', 'error');
            return;
        }
        renderShoppingOrdersSummaryRows(data.pending_orders || [], 'shopping-pending-orders-body', false);
        renderShoppingClosedRequestsRows(data.closed_orders || []);
        renderShoppingRequestDetail(null, []);
    } catch (_) {
        setShoppingFeedback('Error de conexión al cargar solicitudes.', 'error');
    }
}

async function startShoppingNewOrderFlow() {
    setShoppingMode('create');
    try {
        const response = await fetch(API_URL + 'api/purchase-order/create', {
            method: 'POST',
            headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo crear la orden de compra.', 'error');
            return;
        }
        await loadShoppingOrderActive();
        setShoppingFeedback(data.message || 'Orden de compra activa lista.', 'ok');
        const input = document.getElementById('shopping-product-input');
        if (input) {
            setTimeout(() => {
                try {
                    input.focus();
                    input.select();
                } catch (_) {
                }
            }, 0);
        }
    } catch (_) {
        setShoppingFeedback('Error de conexión al crear la orden.', 'error');
    }
}

async function closeShoppingOrder() {
    if (!shoppingOrderState.order) {
        setShoppingFeedback('No hay orden activa para cerrar.', 'warning');
        return;
    }
    const ok = (typeof window.appConfirm === 'function')
        ? await window.appConfirm('¿Cerrar la orden de compra actual? Quedará en solicitudes cerradas.', 'warning', {
            title: 'Cerrar orden',
            okText: 'Cerrar orden',
            cancelText: 'Cancelar',
        })
        : confirm('¿Cerrar la orden de compra actual?');
    if (!ok) return;

    try {
        const response = await fetch(API_URL + 'api/purchase-order/close', {
            method: 'POST',
            headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            handleSessionExpiredRedirect('Sesion expirada. Vuelve a iniciar sesion.');
            return;
        }
        if (!response.ok) {
            setShoppingFeedback(data.message || 'No se pudo cerrar la orden.', 'error');
            return;
        }
        shoppingOrderState = { order: null, items: [] };
        renderShoppingOrderTable();
        applyShoppingCreateWorkspaceState();
        setShoppingFeedback(data.message || 'Orden cerrada.', 'ok');
        await loadShoppingRequestsSummary();
    } catch (_) {
        setShoppingFeedback('Error de conexión al cerrar la orden.', 'error');
    }
}

async function openShoppingReceiveView() {
    setShoppingMode('receive');
    setShoppingReceiveDetailVisible(false);
    await refreshShoppingReceiveOrders(false);
    const input = document.getElementById('shopping-receive-input');
    if (input && shoppingReceiveState.selectedOrderId) {
        setTimeout(() => {
            try {
                input.focus();
                input.select();
            } catch (_) {
            }
        }, 0);
    }
}

async function openShoppingRequestsView() {
    setShoppingMode('requests');
    await loadShoppingRequestsSummary();
}

async function prepareShoppingView() {
    await loadShoppingBuyers();
    const hasActiveOrder = await loadShoppingOrderActive();
    const hasActiveItems = Array.isArray(shoppingOrderState.items) && shoppingOrderState.items.length > 0;
    applyShoppingCreateWorkspaceState();
    if (hasActiveOrder && hasActiveItems) {
        setShoppingMode('create');
        const input = document.getElementById('shopping-product-input');
        if (input) {
            setTimeout(() => {
                try {
                    input.focus();
                    input.select();
                } catch (_) {
                }
            }, 0);
        }
        return;
    }
    await openShoppingRequestsView();
}

function setupAddProductCodeGuard() {
    const codeInput = document.getElementById('product-code');
    if (!codeInput) return;
    codeInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await handleExistingProductCodeOnAdd(true);
    });
}

function setupPromotionSelectorUI() {
    const select = document.getElementById('promo-products');
    if (!select) return;
    select.addEventListener('change', addSelectedPromotionProduct);
    onPromotionTypeChange();
    renderPromotionSelectedProducts();
}

/* Mostrar la informaciÃ³n en la consola*/

document.addEventListener('DOMContentLoaded', async () => {
    setupFrontendErrorReporting();
    applyUserPermissionsToUI();
    await fetchScannerRuntimeSettings();
    await ensureShiftStartedOnLoad();
    setupProductSearchAutocomplete();
    setupAddProductCodeGuard();
    setupDepartmentNameUppercase();
    await loadDepartmentOptions('product-department-add');
    await loadDepartmentOptions('product-department-edit');
    await loadProductSupplierOptions();
    await loadPromotionProductsSelect();
    setupPromotionSelectorUI();
    setupCartQuantityKeyboardShortcuts();
    setupSystemFunctionKeyShortcuts();
    setupProductPriceAutoCalc();
    setupProductDescriptionTitleCase();
    setupAddInventoryToggle();
    await syncProfitConfigFromServer();
    applyDefaultProfitToProductForms();
    restoreCartState();
    updateCartUI();
    updateSalesSessionStrip();
    setupSalesMobileCameraPermissionHook();
    setupSalesCameraScanButtonVisibility();
    if (scannerRuntimeSettings.scanner_auto_focus) {
        document.getElementById('barcode')?.focus();
    }
    if (document.getElementById('inventory-code-input')) {
        clearInventoryView();
    }
});

window.addEventListener('resize', setupSalesCameraScanButtonVisibility);
window.addEventListener('orientationchange', setupSalesCameraScanButtonVisibility);

window.addEventListener('focus', refreshSuppliersOnProductContext);
window.addEventListener('minimarket:suppliers-updated', refreshSuppliersOnProductContext);
window.addEventListener('message', (event) => {
    try {
        if (event.origin !== window.location.origin) return;
        if (event?.data?.type !== 'minimarket:suppliers-updated') return;
        refreshSuppliersOnProductContext();
    } catch (_) {
    }
});
            





