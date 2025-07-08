<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Ventas Minimarket</title>
    <link rel="stylesheet" href="./css/styles.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="./js/scripts.js"></script>
    <script src="./js/functions.js"></script>

</head>
<body>
    <header>
        <h3>Sistema de Ventas Minimarket</h3>
        <nav>
            <button onclick="showSection('sales')">Ventas</button>
            <button onclick="showSection('credit')">Créditos</button>
            <button onclick="showSection('client')">Clientes</button>
            <button onclick="showSection('product')">Productos</button>
            <button onclick="showSection('inventory')">Inventario</button>
            <button onclick="showSection('shopping')">Compras</button>
            <button onclick="showSection('configuration')">Configuración</button>
            <button onclick="showSection('invoice')">Facturas</button>
            <button onclick="showSection('cut')">Corte</button>
            <button onclick="showSection('reports')">Reportes</button>
            <button id="logout">Cerrar Sesión</button>
        </nav>
    </header>
    <main>