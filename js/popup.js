document.addEventListener("DOMContentLoaded", () => {
    // ================== CONTROL DE TABS ==================
    const tabs = Array.from(document.querySelectorAll(".tabss .tab"));
    const contents = document.querySelectorAll(".tab-metodo-pago-content");
    const finalizeButtons = [
        document.getElementById("finalize-sale-btn"),
        document.getElementById("finalize-no-receipt-btn"),
    ].filter(Boolean);
    const montoElement = document.getElementById("montoAPagar");
    const inputEfectivo = document.getElementById("efectivoEfectivo");
    const inputEfectivoMixto = document.getElementById("efectivoMixto");
    const inputTarjetaMixto = document.getElementById("tarjetaMixto");
    const inputCambioEfectivo = document.getElementById("cambioEfectivo");
    const inputCambioMixto = document.getElementById("cambioMixto");

    if (!montoElement || !inputEfectivo || !inputEfectivoMixto || !inputTarjetaMixto || !inputCambioEfectivo || !inputCambioMixto) {
        return;
    }

    function activateFirstVisibleTab() {
        const firstVisibleTab = tabs.find((tab) => !tab.classList.contains("hidden"));
        if (!firstVisibleTab) return;
        const target = firstVisibleTab.getAttribute("data-tab");
        const targetContent = target ? document.getElementById(target) : null;
        if (!targetContent) return;
        tabs.forEach((t) => t.classList.remove("active"));
        contents.forEach((c) => c.classList.remove("active"));
        firstVisibleTab.classList.add("active");
        targetContent.classList.add("active");
    }

    function applyPaymentSettings(settings) {
        window.salePaymentSettings = settings || {};
        const enabledMap = {
            efectivo: true,
            tarjeta: Boolean(Number(settings.card_enabled ?? 1)),
            mixto: Boolean(Number(settings.mixed_enabled ?? 1)),
            dolares: Boolean(Number(settings.usd_enabled ?? 0)),
            transferencia: Boolean(Number(settings.transfer_enabled ?? 0)),
            cheque: Boolean(Number(settings.check_enabled ?? 0)),
            vale: Boolean(Number(settings.voucher_enabled ?? 0)),
        };

        tabs.forEach((tab) => {
            const method = tab.getAttribute("data-payment-method");
            const enabled = Boolean(enabledMap[method]);
            const content = document.getElementById(tab.getAttribute("data-tab"));
            tab.classList.toggle("hidden", !enabled);
            if (content) {
                content.classList.toggle("hidden", !enabled);
                if (!enabled) {
                    content.classList.remove("active");
                }
            }
        });

        activateFirstVisibleTab();
    }

    async function fetchPaymentSettings() {
        try {
            if (typeof API_URL !== "string") return null;
            const headers = typeof withAuthHeaders === "function" ? withAuthHeaders() : {};
            const response = await fetch(API_URL + "api/payment-settings", { headers });
            if (!response.ok) return null;
            return await response.json();
        } catch (_) {
            return null;
        }
    }

    // Fuerza vista inicial.
    activateFirstVisibleTab();
    window.reloadSalePaymentSettings = async () => {
        const settings = await fetchPaymentSettings();
        if (settings) {
            applyPaymentSettings(settings);
            return;
        }
        applyPaymentSettings({
            card_enabled: 1,
            mixed_enabled: 1,
            usd_enabled: 0,
            transfer_enabled: 0,
            check_enabled: 0,
            voucher_enabled: 0,
            cash_strict_amount: 0,
        });
    };
    window.reloadSalePaymentSettings();

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            if (tab.classList.contains("hidden")) return;
            const target = tab.getAttribute("data-tab");
            const targetContent = target ? document.getElementById(target) : null;
            if (!targetContent) return;

            tabs.forEach(t => t.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            targetContent.classList.add("active");
            refreshFinalizeButtonState();
        });
    });
    
    // ================== CALCULO DE CAMBIO ==================
        let montoTexto = montoElement.innerText.trim();
        let montoAPagar = parseInt(montoTexto.replace(/\D/g, ""), 10);

    function calcularCambio() {
        
        // ================== CALCULO DE CAMBIO ==================
        montoTexto = montoElement.innerText.trim();
        montoAPagar = parseInt(montoTexto.replace(/\D/g, ""), 10);
        
        // Tomamos siempre el valor actual de los inputs
        const efectivo       = parseInt((inputEfectivo.value || "0").replace(/\D/g, "")) || 0;
        const efectivoMixto  = parseInt((inputEfectivoMixto.value || "0").replace(/\D/g, "")) || 0;
        const tarjetaMixto   = parseInt((inputTarjetaMixto.value || "0").replace(/\D/g, "")) || 0;
        const diferenciaEfectivo = efectivo - montoAPagar;
        const diferenciaMixta = (efectivoMixto + tarjetaMixto) - montoAPagar;


        // Mostrar con formato
        inputCambioEfectivo.value = (diferenciaEfectivo > 0 ? "+" : "") + diferenciaEfectivo.toLocaleString("es-CL");
        inputCambioMixto.value    = (diferenciaMixta > 0 ? "+" : "") + diferenciaMixta.toLocaleString("es-CL");

        // Colorear según resultado
        inputCambioEfectivo.style.color = diferenciaEfectivo < 0 ? "red" : diferenciaEfectivo > 0 ? "green" : "black";
        inputCambioMixto.style.color    = diferenciaMixta < 0 ? "red" : diferenciaMixta > 0 ? "green" : "black";
    }

    function formatearInput(input) {
        let valor = input.value.replace(/\D/g, "");
        if (valor) {
            input.value = parseInt(valor, 10).toLocaleString("es-CL");
        } else {
            input.value = "";
        }
    }

    function manejarInput(input) {
        formatearInput(input);
        calcularCambio();
        refreshFinalizeButtonState();
    }

    function refreshFinalizeButtonState() {
        if (!finalizeButtons.length) return;
        if (typeof validatePaymentCoverage !== "function" || typeof getCartTotalAmount !== "function" || typeof getSelectedPaymentMethod !== "function") {
            finalizeButtons.forEach((btn) => { btn.disabled = false; });
            return;
        }

        const totalAmount = getCartTotalAmount();
        const metodoPago = getSelectedPaymentMethod();
        const paymentCheck = validatePaymentCoverage(totalAmount, metodoPago);
        const requiresAmount = metodoPago === "efectivo" || metodoPago === "mixto";
        const shouldDisable = requiresAmount && totalAmount > 0 && !paymentCheck.ok;

        finalizeButtons.forEach((btn) => { btn.disabled = shouldDisable; });
        if (!shouldDisable && typeof clearPaymentWarning === "function") {
            clearPaymentWarning();
        }
    }

    window.refreshFinalizeButtonState = refreshFinalizeButtonState;

    // Eventos
    inputEfectivo.addEventListener("input", () => manejarInput(inputEfectivo));
    inputEfectivoMixto.addEventListener("input", () => manejarInput(inputEfectivoMixto));
    inputTarjetaMixto.addEventListener("input", () => manejarInput(inputTarjetaMixto));

    // Inicializar con la deuda en rojo
    inputCambioEfectivo.value = "-" + montoAPagar.toLocaleString("es-CL");
    inputCambioEfectivo.style.color = "red";
    inputCambioMixto.value = "-" + montoAPagar.toLocaleString("es-CL");
    inputCambioMixto.style.color = "red";
    refreshFinalizeButtonState();
});
