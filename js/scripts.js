
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'index.php'; // Redirige al login si no hay token
}


let cart = []; // Array para almacenar los productos del carrito

async function addToCart() {
    const barcode = document.getElementById('barcode').value; // Obtener el código de producto
    if (!barcode) {
        alert("Please enter a product code.");
        return;
    }

    try {
        // Llamar al backend para obtener el producto por código
        const response = await fetch(`http://localhost:3000/api/productos/code/${barcode}`);
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
            <td>${item.descripcion}</td>
            <td>$${item.precio_venta.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>$${(item.precio_venta * item.quantity).toFixed(2)}</td>
        `;
        cartTable.appendChild(row); // Añadir la fila a la tabla
    });

    // Actualizar el total
    const totalAmount = cart.reduce((sum, item) => sum + item.precio_venta * item.quantity, 0);
    document.getElementById('total-amount').textContent = totalAmount.toFixed(2);
}

// Finalizar la venta
async function finalizeSale() {
    if (cart.length === 0) {
        alert("The cart is empty. Please add products before finalizing the sale.");
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/sales', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ products: cart }),
        });

        if (response.ok) {
            alert("Sale completed successfully!");
            const receipt = await response.json();
            showReceipt(receipt);
            cart = []; // Vaciar el carrito
            updateCartUI();
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        console.error("Error finalizing sale:", error);
        alert("Failed to finalize sale. Please try again.");
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
const API_URL = "http://localhost:3000/api";

// Adaptar las funciones de `scripts.js` para usar `API_URL` dinámicamente.
async function getProducts() {
    const response = await fetch(`${API_URL}/productos`);
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
        const response = await fetch('http://localhost:3000/api/productos');
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
            const response = await fetch(`http://localhost:3000/api/productos/${id}`, {
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
            const response = await fetch(`http://localhost:3000/api/productos/${id}`, {
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
            const response = await fetch(`http://localhost:3000/api/productos/search?query=${searchQuery}`);
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

    const response = await fetch(`http://localhost:3000/api/productos/code/${code}`);
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

    const response = await fetch(`http://localhost:3000/api/productos/name/${name}`);
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
    const costo = parseFloat(document.getElementById('product-costo').value);
    const ganancia = parseFloat(document.getElementById('product-ganancia').value) || 0;
    const precioVenta = parseFloat(document.getElementById('product-price').value);
    const precioMayoreo = parseFloat(document.getElementById('product-mayoreo').value) || null;
    const utilizaInventario = document.querySelector('input[name="utiliza_inv"]')?.checked || false;
    const cantidadActual = parseFloat(document.getElementById('product-quantity').value) || 0;
    const cantidadMinima = parseFloat(document.getElementById('product-quantity-min').value) || 0;
    const cantidadMaxima = parseFloat(document.getElementById('product-quantity-max').value) || 0;
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
        const response = await fetch('http://localhost:3000/api/productos', {
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
    document.getElementById('checkbox-inventario').checked = false;
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

    const response = await fetch(`http://192.168.0.55:3000/api/productos/${code}`, {
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

// Delete product by code
async function deleteProduct() {
    const code = document.getElementById('product-code').value;
    if (!code) {
        alert("Please enter the product code.");
        return;
    }

    const response = await fetch(`http://192.168.0.55:3000/api/productos/${code}`, {
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


// consulta el servidor para obtener la cantidad de equipos conectados.
async function getConnectedDevices() {
    try {
        const response = await fetch('http://localhost:3000/devices'); // Consultar al backend
        const data = await response.json();
        document.getElementById('device-count').textContent = `Equipos conectados: ${data.total}`;
    } catch (error) {
        console.error("Error al obtener la cantidad de dispositivos:", error);
    }
}

// Llamar a la función cada 5 segundos para actualizar el número de equipos conectados
setInterval(getConnectedDevices, 5000);

// Llamar una vez al cargar la página
//document.addEventListener('DOMContentLoaded', getConnectedDevices);
document.getElementById("info").textContent =
                `Sistema Operativo: ${getDeviceInfo().sistemaOperativo}, ` +
                `Dispositivo: ${getDeviceInfo().tipoDispositivo}, ` +
                `Navegador: ${getDeviceInfo().navegador}`;


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
                  