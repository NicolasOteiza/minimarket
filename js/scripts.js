const API_URL = "https://sistemaventas.linkpc.net/";


async function load_ticket(){
    const cajero = localStorage.getItem('id_user');
    const n_ticket = document.getElementById('nticket');
    
    try {
        const response = await fetch(API_URL+`api/ultimo_ticket/cajero/${cajero}`);
        const data = await response.json();
        if (response.ok) {
            if(!data.ultimo){
                n_ticket.textContent = 1;

            }else{
                const ultimo = parseInt(data.ultimo);
                n_ticket.textContent = ultimo +1;
            };

        };
    } catch (error) {
        console.error('Error DOM:', error);
        
    }
}

async function addToCart() {
    const barcode = document.getElementById('barcode').value; // Obtener el código de producto
    if (!barcode) {
        alert("Por favor ingrese el código de un producto.");
        return;
    }

    try {
        // Llamar al backend para obtener el producto por código
        const response = await fetch(API_URL+`api/productos/code/${barcode}`);
        const product = await response.json();

        if (response.ok) {
            // Verificar si el producto ya está en el carrito
            const existingProduct = cart.find(item => item.id_producto === product.id_producto);

            if (existingProduct) {
                // Incrementar la cantidad si ya existe en el carrito
                existingProduct.quantity += 1;
            } else {
                // Agregar el producto al carrito con cantidad inicial de 1
                cart.push({ ...product, quantity: 1 });
            }

            // Actualizar la interfaz de usuario del carrito
            updateCartUI();

            // Limpiar el campo de código de barras
            document.getElementById('barcode').value = '';
        } else {
            alert(`Error: ${product.error}`);
        }
    } catch (error) {
        console.error("Error adding product to cart:", error);
        alert("Failed to add product to cart. Please try again.");
    }
}

// Actualizar la interfaz del carrito
function updateCartUI() {
    const cartTable = document.getElementById('cart-table-body'); // El cuerpo de la tabla
    cartTable.innerHTML = ''; // Limpiar las filas de la tabla

    cart.forEach(item => {
        // Crear una nueva fila
        const row = document.createElement('tr');

        // Crear y agregar celdas para cada dato
        row.innerHTML = `
            <td>${item.codigo_barras}</td>
            <td>${item.descripcion}</td>
            <td style="text-align: center;">$${item.precio_venta.toFixed(0)}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">$${(item.precio_venta * item.quantity).toFixed(0)}</td>
        `;
        cartTable.appendChild(row); // Añadir la fila a la tabla
    });

    // Actualizar el total
    const totalAmount = cart.reduce((sum, item) => sum + item.precio_venta * item.quantity, 0);

    document.getElementById('total-amount').textContent = "$ "+totalAmount.toFixed(0);
    document.getElementById('montoAPagar').textContent = "$ "+totalAmount.toFixed(0);
    document.getElementById('cambioEfectivo').value = "$ "+totalAmount.toFixed(0);
    document.getElementById('cambioMixto').value = "$ "+totalAmount.toFixed(0);





    

}

// Finalizar la venta
async function finalizeSale() {

    const num_ticket = document.getElementById('nticket');
    const cajero = localStorage.getItem('id_user');
    const caja = localStorage.getItem('caja');
    const metodo_pago = 'efectivo';
    
    const venta ={ 
        cajero: cajero, 
        numero_ticket: num_ticket.textContent, 
        numero_caja: caja, 
        metodo_pago: metodo_pago, 
        producto: cart,
    } ;

    if (cart.length === 0) {
        alert("El carrito está vacío. Añade productos antes de finalizar la compra.");
        return;
    }
    console.log( venta);
    let num_tic =(parseInt(num_ticket.textContent) + 1);
    
    try {
        const response = await fetch(API_URL+'api/sales', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(venta),
        });

        if (response.ok) {
            alert("¡Venta completada con éxito!");
           
            num_ticket.textContent = num_tic.toString();
            cart = []; // Vaciar el carrito
            updateCartUI();
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        console.error("Error al finalizar la venta:", error);
        alert("No se pudo finalizar la venta. Inténtelo de nuevo.");
    }
}

