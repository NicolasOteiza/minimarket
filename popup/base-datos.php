<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuración</title>
    <link rel="stylesheet" href="../css/popUpstyle.css">

    <script src="../js/functions.js"></script>
</head>

<body>
    <h2 class="h2-ext">BASE DE DATOS</h2>
    <div class="sub">
        <div class="content">
            <b>Exportar base de datos</b>
            <p>si cuentas con otro negocio con este punto de venta, esta
                opción permite exportar la base de datos y permitir re-usar
                los productos de la base de datos actual
            </p>
            <p>NOTA: se exportará la base de datos con los productos con
                inventario ilimitado, los mismos departamentos y únicamente
                con el usuario administrador (no se transfieren cantidades
                en inventario, cajeros adicionales, clientes, ni ventas)
            </p>
            <table style="width: 500px; border-style:none;">
                <tr>
                    <td class="td-ext">
                        <button onClick="close_w()" class="btn btn-ext">Exportar la base de datos</button>
                    </td>
                </tr>
                <tr>
                    <td colspan="2" class="td-ext">
                        <b>Soporte de base de datos (solo distribuidores y usuarios avanzados)</b>
                    </td>
                <tr>
                    <td class="td-ext">
                        <button onClick="close_w()" class="btn btn-ext">Verificar base de datos</button>
                    </td>
                    <td class="td-ext">
                        <button onClick="close_w()" class="btn btn-ext">Leer archivo de mantemiento</button>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext">
                        <button onClick="close_w()" class="btn btn-ext"> Reiniciar la base de datos</button>
                    </td>
                    <td class="td-ext">
                        <button onClick="close_w()" class="btn btn-ext"> Rotar base de datos</button>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext">
                        <button onClick="close_w()" class="btn btn-ext">Enviar archivos de diagnosticos</button>
                    </td>

                </tr>
            </table>

            <button onClick="close_w()" class="btn"> Cerrar</button>
        </div>
    </div>
</body>

</html>