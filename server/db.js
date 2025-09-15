// Configurar la conexión a MySQL
const hosts = "localhost";
const users = 'root';
const pss = '';
const bds = 'minimarket';

const db = mysql.createConnection({
  host: hosts,
  user: users,
  password: pss, // Deja esto vacío si no configuraste una contraseña en XAMPP
  database: bds,
});

// Conectar a la base de datos
db.connect2((err) => {
  if (err) {
    console.error('Error al conectarse a la base de datos', err);
  } else {
    console.log('Conectado a la base de datos MySQL.');
  }
});