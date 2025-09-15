<link rel="stylesheet" href="./css/panel.css"><!-- solo una vez en tu layout -->

<div class="panel"><!-- caja blanca sombreada -->
    <h1>Productos</h1>

    <!-- ====== SUB‑MENÚ local ====== -->
    <nav class="panel-grid" style="margin-bottom:1.5rem">
        <button class="btn" onclick="showSectioninventario('add')">Nuevo</button>
        <button class="btn" onclick="showSectioninventario('modify')">Modificar</button>
        <button class="btn" onclick="showSectioninventario('remove')">Eliminar</button>
        <button class="btn" onclick="showSectioninventario('dep')">Departamento</button>
        <button class="btn" onclick="showSectioninventario('find')">Ventas por periodo</button>
        <button class="btn" onclick="showSectioninventario('find')">Promociones</button>
        <button class="btn" onclick="showSectioninventario('find')">Importar</button>
        <button class="btn" onclick="showSectioninventario('find')">Catálogo</button>
    </nav>

    <!-- ======= NUEVO PRODUCTO ======= -->
    <section id="add" class="hidden">
        <h3>Nuevo producto</h3>

        <div class="form-row">
            <label>Código de barras</label>
            <input type="text" id="product-code" placeholder="Código de barras" required>
        </div>

        <div class="form-row">
            <label>Descripción</label>
            <input type="text" id="product-name" placeholder="Descripción" required>
        </div>

        <div class="form-row">
            <label>Se vende</label>
            <div style="display:flex;gap:1rem;">
                <label><input type="radio" name="formato_venta" id="radio-unidad" value="unidad" required> Unidad</label>
                <label><input type="radio" name="formato_venta" id="radio-kilo" value="granel"> Granel</label>
                <label><input type="radio" name="formato_venta" id="radio-pack" value="pack"> Pack</label>
            </div>
        </div>

        <div class="form-row">
            <label>Costo</label>
            <input type="number" id="product-costo" placeholder="Costo" required>
        </div>

        <div class="form-row">
            <label>Ganancia (%)</label>
            <input type="number" id="product-ganancia" placeholder="Ganancia %">
        </div>

        <div class="form-row">
            <label>Precio venta</label>
            <input type="number" id="product-price" placeholder="Precio venta" required>
        </div>

        <div class="form-row">
            <label>Precio mayoreo</label>
            <input type="number" id="product-mayoreo" placeholder="Precio mayoreo">
        </div>

        <div class="form-row">
            <label>Departamento</label>
            <select id="checkbox-inventario" name="dep">
                <option value="verduleria">Verdulería</option>
                <option value="lacteos">Lácteos</option>
                <option value="libreria">Librería</option>
            </select>
        </div>

        <div class="form-row">
            <label><input type="checkbox" name="utiliza_inv"> Este producto utiliza inventario</label>
        </div>

        <div class="form-row">
            <label>Hay</label>
            <input type="number" id="product-quantity" placeholder="Cantidad">
        </div>

        <div class="form-row">
            <label>Mínima</label>
            <input type="number" id="product-quantity-min" placeholder="Cantidad mínima">
        </div>

        <div class="form-row">
            <label>Máxima</label>
            <input type="number" id="product-quantity-max" placeholder="Cantidad máxima">
        </div>

        <div class="form-row" style="justify-content:end;">
            <button class="btn" onclick="addProduct()">Guardar</button>
            <button class="btn" onclick="hideAllSections()">Cancelar</button>
        </div>
    </section>

    <!-- ======= MODIFICAR PRODUCTO ======= -->
    <section id="modify" class="hidden">
        <h3>Modificar producto</h3>
        <!-- Repite los mismos inputs que en #add o carga datos existentes -->
        <!-- … -->
    </section>

    <!-- ======= ELIMINAR / BUSCAR ======= -->
    <section id="remove" class="hidden">
        <h3>Eliminar producto</h3>
        <div class="form-row">
            <label>Código de barras</label>
            <input type="text" id="product-code-delete" placeholder="Código de barras">
            <button class="btn" onclick="deleteProduct()">Eliminar</button>
        </div>
    </section>

    <section id="find" class="hidden">
        <h3>Buscar productos / Ventas</h3>
        <div class="form-row">
            <input type="text" id="product-code-find" placeholder="Código">
            <input type="text" id="product-name-find" placeholder="Nombre">
            <input type="number" id="product-price-find" placeholder="Precio">
            <button class="btn" onclick="updateProduct()">Buscar</button>
        </div>
    </section>
</div>