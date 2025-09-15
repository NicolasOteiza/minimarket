
  // --- Logout ---
document.getElementById('logout').addEventListener('click', async () => {
  try {
    document.getElementById('logout-msg').style.display = 'block';
    
    localStorage.setItem("estado_login","0");
    await deleteConnectedUser();
   
    localStorage.setItem("estado_login","0");
    
    await updateUser();
    // elimina los datos de la sesion activa
    localStorage.removeItem('id_user');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('user');
    localStorage.removeItem('estado_login');
    localStorage.removeItem('password');

    

    console.log("footer responde: llego hasta aqui");

    
    window.location.href = 'index.php';
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
});
