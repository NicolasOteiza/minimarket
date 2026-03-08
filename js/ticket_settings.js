const API_URL = (() => {
    const override = window.localStorage.getItem('api_url');
    if (override) {
        return override.endsWith('/') ? override : `${override}/`;
    }
    if (window.location.port === '3001') {
        return `${window.location.origin}/`;
    }
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    const protocol = isLocalHost ? 'http:' : window.location.protocol;
    return `${protocol}//${window.location.hostname}:3001/`;
})();

function withAuthHeaders(headers = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        return { ...headers, Authorization: `Bearer ${token}` };
    }
    return headers;
}

function closePopupWindow() {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'close-app-popup' }, '*');
        return;
    }
    window.close();
}

async function fetchTicketSettings() {
    const response = await fetch(API_URL + 'api/ticket-settings', {
        headers: withAuthHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'No se pudo cargar configuracion de ticket');
    }
    return data;
}

async function saveTicketSettings(payload) {
    const response = await fetch(API_URL + 'api/ticket-settings', {
        method: 'PUT',
        headers: withAuthHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'No se pudo guardar configuracion');
    }
    return data;
}

async function fetchPrinters() {
    const response = await fetch(API_URL + 'api/printers', {
        headers: withAuthHeaders(),
    });
    const data = await response.json().catch(() => []);
    if (!response.ok) {
        throw new Error(data.message || 'No se pudo obtener impresoras');
    }
    return Array.isArray(data) ? data : [];
}

async function fetchBusinessInfo() {
    const response = await fetch(API_URL + 'api/getInfo', {
        headers: withAuthHeaders(),
    });
    const data = await response.json().catch(() => []);
    if (!response.ok) {
        throw new Error('No se pudo obtener la informacion del negocio');
    }
    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }
    return data[data.length - 1];
}

function formatCLP(value) {
    const amount = Number(value || 0);
    return Math.round(amount).toLocaleString('es-CL');
}

function padRight(value, width) {
    const str = String(value ?? '');
    if (str.length >= width) return str.slice(0, width);
    return str + ' '.repeat(width - str.length);
}

function padLeft(value, width) {
    const str = String(value ?? '');
    if (str.length >= width) return str.slice(0, width);
    return ' '.repeat(width - str.length) + str;
}

function clampColumns(value, fallback = 30) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.max(28, Math.min(64, parsed));
}

function clampFeedLines(value, fallback = 2) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.max(0, Math.min(8, parsed));
}

function getRecommendedColumnsForPaper(paperWidthMm) {
    const paper = Number(paperWidthMm || 58) >= 80 ? 80 : 58;
    return paper === 58 ? 39 : 48;
}

function getPreviewPrintProfile(printerName, requestedColumns) {
    const printer = String(printerName || '').trim();
    const isXp58 = /xp-58/i.test(printer);
    return { columns: clampColumns(requestedColumns, 30), isXp58 };
}

function getPreviewFontPt(columns, paperWidthMm) {
    const paper = Number(paperWidthMm || 58) >= 80 ? 80 : 58;
    const cols = clampColumns(columns, paper === 58 ? 30 : 42);
    if (paper === 58) {
        if (cols <= 30) return 6.5;
        if (cols <= 36) return 6.2;
        if (cols <= 42) return 5.9;
        return 5.6;
    }
    if (cols <= 36) return 7.5;
    return 8;
}

