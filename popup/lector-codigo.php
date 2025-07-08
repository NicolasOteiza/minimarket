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
    <h2 class="h2-ext">LECTOR DE CÓDIGOS DE BARRA</h2>
    <div class="sub">
        <div class="content">
            <p>
                Si cuentas con un lector de códigos de barra 
                con emulación de teclado, no es necesario que 
                configures el lector, simplemente conéctalo a 
                tu computadora y funcionará.
            </p>
            <p>
                Si por otro lado, cuentas con un lector de 
                códigos de barras con conexión a puerto serial 
                (RS232), puedes activarlo en la siguiente opción.
            </p>
            <label>
                <input type="checkbox" id="toggleCheckbox">
                Utilizo un lector de código de barras serial
            </label>
            <br>
            <div id="serialSettings" class="hidden">
                <table class="table-medium">
                    <tr>
                        <td class="td-ext"><p class="p-ext">Puerto:</p></td>
                        <td class="td-ext">
                            <select class="p-ext text-left" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                                <option value="0">Sin Puerto Disponible</option>
                            </select>
                        </td>
                        <td class="td-ext"><p class="p-ext text-ligth">(Port)</p></td>
                    </tr>
                    <tr>
                        <td class="td-ext"><p class="p-ext">Bits por segundo:</p></td>
                        <td class="td-ext">
                            <select class="p-ext text-left" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                                <option value="0">9600</option>
                                <option value="1">8400</option>
                                <option value="2">7200</option>
                            </select>
                        </td>
                        <td class="td-ext"><p class="p-ext text-ligth">(Bits per second / Baudrate)</p></td>
                    </tr>
                    <tr>
                        <td class="td-ext"><p class="p-ext">Bits de datos:</p></td>
                        <td class="td-ext">
                            <select class="p-ext text-left" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                                <option value="0">9</option>
                                <option value="1">8</option>
                                <option value="2">7</option>
                            </select>
                        </td>
                        <td class="td-ext"><p class="p-ext text-ligth">(Data Bits)</p></td>
                    </tr>
                    <tr>
                        <td class="td-ext"><p class="p-ext">Paridad:</p></td>
                        <td class="td-ext">
                            <select class="p-ext text-left" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                                <option value="0">None</option>
                            </select>
                        </td>
                        <td class="td-ext"><p class="p-ext text-ligth">(Parity)</p></td>
                    </tr>
                    <tr>
                        <td class="td-ext"><p class="p-ext">Bits de parada:</p></td>
                        <td class="td-ext" >
                            <select class="text-left" style="width:60px;" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                                <option value="0">1</option>
                                <option value="1">2</option>
                                <option value="2">3</option>
                                <option value="3">4</option>
                                <option value="4">5</option>
                                <option value="5">6</option>
                            </select>
                        </td>
                        <td class="td-ext"><p class="p-ext text-ligth">(Stop bits)</p></td>
                    </tr>
                    <tr>
                        <td class="td-ext"><p class="p-ext">Control de flujo:</p></td>
                        <td class="td-ext">
                            <select class="p-ext text-left" onclick="" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                                <option value="0">Hardware</option>
                            </select></td>
                        <td class="td-ext"><p class="p-ext text-ligth">(Flow control)</p></td>
                    </tr>
                </table>
            </div>
            <button onClick="close_w()" class="btn">Cerrar</button>
        </div>
    </div>

    <script>
        // Función para alternar la visibilidad del div
        document.getElementById('toggleCheckbox').addEventListener('change', function() {
            const serialSettings = document.getElementById('serialSettings');
            if (this.checked) {
                serialSettings.classList.remove('hidden'); // Mostrar el div
            } else {
                serialSettings.classList.add('hidden'); // Ocultar el div
            }
        });
    </script>
</body>
</html>
