const LOGO_STORAGE_KEYS = ['business_logo', 'logo_data', 'logo_url'];
const LOGO_TARGET_HEIGHT = 63;
const LOGO_MIN_WIDTH = 300;
const LOGO_MAX_WIDTH = 600;
let currentSourceLogo = '';
let cropState = { zoom: 1, offsetX: 0, offsetY: 0 };

const API_URL = (() => {
    const override = window.localStorage.getItem('api_url');
    if (override) return override.endsWith('/') ? override : `${override}/`;
    if (window.location.port === '3001') return `${window.location.origin}/`;
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    const protocol = isLocalHost ? 'http:' : window.location.protocol;
    return `${protocol}//${window.location.hostname}:3001/`;
})();

function withAuthHeaders(headers = {}) {
    const token = localStorage.getItem('token');
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function getStoredLogo() {
    for (const key of LOGO_STORAGE_KEYS) {
        const value = localStorage.getItem(key);
        if (value) return value;
    }
    return '';
}

function storeLogo(dataUrl) {
    LOGO_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, dataUrl));
}

async function fetchServerLogo() {
    const response = await fetch(API_URL + 'api/logo-settings', { headers: withAuthHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'No se pudo cargar logotipo del servidor.');
    }
    return typeof data.logo_data === 'string' ? data.logo_data : '';
}

async function saveServerLogo(dataUrl) {
    const response = await fetch(API_URL + 'api/logo-settings', {
        method: 'PUT',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ logo_data: dataUrl }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'No se pudo guardar logotipo en el servidor.');
    }
}

function loadImageDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
    });
}

function loadImageMeta(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, src: dataUrl });
        img.onerror = () => reject(new Error('Archivo de imagen invalido.'));
        img.src = dataUrl;
    });
}

function updatePreview(dataUrl, width, height) {
    const preview = document.getElementById('logo-preview');
    const meta = document.getElementById('logo-preview-meta');
    if (preview) {
        preview.src = dataUrl || '';
    }
    if (meta) {
        if (dataUrl) {
            meta.textContent = `Previsualizacion cargada. Ancho: ${width}px, Alto: ${height}px`;
        } else {
            meta.textContent = 'Recomendado: fondo transparente y buena resolucion para evitar distorsion en la barra superior.';
        }
    }
}

function notifyParentLogoUpdated(dataUrl) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'logo-updated', dataUrl }, '*');
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function buildResizedLogoDataUrl(sourceDataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const targetWidth = clamp(img.naturalWidth || LOGO_MIN_WIDTH, LOGO_MIN_WIDTH, LOGO_MAX_WIDTH);
            const targetHeight = LOGO_TARGET_HEIGHT;

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('No se pudo preparar el lienzo de ajuste.'));
                return;
            }

            // Cover + encuadre manual (zoom + desplazamiento)
            const baseScale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
            const scale = baseScale * cropState.zoom;
            const drawWidth = img.naturalWidth * scale;
            const drawHeight = img.naturalHeight * scale;
            const maxShiftX = Math.max(0, (drawWidth - targetWidth) / 2);
            const maxShiftY = Math.max(0, (drawHeight - targetHeight) / 2);
            const dx = (targetWidth - drawWidth) / 2 + (cropState.offsetX * maxShiftX);
            const dy = (targetHeight - drawHeight) / 2 + (cropState.offsetY * maxShiftY);

            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

            resolve({
                dataUrl: canvas.toDataURL('image/png'),
                width: targetWidth,
                height: targetHeight,
            });
        };
        img.onerror = () => reject(new Error('No se pudo ajustar la imagen.'));
        img.src = sourceDataUrl;
    });
}

async function refreshAdjustedPreview() {
    if (!currentSourceLogo) return;
    try {
        const adjusted = await buildResizedLogoDataUrl(currentSourceLogo);
        updatePreview(adjusted.dataUrl, adjusted.width, adjusted.height);
    } catch {
        // noop
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const input = document.getElementById('id-logotipo');
    const saveBtn = document.getElementById('save-logo-btn');
    const zoomInput = document.getElementById('logo-zoom');
    const offsetXInput = document.getElementById('logo-offset-x');
    const offsetYInput = document.getElementById('logo-offset-y');
    const resetCropBtn = document.getElementById('logo-reset-crop-btn');
    let pendingLogo = '';
    let pendingMeta = { width: 0, height: 0 };

    let stored = '';
    try {
        stored = await fetchServerLogo();
        if (stored) storeLogo(stored);
    } catch (_) {
        stored = getStoredLogo();
    }

    if (stored) {
        try {
            const meta = await loadImageMeta(stored);
            updatePreview(meta.src, meta.width, meta.height);
            pendingLogo = meta.src;
            pendingMeta = { width: meta.width, height: meta.height };
            currentSourceLogo = meta.src;
        } catch {
            updatePreview('', 0, 0);
        }
    } else {
        updatePreview('', 0, 0);
    }

    input?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Selecciona un archivo de imagen valido.');
            event.target.value = '';
            return;
        }

        try {
            const dataUrl = await loadImageDataUrl(file);
            const meta = await loadImageMeta(dataUrl);
            pendingLogo = dataUrl;
            pendingMeta = { width: meta.width, height: meta.height };
            currentSourceLogo = dataUrl;
            cropState = { zoom: 1, offsetX: 0, offsetY: 0 };
            if (zoomInput) zoomInput.value = '100';
            if (offsetXInput) offsetXInput.value = '0';
            if (offsetYInput) offsetYInput.value = '0';
            await refreshAdjustedPreview();
        } catch (error) {
            alert(error.message || 'No se pudo cargar la imagen.');
        }
    });

    const onCropChange = async () => {
        cropState.zoom = clamp((Number(zoomInput?.value || 100) / 100), 1, 2.5);
        cropState.offsetX = clamp((Number(offsetXInput?.value || 0) / 100), -1, 1);
        cropState.offsetY = clamp((Number(offsetYInput?.value || 0) / 100), -1, 1);
        await refreshAdjustedPreview();
    };
    zoomInput?.addEventListener('input', onCropChange);
    offsetXInput?.addEventListener('input', onCropChange);
    offsetYInput?.addEventListener('input', onCropChange);

    resetCropBtn?.addEventListener('click', async () => {
        cropState = { zoom: 1, offsetX: 0, offsetY: 0 };
        if (zoomInput) zoomInput.value = '100';
        if (offsetXInput) offsetXInput.value = '0';
        if (offsetYInput) offsetYInput.value = '0';
        await refreshAdjustedPreview();
    });

    saveBtn?.addEventListener('click', async () => {
        if (!pendingLogo) {
            alert('Selecciona una imagen antes de guardar.');
            return;
        }

        try {
            const adjusted = await buildResizedLogoDataUrl(currentSourceLogo || pendingLogo);
            storeLogo(adjusted.dataUrl);
            await saveServerLogo(adjusted.dataUrl);
            notifyParentLogoUpdated(adjusted.dataUrl);
            updatePreview(adjusted.dataUrl, adjusted.width, adjusted.height);
            close_w();
        } catch (error) {
            alert(error.message || 'No se pudo guardar el logotipo.');
        }
    });
});
