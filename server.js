const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const port = 3001;

// Crear la aplicación Express
const app = express();
app.use(express.json());
app.use(cors());

// Configurar la conexión a MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Deja esto vacío si no configuraste una contraseña en XAMPP
  database: 'minimarket',
});

// Conectar a la base de datos
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to the MySQL database.');
  }
});

// Crea un pool de conexiones
const pool = mysql.createPool({
  host: 'localhost',      // Dirección del servidor de base de datos
  user: 'root',           // Usuario de MySQL (generalmente 'root')
  password: '',           // Contraseña (si no tienes, déjalo vacío)
  database: 'minimarket', // Nombre de tu base de datos
  port: 3306,             // Puerto de conexión (por defecto es 3306)
});

// Verifica que la conexión a la base de datos sea exitosa
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error de conexión a la base de datos:', err);
  } else {
    console.log('Conexión exitosa a la base de datos');
    connection.release();  // Libera la conexión después de la verificación
  }
});

// Iniciar el servidor
app.listen(3001, () => {
  console.log('Server is running on port 3001');
});

// Rutas del backend

//GETs

app.get('/api/productos', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Search product by code
app.get('/api/productos/code/:code', (req, res) => {
  const { code } = req.params;

  db.query('SELECT * FROM producto WHERE codigo_barras = ?', [code], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(results[0]);
  });
});

// Search product by name
app.get('/api/productos/name/:name', (req, res) => {
  const { name } = req.params;

  db.query('SELECT * FROM productos WHERE name = ?', [name], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(results[0]);
  });
});

//POSTs

// Validacion de usuario
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Realizamos la consulta en la base de datos
    const result = await pool.promise().query(
      'SELECT * FROM usuarios WHERE username = ?',
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

    // Compara la contraseña ingresada con la almacenada en la base de datos
    if (user.password !== password) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // Si la validación es exitosa, generamos un token ficticio
    const fakeToken = `token-${Date.now()}`;
    return res.json({ message: 'Login exitoso', token: fakeToken });

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
  console.log("dotos obtenidos ", req.body)
  /*console.log(req.body);
  console.log(formato_venta);*/
  try {

    // Obtener el id del formato de venta
    const [formatoRows] = await pool.promise().query(
      'SELECT id_formato FROM formato_venta WHERE descripcion = ?',
      [formato_venta]
    );


    if (formatoRows.length === 0) {
      console.log(res.status(400).json({ message: 'Formato de venta no válido' }));
      return res.status(400).json({ message: 'Formato de venta no válido' });
    }
    const id_formato = formatoRows[0].id_formato;
    console.log("valor de id formato", id_formato);

    // Obtener el id del departamento
    const [departamentoRows] = await pool.promise().query(
      'SELECT id_departamento FROM departamento WHERE nombre = ?',
      [req.body.departamento]
    );
    if (departamentoRows.length === 0) {
      return res.status(400).json({ message: 'Departamento no válido' });
    }
    const id_departamento = departamentoRows[0].id_departamento;
    console.log("valor de id departamento", id_departamento);

    // Insertar el producto en la base de datos
    await pool.promise().query(
      `INSERT INTO producto (
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
    //console.log("valor de res" , res);
    res.status(201).json({ message: 'Producto añadido exitosamente' });

  } catch (error) {
    //console.error('Error al añadir producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


//PUTs

app.put('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, quantity } = req.body;
  db.query('UPDATE producto SET name = ?, price = ?, quantity = ? WHERE id = ?', [name, price, quantity, id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Product updated' });
  });
});

// Update product
app.put('/api/productos/:code', (req, res) => {
  const { code } = req.params;
  const { name, price, quantity } = req.body;

  db.query(
    'UPDATE producto SET name = ?, price = ?, quantity = ? WHERE id = ?',
    [name, price, quantity, code],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Product updated successfully' });
    }
  );
});

//DELETEs

/*app.delete('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM producto WHERE id = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Product deleted' });
  });
});*/

// Delete product
app.delete('/api/productos/:code', (req, res) => {
  const { code } = req.params;

  db.query('DELETE FROM producto WHERE id = ?', [code], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Product deleted successfully' });
  });
});

//USEs

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});


// Simula un nuevo dispositivo conectándose
app.post('/connect', (req, res) => {
  connectedDevices++;
  res.json({ message: 'Nuevo dispositivo conectado', total: connectedDevices });
});

// Devuelve la cantidad de dispositivos conectados
app.get('/devices', (req, res) => {
  res.json({ total: connectedDevices });
});

// Simula la desconexión de un dispositivo
app.post('/disconnect', (req, res) => {
  if (connectedDevices > 0) connectedDevices--;
  res.json({ message: 'Dispositivo desconectado', total: connectedDevices });
});

app.listen(3001, () => console.log('Servidor corriendo en http://localhost:3001'));