function buildPreviewText(settings, business) {
    const profile = getPreviewPrintProfile(settings.printer_name, settings.columns_width);
    const columns = profile.columns;
    const divider = '-'.repeat(columns);
    const lines = [];
    const title = String(settings.ticket_header || 'COMPROBANTE DE VENTA').trim();
    const footer = String(settings.ticket_footer || 'Gracias por su compra').trim();
    const centerLine = (value = '') => {
        const text = String(value).trim();
        if (!text) return '';
        if (text.length >= columns) return text.slice(0, columns);
        const left = Math.floor((columns - text.length) / 2);
        const right = columns - text.length - left;
        return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
    };
    const wrapText = (value = '') => {
        const raw = String(value || '').trim();
        if (!raw) return [];
        const words = raw.split(/\s+/);
        const out = [];
        let current = '';
        words.forEach((word) => {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length <= columns) {
                current = candidate;
                return;
            }
            if (current) out.push(current);
            if (word.length > columns) {
                for (let i = 0; i < word.length; i += columns) {
                    out.push(word.slice(i, i + columns));
                }
                current = '';
            } else {
                current = word;
            }
        });
        if (current) out.push(current);
        return out;
    };

    lines.push(centerLine(title));
    lines.push(divider);

    if (settings.show_business_info && business) {
        if (business.nombre) lines.push(centerLine(String(business.nombre)));
        if (business.tipo_local) wrapText(`Rubro: ${business.tipo_local}`).forEach((line) => lines.push(line));
        if (business.telefono) lines.push(`Tel: ${business.telefono}`);
        if (business.mail) wrapText(`Mail: ${business.mail}`).forEach((line) => lines.push(line));
        lines.push(divider);
    }

    lines.push(`Fecha: ${new Date().toLocaleDateString('es-CL')}`);
    lines.push(`Hora: ${new Date().toLocaleTimeString('es-CL', { hour12: false })}`);
    if (settings.show_ticket_number) lines.push('Ticket: 1001');
    if (settings.show_cashier) lines.push('Cajero: DEMO');
    if (settings.show_box) lines.push('Caja: 1');
    if (settings.show_payment_method) lines.push('Pago: efectivo');
    lines.push(divider);

    const sampleItems = [
        { descripcion: 'Producto demo 1', cantidad: 1, precio_unitario: 1290, subtotal: 1290 },
        { descripcion: 'Producto demo 2', cantidad: 2, precio_unitario: 850, subtotal: 1700 },
        { descripcion: 'Producto demo 3', cantidad: 1, precio_unitario: 3990, subtotal: 3990 },
    ];

    if (settings.include_details_by_default) {
        lines.push('DETALLE');
        lines.push(divider);

        sampleItems.forEach((item) => {
            const amountText = `$${formatCLP(item.subtotal)}`;
            const leftWidth = Math.max(8, columns - amountText.length - 1);
            wrapText(item.descripcion).forEach((line) => lines.push(line));
            lines.push(padRight(`${formatCLP(item.cantidad)} x $${formatCLP(item.precio_unitario)}`, leftWidth) + ' ' + padLeft(amountText, amountText.length));
        });
        lines.push(divider);
    }

    const total = sampleItems.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
    const totalText = `$${formatCLP(total)}`;
    if (columns <= 34 || (`TOTAL ${totalText}`).length > columns) {
        lines.push('TOTAL');
        lines.push(totalText);
    } else {
        lines.push(padRight('TOTAL', Math.max(1, columns - totalText.length - 1)) + ` ${totalText}`);
    }
    lines.push(divider);
    wrapText(footer).forEach((line) => lines.push(line));
    lines.push(centerLine('ORIGINAL CLIENTE'));
    lines.push('');
    return lines.join('\r\n');
}

function getPreviewSettingsFromForm(base = {}) {
    return {
        ...base,
        ticket_header: document.getElementById('ticket-header')?.value || 'COMPROBANTE DE VENTA',
        ticket_footer: document.getElementById('ticket-footer')?.value || 'Gracias por su compra',
        columns_width: clampColumns(document.getElementById('ticket-columns')?.value, 30),
        show_business_info: document.getElementById('ticket-show-business')?.checked ?? true,
        show_ticket_number: document.getElementById('ticket-show-ticket-number')?.checked ?? true,
        show_cashier: document.getElementById('ticket-show-cashier')?.checked ?? true,
        show_box: document.getElementById('ticket-show-box')?.checked ?? true,
        show_payment_method: document.getElementById('ticket-show-payment')?.checked ?? true,
        include_details_by_default: document.getElementById('ticket-include-details')?.checked ?? true,
    };
}

