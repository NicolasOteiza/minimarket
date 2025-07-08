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
    <h2 class="h2-ext">IMPRESORA</h2>
       <div class="sub">
        <div class="content">
            <p>
                Por favor elige la impresora de ticket
                entre las impresoras instaladas en tu sistema: 
            </p>
            <p>Impresora de tickets:</p>
            <input style="width: 500px;" type="text" name="" id="">
            <p>
                fuente de impresión Normal
            </p>
            <input style="width: 400px;" type="text" name="" id="">
            <input style="width: 90px; text-align: center" type="number" name="" id="" value="20">

            <p>
                Columnas
            </p>
            <input style="width: 60px;text-align: center" type="number" name="" id="" value="20">
            <br>
            <br>
            <label>
                <input type="checkbox" name="" id="">
                Usar fuente "normal" para totales 
            </label>
            <br>
            <label>
                <input type="checkbox" name="" id="">
                poner todas las letras Negritas 
            </label>
            <br>
            <button  onClick="close_w()" class="btn" > Cerrar</button>
        </div>
       </div> 

    
</body>

</html>