// Mostrar el recibo
function showReceipt(receipt) {
    const receiptDetails = document.getElementById('receipt-details');
    receiptDetails.innerHTML = ''; // Limpiar los detalles del recibo

    receipt.products.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name} - $${item.price} x ${item.quantity}`;
        receiptDetails.appendChild(li);
    });

    document.getElementById('receipt-total').textContent = receipt.total.toFixed(2);
    document.getElementById('receipt').classList.remove('hidden');
}

// Adaptar las funciones de `scripts.js` para usar `API_URL` dinámicamente.
async function getProducts() {
    const response = await fetch(API_URL+'api/productos');
    const products = await response.json();
    updateInventoryList(products);
}

// Función para mostrar la sección activa
function showSection(sectionId) {
    const sections = document.querySelectorAll('main > section');
    sections.forEach(section => section.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
}

// Función para mostrar la sección activa
function showSectioninventario(sectionId) {
    const sections = document.querySelectorAll('div > section');
    sections.forEach(section => section.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
}

// Función para ocultar la sección activa
function hideAllSections() {
    const sections = document.querySelectorAll('div > section');
    sections.forEach(section => section.classList.add('hidden'));
}

// Función para obtener los productos desde el backend
async function getProducts() {
    try {
        const response = await fetch(API_URL+'api/productos');
        const products = await response.json();
        updateInventoryList(products);
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}


// Actualiza la lista de productos en la vista de inventario
function updateInventoryList(products) {
    const inventoryList = document.getElementById('inventory-list');
    inventoryList.innerHTML = ''; // Limpiar la lista antes de agregar nuevos productos
    products.forEach(product => {
        const li = document.createElement('li');
        li.textContent = `${product.name} - $${product.price} x ${product.quantity}`;
        inventoryList.appendChild(li);
    });
}

// Función para modificar un producto
async function modifyProduct() {
    const id = prompt("Enter the product ID to modify:");
    const name = prompt("Enter new name:");
    const price = parseFloat(prompt("Enter new price:"));
    const quantity = parseInt(prompt("Enter new quantity:"));

    if (id && name && !isNaN(price) && !isNaN(quantity)) {
        try {
            const response = await fetch(API_URL+'api/productos/${id}', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, price, quantity })
            });
            const result = await response.json();
            alert(result.message);
            getProducts();
        } catch (error) {
            console.error('Error modifying product:', error);
        }
    }
}

// Función para eliminar un producto
async function deleteProduct() {
    const id = prompt("Enter the product ID to delete:");

    if (id) {
        try {
            const response = await fetch(API_URL+'api/productos/${id}', {
                method: 'DELETE'
            });
            const result = await response.json();
            alert(result.message);
            getProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    }
}

// Función para buscar productos
async function searchProduct() {
    const searchQuery = document.getElementById('search-product').value;
    if (searchQuery) {
        try {
            const response = await fetch(API_URL+`api/productos/search?query=${searchQuery}`);
            const products = await response.json();
            updateInventoryList(products);
        } catch (error) {
            console.error('Error searching for product:', error);
        }
    } else {
        getProducts();
    }
}

/* Llamar a getProducts cuando la sección de inventario se muestra
document.getElementById('inventory').addEventListener('show', () => {
    getProducts();
});*/

// Fetch product by code
async function searchByCode() {
    const code = document.getElementById('product-code').value;
    if (!code) {
        alert("Please enter the product code.");
        return;
    }

    const response = await fetch(API_URL+`api/productos/code/${code}`);
    const product = await response.json();

    if (response.ok) {
        alert(`Product found: ${product.name}, Price: ${product.price}, Quantity: ${product.quantity}`);
    } else {
        alert(`Error: ${product.error}`);
    }
}

// Fetch product by name
async function searchByName() {
    const name = document.getElementById('product-name').value;
    if (!name) {
        alert("Please enter the product name.");
        return;
    }

    const response = await fetch(API_URL+`api/productos/name/${name}`);
    const product = await response.json();

    if (response.ok) {
        alert(`Product found: ${product.name}, Price: ${product.price}, Quantity: ${product.quantity}`);
    } else {
        alert(`Error: ${product.error}`);
    }
}

// Add new product
async function addProduct() {
    const productCode = document.getElementById('product-code').value;
    const productName = document.getElementById('product-name').value;
    const formatoVenta = document.querySelector('input[name="formato_venta"]:checked').value;
    const costo = parseInt(document.getElementById('product-costo').value);
    const ganancia = parseInt(document.getElementById('product-ganancia').value) || 0;
    const precioVenta = parseInt(document.getElementById('product-price').value);
    const precioMayoreo = parseInt(document.getElementById('product-mayoreo').value) || null;
    const utilizaInventario = document.querySelector('input[name="utiliza_inv"]')?.checked || false;
    const cantidadActual = parseInt(document.getElementById('product-quantity').value) || 0;
    const cantidadMinima = parseInt(document.getElementById('product-quantity-min').value) || 0;
    const cantidadMaxima = parseInt(document.getElementById('product-quantity-max').value) || 0;
    const departamento = document.querySelector('select[name="dep"]').value;

    const productData = {
        codigo_barras: productCode,
        descripcion: productName,
        formato_venta: formatoVenta,
        costo,
        ganancia,
        precio_venta: precioVenta,
        precio_mayoreo: precioMayoreo,
        utiliza_inventario: utilizaInventario,
        cantidad_actual: cantidadActual,
        cantidad_minima: cantidadMinima,
        cantidad_maxima: cantidadMaxima,
        departamento,
    };

    try {
        const response = await fetch(API_URL+'api/productos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData),
        });

        const result = await response.json();

        if (response.ok) {
            alert('Producto añadido exitosamente');
            claerAddProd();
            hideAllSections();
        } else {
            alert(`Error al añadir el producto: ${result.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al conectar con el servidor');
    }
}

