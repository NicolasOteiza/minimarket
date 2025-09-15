<!-- Panel de configuración con pestañas -->
<div class="panel">

    <!-- ===== PESTAÑAS ===== -->
    <div class="menu-image">
        <div class="tabs">
            <div class="tab active" data-tab="general">General</div>
            <div class="tab" data-tab="personalizacion">Personalización</div>
            <div class="tab" data-tab="dispositivos">Dispositivos</div>
            <div class="tab" data-tab="servicios">Servicios</div>
            <div class="tab" data-tab="mantenimiento">Mantenimiento</div>
        </div>
    </div>
    <div class="menu-no-image ">
        <div class="tabs">
            <div class="tab active" data-tab="general"><img src="./img/general.png" class="menu-img"></div>
            <div class="tab" data-tab="personalizacion"><img src="./img/personaliza.png" class="menu-img"></div>
            <div class="tab" data-tab="dispositivos"><img src="./img/dispositivo.png" class="menu-img"></div>
            <div class="tab" data-tab="servicios"><img src="./img/servicios.png" class="menu-img"></div>
            <div class="tab" data-tab="mantenimiento"><img src="./img/mantenimiento.png" class="menu-img"></div>
        </div>
    </div>


    <!-- ===== CONTENEDOR DE PESTAÑAS ===== -->
    <div class="div-tab">

        <!-- ---------- General ---------- -->
        <div id="general" class="tab-content active">
            <h3 class="sub">General</h3>
            <ul class="panel-grid">
                <!-- (items originales) -->
                <li class="panel-item" onclick="open_w('opciones-Habilitadas')">
                    <img src="https://cdn-icons-gif.flaticon.com/10690/10690746.gif" alt="">
                    <span>Opciones<br>Habilitadas</span>
                </li>
                <li class="panel-item" onclick="open_w('cajero')">
                    <img src="https://cdn-icons-gif.flaticon.com/11188/11188712.gif" alt="">
                    <span>Cajeros</span>
                </li>
                <li class="panel-item" onclick="open_w('base-datos')">
                    <img src="https://cdn-icons-gif.flaticon.com/9872/9872469.gif" alt="">
                    <span>Base&nbsp;de<br>datos</span>
                </li>
                <li class="panel-item" onclick="open_w('articulos-precargados')">
                    <img src="https://cdn-icons-gif.flaticon.com/18300/18300014.gif" alt="">
                    <span>Artículos<br>precargados</span>
                </li>
                <li class="panel-item" onclick="open_w('facturacion')">
                    <img src="https://cdn-icons-gif.flaticon.com/8716/8716613.gif" alt="">
                    <span>Facturación</span>
                </li>
                <li class="panel-item" onclick="open_w('modificar-folio')">
                    <img src="https://cdn-icons-gif.flaticon.com/15309/15309792.gif" alt="">
                    <span>Modificar<br>folios</span>
                </li>
                <li class="panel-item" onclick="open_w('administrar-caja')">
                    <img src="https://cdn-icons-gif.flaticon.com/11188/11188712.gif" alt="">
                    <span>Administrar<br>cajas</span>
                </li>
            </ul>
        </div>

        <!-- ---------- Personalización ---------- -->
        <div id="personalizacion" class="tab-content">
            <h3 class="sub">Personalización</h3>
            <ul class="panel-grid">
                <!-- (items originales) -->
                <li class="panel-item" onclick="open_w('logotipo-programa')">
                    <img src="https://cdn-icons-gif.flaticon.com/18549/18549235.gif" alt="">
                    <span>Logotipo</span>
                </li>
                <li class="panel-item" onclick="open_w('ticket')">
                    <img src="https://cdn-icons-gif.flaticon.com/12147/12147184.gif" alt="">
                    <span>Ticket</span>
                </li>
                <li class="panel-item" onclick="open_w('forma-pago')">
                    <img src="https://cdn-icons-gif.flaticon.com/11188/11188755.gif" alt="">
                    <span>Formas<br>de pago</span>
                </li>
                <li class="panel-item" onclick="open_w('impuestos')">
                    <img src="https://cdn-icons-gif.flaticon.com/15576/15576128.gif" alt="">
                    <span>Impuestos</span>
                </li>
                <li class="panel-item" onclick="open_w('corte')">
                    <img src="https://cdn-icons-gif.flaticon.com/15579/15579028.gif" alt="">
                    <span>Corte</span>
                </li>
                <li class="panel-item" onclick="open_w('simbolo-moneda')">
                    <img src="https://cdn-icons-gif.flaticon.com/15575/15575658.gif" alt="">
                    <span>Símbolo<br>moneda</span>
                </li>
                <li class="panel-item" onclick="open_w('unidad-medida')">
                    <img src="https://cdn-icons-gif.flaticon.com/11200/11200186.gif" alt="">
                    <span>Unidades</span>
                </li>
            </ul>
        </div>

        <!-- ---------- Dispositivos ---------- -->
        <div id="dispositivos" class="tab-content">
            <h3 class="sub">Dispositivos</h3>
            <ul class="panel-grid">
                <!-- (items originales) -->
                <li class="panel-item" onclick="open_w('impresora')">
                    <img src="https://cdn-icons-gif.flaticon.com/18255/18255118.gif" alt="">
                    <span>Impresora</span>
                </li>
                <li class="panel-item" onclick="open_w('lector-codigo')">
                    <img src="https://cdn-icons-gif.flaticon.com/11188/11188729.gif" alt="">
                    <span>Lector<br>códigos</span>
                </li>
                <li class="panel-item" onclick="open_w('cajon-dinero')">
                    <img src="https://cdn-icons-gif.flaticon.com/14099/14099172.gif" alt="">
                    <span>Cajón&nbsp;dinero</span>
                </li>
            </ul>
        </div>

        <!-- ---------- Servicios ---------- -->
        <div id="servicios" class="tab-content">
            <h3 class="sub">Servicios</h3>
            <ul class="panel-grid">
                <!-- (items originales) -->
                <li class="panel-item" onclick="open_w('compra-proveedor')">
                    <img src="https://cdn-icons-gif.flaticon.com/15575/15575664.gif" alt="">
                    <span>Compras /<br>Proveedores</span>
                </li>
                <li class="panel-item" onclick="open_w('sincronizar-nube')">
                    <img src="https://cdn-icons-gif.flaticon.com/16678/16678265.gif" alt="">
                    <span>Sincronizar<br>nube</span>
                </li>
                <li class="panel-item" onclick="open_w('notificar-correo')">
                    <img src="https://cdn-icons-gif.flaticon.com/11237/11237480.gif" alt="">
                    <span>Notificar<br>correo</span>
                </li>
            </ul>
        </div>

        <!-- ---------- Mantenimiento ---------- -->
        <div id="mantenimiento" class="tab-content">
            <h3 class="sub">Mantenimiento</h3>
            <ul class="panel-grid">
                <!-- (items originales) -->
                <li class="panel-item" onclick="open_w('respaldo-automatico')">
                    <img src="https://cdn-icons-gif.flaticon.com/16313/16313609.gif" alt="">
                    <span>Respaldo<br>automático</span>
                </li>
                <li class="panel-item" onclick="open_w('licencia')">
                    <img src="https://cdn-icons-gif.flaticon.com/15578/15578358.gif" alt="">
                    <span>Licencia</span>
                </li>
                <li class="panel-item" onclick="open_w('actualizacion-automatica')">
                    <img src="https://cdn-icons-gif.flaticon.com/16313/16313572.gif" alt="">
                    <span>Actualizaciones<br>automáticas</span>
                </li>
            </ul>
        </div>
    </div>

    <div class="centrar" style="margin-top:2rem;">
        <a href="https://www.flaticon.es/iconos-animados-gratis/ajustes" target="_blank">
            Iconos animados creados por Freepik – Flaticon
        </a>
    </div>
</div>

<!-- Mini‑script para conmutar pestañas (sin librerías externas) -->
<script>

</script>