<?php require('./layout/header.php'); ?>

<main class="main-content">

    <section id="sales">
        <?php require('./content/ventas.php'); ?>
    </section>
    <section id="credit" class="hidden">
        <?php require('./content/creditos.php'); ?>
    </section>
    <section id="client" class="hidden">
        <?php require('./content/clientes.php'); ?>
    </section>
    <section id="product" class="hidden">
        <?php require('./content/productos.php'); ?>
    </section>
    <section id="inventory" class="hidden">
        <?php require('./content/inventario.php'); ?>
    </section>
    <section id="shopping" class="hidden">
        <?php require('./content/compras.php'); ?>
    </section>
    <section id="configuration" class="hidden">
        <?php require('./content/configuracion.php'); ?>
    </section>
    <section id="invoice" class="hidden">
        <?php require('./content/facturas.php'); ?>
    </section>
    <section id="cut" class="hidden">
        <?php require('./content/corte.php'); ?>
    </section>
    <section id="reports" class="hidden">
        <?php require('./content/reportes.php'); ?>
    </section>

    <p id="logout-msg" style="display:none;">Cerrando sesión…</p>
</main>

<?php require('./layout/footer.php'); ?>