function claerAddProd(){
    document.getElementById('product-code').value = "";
    document.getElementById('product-name').value = "";
    document.getElementById('radio-unidad').checked = true;
    parseInt(document.getElementById('product-costo').value = null);
    parseInt(document.getElementById('product-ganancia').value = null);
    parseInt(document.getElementById('product-price').value = null);
    parseInt(document.getElementById('product-mayoreo').value = null);
    //document.getElementById('checkbox-inventario').checked = false;
    parseInt(document.getElementById('product-quantity').value = null);
    parseInt(document.getElementById('product-quantity-min').value = null);
    parseInt(document.getElementById('product-quantity-max').value = null);
    document.querySelector('select[name="dep"]').value = "verduleria";
}

// Update existing product
async function updateProduct() {
    const code = document.getElementById('product-code').value;
    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const quantity = parseInt(document.getElementById('product-quantity').value);

    if (!code || !name || isNaN(price) || isNaN(quantity)) {
        alert("Please fill in all fields correctly.");
        return;
    }

    const response = await fetch(API_URL+`api/productos/${code}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, price, quantity }),
    });

    if (response.ok) {
        alert("Product updated successfully!");
        getProducts();
    } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
    }
}

//update user 
async function updateUser() {
    const id = localStorage.getItem("id_user");
    const estado_usuario =  localStorage.getItem("estado_login")

    if (!id || !estado_usuario ) {
        alert("Please fill in all fields correctly.");
        return;
    }
    const response = await fetch(API_URL+`api/updateUser`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, estado_usuario }),
    });
    if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error}`);
    }

}

// Delete product by code
async function deleteProduct() {
    const code = document.getElementById('product-code').value;
    if (!code) {
        alert("Please enter the product code.");
        return;
    }

    const response = await fetch(API_URL+`api/productos/${code}`, {
        method: "DELETE",
    });

    if (response.ok) {
        alert("Product deleted successfully!");
        getProducts();
    } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
    }
}

// -------------agrega sesiones de usuarios conectado al backend
async function addConnectedUser() {
    const numero_caja = localStorage.getItem('n_caja');
    const user_id = localStorage.getItem('id_user');

    const connectedData = { numero_caja: numero_caja, user_id: user_id}
    try{
        const response = await fetch(API_URL+'api/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(connectedData)
        });
    }catch{
    console.error("Error al crear la sesion: ", error);
    }
}

// ------------agrega logout de usuarios desconectado al backend
async function deleteConnectedUser() {
  
    const numero_caja = localStorage.getItem('n_caja');
    const user_id = localStorage.getItem('id_user');

    const connectedData = { numero_caja: numero_caja, user_id: user_id}
    /*console.log("data enviada a server.js");
    console.log(connectedData);*/
     try{
        const response = await fetch(API_URL+'api/disconnect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(connectedData)
        });
    }catch{
    console.error("Error al crear la sesion: ", error);
    }
}

// -------------agrega sesiones de usuarios conectado al backend
async function addCajaConnected() {
    const numero_caja = localStorage.getItem('n_caja');
    const nombre_caja = localStorage.getItem('nombre_caja');

    const connectedData = { numero_caja: numero_caja, nombre_caja: nombre_caja, estado: 1}
    //console.log(connectedData);
    try{
        const response = await fetch(API_URL+'api/addCaja', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(connectedData)
        });
    }catch (error){
    console.error("Error al crear la sesion: ", error);
    }
}

