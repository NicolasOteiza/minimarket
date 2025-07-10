var configuracion_ventana =
  "toolbar=no,"+
  "fullscreen=no,"+
  "location=no,"+
  "menubar=no,"+
  "resizable=no,"+
  "scrollbars=no,"+
  "status=no,"+
  "top=150,"+
  "left=200,"+
  "width=1100,"+
  "height=700";


let myWindow;

function open_w(popUpReference) {
  myWindow = window.open(
    ["/sistemaventas/popup/"+popUpReference+".php"],
    [configuracion_ventana]
  ); 
}

function close_w() {
  window.close();
}

function showTab(index) {
  // Obtener todas las pestañas y el contenido
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Eliminar la clase activa de todas las pestañas y contenido
  tabs.forEach(tab => tab.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));

  // Activar la pestaña y contenido correspondiente
  tabs[index].classList.add('active');
  tabContents[index].classList.add('active');
}

function showNewCajero(code){
  // Función para alternar la visibilidad del div
  const butonSettings = document.getElementById('toggleButton');
  const tablaSettings = document.getElementById('id-tablaNewCajero');
  const btnGuardarSettings = document.getElementById('guardarButton');
  
  if(code==1){
    btnGuardarSettings.classList.remove('hidden'); // Ocultar el div
    butonSettings.classList.add('hidden'); // Ocultar el div
    tablaSettings.classList.remove('hidden'); // Ocultar el div
  }else{
    btnGuardarSettings.classList.add('hidden'); // Ocultar el div
    butonSettings.classList.remove('hidden'); // Ocultar el div
    tablaSettings.classList.add('hidden'); // Ocultar el div
  }
}











function getDeviceInfo() {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const isMobile = /Mobi|Android/i.test(userAgent);
  const isTablet = /Tablet|iPad/i.test(userAgent);
  const isWindows = /Win/i.test(platform);
  const isMac = /Mac/i.test(platform);
  const isLinux = /Linux/i.test(platform);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  let os = "Desconocido";
  if (isWindows) os = "Windows";
  else if (isMac) os = "MacOS";
  else if (isLinux) os = "Linux";
  else if (isIOS) os = "iOS";
  else if (isMobile) os = "Android";

  let deviceType = "PC o Laptop";
  if (isMobile) deviceType = "Móvil";
  else if (isTablet) deviceType = "Tablet";

  let browser = "Desconocido";
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Google Chrome";
  else if (userAgent.includes("Firefox")) browser = "Mozilla Firefox";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
  else if (userAgent.includes("Edg")) browser = "Microsoft Edge";
  else if (userAgent.includes("Opera") || userAgent.includes("OPR")) browser = "Opera";
  else if (userAgent.includes("MSIE") || userAgent.includes("Trident")) browser = "Internet Explorer";

  return {
      sistemaOperativo: os,
      tipoDispositivo: deviceType,
      navegador: browser,
  };
}

// Mostrar la información en la consola
console.log(getDeviceInfo());
