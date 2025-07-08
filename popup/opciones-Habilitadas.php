<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OPCIONES HABILITADAS</title>
    <link rel="stylesheet" href="../css/popUpStyle.css">

    <script src="../js/functions.js"></script>
</head>

<body>
    <h2 class="h2-ext">OPCIONES HABILITADAS </h2>


    <div class="sub">
        <div class="content">
            <table>
                <tr>
                    <td class="td-ext" style="padding-top: 15px;">
                        <label>
                            <input class="checkbox" type="checkbox" name="utiliza_inv">
                            <b>Utilizar inventarios para mis productos.</b>
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext">
                        <p style="margin-left:50px;">
                            Si usas Inventario, tus productos tendran cantidades limitadas
                            en venta y podrás llevar un control de cuanto tienes, cuando
                            y cuanto se vende.
                        </p>
                        <p style="margin-left:50px;">Si actualmente no usas inventario, puedes no usarlo
                            y posteriormente activalro.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td  class="td-ext" style="padding-top: 15px;">
                        <label>
                            <input class="checkbox" type="checkbox" name="utiliza_inv">
                            <b>Deseo ofrecer crédito a mis clientes.</b>
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext">
                        <p style="margin-left:50px;">
                            Activa esta opcion para dar de alta clientes y poder ofrecer
                            ventas a credito, recibir abonos y liquidar su adeudo.
                        </p>
                    </td>

                </tr>
                <tr>
                    <td class="td-ext" style="padding-top: 15px;">
                        <label>
                            <input class="checkbox" type="checkbox" name="utiliza_inv">
                            <b>Habilitar venta de producto común.</b>
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext">
                        <p style="margin-left:50px;">
                            desea activar la opción de venta de "Producto Común", con
                            la cual puedes vender articulos que NO entán en la base de
                            datos al momento de hacer una venta, por ejemplo: chicles,
                            dulces, articulos esporadicos, etc.
                        </p>
                    </td>

                </tr>
                <tr>
                    <td class="td-ext" style="padding-top: 15px;">
                        <label>
                            <input class="checkbox" type="checkbox" name="utiliza_inv">
                            <b>Calcular automaticamente el precio de venta con el margen
                            de ganancia del</b>
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext">
                        <label>
                            <input style="width: 40px; margin-left:50px; margin-right:10px; text-align: center;" type="number" name="margen-ganancia" id="id-margen-ganancia" value="30">
                            Activa esta opcion para dar de alta clientes y poder ofrecer
                            ventas a credito, recibir abonos y liquidar su adeudo.
                            
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext" style="padding-top: 15px;">
                        <label>
                            <input class="checkbox" type="checkbox" name="utiliza_inv">
                            <b> Habilitar redondeo a cantidades cerradas.</b>
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext">
                        <select style="margin-left:50px; width:600px;" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                            <option value="0">Sin redondeo</option>
                            <option value="1">Redondeo a 1</option>
                            <option value="5">Redondeo a 5</option>
                            <option value="10">Redondeo a 10</option>
                            <option value="50">Redondeo a 50</option>
                            <option value="100">Redondeo a 100</option>
                        </select>
                    </td>

                </tr>
                <tr>
                    <td class="td-ext" style="padding-top: 15px;">
                        <label>
                            <input class="checkbox" type="checkbox" name="utiliza_inv">
                            <b> Mensajes de Contingencias</b>
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="td-ext">
                        <label style="margin-left:50px;">
                            Mostrar aviso:   
                            <input type="text" 
                            name="mensaje-contingencia" 
                            id="id-mensaje-contingencia"
                            style="width: 300px;">
                        </label>
                        <label>
                            cada:
                            <input type="number" 
                            name="tiempo-mensaje-contingencia" 
                            id="id-tiempo-mensaje-contingencia"
                            style="width:40px"
                            value="5">
                            ventas cobradas.
                        </label>
                    </td>

                </tr>
                <tr>
                    <td class="td-ext">
                        <button class="btn" onclick="close_w()" style="width: 250px; margin-top: 20px; font-size:16px;"><b>Guardar configuración</b></button>
                    </td>
                </tr>
            </table>
        </div>
    </div>

</body>

</html>