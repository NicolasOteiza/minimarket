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
    <h2 class="h2-ext">FORMA DE PAGO</h2>
    <div class="sub">
        <div class="content">
            <table>
                <tr>
                    <td class="centrar" style="width: 80px;">
                        <img class="img-ext" src="../img/efectivo1.png" alt="">
                    </td>
                    <td>
                        <b>Efectivo</b>
                        <br>
                        <label>
                            <input type="checkbox" name="" id=""> 
                            No permitir cobrar si el efectivo ingresado es 
                            menor que el total de la venta.
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="centrar" style="width: 80px;">
                        <img class="img-ext" src="../img/dolar.png" alt="">
                    </td>
                    <td>
                        <b>Dólares Americanos</b>
                        <br>
                        <label>
                            <input type="checkbox" name="" id=""> 
                            Deseo habilitar el cobro en Dólar 
                            Americanos.
                        </label>
                        <p>
                            Al habilitarlo podrás realizar el cobro en dólares, 
                            el tipo de cambio te es preguntado cada vez que inicia 
                            el programa o lo puedes modificar en el recuadro.
                        </p>
                        tipo de cambio: <input type="text" name="" id="">
                        <button>Modificar</button>
                    </td>
                </tr>
                <tr>
                    <td class="centrar" style="width: 80px;">
                        <img class="img-ext" src="../img/tarjeta-credito.png" alt="">
                    </td>
                    <td>
                    <b>Tarjeta de crédito</b>
                        <br>
                        <label>
                            <input type="checkbox" name="" id=""> 
                            Deseo habilitar el cobro con tarjeta de Crédito/ 
                            Débito.
                        </label>
                        <p>
                            Al habilitar podrás registrar el pago de la venta 
                            con targeta y obtener el reporte de ingresos que 
                            tuviste con esta forma de pago en el corte del día.
                        </p>
                        <label>
                            <input type="checkbox" name="" id=""> 
                            cobrar comisión por cobro con tarjeta del 
                            <input type="text" name="" id=""> %
                        
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="centrar" style="width: 80px;">
                        <img class="img-ext" src="../img/transferencia.png" alt="">
                    </td>
                    <td>
                        <b>Transferencias Bancarias</b>
                        <br>
                        <label>
                            <input type="checkbox" name="" id=""> 
                            Deseo habilitar cobro con transferencia.
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="centrar" style="width: 80px;">
                        <img class="img-ext" src="../img/cheque.png" alt="">
                    </td>
                    <td>
                    <b>Cheque</b>
                        <br>
                        <label>
                            <input type="checkbox" name="" id=""> 
                            Deseo habilitar cobro con cheque.
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="centrar" style="width: 80px;">
                        <img class="img-ext" src="../img/vale.png" alt="">
                    </td>
                    <td>
                        <b>Vales de promociones</b>
                        <br>
                        <label>
                            <input type="checkbox" name="" id=""> 
                            Deseo habilitar cobro con Vales promocionales.
                        </label>
                    </td>
                </tr>
                <tr>
                    <td class="centrar" style="width: 80px;">
                        <img class="img-ext" src="../img/mixto.png" alt="">
                    </td>
                    <td>
                        <b>Pago Mixto</b>
                        <br>
                        <label>
                            <input type="checkbox" name="" id=""> 
                            Deseo habilitar cobro con Varias formas de pago (mixto).
                        </label>
                        <p>
                            Al habilitar esta opción podrás cobrar con varias formas 
                            de pago en una sola venta, por ejemplo: efectivo y tarjeta.
                        </p>
                    </td>
                </tr>
            </table>
        <button  onClick="close_w()" class="btn" > Cerrar</button>
        </div>
    </div>

    
</body>

</html>