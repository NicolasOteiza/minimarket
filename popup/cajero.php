<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuración</title>
    <link rel="stylesheet" href="../css/root.css">
    <link rel="stylesheet" href="../css/popUpStyle.css">

</head>

<body class="popup-body">
    <h2 class="h2-ext">CAJEROS</h2>

    <div class="sub">
        <div class="content popup-container">
            <div class="popup-toolbar">
                <input type="text" placeholder="Buscar..." class="input-buscar">
                <button class="btn" onClick="showNewCajero(1)" id="toggleButton" name="toggleButton">Nuevo Cajero</button>
                <button class="btn hidden" onClick="showNewCajero(0)" id="guardarButton" name="guardarButton">Guardar Cajero</button>
                <button class="btn">Dar de Baja Cajero</button>
            </div>

            <table class="tabla-cajeros">
                <tr>
                    <td class="td-lista">
                        <div class="contenedor-lista">
                            <table class="tabla-lista">
                                <thead>
                                    <tr>
                                        <th class="centrar">
                                            <p>Img</p>
                                        </th>
                                        <th class="centrar">
                                            <p>Nombre del Cajero</p>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr class="color1">
                                        <td class="centrar"><img class="img-user" src="../img/usuario.png" alt=""></td>
                                        <td>
                                            <p>Nicolas Oteiza</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="centrar"><img class="img-user" src="../img/usuario.png" alt=""></td>
                                        <td>
                                            <p>Nicolas Oteiza</p>
                                        </td>
                                    </tr>
                                    <tr class="color1 centrar">
                                        <td class="centrar"><img class="img-user" src="../img/usuario.png" alt=""></td>
                                        <td>
                                            <p>Nicolas Oteiza</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </td>

                    <td class="td-formulario">
                        <div class="formulario-wrapper">
                            <table class="tabla-formulario hidden" id="id-tablaNewCajero" name="id-tablaNewCajero">
                                <thead>
                                    <tr>
                                        <th colspan="2">
                                            <h3>Nuevo Cajero</h3>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="txt-left"><label>Usuario</label></td>
                                        <td><input type="text" class="input-campo"></td>
                                    </tr>
                                    <tr>
                                        <td class="txt-left"><label>Nombre Completo</label></td>
                                        <td><input type="text" class="input-campo"></td>
                                    </tr>
                                    <tr>
                                        <td class="txt-left"><label>Contraseña</label></td>
                                        <td><input type="password" class="input-campo"></td>
                                    </tr>
                                    <tr>
                                        <td class="txt-left"><label>Confirmar Contraseña</label></td>
                                        <td><input type="password" class="input-campo"></td>
                                    </tr>
                                    <tr>
                                        <td colspan="2">
                                            <div class="div-tab">
                                                <?php require('../popup/tab-option-cajero/permisos_cajeros.php') ?>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>

            <div class="popup-footer">
                <button onClick="close_w()" class="btn">Cerrar</button>
            </div>
        </div>
    </div>
    <script src="../js/functions.js"></script>
</body>

</html>