<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuración</title>
    <link rel="stylesheet" href="../css/popUpStyle.css">


    <script src="../js/functions.js"></script>
</head>

<body>
    <h2 class="h2-ext">CAJEROS</h2>
    <div class="sub">
        <div class="content">
            <input style="width: 420px; margin-right: 10px;" type="text" placeholder="Buscar...">
            <button class="btn" onClick="showNewCajero(1)" id="toggleButton" name="toggleButton">Nuevo Cajero</button>
            <button class="btn hidden" onClick="showNewCajero(0)" id="guardarButton" name="guardarButton">Guardar Cajero</button>
            <button class="btn">Dar de Baja Cajero</button>
            <table>
                <tr>
                    <td style="padding: 0px; margin: 0px; height: 450px; min-width: 30%;">
                        <div style="width: 100%; height:100%;">
                            <table style=" padding: 0px; margin: 0px;">
                                <th class="centrar"style="height: 20px;">
                                    <p> Img</p>
                                </th>
                                <th class="centrar" style="height: 20px;">
                                    <p>Nombre del Cajero</p>
                                </th>
                                <tr class="color1" style="height: 20px;">
                                    <td class="centrar">
                                        <img src="../img/usuario.png" alt="">
                                    </td>
                                    <td>
                                        <p>Nicolas Oteiza</p>
                                    </td>
                                </tr>
                                <tr style="height: 20px;">
                                    <td class="centrar">
                                        <img src="../img/usuario.png" alt="">
                                    </td>
                                    <td>
                                        <p>Nicolas Oteiza</p>
                                    </td>
                                </tr>
                                <tr class="color1 centrar" style="height: 20px;">
                                    <td class="centrar">
                                        <img src="../img/usuario.png" alt="">
                                    </td>
                                    <td>
                                        <p>Nicolas Oteiza</p>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </td>
                    <td style="padding: 0px; margin: 0px; height: 450px; width: 70%;">
                        <div>
                            <table class="hidden" id="id-tablaNewCajero" name="id-tablaNewCajero">
                                <th colspan="2" >
                                    <h3>NUEVO CAJERO</h3>
                                </th>
                                <tr>
                                    <td class="txt-left">
                                        <label>Usuario</label>
                                    </td>
                                    <td>
                                        <input type="text" style="width: 200px;">
                                    </td>
                                </tr>
                                <tr>
                                    <td class="txt-left">
                                        <label>Nombre Completo</label>
                                    </td>
                                    <td>
                                        <input type="text" style="width: 200px;">
                                    </td>
                                </tr>
                                <tr>
                                    <td class="txt-left">
                                        <label>Contraseña</label>
                                    </td>
                                    <td>
                                        <input type="text" style="width: 200px;">
                                    </td>
                                </tr>
                                <tr>
                                    <td class="txt-left">
                                        <label>Confirmar Contraseña</label>
                                    </td>
                                    <td>
                                        <input type="text" style="width: 200px;">
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" >
                                        <div  class="div-tab">
                                            <?php require('../popup/tab-option-cajero/permisos_cajeros.php') ?>
                                        </div>
    
                                    </td>
                                </tr>
                                
                            </table>
                        </div>

                        
                    </td>
                </tr>
            </table>
            <button onClick="close_w()" class="btn"> Cerrar</button>
        </div>
    </div>
    
    
</body>

</html>