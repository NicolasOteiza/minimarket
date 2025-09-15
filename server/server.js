const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const portApi = 3001;
const portBd = 3306;
const hosts = "sistemaventas.linkpc.net";
const users = 'ventas';
const pss = 'Anto3979';
const bds = 'minimarket';

// -----------------Crear la aplicación Express
const app = express();
app.use(express.json());
app.use(cors());

// -----------------Configurar la conexión a MySQL
const db = mysql.createConnection({
  host: hosts,
  user: users,
  password: pss, // Deja esto vacío si no configuraste una contraseña en XAMPP
  database: bds,
});

// -----------------Conectar a la base de datos
db.connect((err) => {
  if (err) {
    console.error('Error al conectarse a la base de datos', err);
  } else {
    console.log('Conectado a la base de datos MySQL.');//revisado
  }
});

// -----------------Crea un pool de conexiones
const pool = mysql.createPool({
  host: hosts,      // Dirección del servidor de base de datos
  user: users,      // Usuario de MySQL (generalmente 'root')
  password: pss,    // Contraseña (si no tienes, déjalo vacío)
  database: bds,    // Nombre de tu base de datos
  port: portBd,     // Puerto de conexión (por defecto es 3306)
});

// -----------------Verifica que la conexión a la base de datos sea exitosa
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error de conexión a la base de datos:', err);
  } else {
    console.log('Conexión exitosa a la base de datos.');//revisado
    console.log(users);//revisado
    console.log(bds);//revisado
    connection.release();  // Libera la conexión después de la verificación
  }
});

// -----------------Iniciar el servidor
app.listen(portApi, () => {
  console.log('El servidor se está ejecutando en el puerto ', portApi);//revisado
});

//---------------------------------------------------------------------------------
//----------------------Rutas del backend------------------------------------------

//----------------------------GETs-------------------------------------------------

