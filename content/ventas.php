<div class="mainContent">
    <div class="sub">
        <div class="subtitulo">
            <h2>VENTA - Ticket 1</h2>
        </div>
        <div class="content">
            Codigo de Producto
            <input type="text" id="barcode" placeholder="Escanea o ingresa el código del producto">
            <button onclick="addToCart()">Agregar al carrito</button>
            <table class="tabla_venta">
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th>Precio Unitario</th>
                        <th>Cantidad</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody id="cart-table-body">
                    <!-- Las filas del carrito se agregarán dinámicamente aquí -->
                </tbody>
            </table>
        </div>
        <div class="content2">
            <table>
                <tfoot>
                    <tr>
                        <td colspan="3"><strong>Total:</strong></td>
                        <td id="total-amount">$0.00</td>
                    </tr>
                </tfoot>
            </table>
            <button onclick="finalizeSale()">Finalizar Venta</button>
            <div id="receipt" class="hidden">
                <h3>Boleta</h3>
                <ul id="receipt-details"></ul>
                <strong>Total: $<span id="receipt-total"></span></strong>
            </div>
        </div>
    </div>
</div>