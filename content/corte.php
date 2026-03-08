<div class="mainContent" id="cut-view">
    <style>
        #cut-view {
            background: linear-gradient(180deg, #f6f8fb 0%, #eef2f7 100%);
            padding: 12px;
            border-radius: 14px;
        }
        #cut-view .subtitulo h2 {
            margin: 0;
            font-size: 1.35rem;
            color: #0f172a;
            letter-spacing: 0.2px;
        }
        #cut-view .cut-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        #cut-view .cut-card {
            background: #ffffff;
            border: 1px solid #d9e0ea;
            border-radius: 14px;
            padding: 16px;
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
        }
        #cut-view .cut-title {
            margin: 0 0 8px 0;
            font-size: 1.02rem;
            color: #0f172a;
        }
        #cut-view .cut-muted {
            color: #475569;
            margin: 0 0 12px 0;
            font-size: 0.92rem;
        }
        #cut-view .cut-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 10px;
        }
        #cut-view #cut-close-breakdown,
        #cut-view #cut-breakdown {
            margin: 8px 0 0 18px;
            color: #1e293b;
        }
        #cut-view .cut-block {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #f8fafc;
            padding: 10px;
            margin-top: 10px;
        }
        #cut-view .cut-block h4 {
            margin: 0;
            color: #0f172a;
            font-size: 0.95rem;
        }
        #cut-view .cut-block .cut-subtitle {
            margin: 2px 0 8px 0;
            color: #475569;
            font-size: 0.82rem;
            text-transform: uppercase;
            letter-spacing: 0.35px;
        }
        #cut-view .cut-kpi-total {
            margin-top: 8px;
            font-weight: 700;
            color: #0f172a;
            text-align: right;
        }
        #cut-view .cut-list {
            margin: 0;
            padding-left: 18px;
            color: #1e293b;
            font-size: 0.9rem;
        }
        #cut-view .cut-table-wrap {
            max-height: 300px;
            overflow: auto;
            border: 1px solid #d9e0ea;
            border-radius: 10px;
            background: #fff;
            margin-top: 10px;
        }
        #cut-view .cut-table-wrap .venta-table th {
            position: sticky;
            top: 0;
            background: #eff6ff;
            color: #0f172a;
            z-index: 1;
        }
        #cut-view .cut-table-wrap .venta-table td {
            color: #1e293b;
            font-size: 0.9rem;
        }
        #cut-view .form-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 10px;
        }
        #cut-view .form-row label {
            font-weight: 600;
            color: #1e293b;
            font-size: 0.9rem;
        }
        #cut-view .form-row input {
            width: 100%;
            border: 1px solid #c6d0dd;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 0.93rem;
            color: #0f172a;
            background: #fff;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        #cut-view .form-row input:focus {
            border-color: #0ea5e9;
            box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);
        }
        #cut-view .btn {
            border-radius: 10px;
            border: 1px solid #0ea5e9;
            background: #0ea5e9;
            color: #fff;
            padding: 8px 14px;
            font-weight: 600;
            cursor: pointer;
            transition: filter 0.2s ease;
        }
        #cut-view .btn:hover {
            filter: brightness(0.94);
        }
        #cut-view .btn:disabled {
            background: #cbd5e1;
            border-color: #cbd5e1;
            color: #64748b;
            cursor: not-allowed;
            filter: none;
        }
        #cut-view .cut-side-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
        }
        #cut-view .cut-top-actions {
            display: flex;
            justify-content: flex-end;
            margin: 10px 0 12px 0;
        }
        #cut-view .cut-divider {
            border: 0;
            border-top: 1px solid #e2e8f0;
            margin: 14px 0;
        }
        @media (max-width: 980px) {
            #cut-view .cut-grid {
                grid-template-columns: 1fr;
            }
        }
        #cut-close-popup .cut-dialog {
            background: #fff;
            width: min(540px, 92vw);
            border-radius: 14px;
            border: 1px solid #d9e0ea;
            overflow: hidden;
            box-shadow: 0 24px 40px rgba(15, 23, 42, 0.25);
        }
        #cut-close-popup .cut-dialog-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 11px 14px;
            background: #eff6ff;
            border-bottom: 1px solid #d9e0ea;
        }
        #cut-close-popup .cut-dialog-header strong {
            color: #0f172a;
        }
        #cut-close-popup .cut-dialog-body {
            padding: 14px;
        }
        #cut-close-popup .form-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 10px;
        }
        #cut-close-popup .form-row label {
            font-weight: 600;
            color: #1e293b;
            font-size: 0.9rem;
        }
        #cut-close-popup .form-row input {
            width: 100%;
            border: 1px solid #c6d0dd;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 0.93rem;
            color: #0f172a;
            background: #fff;
            outline: none;
            box-sizing: border-box;
        }
        #cut-close-popup .form-row input:focus {
            border-color: #0ea5e9;
            box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);
        }
        #cut-close-popup .cut-dialog-actions {
            justify-content: flex-end;
            gap: 8px;
        }
        #cut-close-popup .cut-btn-ghost {
            background: #fff;
            color: #0f172a;
            border-color: #cbd5e1;
        }
    </style>

    <div class="sub">
        <div class="subtitulo">
            <h2>Corte</h2>
        </div>
        <div class="cut-top-actions">
            <button id="cut-close-shift-btn" data-permission-key="corte_turno" data-permission-mode="disable" class="btn" onclick="openCloseShiftDialog()" disabled>Cerrar turno</button>
        </div>

        <div class="content">
            <div class="cut-grid">
                <section class="cut-card">
                    <h3 class="cut-title">Resumen del turno actual</h3>
                    <p id="cut-summary" class="cut-muted">Sin datos cargados.</p>
                    <ul id="cut-breakdown" class="cut-list"></ul>

                    <div class="cut-block">
                        <h4>Ventas Totales</h4>
                        <p class="cut-subtitle">Dinero en caja</p>
                        <ul id="cut-cash-detail-list" class="cut-list"></ul>
                        <div id="cut-cash-total" class="cut-kpi-total"></div>
                    </div>

                    <div class="cut-block">
                        <h4>Ganancia</h4>
                        <p class="cut-subtitle">Ventas</p>
                        <ul id="cut-profit-detail-list" class="cut-list"></ul>
                        <div id="cut-profit-total" class="cut-kpi-total"></div>
                    </div>

                    <div class="cut-block">
                        <h4>Detalle de ingresos de la sesion</h4>
                        <ul id="cut-session-income-list" class="cut-list"></ul>
                    </div>

                    <div class="cut-block">
                        <h4>Detalle de salidas</h4>
                        <ul id="cut-session-expense-list" class="cut-list"></ul>
                    </div>

                    <div class="cut-block">
                        <h4>Monto vendido por departamento</h4>
                        <ul id="cut-department-list" class="cut-list"></ul>
                    </div>

                    <div class="cut-block">
                        <h4>Top 3 productos vendidos por departamento (sesion)</h4>
                        <ul id="cut-top-products-by-department" class="cut-list"></ul>
                    </div>
                </section>

                <section class="cut-card">
                    <h3 class="cut-title">Resumen para cierre</h3>
                    <div class="cut-actions">
                        <button class="btn" id="cut-load-session-btn" data-permission-key="corte_turno" data-permission-mode="disable" onclick="loadCutSummaryForClose('session')">Resumen sesion</button>
                        <button class="btn" id="cut-load-day-btn" data-permission-key="corte_dia" data-permission-mode="disable" onclick="loadCutSummaryForClose('day')">Resumen dia</button>
                    </div>
                    <p id="cut-close-scope-info" class="cut-muted">Selecciona una opcion para cargar el resumen de ventas.</p>
                    <ul id="cut-close-breakdown"></ul>

                    <div class="cut-table-wrap">
                        <table class="venta-table" style="margin:0;">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Ticket</th>
                                    <th>Metodo</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody id="cut-close-detail-body"></tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    </div>
