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
    <h2 class="h2-ext">CORTE</h2>
        <div class="sub">
            <div class="content">
                <p>
                    Elije la forma en que deseas que el programa actúe
                    cuando tus cajeros cierren su turno:
                </p>
                <label>
                    <input type="radio" name="corte" id="id-corte">
                    Solicitar dinero esperando en caja y realizar ajustes
                    automáticos si existe alguna diferencia.
                </label>
                <p>
                    Por ejemplo si el dinero esperado en caja es de $1000,
                    y el cajero ingresa $800, el programa creará una salida 
                    por faltante de efectivo de $200 pesos asignada al cajero,
                    de igual manera en caso de que el efectivo sea mayor al 
                    esperado se creará un movimiento de entrada de efectivo.
                </p>
                <img class="img-large " src="../img/cajero-automatico.png" alt="">
                <br>
                <label>
                    <input type="radio" name="corte" id="id-corte">
                    No solicitar dinero en caja ni realizar ningun tipo de ajustes
                    automáticos. 
                </label>
                <p>
                    Por ejemplo si el dinero esperado en caja es de $1000,
                    y el cajero ingresa $800, el programa creará una salida 
                    por faltante de efectivo de $200 pesos asignada al cajero,
                    de igual manera en caso de que el efectivo sea mayor al 
                    esperado se creará un movimiento de entrada de efectivo.
                </p>
                <img class="img-large " src="../img/cajero-automatico.png" alt="">
                <br>
                <button  onClick="close_w()" class="btn" > Cerrar</button>
            </div>
        </div>

    
</body>

</html>