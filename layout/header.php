<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Ventas - Minimarket</title>

    <!-- Único CSS optimizado -->
    <link rel="stylesheet" href="./css/root.css">
    <link rel="stylesheet" href="./css/styleshome.css">
    <link rel="stylesheet" href="./css/panel.css">
    <link rel="stylesheet" href="./css/popup.css">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

</head>

<body>
    <!-- ======= HEADER ======= -->
    <header class="header">
        <h3>Minimarket</h3>

        <!-- Controles: modo oscuro y hamburguesa -->
        <div class="menu-controls">
            <button id="toggle-theme" class="theme-toggle" aria-label="Toggle dark mode"> 🌙</button>

            <button id="menu-toggle" class="menu-toggle" title="Menú">
                <i class="fas fa-bars"></i>
            </button>
        </div>
    </header>

    <!-- ======= SIDEBAR / NAV ======= -->
    <aside id="sidebar">
        <nav id="main-menu" class="nav-menu collapsed"><!-- «collapsed» se quita vía JS -->
            <button class="btn" onclick="showSection('sales')"> <i class="fas fa-shopping-cart"></i> Ventas</button>
            <!--<button class="btn" onclick="showSection('credit')">       <i class="fas fa-credit-card"></i> Créditos</button>
            <button class="btn" onclick="showSection('client')">       <i class="fas fa-user-friends"></i> Clientes</button>-->
            <button class="btn" onclick="showSection('product')"> <i class="fas fa-box-open"></i> Productos</button>
            <button class="btn" onclick="showSection('inventory')"> <i class="fas fa-warehouse"></i> Inventario</button>
            <button class="btn" onclick="showSection('shopping')"> <i class="fa-truck"></i> Compras</button>
            <button class="btn" onclick="showSection('configuration')"><i class="fas fa-cog"></i> Configuración</button>
            <!--<button class="btn" onclick="showSection('invoice')">      <i class="fas fa-file-invoice"></i> Facturas</button>-->
            <button class="btn" onclick="showSection('cut')"> <i class="fas fa-scissors"></i> Corte</button>
            <button class="btn" onclick="showSection('reports')"> <i class="fas fa-chart-line"></i> Reportes</button>
            <button class="btn" id="logout"> <i class="fas fa-sign-out-alt"></i></button>
        </nav>
    </aside>