function setSelectOptions(selectEl, printers, selectedName) {
    selectEl.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Selecciona impresora...';
    selectEl.appendChild(empty);

    printers.forEach((printer) => {
        const option = document.createElement('option');
        option.value = printer.name;
        option.textContent = printer.isDefault ? `${printer.name} (Predeterminada del SO)` : printer.name;
        selectEl.appendChild(option);
    });
    if (selectedName) {
        selectEl.value = selectedName;
    } else {
        const defaultPrinter = printers.find((p) => p.isDefault);
        if (defaultPrinter) {
            selectEl.value = defaultPrinter.name;
        }
    }
}

function getTicketFormPayload(base = {}) {
    return {
        ...base,
        ticket_header: document.getElementById('ticket-header')?.value || 'COMPROBANTE DE VENTA',
        ticket_footer: document.getElementById('ticket-footer')?.value || 'Gracias por su compra',
        columns_width: clampColumns(document.getElementById('ticket-columns')?.value, 30),
        show_business_info: document.getElementById('ticket-show-business')?.checked ?? true,
        show_ticket_number: document.getElementById('ticket-show-ticket-number')?.checked ?? true,
        show_cashier: document.getElementById('ticket-show-cashier')?.checked ?? true,
        show_box: document.getElementById('ticket-show-box')?.checked ?? true,
        show_payment_method: document.getElementById('ticket-show-payment')?.checked ?? true,
        include_details_by_default: document.getElementById('ticket-include-details')?.checked ?? true,
    };
}

function fillTicketForm(settings) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
    };
    const check = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(val);
    };
    set('ticket-header', settings.ticket_header || 'COMPROBANTE DE VENTA');
    set('ticket-footer', settings.ticket_footer || 'Gracias por su compra');
    set('ticket-columns', clampColumns(settings.columns_width, 30));
    check('ticket-show-business', settings.show_business_info);
    check('ticket-show-ticket-number', settings.show_ticket_number);
    check('ticket-show-cashier', settings.show_cashier);
    check('ticket-show-box', settings.show_box);
    check('ticket-show-payment', settings.show_payment_method);
    check('ticket-include-details', settings.include_details_by_default);
}