// -------------agrega la info(configuracion) del sistema al backend
async function addInfo() {

    const inventario        = Boolean(localStorage.getItem('inventario'));
    const credito           = Boolean(localStorage.getItem('credito'));
    const producto_comun    = Boolean(localStorage.getItem('producto_comun'));
    const margen_ganancia   = Boolean(localStorage.getItem('margen_ganancia'));
    const monto_ganancia    = localStorage.getItem('monto_ganancia');
    const redondeo          = Boolean(localStorage.getItem('redondeo'));
    const monto_redondeo    = localStorage.getItem('monto_redondeo');
    const mensaje           = Boolean(localStorage.getItem('mensaje'));
    const data_mensaje      = localStorage.getItem('data_mensaje');
    const time_mensaje      = localStorage.getItem('time_mensaje');

    const nombre_local      = localStorage.getItem('nombre_local');
    const telefono_local    = localStorage.getItem('telefono_local');
    const mail_local        = localStorage.getItem('mail_local');
    const tipo_local        = localStorage.getItem('tipo_local');

    const connectedData = { 
        nombre_local:       nombre_local, 
        telefono_local:     telefono_local,
        mail_local:         mail_local, 
        tipo_local:         tipo_local,

        inventario:         inventario, 
        credito:            credito, 
        producto_comun:     producto_comun,
        margen_ganancia:    margen_ganancia, 
        monto_ganancia:     monto_ganancia, 
        redondeo:           redondeo,
        monto_redondeo:     monto_redondeo, 
        mensaje:            mensaje, 
        data_mensaje:       data_mensaje,
        time_mensaje:       time_mensaje, 
        
        
    }
    console.log(connectedData);
    try{
        const response = await fetch(API_URL+'api/addInfo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(connectedData)
        });
    }catch (error){
    console.error("Error al crear la sesion: ", error);
    }
}

//---------------obtener informacion del negocio del backend
async function getInfo() {
    try {
        const response = await fetch(API_URL+'api/getInfo');
        const info = await response.json();
        return info;
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

//---------------obtener informacion del negocio del backend
async function getCajas() {
    try {
        const response = await fetch(API_URL+'api/getCajas');
        const cajas = await response.json();
        return cajas;
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

/* consulta el servidor para obtener la cantidad de equipos conectados.
async function getConnectedDevices() {
    try {
        const response = await fetch(API_URL+'devices'); // Consultar al backend
        const data = await response.json();
        console.log(data.connected);
        return (parseInt(data.connected));
    } catch (error) {
        console.error("Error al obtener la cantidad de dispositivos:", error);
    }
}*/

// Llamar a la función cada 5 segundos para actualizar el número de equipos conectados
//setInterval(getConnectedDevices, 5000);


// Llamar una vez al cargar la página
//document.addEventListener('DOMContentLoaded', getConnectedDevices);

/*document.getElementById("info").textContent =
                `Sistema Operativo: ${getDeviceInfo().sistemaOperativo}, ` +
                `Dispositivo: ${getDeviceInfo().tipoDispositivo}, ` +
                `Navegador: ${getDeviceInfo().navegador}`;

*/

// ---------------funcion que obtiene informacion del equipo que se esta usando
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

//-------------muestra los popup de la vista de configuracion en una ventana nueva
function mostrarPopUp(popUp) {
    //console.log("mostrar popup");
  document.getElementById(popUp).classList.remove("hidden");
}

//-------------oculta los popup de la vista de configuracion de una ventana abierta
function cerrarPopUp(popUp) {
    //console.log("cerrar popup");
  document.getElementById(popUp).classList.add("hidden");
}

function mostrarMensaje(mensaje) {
    //console.log("mensaje popup");
  document.getElementById("mensajePopUp").textContent = mensaje;
  mostrarPopUp();
}
// -------------valida y crea la sesion del usuario
async function login(){
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const username_localStorage = localStorage.getItem('user');
    const password_localStorage = localStorage.getItem('password'); 
    console.log("username");
    console.log(username);
    console.log("password");
    console.log(password);
    if (username_localStorage && password_localStorage ) {
        if (username_localStorage == username && password_localStorage == password) {
            document.getElementById('msj_activo').classList.add('hidden');
            window.location.href = 'home.php'; // Redirigir al sistema principal
        }else{
            alert("usuario o contraseña incorrecto vuelve a intentarlo."+
                "Si el problema persiste contacta con el administrador.");
            return;
        }

    }
    console.log("login");
    try {
        const response = await fetch(API_URL +'/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
          const data = await response.json();
          // Guardar token o sesión
          localStorage.setItem('token', data.token);
          localStorage.setItem('password', password);
          localStorage.setItem('user', username);// Opcional: guardar el nombre de usuario
          localStorage.setItem('id_user', data.id);
          localStorage.setItem('username', data.username);
          localStorage.setItem('estado_login','1');

          await addConnectedUser();
          await updateUser();

          /*console.log(`token: ${data.token}`);
          console.log(`user: ${username}`);
          console.log(`id_user: ${data.id}`);
          console.log(`username: ${data.username}`);
          */
          window.location.href = 'home.php'; // Redirigir al sistema principal
        } else {
            document.getElementById('login-error').classList.remove('hidden');
        }
    } catch (error) {
        //console.error('Error during login:', error);
        document.getElementById('login-error').classList.remove('hidden');
    }
}
                  
/* Mostrar la información en la consola*/
console.log("scripts cargado exitosamente...");
            