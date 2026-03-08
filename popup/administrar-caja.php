<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Administrar cajas</title>
    <link rel="stylesheet" href="../css/root.css">
    <link rel="stylesheet" href="../css/popUpStyle.css">
    <script src="../js/functions.js"></script>
    <style>
        body {
            padding: 14px 16px;
            background: var(--clr-bg-light);
        }

        .box-admin-shell {
            max-width: 1080px;
            margin: 0 auto;
        }

        .box-admin-title {
            margin: 0 0 10px;
            font-size: 1.35rem;
            color: var(--clr-text-light);
        }

        .box-admin-layout {
            display: grid;
            grid-template-columns: 1.5fr 1fr;
            gap: 12px;
        }

        .box-admin-card {
            border: 1px solid #d6e0ef;
            border-radius: 12px;
            background: #fff;
            padding: 12px;
        }

        .box-admin-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(130px, 1fr));
            gap: 10px;
        }

        .box-slot {
            border: 1px solid #d6e0ef;
            border-radius: 10px;
            padding: 10px;
            background: #f8fbff;
            cursor: pointer;
            text-align: center;
        }

        .box-slot.selected {
            border-color: #0ea5e9;
            box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.18);
            background: #eef9ff;
        }

        .box-slot img {
            width: 48px;
            height: 48px;
            object-fit: contain;
        }

        .box-slot-number {
            margin-top: 6px;
            font-weight: 700;
            font-size: 0.9rem;
        }

        .box-slot-name {
            margin-top: 4px;
            font-size: 0.83rem;
            color: #4b5563;
            min-height: 18px;
        }

        .box-slot-state {
            margin-top: 8px;
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 0.72rem;
            font-weight: 700;
            border: 1px solid #93c5fd;
            color: #1d4ed8;
            background: #eff6ff;
        }

        .box-slot-state.off {
            border-color: #fecaca;
            color: #b91c1c;
            background: #fef2f2;
        }

        .box-admin-form {
            display: grid;
            gap: 10px;
        }

        .box-admin-form label {
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--clr-text-light);
        }

        .box-admin-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .box-admin-toolbar {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 10px;
        }

        .box-admin-editor-empty {
            min-height: 300px;
            border: 1px dashed #cbd5e1;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #64748b;
            text-align: center;
            padding: 16px;
        }

        .box-admin-summary {
            margin: 0 0 10px;
            font-size: 0.87rem;
            color: #4b5563;
        }

        .box-admin-msg {
            min-height: 18px;
            font-size: 0.83rem;
        }

        .box-admin-msg.ok {
            color: #166534;
        }

        .box-admin-msg.err {
            color: #b91c1c;
        }

        body.dark .box-admin-card {
            background: #111c2f;
            border-color: #263952;
        }

        body.dark .box-slot {
            background: #0f1a2c;
            border-color: #2b3f5c;
        }

        body.dark .box-slot.selected {
            background: #13253a;
        }

        body.dark .box-slot-name,
        body.dark .box-admin-summary {
            color: #c1d0e6;
        }

        body.dark .box-admin-editor-empty {
            border-color: #334e73;
            color: #c1d0e6;
        }

        @media (max-width: 900px) {
            .box-admin-layout {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 650px) {
            .box-admin-grid {
                grid-template-columns: repeat(2, minmax(130px, 1fr));
            }
        }
    </style>
</head>
<body>
    <div class="box-admin-shell">
        <h2 class="box-admin-title">Administrar Cajas</h2>
        <p class="box-admin-summary" id="box-admin-summary">Cargando cajas habilitadas...</p>

        <div class="box-admin-layout">
            <div class="box-admin-card">
                <div class="box-admin-toolbar">
                    <button type="button" class="btn" id="box-refresh-btn">Recargar</button>
                </div>
                <div class="box-admin-grid" id="box-admin-grid"></div>
            </div>

            <div class="box-admin-card">
                <div id="box-admin-editor-empty" class="box-admin-editor-empty">
                    Selecciona una caja habilitada para editarla.
                </div>
                <form id="box-admin-form" class="box-admin-form hidden">
                    <div>
                        <label for="box-number">Numero de caja</label>
                        <select id="box-number"></select>
                    </div>
                    <div>
                        <label for="box-name">Nombre de caja</label>
                        <input type="text" id="box-name" maxlength="120" placeholder="Ej. Caja Principal" required>
                    </div>
                    <div>
                        <label>
                            <input type="checkbox" id="box-enabled" checked>
                            Caja habilitada
                        </label>
                    </div>
                    <div>
                        <label>
                            <input type="checkbox" id="box-assign-local">
                            Asignar esta caja al equipo actual
                        </label>
                    </div>
                    <div class="box-admin-actions">
                        <button type="submit" class="btn" id="box-save-btn" disabled>Guardar caja</button>
                        <button type="button" class="btn" id="box-cancel-btn" disabled>Cancelar</button>
                    </div>
                    <p id="box-admin-msg" class="box-admin-msg"></p>
                </form>
            </div>
        </div>
    </div>

    <script>
        const API_URL = (() => {
            const override = window.localStorage.getItem('api_url');
            if (override) return override.endsWith('/') ? override : `${override}/`;
            if (window.location.port === '3001') return `${window.location.origin}/`;
            const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
            const protocol = isLocalHost ? 'http:' : window.location.protocol;
            return `${protocol}//${window.location.hostname}:3001/`;
        })();

        const slots = Array.from({ length: 8 }, (_, i) => i + 1);
        let boxesByNumber = new Map();
        let selectedBoxNumber = null;
        let initialFormSnapshot = null;

        function applyPopupTheme() {
            const saved = localStorage.getItem('theme');
            if (saved === 'dark') {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        }

        function withAuthHeaders(headers = {}) {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
        }

        function setEditorVisible(visible) {
            const form = document.getElementById('box-admin-form');
            const empty = document.getElementById('box-admin-editor-empty');
            if (form) form.classList.toggle('hidden', !visible);
            if (empty) empty.classList.toggle('hidden', visible);
        }

        function getFormSnapshot() {
            const numberInput = document.getElementById('box-number');
            const nameInput = document.getElementById('box-name');
            const enabledInput = document.getElementById('box-enabled');
            const assignInput = document.getElementById('box-assign-local');
            return {
                numero_caja: Number(numberInput?.value || 0),
                nombre_caja: String(nameInput?.value || '').trim(),
                estado: Boolean(enabledInput?.checked),
                assign_local: Boolean(assignInput?.checked),
            };
        }

        function isFormDirty() {
            if (!initialFormSnapshot) return false;
            const current = getFormSnapshot();
            return (
                current.numero_caja !== initialFormSnapshot.numero_caja ||
                current.nombre_caja !== initialFormSnapshot.nombre_caja ||
                current.estado !== initialFormSnapshot.estado ||
                current.assign_local !== initialFormSnapshot.assign_local
            );
        }

        function refreshFormButtonsState() {
            const saveBtn = document.getElementById('box-save-btn');
            const cancelBtn = document.getElementById('box-cancel-btn');
            const dirty = isFormDirty();
            if (saveBtn) saveBtn.disabled = !dirty;
            if (cancelBtn) cancelBtn.disabled = !dirty;
        }

        function syncInitialSnapshot() {
            initialFormSnapshot = getFormSnapshot();
            refreshFormButtonsState();
        }

        function setMessage(text, type = '') {
            const el = document.getElementById('box-admin-msg');
            if (!el) return;
            el.textContent = text || '';
            el.className = `box-admin-msg ${type}`.trim();
        }

        function normalizeBoxes(raw) {
            if (!Array.isArray(raw)) return [];
            return raw
                .map((row) => ({
                    n_caja: Number(row?.n_caja || 0),
                    nombre_caja: String(row?.nombre_caja || '').trim(),
                    estado: Number(row?.estado || 0) === 1 ? 1 : 0,
                }))
                .filter((row) => row.n_caja >= 1 && row.n_caja <= 8);
        }

        function renderSummary() {
            const enabled = Array.from(boxesByNumber.values()).filter((box) => box.estado === 1).length;
            const summary = document.getElementById('box-admin-summary');
            if (summary) {
                summary.textContent = `Cajas habilitadas: ${enabled} de 8 equipos permitidos.`;
            }
        }

        function renderGrid() {
            const grid = document.getElementById('box-admin-grid');
            if (!grid) return;
            grid.innerHTML = '';

            const enabledBoxes = Array.from(boxesByNumber.values())
                .filter((box) => box.estado === 1)
                .sort((a, b) => a.n_caja - b.n_caja);

            if (enabledBoxes.length === 0) {
                const empty = document.createElement('div');
                empty.style.gridColumn = '1 / -1';
                empty.style.padding = '10px';
                empty.style.border = '1px dashed #cbd5e1';
                empty.style.borderRadius = '8px';
                empty.style.textAlign = 'center';
                empty.textContent = 'No hay cajas habilitadas.';
                grid.appendChild(empty);
                return;
            }

            enabledBoxes.forEach((box) => {
                const number = Number(box.n_caja);
                const slot = document.createElement('button');
                slot.type = 'button';
                slot.className = `box-slot${selectedBoxNumber === number ? ' selected' : ''}`;
                slot.dataset.box = String(number);
                slot.innerHTML = `
                    <img src="../img/cajero-automatico.png" alt="Caja ${number}">
                    <div class="box-slot-number">Caja ${number}</div>
                    <div class="box-slot-name">${box?.nombre_caja || 'Sin configurar'}</div>
                    <span class="box-slot-state">Habilitada</span>
                `;
                slot.addEventListener('click', () => {
                    selectedBoxNumber = number;
                    fillFormFromSelection();
                    setEditorVisible(true);
                    renderGrid();
                });
                grid.appendChild(slot);
            });
        }

        function buildBoxNumberOptions() {
            const select = document.getElementById('box-number');
            if (!select) return;
            select.innerHTML = slots.map((n) => `<option value="${n}">Caja ${n}</option>`).join('');
            if (selectedBoxNumber) {
                select.value = String(selectedBoxNumber);
            }
        }

        function fillFormFromSelection() {
            if (!selectedBoxNumber) {
                initialFormSnapshot = null;
                refreshFormButtonsState();
                return;
            }
            const box = boxesByNumber.get(selectedBoxNumber);
            const numberInput = document.getElementById('box-number');
            const nameInput = document.getElementById('box-name');
            const enabledInput = document.getElementById('box-enabled');
            const assignInput = document.getElementById('box-assign-local');

            if (numberInput) numberInput.value = String(selectedBoxNumber);
            if (nameInput) nameInput.value = box?.nombre_caja || `Caja ${selectedBoxNumber}`;
            if (enabledInput) enabledInput.checked = box ? box.estado === 1 : true;
            if (assignInput) assignInput.checked = false;
            syncInitialSnapshot();
        }

        function clearSelectionAndEditor() {
            selectedBoxNumber = null;
            initialFormSnapshot = null;
            setEditorVisible(false);
            refreshFormButtonsState();
            renderGrid();
        }

        async function loadBoxes() {
            setMessage('');
            try {
                const response = await fetch(API_URL + 'api/getCajas', {
                    headers: withAuthHeaders(),
                });
                const data = await response.json().catch(() => []);
                const boxes = normalizeBoxes(data);
                boxesByNumber = new Map(boxes.map((box) => [box.n_caja, box]));
                if (selectedBoxNumber !== null && !slots.includes(selectedBoxNumber)) {
                    selectedBoxNumber = null;
                }
                buildBoxNumberOptions();
                renderSummary();
                if (selectedBoxNumber === null) {
                    setEditorVisible(false);
                    initialFormSnapshot = null;
                    refreshFormButtonsState();
                } else {
                    setEditorVisible(true);
                    fillFormFromSelection();
                }
                renderGrid();
            } catch (error) {
                setMessage('No se pudo cargar la informacion de cajas.', 'err');
            }
        }

        async function bindDeviceIfNeeded(boxNumber, boxName) {
            const assignInput = document.getElementById('box-assign-local');
            if (!assignInput || !assignInput.checked) return;

            localStorage.setItem('n_caja', String(boxNumber));
            localStorage.setItem('nombre_caja', String(boxName));

            const fingerprint = String(localStorage.getItem('device_fp') || '').trim();
            if (!fingerprint) return;

            try {
                await fetch(API_URL + 'api/device-caja/bind', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fingerprint,
                        numero_caja: Number(boxNumber),
                        nombre_caja: String(boxName),
                    }),
                });
            } catch (_) {}
        }

        async function submitBoxForm(event) {
            event.preventDefault();
            if (selectedBoxNumber === null) {
                setMessage('Selecciona una caja habilitada para editar.', 'err');
                return;
            }
            const numberInput = document.getElementById('box-number');
            const nameInput = document.getElementById('box-name');
            const enabledInput = document.getElementById('box-enabled');
            const boxNumber = Number(numberInput?.value || 0);
            const boxName = String(nameInput?.value || '').trim();
            const isEnabled = Boolean(enabledInput?.checked);
            if (!isFormDirty()) {
                return;
            }

            if (boxNumber < 1 || boxNumber > 8) {
                setMessage('Numero de caja invalido. Solo se permite 1 a 8.', 'err');
                return;
            }
            if (!boxName) {
                setMessage('Debes indicar un nombre para la caja.', 'err');
                return;
            }

            setMessage('Guardando...', '');
            try {
                const response = await fetch(API_URL + 'api/cajas/upsert', {
                    method: 'POST',
                    headers: withAuthHeaders({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        numero_caja: boxNumber,
                        nombre_caja: boxName,
                        estado: isEnabled ? 1 : 0,
                        fingerprint: String(localStorage.getItem('device_fp') || '').trim() || null,
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    setMessage(data.error || data.message || 'No se pudo guardar la caja.', 'err');
                    return;
                }

                await bindDeviceIfNeeded(boxNumber, boxName);
                selectedBoxNumber = boxNumber;
                setMessage('Caja guardada correctamente.', 'ok');
                await loadBoxes();
            } catch (error) {
                setMessage('Error de conexion al guardar la caja.', 'err');
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            applyPopupTheme();
            buildBoxNumberOptions();
            setEditorVisible(false);
            refreshFormButtonsState();

            document.getElementById('box-number')?.addEventListener('change', (e) => {
                selectedBoxNumber = Number(e.target.value || 1);
                fillFormFromSelection();
                setEditorVisible(true);
                renderGrid();
            });
            document.getElementById('box-name')?.addEventListener('input', refreshFormButtonsState);
            document.getElementById('box-enabled')?.addEventListener('change', refreshFormButtonsState);
            document.getElementById('box-assign-local')?.addEventListener('change', refreshFormButtonsState);
            document.getElementById('box-admin-form')?.addEventListener('submit', submitBoxForm);
            document.getElementById('box-refresh-btn')?.addEventListener('click', loadBoxes);
            document.getElementById('box-cancel-btn')?.addEventListener('click', () => {
                clearSelectionAndEditor();
                setMessage('');
            });

            await loadBoxes();
        });
    </script>
</body>
</html>
