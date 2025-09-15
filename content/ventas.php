<!-- ============  VENTA – Ticket 1  ============ -->

<div class="panel"><!-- hereda caja blanca con sombra -->
    <h1 class="panel-title">VENTA – Ticket <p id="nticket">1</p>
    </h1>

    <!-- FILA: código + botón -->
    <div class="form-row">
        <label for="barcode" class="form-label">Código de producto</label>
        <input type="text" id="barcode" class="form-input" onkeydown="if (event.key === 'Enter'){ addToCart(); }" placeholder=" Escanea o ingresa el código">
        <button id="searchCode" class="btn" onclick="addToCart()">Agregar al carrito</button>
    </div>

    <!-- TABLA DE CARRITO -->
    <div style="width: 100%; ">
        <div style=" padding:0px 0px 0px 0px;">
            <table>
                <tr>
                    <td class="tot-label"><button class="btn btn2">Producto Común</button></td>
                    <td class="tot-label"><button class="btn btn2">Buscar</button></td>
                    <td class="tot-label"><button class="btn btn2">Ingreso</button></td>
                    <td class="tot-label"><button class="btn btn2">Salida</button></td>
                    <td class="tot-label"><button class="btn btn2">Eliminar</button></td>
                    <td class="tot-label"><button class="btn btn2">Consulta Precio</button></td>
                </tr>
            </table>
        </div>
        <div>
            <div class="carrito">
                <table class="venta-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Descripción</th>
                            <th>Precio Unitario</th>
                            <th>Cantidad</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody id="cart-table-body"><!-- filas dinámicas --></tbody>
                </table>
            </div>
            <div>
                <table class="venta-table">
                    <tr>
                        <td colspan="7" class="tot-label">
                            <strong>Total:</strong>
                        </td>
                        <td style="width:60px;">
                            <ul style="list-style: none;">
                                <li id="total-amount"><b>$0</b></li>
                                <li>
                                    <button style="height: 80px; font-size: 30px;" class="btn btn2" onclick="mostrarPopUp('miPopUp')"><b>Finalizar venta</b></button>
                                </li>
                            </ul>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
    </div>
    <!-- TABLA METODO -->
    <div id="miPopUp" class="hidden">
        <div class="contenidoPopUp">
            <!--titulo-->
            <div class="popup-titulo">
                <p class="popup-titulo-texto">Venta de productos: Cobrar</p>
                <button class="popup-cerrar" onclick="cerrarPopUp('miPopUp')">
                    <p>X</p>
                </button>
            </div>

            <div class="popup-body">
                <!--frame metodo de pago-->
                <div class="popup-metodo">
                    <!--subtitulo-->
                    <div class="popup-subtitulo">
                        COBRAR
                    </div>
                    <!--monto a pagar-->
                    <div class="popup-monto">
                        <p id="montoAPagar">$0</p>
                    </div>
                    <!--seleccion de metodo de pago-->
                    <div class="popup-metodos">
                        <div class="tabss">
                            <div class="tab active" data-tab="efectivo">
                                <div class="tab-img"><img src="../../img/efectivo.png"></div>
                                <div class="tab-texto"><span>Efectivo</span></div>
                            </div>
                            <div class="tab" data-tab="tarjeta">
                                <div class="tab-img"><img src="../../img/tarjeta-credito.png"></div>
                                <div class="tab-texto"><span>Tarjeta</span></div>
                            </div>
                            <div class="tab" data-tab="mixto">
                                <div class="tab-img"><img src="../../img/mixto.png"></div>
                                <div class="tab-texto"><span>Mixto</span></div>
                            </div>
                        </div>
                    </div>
                    <!--detalle del metodo de pago-->
                    <div class="div-tab">
                        <!--efectivo metodo de pago-->
                        <div id="efectivo" class="tab-metodo-pago-content active">
                            <div class="parent">
                                <div class="div1">Pagó con:</div>
                                <div class="div2"><input id="efectivoEfectivo" type="text" min="0" placeholder="0"></div>
                                <div class="div3">Su cambio:</div>
                                <div class="div4"><input id="cambioEfectivo" type="text" readonly></div>
                            </div>
                            <!-- <p>Pagó con: <input type="text"></p>
                            <p>Su cambio: <input type="text"></p>-->
                        </div>
                        <!--tarjeta metodo de pago-->
                        <div id="tarjeta" class="tab-metodo-pago-content">

                            <div class="parent">
                                <div class="div1">Referencia:</div>
                                <div class="div2"><input type="text"></div>
                            </div>
                            <!-- <p>Referencia: <input type="text"></p>-->
                        </div>
                        <!--mixto metodo de pago-->
                        <div id="mixto" class="tab-metodo-pago-content">
                            <div class="parent">
                                <div class="div3">Tarjeta:</div>
                                <div class="div4"><input id="tarjetaMixto" type="text" min="0" placeholder="0"></div>
                                <div class="div1">Efectivo:</div>
                                <div class="div2"><input id="efectivoMixto" type="text" min="0" placeholder="0"></div>
                                <div class="div5">Su cambio:</div>
                                <div class="div6"><input id="cambioMixto" type="text" readonly></div>
                            </div>
                        </div>
                    </div>
                </div>
                <!--frame finalizar venta-->
                <div class="popup-finalizar">
                    <button class="btn2" onclick="finalizeSale()">finalizar venta</button>
                    <button class="btn2">finalizar venta</button>
                    <button class="btn2">finalizar venta</button>
                </div>
            </div>
        </div>
    </div>


</div>