</div>

<div id="cut-close-popup" class="hidden" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9998; align-items:center; justify-content:center;">
    <div class="cut-dialog">
        <div class="cut-dialog-header">
            <strong>Cerrar turno</strong>
            <button type="button" class="btn" onclick="closeCloseShiftDialog()" style="min-width:auto; padding:6px 10px;">X</button>
        </div>
        <div class="cut-dialog-body">
            <p id="cut-close-popup-info" style="margin:0 0 10px 0;"></p>
            <div class="form-row">
                <label for="cut-initial-amount">Monto inicial en caja</label>
                <input id="cut-initial-amount" type="number" min="0" step="0.01" value="0" readonly>
            </div>
            <div id="cut-declared-row" class="form-row">
                <label for="cut-declared-amount">Efectivo contado en caja</label>
                <input id="cut-declared-amount" type="number" min="0" step="0.01" value="0" oninput="refreshCloseShiftDifference()">
            </div>
            <div id="cut-declared-card-row" class="form-row">
                <label for="cut-declared-card-amount">Tarjetas declaradas (cierre Redcompra)</label>
                <input id="cut-declared-card-amount" type="number" min="0" step="0.01" value="0" oninput="refreshCloseShiftDifference()">
            </div>
            <div class="form-row">
                <label for="cut-notes">Observaciones</label>
                <input id="cut-notes" type="text" maxlength="255" placeholder="Opcional">
            </div>
            <div id="cut-difference-row" class="form-row">
                <label>Diferencia</label>
                <input id="cut-difference-preview" type="text" readonly>
            </div>
            <div id="cut-card-difference-row" class="form-row">
                <label>Diferencia tarjeta</label>
                <input id="cut-card-difference-preview" type="text" readonly>
            </div>
            <div class="form-row cut-dialog-actions">
                <button class="btn cut-btn-ghost" type="button" onclick="closeCloseShiftDialog()">Cancelar</button>
                <button id="cut-confirm-close-btn" class="btn" type="button" onclick="confirmCloseShiftFromDialog()">Confirmar cierre</button>
            </div>
        </div>
    </div>
</div>