async function initTicketForm() {
    const form = document.getElementById('ticket-settings-form');
    if (!form) return;
    const previewEl = document.getElementById('ticket-preview');
    const paperEl = document.getElementById('ticket-paper');
    const printableEl = document.getElementById('ticket-printable-area');
    const previewMetaEl = document.getElementById('ticket-preview-meta');
    const columnsInput = document.getElementById('ticket-columns');
    const applyDefaultBtn = document.getElementById('apply-ticket-default-btn');
    let businessInfo = null;
    let currentSettings = null;

    function updatePreview() {
        if (!previewEl || !currentSettings) return;
        const settings = getPreviewSettingsFromForm(currentSettings);
        const profile = getPreviewPrintProfile(settings.printer_name, settings.columns_width);
        const paperWidthMm = Number(currentSettings?.paper_width_mm || 58) >= 80 ? 80 : 58;
        const printableWidthMm = paperWidthMm === 58 ? 58 : 80;
        if (columnsInput) {
            columnsInput.value = String(profile.columns);
            columnsInput.disabled = false;
            columnsInput.title = '';
        }
        if (paperEl) {
            paperEl.style.width = `${Math.round(paperWidthMm * 4.2)}px`;
        }
        if (printableEl) {
            printableEl.style.width = `${Math.round(printableWidthMm * 4.2)}px`;
        }
        const fontPt = getPreviewFontPt(profile.columns, paperWidthMm);
        if (previewEl) {
            const fontMm = fontPt * 0.3528;
            previewEl.style.fontSize = `${fontMm.toFixed(2)}mm`;
            previewEl.style.lineHeight = '1.2';
        }
        if (previewMetaEl) {
            previewMetaEl.textContent = `Papel: ${paperWidthMm}mm | Area util aprox: ${printableWidthMm}mm | Columnas configuradas: ${profile.columns}`;
        }
        const effectiveSettings = { ...settings, columns_width: profile.columns };
        previewEl.textContent = buildPreviewText(effectiveSettings, businessInfo);
    }

    try {
        const [settings, business] = await Promise.all([
            fetchTicketSettings(),
            fetchBusinessInfo().catch(() => null),
        ]);
        currentSettings = settings;
        businessInfo = business;
        fillTicketForm(settings);
        updatePreview();
    } catch (error) {
        alert(error.message);
    }

    const reactiveInputs = [
        'ticket-header',
        'ticket-footer',
        'ticket-columns',
        'ticket-show-business',
        'ticket-show-ticket-number',
        'ticket-show-cashier',
        'ticket-show-box',
        'ticket-show-payment',
        'ticket-include-details',
    ];
    reactiveInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', updatePreview);
        el.addEventListener('change', updatePreview);
    });

    applyDefaultBtn?.addEventListener('click', () => {
        const paperWidthMm = Number(currentSettings?.paper_width_mm || 58) >= 80 ? 80 : 58;
        const recommended = getRecommendedColumnsForPaper(paperWidthMm);
        if (columnsInput) {
            columnsInput.value = String(recommended);
        }
        updatePreview();
    });

    const testPrintBtn = document.getElementById('print-ticket-test-btn');
    testPrintBtn?.addEventListener('click', async () => {
        if (!currentSettings) return;
        try {
            testPrintBtn.disabled = true;
            const latest = await fetchTicketSettings();
            const payload = getTicketFormPayload(latest);
            payload.printer_name = latest.printer_name || null;
            payload.paper_width_mm = Number(latest.paper_width_mm || 58) >= 80 ? 80 : 58;
            payload.print_engine = String(latest.print_engine || 'auto');
            payload.feed_lines_after_print = clampFeedLines(latest.feed_lines_after_print, 2);
            const profile = getPreviewPrintProfile(payload.printer_name, payload.columns_width);
            payload.columns_width = profile.columns;
            await saveTicketSettings(payload);
            currentSettings = payload;
            updatePreview();
            const response = await fetch(API_URL + 'api/print/sale-ticket-test', {
                method: 'POST',
                headers: withAuthHeaders({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({}),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'No se pudo imprimir prueba');
            }
            alert(`Prueba enviada a impresora: ${data.printer || 'configurada'}`);
        } catch (error) {
            alert(error.message || 'No se pudo imprimir la prueba');
        } finally {
            testPrintBtn.disabled = false;
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const saveBtn = document.getElementById('save-ticket-and-close-btn');
            if (saveBtn) saveBtn.disabled = true;
            const current = await fetchTicketSettings();
            const payload = getTicketFormPayload(current);
            payload.printer_name = current.printer_name || null;
            const profile = getPreviewPrintProfile(payload.printer_name, payload.columns_width);
            payload.columns_width = profile.columns;
            await saveTicketSettings(payload);
            currentSettings = payload;
            updatePreview();
            alert('Configuracion guardada correctamente.');
            if (saveBtn) saveBtn.disabled = false;
        } catch (error) {
            const saveBtn = document.getElementById('save-ticket-and-close-btn');
            if (saveBtn) saveBtn.disabled = false;
            alert(error.message);
        }
    });
}

async function initPrinterForm() {
    const form = document.getElementById('printer-settings-form');
    if (!form) return;

    const select = document.getElementById('ticket-printer-select');
    const reloadBtn = document.getElementById('reload-printers-btn');
    const columnsInput = document.getElementById('printer-columns');
    const saveBtn = document.getElementById('save-printer-btn');
    const hint = document.getElementById('printer-columns-hint');
    const paperWidthSelect = document.getElementById('printer-paper-width');
    const printEngineSelect = document.getElementById('printer-engine');
    const feedLinesInput = document.getElementById('printer-feed-lines');
    const applyDefaultBtn = document.getElementById('apply-printer-default-btn');
    let currentSettings = null;

    async function refreshPrinters() {
        const printers = await fetchPrinters();
        setSelectOptions(select, printers, currentSettings?.printer_name || '');
        const selectedName = String(select?.value || '').trim() || currentSettings?.printer_name || '';
        const selectedPaperWidth = Number(paperWidthSelect?.value || currentSettings?.paper_width_mm || 58);
        const baseColumns = clampColumns(columnsInput?.value || currentSettings?.columns_width || (selectedPaperWidth >= 80 ? 42 : 30), selectedPaperWidth >= 80 ? 42 : 30);
        const profile = getPreviewPrintProfile(selectedName, baseColumns);
        const effectiveColumns = selectedPaperWidth >= 80
            ? Math.max(32, Math.min(64, baseColumns))
            : Math.max(28, Math.min(56, baseColumns));
        if (columnsInput) {
            columnsInput.value = String(effectiveColumns);
            columnsInput.disabled = false;
            columnsInput.title = '';
        }
        if (hint) {
            hint.textContent = profile.isXp58
                ? 'XP-58 detectada: modo ancho maximo, ajusta entre 30 y 56 segun legibilidad.'
                : 'Puedes ajustar entre 28 y 64 columnas.';
        }
    }

    try {
        currentSettings = await fetchTicketSettings();
        columnsInput.value = clampColumns(currentSettings.columns_width, 30);
        if (paperWidthSelect) paperWidthSelect.value = String(currentSettings.paper_width_mm || 58);
        if (printEngineSelect) printEngineSelect.value = String(currentSettings.print_engine || 'auto');
        if (feedLinesInput) feedLinesInput.value = String(clampFeedLines(currentSettings.feed_lines_after_print, 2));
        await refreshPrinters();
    } catch (error) {
        alert(error.message);
    }

    reloadBtn?.addEventListener('click', async () => {
        try {
            await refreshPrinters();
        } catch (error) {
            alert(error.message);
        }
    });

    select?.addEventListener('change', async () => {
        try {
            await refreshPrinters();
        } catch (error) {
            alert(error.message);
        }
    });

    paperWidthSelect?.addEventListener('change', async () => {
        try {
            await refreshPrinters();
        } catch (error) {
            alert(error.message);
        }
    });

    applyDefaultBtn?.addEventListener('click', async () => {
        try {
            const paperWidth = Number(paperWidthSelect?.value || currentSettings?.paper_width_mm || 58) >= 80 ? 80 : 58;
            const recommended = getRecommendedColumnsForPaper(paperWidth);
            if (columnsInput) columnsInput.value = String(recommended);
            await refreshPrinters();
        } catch (error) {
            alert(error.message);
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const selectedPrinter = (select.value || '').trim();
        if (!selectedPrinter) {
            alert('Selecciona una impresora antes de guardar.');
            return;
        }

        if (saveBtn) saveBtn.disabled = true;
        try {
            const latest = await fetchTicketSettings();
            const payload = {
                ...latest,
                printer_name: selectedPrinter,
                columns_width: clampColumns(columnsInput.value || latest.columns_width || 30, 30),
                paper_width_mm: Number(paperWidthSelect?.value || latest.paper_width_mm || 58) >= 80 ? 80 : 58,
                print_engine: String(printEngineSelect?.value || latest.print_engine || 'auto'),
                feed_lines_after_print: clampFeedLines(feedLinesInput?.value || latest.feed_lines_after_print || 2, 2),
            };
            const profile = getPreviewPrintProfile(payload.printer_name, payload.columns_width);
            payload.columns_width = profile.columns;
            await saveTicketSettings(payload);
            closePopupWindow();
        } catch (error) {
            if (saveBtn) saveBtn.disabled = false;
            alert(error.message);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await initTicketForm();
    await initPrinterForm();
});
