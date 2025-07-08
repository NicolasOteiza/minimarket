<div class="mainContent">
    <div class="sub">
        <div class="subtitulo">
            <h2>Inventario</h2>
        </div>
        <div class="content">
            <nav class="nav-inv">
                <button onclick="showSectioninventario('add')">Nuevo</button>
                <button onclick="showSectioninventario('modify')">Modificar</button>
                <button onclick="showSectioninventario('remove')">Eliminar</button>
                <button onclick="showSectioninventario('dep')">Departamento</button>
                <button onclick="showSectioninventario('find')">Ventas por Periodo</button>
                <button onclick="showSectioninventario('find')">Promociones</button>
                <button onclick="showSectioninventario('find')">Importar</button>
                <button onclick="showSectioninventario('find')">Catalogo</button>
            </nav>
            <section id="add"class="hidden" >
                <table>
                    <tr>
                        <th><h3>Nuevo Producto</h3></th>
                    </tr>
                    <tr>
                        <td>Código de Barras:</td>
                        <td><input type="text" id="product-code" placeholder="Código de Barras" required>
                        </td>
                    </tr>
                    <tr>
                        <td>Descripción:</td>
                        <td><input type="text" id="product-name" placeholder="Descripcion" required>
                        </td>
                    </tr>
                    <tr>
                        <td>Se Vende</td>
                        <td>
                            <label><input class="radio" type="radio" name="formato_venta" id="radio-unidad"
                                    value="unidad" required> Por Unidad/Pza</label>
                            <label><input class="radio" type="radio" name="formato_venta" id="radio-kilo"
                                    value="granel"> A Granel (Usa Decimales) </label>
                            <label><input class="radio" type="radio" name="formato_venta" id="radio-pack"
                                    value="pack"> Como Paquete (pack)</label>
                        </td>
                    </tr>
                    <tr>
                        <td>Costo:</td>
                        <td><input class="pesos" type="number" id="product-costo" placeholder="Costo"
                                required>
                        </td>
                    </tr>
                    <tr>
                        <td>Ganancia</td>
                        <td><input class="pesos" type="number" id="product-ganancia"
                                placeholder="Ganancia(%)">
                        </td>
                    </tr>
                    <tr>
                        <td>Precio Venta</td>
                        <td><input class="pesos" type="number" id="product-price" placeholder="Precio"
                                required>
                        </td>
                    </tr>
                    <tr>
                        <td>Precio Mayoreo</td>
                        <td><input class="pesos" type="number" id="product-mayoreo"
                                placeholder="Precio al Mayor">
                        </td>
                    </tr>
                    <tr>
                        <td>Departamento:</td>
                        <td>
                            <select id="checkbox-inventario" name="dep">
                                <option value="verduleria">Verduleria</option>
                                <option value="lacteos">Lácteos</option>
                                <option value="libreria">Librería</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <label><input class="checkbox" type="checkbox" name="utiliza_inv"> Este Producto
                                'SI'
                                utiliza invenario 
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <td>Hay</td>
                        <td>
                            <input class="pesos" type="number" id="product-quantity" placeholder="Cantidad">
                        </td>
                    </tr>
                    <tr>
                        <td>Minima</td>
                        <td>
                            <input class="pesos" type="number" id="product-quantity-min"
                                placeholder="Cantidad min">
                        </td>
                    </tr>
                    <tr>
                        <td>Máxima</td>
                        <td>
                            <input class="pesos" type="number" id="product-quantity-max"
                                placeholder="Cantidad max">
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <button onclick="addProduct()">Add Product</button>
                            <button onclick="hideAllSections()">Cancel Product</button>
                        </td>
                    </tr>
                </table>
            </section>
            <section id="modify" class="hidden">
            <table>
                    <tr>
                        <th><h3>Modificar Producto</h3></th>
                    </tr>
                    <tr>
                        <td>Código de Barras:</td>
                        <td><input type="text" id="product-code" placeholder="Código de Barras" required>
                        </td>
                    </tr>
                    <tr>
                        <td>Descripción:</td>
                        <td><input type="text" id="product-name" placeholder="Descripcion" required>
                        </td>
                    </tr>
                    <tr>
                        <td>Se Vende</td>
                        <td>
                            <label><input class="radio" type="radio" name="formato_venta" id="radio-unidad"
                                    value="unidad" required> Por Unidad/Pza</label>
                            <label><input class="radio" type="radio" name="formato_venta" id="radio-kilo"
                                    value="granel"> A Granel (Usa Decimales) </label>
                            <label><input class="radio" type="radio" name="formato_venta" id="radio-pack"
                                    value="pack"> Como Paquete (pack)</label>
                        </td>
                    </tr>
                    <tr>
                        <td>Costo:</td>
                        <td><input class="pesos" type="number" id="product-costo" placeholder="Costo"
                                required>
                        </td>
                    </tr>
                    <tr>
                        <td>Ganancia</td>
                        <td><input class="pesos" type="number" id="product-ganancia"
                                placeholder="Ganancia(%)">
                        </td>
                    </tr>
                    <tr>
                        <td>Precio Venta</td>
                        <td><input class="pesos" type="number" id="product-price" placeholder="Precio"
                                required>
                        </td>
                    </tr>
                    <tr>
                        <td>Precio Mayoreo</td>
                        <td><input class="pesos" type="number" id="product-mayoreo"
                                placeholder="Precio al Mayor">
                        </td>
                    </tr>
                    <tr>
                        <td>Departamento:</td>
                        <td>
                            <select id="checkbox-inventario" name="dep">
                                <option value="verduleria">Verduleria</option>
                                <option value="lacteos">Lácteos</option>
                                <option value="libreria">Librería</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <label><input class="checkbox" type="checkbox" name="utiliza_inv"> Este Producto
                                'SI'
                                utiliza invenario 
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <td>Hay</td>
                        <td>
                            <input class="pesos" type="number" id="product-quantity" placeholder="Cantidad">
                        </td>
                    </tr>
                    <tr>
                        <td>Minima</td>
                        <td>
                            <input class="pesos" type="number" id="product-quantity-min"
                                placeholder="Cantidad min">
                        </td>
                    </tr>
                    <tr>
                        <td>Máxima</td>
                        <td>
                            <input class="pesos" type="number" id="product-quantity-max"
                                placeholder="Cantidad max">
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <button onclick="addProduct()">Add Product</button>
                            <button onclick="hideAllSections()">Cancel Product</button>
                        </td>
                    </tr>
                </table>
            </section>
            <section id="find" class="hidden">
                <input type="text" id="product-code" placeholder="Product Code">
                <input type="text" id="product-name" placeholder="Product Name">
                <input type="number" id="product-price" placeholder="Price">
                <input type="number" id="product-quantity" placeholder="Quantity">
                <button onclick="updateProduct()">Modify Product</button>
            </section>
            <section id="remove" class="hidden">
                <input type="text" id="product-code" placeholder="Product Code">
                <button onclick="deleteProduct()">Delete Product</button>
            </section>
        </div>
    </div>
</div>