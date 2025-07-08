<?php require('./layout/header.php') ?>
        <!-- Sección de Ventas -->
        <section id="sales"  class="hidden" >
            <?php require('./content/ventas.php') ?>
        </section>
        <!-- Sección de creditos -->
        <section id="credit" class="hidden">
            <?php require('./content/creditos.php') ?>
        </section>
        <!-- Sección de clentes -->
        <section id="client" class="hidden">
            <?php require('./content/clientes.php') ?>
        </section>
        <!-- Sección de productos -->
        <section id="product" class="hidden">
            <?php require('./content/productos.php') ?>
        </section>
        <!-- Sección de Inventario -->
        <section id="inventory" class="hidden">
            <?php require('./content/inventario.php') ?>
        </section>
        <!-- Sección de compras -->
        <section id="shopping" class="hidden">
            <?php require('./content/compras.php') ?>
        </section>
        <!-- Sección de configuracion -->
        <section id="configuration">
            <?php require('./content/configuracion.php') ?>
        </section>
        <!-- Sección de facturacion -->
        <section id="invoice" class="hidden">
            <?php require('./content/facturas.php') ?>
        </section>
        <!-- Sección de corte -->
        <section id="cut" class="hidden">
            <?php require('./content/corte.php') ?>
        </section>
        <!-- Sección de Reportes -->
        <section id="reports" class="hidden">
            <?php require('./content/reportes.php') ?>
        </section>
    <?php require('./layout/footer.php')?>