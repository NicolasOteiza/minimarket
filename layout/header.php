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
    <link rel="stylesheet" href="./css/popup.css?v=20260220a">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

</head>

<body>
    <!-- ======= HEADER ======= -->
    <header class="header">
        <div class="header-brand">
            <img id="header-business-logo" src="" alt="Logo" class="header-logo hidden">
            <h3 id="header-business-name">Minimarket</h3>
        </div>

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
            <button id="nav-sales-btn" class="btn" onclick="showSection('sales')"> <i class="fas fa-shopping-cart"></i> F1 Ventas</button>
            <!--<button class="btn" onclick="showSection('credit')">       <i class="fas fa-credit-card"></i> Créditos</button>
            <button class="btn" onclick="showSection('client')">       <i class="fas fa-user-friends"></i> Clientes</button>-->
            <button id="nav-product-btn" class="btn" onclick="showSection('product')"> <i class="fas fa-box-open"></i> F2 Productos</button>
            <button id="nav-inventory-btn" class="btn" onclick="showSection('inventory')"> <i class="fas fa-warehouse"></i> Inventario</button>
            <button id="nav-shopping-btn" class="btn" onclick="showSection('shopping')"> <i class="fas fa-shopping-cart"></i> Compras</button>
            <button id="nav-configuration-btn" class="btn" onclick="showSection('configuration')"><i class="fas fa-cog"></i> Configuración</button>
            <!--<button class="btn" onclick="showSection('invoice')">      <i class="fas fa-file-invoice"></i> Facturas</button>-->
            <button id="nav-cut-btn" class="btn" onclick="showSection('cut')"> <i class="fas fa-scissors"></i> Corte</button>
            <button id="nav-reports-btn" class="btn" onclick="showSection('reports')"> <i class="fas fa-chart-line"></i> Reportes</button>
            <button class="btn" id="logout"> <i class="fas fa-sign-out-alt"></i></button>
        </nav>
    </aside>
