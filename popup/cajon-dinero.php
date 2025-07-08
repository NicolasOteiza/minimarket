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
    <h2 class="h2-ext">CAJON / GAVETA DE DINERO</h2>
        <div class="sub">
            <div class="content">
                <P>
                    Por favor elige el modelo de impresora a la cual esta 
                    conectado el cajón / gaveta de dinero:
                </P>
                <select class="text-left" style="width:250px;" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                    <option value="0">- Ninguno -</option>
                </select>
                <select class="text-left" style="width:60px;" name="formato-cantidad-cerrada" id="id-formato-cantidad-cerrada">
                    <option value="0">LPT!</option>
                </select>
                <br>
                <br>
                <button class="btn-icon"><img src="../img/cajero-automatico.png" alt=""> Probar Apertura de Cajón</button>
                <br>
                <br>
                <button  onClick="close_w()" class="btn" > Cerrar</button>
            </div>
        </div>
</body>

</html>