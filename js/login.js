// -------------configuraciones que se cargar al momento de cargar 
// -------------los elementos de la vista
document.addEventListener('DOMContentLoaded', async () => {

  const numero_caja = localStorage.getItem('n_caja');
  const username = localStorage.getItem('user');
  const password = localStorage.getItem('password');

  /*console.log("usuario localStorage");
  console.log(username);
  console.log("clave localStorage");
  console.log(password);
*/
  if (username || password) {
      const inputName = document.getElementById('username');
      const inputPassword = document.getElementById('password');
      inputName.value = username;
      document.getElementById('msj_activo').classList.remove('hidden');
    }

  const info = await getInfo();

  //console.log(info.length);
 if (info.length == 0) {
  document.getElementById('welcome-msj').classList.remove('hidden');
  document.getElementById('load').classList.add('hidden');
  return;
 }
  if(info[0].nombre){
    document.getElementById('load').classList.add('hidden');
    document.getElementById('welcome-msj').classList.remove('hidden');
    document.getElementById('config-form').classList.add('hidden');
  }
  if (numero_caja){
    document.getElementById('config-form').classList.add('hidden');
    document.getElementById('welcome-msj').classList.add('hidden');
    document.getElementById('load').classList.add('hidden');
      document.getElementById('login').classList.remove('hidden');

  }
  

});

// -------------boton de vista de bienvenida configurar sistema
document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('welcome-msj').classList.add('hidden');
    document.getElementById('data-negocio').classList.remove('hidden');
    
});

// -------------boton de vista de bienvenida agregar caja nueva
document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('welcome-msj').classList.add('hidden');
    document.getElementById('add-caja').classList.remove('hidden'); 
   
    
});

// -------------boton de vista de configuracion  Datos negocio
document.getElementById('data-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombre-local').value;
    const telefono = document.getElementById('fono-local').value;
    const mail = document.getElementById('mail-local').value;
    const local = document.getElementById('tipo-local').value;

    localStorage.setItem('nombre_local', nombre);
    localStorage.setItem('telefono_local', telefono);
    localStorage.setItem('mail_local', mail);
    localStorage.setItem('tipo_local', local);

    /*console.log(`nombre: ${nombre}`);
    console.log(`telefono: ${telefono}`);
    console.log(`mail: ${mail}`);
    console.log(`local: ${local}`);
    */
    document.getElementById('data-negocio').classList.add('hidden');
    document.getElementById('config-negocio').classList.remove('hidden');   
    
});

// -------------boton de vista de configuracion  opciones negocio
document.getElementById('option-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    let inventario = document.getElementById('inventario');
    let credito = document.getElementById('credito');
    let producto_comun = document.getElementById('producto_comun');
    let margen_ganancia = document.getElementById('margen_ganancia');
    let redondeo = document.getElementById('redondeo');
    let mensaje = document.getElementById('mensaje');

    
    if(!inventario.checked){
      inventario = false;
    }else{
      inventario = true;
    }
    if(!credito.checked){
      credito = false;
    }else{
      invecreditontario = true;
    }
    if(!producto_comun.checked){
      producto_comun = false;
    }else{
      producto_comun = true;
    }
    if(!margen_ganancia.checked){
      margen_ganancia = false;
    }else{
      margen_ganancia = true;
    }
    if(!redondeo.checked){
      redondeo = false;
    }else{
      redondeo = true;
    }
    if(!mensaje.checked){
      mensaje = false;
    }else{
      mensaje = true;
    }
    
    
    const monto_ganancia = document.getElementById('id-margen-ganancia').value;
    const monto_redondeo = document.getElementById('id-formato-cantidad-cerrada').value;
    const data_mensaje = document.getElementById('id-mensaje-contingencia').value;
    const time_mensaje = document.getElementById('id-tiempo-mensaje-contingencia').value;

    localStorage.setItem('inventario', inventario);
    localStorage.setItem('credito', credito);
    localStorage.setItem('producto_comun', producto_comun);
    localStorage.setItem('margen_ganancia', margen_ganancia);
    localStorage.setItem('monto_ganancia', monto_ganancia);
    localStorage.setItem('redondeo', redondeo);
    localStorage.setItem('monto_redondeo', monto_redondeo);
    localStorage.setItem('mensaje', mensaje);
    localStorage.setItem('data_mensaje', data_mensaje);
    localStorage.setItem('time_mensaje', time_mensaje);
    /* info = {
      inventario,
      credito ,
      producto_comun ,
      margen_ganancia,
      redondeo,
      mensaje,
      monto_ganancia,
      monto_redondeo,
      data_mensaje ,
      time_mensaje 
    }
    console.log("Estos son los datos de la vista de configuraciones habilitadas");
    console.log(info);*/
    addInfo();
    /*console.log(`inventario: ${inventario}`);
    console.log(`credito: ${credito}`);
    console.log(`producto_comun: ${producto_comun}`);
    console.log(`margen_ganancia: ${margen_ganancia}`);
    console.log(`monto_ganancia: ${monto_ganancia}`);
    console.log(`redondeo: ${redondeo}`);
    console.log(`monto_redondeo: ${monto_redondeo}`);
    console.log(`mensaje: ${mensaje}`);
    console.log(`data_mensaje: ${data_mensaje}`);
    console.log(`time_mensaje: ${time_mensaje}`);*/
    
    document.getElementById('config-negocio').classList.add('hidden');
    document.getElementById('add-caja').classList.remove('hidden');   
});

// -------------boton de vista de configuracion  agregar caja nueva
document.getElementById('caja-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    let validar_numero = false;
    let validar_caja = false;
    const n_caja = document.getElementById('n_caja').value;
    const nombre_caja = document.getElementById('nombre_caja').value;
    const cajas = await getCajas();

    /*console.log("respusta del backend");
    console.log(cajas);*/

    if (cajas!=0) {
      cajas.forEach(element => {
        /*console.log(`el numero de caja existente es: `);
        console.log(element.n_caja);
        console.log(`el numero de caja que desea ingresar es: `);
        console.log(n_caja);*/
        if (nombre_caja == element.nombre_caja) {
            
            validar_caja = true;
            //console.log("Validar:true");
        }
        if (n_caja == element.n_caja) {
            
            validar_numero = true;
            //console.log("Validar:true");
        }
      });
    }

    if (validar_numero) {
      alert("la caja seleccionada ya esta en uso, seleccione otro numero")
      return
    }
    if (validar_caja) {
      alert("el nombre seleccionado ya esta en uso, seleccione otro nombre")
      return
    }

    localStorage.setItem('n_caja', n_caja);
    localStorage.setItem('nombre_caja', nombre_caja);
    await addCajaConnected();
    /*console.log(`el numero de caja: ${n_caja}`);
    console.log(`el nombre: ${nombre_caja}`);
    */
    document.getElementById('add-caja').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');   
    
});

// -------------boton de vista de login para acceder al sistema
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await login();

});

console.log("login cargado exitosamente...");