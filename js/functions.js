const token = localStorage.getItem('token');
let cart = []; // Array para almacenar los productos del carrito
let myWindow;
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

function open_w(popUpReference) {
  myWindow = window.open(
    ["/sistemaventas/popup/"+popUpReference+".php"],
    [configuracion_ventana]
  ); 
};

function close_w() {
  window.close();
};

if (!token) {
    window.location.href = 'index.php'; // Redirige al login si no hay token
}

window.onload = load_ticket;










document.addEventListener('DOMContentLoaded', () => {

    // 1) Fuerza a que todos los contenedores .tabs sean horizontales
    //    (solo si el CSS no lo hace ya)
    document.querySelectorAll('.tabs').forEach(tabsBar => {
        tabsBar.style.display = 'flex';
        tabsBar.style.flexWrap = 'wrap';  // se ajusta si se queda sin ancho

        const tabs      = tabsBar.querySelectorAll('.tab');
        const contents  = tabsBar.nextElementSibling?.querySelectorAll('.tab-content');

        if (!tabs.length || !contents?.length) return; // nada que hacer

        // 2) Asigna el evento click a cada pestaña
        tabs.forEach((tab, idx) => {
            tab.addEventListener('click', () => {

                // Desactiva todos
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));

                // Activa el seleccionado
                tab.classList.add('active');
                contents[idx].classList.add('active');
            });
        });
    });

});











// Mini‑script para conmutar pestañas (sin librerías externas) -->
function showTab(index) {
  // Obtener todas las pestañas y el contenido
  const tabs = document.querySelectorAll('.tabs');
  const tabContents = document.querySelectorAll('.tab-content');

  // Eliminar la clase activa de todas las pestañas y contenido
  tabs.forEach(tab => tab.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));

  // Activar la pestaña y contenido correspondiente
  tabs[index].classList.add('active');
  tabContents[index].classList.add('active');
};
function showTabVenta(index) {
  // Obtener todas las pestañas y el contenido
  const tabs = document.querySelectorAll('.tabss');
  const tabContents = document.querySelectorAll('.tab-metodo-pago-content   ');

  // Eliminar la clase activa de todas las pestañas y contenido
  tabs.forEach(tab => tab.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));

  // Activar la pestaña y contenido correspondiente
  tabs[index].classList.add('active');
  tabContents[index].classList.add('active');
};

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
};



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
};



  //toggle modo oscuro
const body = document.body;
const toggleBtn = document.getElementById('toggle-theme');
const root = document.documentElement; // <html>

  // ---------- estado inicial ----------
const saved = localStorage.getItem('theme');
if (saved === 'dark') enableDark();
else enableLight();

  // ---------- eventos ----------
toggleBtn.addEventListener('click', () => {
  if (root.getAttribute('data-theme') === 'dark') {
    enableLight();
  } else {
    enableDark();
  }
});

  // ---------- helpers ----------
function enableDark() {
  root.setAttribute('data-theme', 'dark');
  body.classList.add('dark', 'dark-mode');
  localStorage.setItem('theme', 'dark');
  toggleBtn.textContent = '☀️';
};

function enableLight() {
  root.setAttribute('data-theme', 'light');
  body.classList.remove('dark', 'dark-mode');
  localStorage.setItem('theme', 'light');
  toggleBtn.textContent = '🌙';
};



















 

  
  // =========================
  //  Función: mostrar sección
  // =========================
function showSection(sectionId) {
  // 1) Oculta todas
  document.querySelectorAll('.main-content > section').forEach(sec => sec.classList.add('hidden'));

  // 2) Muestra la solicitada (si existe)
  const target = document.getElementById(sectionId);
  if (target) target.classList.remove('hidden');

  // 3) (Opcional) Cierra el menú en móviles
  if (window.innerWidth <= 768) {
    document.getElementById('main-menu')?.classList.add('collapsed');
  }
};












//pop ups 
document.querySelectorAll('.panel .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            // activar pestaña
            document.querySelectorAll('.panel .tab').forEach(t => t.classList.toggle('active', t === tab));
            // mostrar / ocultar contenido
            document.querySelectorAll('.panel .tab-content').forEach(c =>
                c.classList.toggle('active', c.id === target)
            );
        });
    });
/* Mostrar la información en la consola
console.log("functions cargado exitosamente....");
console.log("Navegador   :",getDeviceInfo().navegador,"\nSO          :",getDeviceInfo().sistemaOperativo,"\nDispositivo :", getDeviceInfo().tipoDispositivo);
*/