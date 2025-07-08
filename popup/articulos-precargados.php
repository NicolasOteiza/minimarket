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
    <h2 class="h2-ext">ARTICULOS PRECARGADOS </h2>
        
    <div class="sub">
        <div class="content">
            <label>
                <input type="checkbox"> Deseo activar esta 
                base de datos de mas de 7500 productos
            </label>
            <p>Al activar esta opción, cada vez que des de 
                alta un producto, se buscará en esta base 
                de datos, al ser encontrado te incluirá la 
                descripción donde tu solo ingresas el precio,
                ahorra tiempo de aptura de esta información.
            </p>
            <img style="width:400px; height: 400px;margin-top:20px; margin-left:80px;" src="../img/precargados.png" alt="Articulos precargados" style="width: 100%;">
            <br>
            <button  onClick="close_w()" class="btn" > Cerrar</button>
        </div>
    </div>
</body>

</html>