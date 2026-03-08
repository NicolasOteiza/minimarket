<div id="inventory-panel" class="panel">
    <h1>Inventario</h1>

    <section class="inventory-section">
        <h3>Consulta por codigo</h3>
        <div class="form-row">
            <label>Escanear o ingresar codigo</label>
            <input
                type="text"
                id="inventory-code-input"
                list="inventory-search-options"
                placeholder="Escanea codigo o escribe nombre del producto"
                oninput="inventorySearchSuggest(this.value)"
                onkeydown="if(event.key==='Enter'){event.preventDefault();loadInventoryProductByCode();}"
            >
        </div>
        <div class="form-row form-actions">
            <button class="btn" type="button" onclick="loadInventoryProductByCode()">Buscar</button>
            <button class="btn" type="button" onclick="clearInventoryView()">Limpiar</button>
        </div>
        <div id="inventory-feedback" class="product-status-box">Escanea un producto para consultar inventario.</div>
    </section>

    <div id="inventory-edit-panels" class="inventory-edit-panels hidden">
        <section class="inventory-section inventory-stock-panel">
            <h3>Inventario</h3>
            <div class="form-row"><label>Existencia actual</label><input type="text" id="inventory-stock-current" readonly></div>
            <div class="form-row"><label>Stock minimo</label><input type="number" id="inventory-stock-min" min="0" step="1"></div>
            <div class="form-row"><label>Stock maximo</label><input type="number" id="inventory-stock-max" min="0" step="1"></div>
            <div class="form-row"><label>Cantidad llega (reposicion)</label><input type="number" id="inventory-restock-qty" min="0" step="1" placeholder="Ej: 24"></div>
        </section>

        <section class="inventory-section inventory-product-panel">
            <h3>Datos del producto</h3>
            <div class="form-row"><label>Costo</label><input type="number" id="inventory-product-cost" min="0" step="1"></div>
            <div class="form-row"><label>Ganancia (%)</label><input type="number" id="inventory-product-profit" min="0" step="1"></div>
            <div class="form-row"><label>Precio venta</label><input type="number" id="inventory-product-sale" min="0" step="1"></div>
        </section>
    </div>

    <div id="inventory-footer-actions" class="form-row form-actions hidden">
        <button class="btn" type="button" id="inventory-save-btn" onclick="saveInventoryChanges()" disabled>Guardar cambios</button>
        <button class="btn" type="button" onclick="cancelInventoryEdition()">Cancelar</button>
    </div>

    <datalist id="inventory-search-options"></datalist>
</div>