// buscar todos los producto
app.get('/api/productos', (req, res) => {
  db.query('SELECT * FROM productos', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// -----------------buscar toda la informacion del local
app.get('/api/getInfo', (req, res) => {
  db.query('SELECT * FROM info', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// -----------------buscar todas las cajas del local
app.get('/api/getCajas', (req, res) => {
  db.query('SELECT * FROM cajas', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (results.length>0) {
      res.json(results);
    }else{
      res.json(0);
    }
  });
});

// buscar producto por codigo
app.get('/api/productos/code/:code', (req, res) => {
  const { code } = req.params;

  db.query('SELECT * FROM productos WHERE codigo_barras = ?', [code], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Base de datos error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(results[0]);
  });
});

// buscar producto por nombre
app.get('/api/productos/name/:name', (req, res) => {
  const { name } = req.params;

  db.query('SELECT * FROM productos WHERE name = ?', [name], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Base de datos error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(results[0]);
  });
});

// Devuelve la cantidad de dispositivos conectados
app.get('/api/devices', async (req, res) => {
  try {
    const [rows] = await pool.promise().query(
      'SELECT COUNT(user) AS connected FROM cajas'
    );
    console.log('Cajas conectadas al Servidor:', rows[0].connected);// ¿en desuso ?
    res.json({ connected: rows[0].connected }); // { connected: 5 }
  } catch (error) {
    console.error('Error al contar cajas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// devuelve el ultimo ticket del cajero en uso para cambio de numeracion en vista
app.get('/api/ultimo_ticket/cajero/:cajero', async (req, res) => {
  const { cajero } = req.params;
  var ultimo = "";
  console.log("id Cajero ", cajero[0]);//revisado
  try {
    const [rows] = await pool.promise().query(
      'SELECT MAX(numero_ticket) AS ultimo FROM ventas WHERE DATE(fecha) = CURDATE() and usuario_id = ?',
      [cajero[0]]
    );
    if (rows[0].ultimo == null) {
      ultimo = "0";
    }else{
      ultimo = rows[0].ultimo;
    }
    console.log('nº ultimo ticket:', ultimo);//revisado
    res.json({ ultimo: rows[0].ultimo }); // { connected: 5 }
  } catch (error) {
    console.error('Error al contar cajas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

//---------------------------POSTs-----------------------------------------------------

// -----------------Validacion de usuario
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Realizamos la consulta en la base de datos
    const result = await pool.promise().query(
      'SELECT * FROM usuarios WHERE user = ?',
      [username]
    );
    

    // Imprimimos el resultado completo para depuración

    // Asegúrate de que el resultado contiene datos
    const rows = result[0];  // El primer elemento de `result` es un array de filas

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    // Accedemos al primer usuario (ya que la consulta devuelve un array)
    const user = rows[0];
    console.log("usuario conectado: ", user.nombre);//revisado
    // Compara la contraseña ingresada con la almacenada en la base de datos
    if (user.contrasena !== password) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // Si la validación es exitosa, generamos un token ficticio
    const fakeToken = `token-${Date.now()}`;
    return res.json({ message: 'Login exitoso', token: fakeToken, id: user.id, username: user.nombre });

  } catch (error) {
    console.error('Error durante el login:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ingresar producto
app.post('/api/productos', async (req, res) => {
  const {
    codigo_barras,
    descripcion,
    formato_venta,
    costo,
    ganancia,
    precio_venta,
    precio_mayoreo,
    utiliza_inventario,
    cantidad_actual,
    cantidad_minima,
    cantidad_maxima,
    departamento,
  } = req.body;

  console.log("informacion producto para agregar a bd: ", req.body)//revisado
  
  try {

    // Obtener el id del formato de venta
    const [formatoRows] = await pool.promise().query(
      'SELECT id_formato FROM formato_venta WHERE descripcion = ?',
      [formato_venta]
    );


    if (formatoRows.length === 0) {
      console.log(res.status(400).json({ message: 'Formato de venta no válido' }));//revisado
      return res.status(400).json({ message: 'Formato de venta no válido' });
    }
    const id_formato = formatoRows[0].id_formato;
    

    // Obtener el id del departamento
    const [departamentoRows] = await pool.promise().query(
      'SELECT id_departamento FROM departamento WHERE nombre = ?',
      [req.body.departamento]
    );
    if (departamentoRows.length === 0) {
      return res.status(400).json({ message: 'Departamento no válido' });
    }
    const id_departamento = departamentoRows[0].id_departamento;

    // Insertar el producto en la base de datos
    await pool.promise().query(
      `INSERT INTO productos (
              codigo_barras, descripcion, id_formato, costo, ganancia, precio_venta, 
              precio_mayoreo, utiliza_inventario, cantidad_actual, cantidad_minima, 
              cantidad_maxima, id_departamento
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo_barras,
        descripcion,
        id_formato,
        costo,
        ganancia,
        precio_venta,
        precio_mayoreo,
        utiliza_inventario,
        cantidad_actual,
        cantidad_minima,
        cantidad_maxima,
        id_departamento,
      ]
    );

    res.status(201).json({ message: 'Producto añadido exitosamente' });

  } catch (error) {
    //console.error('Error al añadir producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ----------------conecta un nuevo usuario al sistema
app.post('/api/connect', async (req, res) => {

  const { numero_caja,user_id} = req.body;                
          
  try {
    await pool.promise().query(
      'INSERT INTO conectados (caja_conectada,estado,user_id,fecha_conexion,hora_conexion) '+
      'VALUES (?,?,?,current_date(),current_time())',
      [numero_caja, true, user_id]     // id es AUTO_INCREMENT
    );
    //guarda el numero de la caja
    res.json({ message: 'Nuevo usuario registrado'});
  } catch (error) {
    console.error('Error al insertar caja:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ---------------desconecta un usuario del sistema
app.post('/api/disconnect', async (req, res) => {
  const { numero_caja,user_id} = req.body;                
          
  try {
    await pool.promise().query(
      'INSERT INTO conectados (caja_conectada,estado,user_id,fecha_conexion,hora_conexion) '+
      'VALUES (?,?,?,current_date(),current_time())',
      [numero_caja, false,user_id]                                // id es AUTO_INCREMENT
    );
    //guarda el numero de la caja
    res.json({ message: 'Usuario desconectado'});
  } catch (error) {
    console.error('Error al insertar caja:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ---------------consulta por un usuario conectado al sistema
app.post('/api/getconnect', async (req, res) => {

  const { numero_caja,user_id} = req.body;      
  let mensaje ="";          
          
  try {
    //consulta la conexion de la caja y el usuario en el dia
    const [conexion] = await pool.promise().query(
      `SELECT COUNT(id_conectado) AS conexion_activa FROM conectados `+
      `WHERE caja_conectada = ${numero_caja} AND user_id = ${user_id} `+
      `AND fecha_conexion = CURRENT_DATE() AND estado = 1`
    );
    //consulta la desconexion de la caja y el usuario en el dia
    const [user_estado] = await pool.promise().query(
      `SELECT estado_usuario FROM usuarios WHERE id = ${user_id} `
    );
    if(user_estado[0].estado_usuario == 0){
      // usuario desconectado
      console.log(`usuario desconectado valor: ${user_estado[0].estado_usuario}`);//revisado
      mensaje ="usuario desconectado,";
    }
    if(user_estado[0].estado_usuario == 1){
      // usuario conectado
      console.log(`usuario conectado valor: ${user_estado[0].estado_usuario}`);//revisado
      mensaje ="usuario conectado,";

    }
    if(conexion[0].conexion_activa == 1){
      // usuario desconectado
      console.log(`conexion creada valor: ${conexion[0].conexion_activa}`);//revisado
      mensaje = mensaje +" conexion creada";
    }
    if(conexion[0].conexion_activa == 0){
      // usuario desconectado
      console.log(`conexion no existe valor: ${conexion[0].conexion_activa}`);//revisado
      mensaje = mensaje +" conexion no existe";
    }
    //guarda el numero de la caja
    res.json({ message: mensaje});
  } catch (error) {
    console.error('Error al consultar caja:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ---------------almacena los datos de la venta y guarda un registro de cada producto por venta
app.post('/api/sales', async (req, res) => {
    const { numero_ticket, cajero, numero_caja, metodo_pago, producto } = req.body;
  const idVenta=0;
    if (!numero_ticket || !cajero || !numero_caja || !metodo_pago ) {
      return res.status(400).json({ error: 'Datos incompletos o inválidos' });
    }
    try {
        
      let total = 0;
        for (const p of producto) {
          total = total + (p.precio_venta * p.quantity);
          
        }

        const [result] = await pool.promise().query(
          'INSERT INTO ventas (fecha, numero_ticket, usuario_id, metodo_pago, caja_id, total)'+
           ' VALUES (now(), ?, ?, ?, ?, ?)',
            [numero_ticket, cajero, metodo_pago, numero_caja, total]
        );

        const idVenta = result.insertId;
        console.log(producto);
        console.log(idVenta);
        for (const p of producto) {
          console.log(p);
            await pool.promise().query(`
                INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?)`,
                [idVenta, p.id_producto, p.quantity, p.precio_venta, p.precio_venta * p.quantity]
            );
        }

        
        res.json({ success: true });
    } catch (err) {
        
        console.error(err);
        res.status(500).json({ error: 'Error al registrar la venta' });
    }
});

// ---------------almacena la informacion del local con los permisos para el sistema
app.post('/api/addInfo', async (req, res) => {
  const { nombre_local, 
          telefono_local,
          mail_local,
          tipo_local,
          inventario,
          credito,
          producto_comun,
          margen_ganancia,
          monto_ganancia,
          redondeo,
          monto_redondeo,
          mensaje,
          data_mensaje,
          time_mensaje} = req.body;

  console.log("informacion local para agregar a bd: ", req.body);//revisado

  
  try{
    await pool.promise().query(`INSERT INTO info (nombre, telefono, mail, tipo_local, inventario,credito,
        producto_comun,margen_ganancia,monto_ganancia,redondeo,monto_redondeo,
        mensaje,data_mensaje,time_mensaje)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nombre_local, telefono_local, mail_local, tipo_local, inventario,
          credito, producto_comun, margen_ganancia, monto_ganancia,
          redondeo, monto_redondeo, mensaje, data_mensaje, time_mensaje]
    );
    res.json({ success: true });
  }catch (err){
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la información del local' });
  }

  });

// ---------------almacena el munero de la caja y su estado activada/desactivada
app.post('/api/addCaja', async (req, res) => {
  const { numero_caja, nombre_caja, estado} = req.body;
  console.log("informacion caja para agregar a bd: ",req.body);//revisado

  if (!numero_caja || !nombre_caja || !estado ) {
      return res.status(400).json({ error: 'Datos incompletos o inválidos' });
    }
  try{
    await pool.promise().query(`
        INSERT INTO cajas (n_caja, nombre_caja, estado )
        VALUES (?, ?, ?)`,
        [numero_caja, nombre_caja, estado]
    );
    res.json({ success: true });
  }catch (err){
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la caja nueva del local' });
  }

  });

//----------------------------PUTs----------------------------------------------------

// actualiza producto por ID
app.put('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, quantity } = req.body;
  db.query('UPDATE productos SET name = ?, price = ?, quantity = ? WHERE id = ?', [name, price, quantity, id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Product updated' });
  });
});

// actualiza producto por codigo
app.put('/api/productos/:code', (req, res) => {
  const { code } = req.params;
  const { name, price, quantity } = req.body;

  db.query(
    'UPDATE productos SET name = ?, price = ?, quantity = ? WHERE id = ?',
    [name, price, quantity, code],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Base de datos error' });
      }
      res.json({ message: 'Product updated successfully' });
    }
  );
});

// ----------------actualiza estado de usuario por ID
app.put('/api/updateUser/', (req, res) => {
  
  const {id, estado_usuario} = req.body;

  console.log("informacion usuario para actualiza estado a bd: ", req.body);//revisado
  db.query(`UPDATE usuarios SET estado_usuario = ${estado_usuario} WHERE id = ${id}`, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'estado del usuario actualizado' });
  });
});
//--------------------------DELETEs--------------------------------------------------

// elimina producto por ID
app.delete('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM productos WHERE id = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Product deleted' });
  });
});

// elimina producto por codigo
app.delete('/api/productos/:code', (req, res) => {
  const { code } = req.params;

  db.query('DELETE FROM productos WHERE code = ?', [code], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Base de datos error' });
    }
    res.json({ message: 'Product deleted successfully' });
  });
});

//------------------------------USEs-----------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});

