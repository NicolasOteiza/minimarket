document.addEventListener("DOMContentLoaded", () => {
    // ================== CONTROL DE TABS ==================
    const tabs = document.querySelectorAll(".tab");
    const contents = document.querySelectorAll(".tab-metodo-pago-content");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.getAttribute("data-tab");

            tabs.forEach(t => t.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            document.getElementById(target).classList.add("active");
        });
    });
    
    // ================== CALCULO DE CAMBIO ==================
        let montoTexto = document.getElementById("montoAPagar").innerText.trim();
        let montoAPagar = parseInt(montoTexto.replace(/\D/g, ""), 10);

        const inputEfectivo       = document.getElementById("efectivoEfectivo");
        const inputEfectivoMixto  = document.getElementById("efectivoMixto");
        const inputTarjetaMixto   = document.getElementById("tarjetaMixto");

        const inputCambioEfectivo = document.getElementById("cambioEfectivo");
        const inputCambioMixto    = document.getElementById("cambioMixto");

    function calcularCambio() {
        
        // ================== CALCULO DE CAMBIO ==================
        montoTexto = document.getElementById("montoAPagar").innerText.trim();
        montoAPagar = parseInt(montoTexto.replace(/\D/g, ""), 10);
        console.log(montoAPagar);

        const inputEfectivo       = document.getElementById("efectivoEfectivo");
        const inputEfectivoMixto  = document.getElementById("efectivoMixto");
        const inputTarjetaMixto   = document.getElementById("tarjetaMixto");

        const inputCambioEfectivo = document.getElementById("cambioEfectivo");
        const inputCambioMixto    = document.getElementById("cambioMixto");
        
        // Tomamos siempre el valor actual de los inputs
        const efectivo       = parseInt((inputEfectivo.value || "0").replace(/\D/g, "")) || 0;
        const efectivoMixto  = parseInt((inputEfectivoMixto.value || "0").replace(/\D/g, "")) || 0;
        const tarjetaMixto   = parseInt((inputTarjetaMixto.value || "0").replace(/\D/g, "")) || 0;
        console.log(efectivo);
        const diferenciaEfectivo = efectivo - montoAPagar;
        const diferenciaMixta = (efectivoMixto + tarjetaMixto) - montoAPagar;

        console.log(diferenciaEfectivo);

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
    }

    // Eventos
    inputEfectivo.addEventListener("input", () => manejarInput(inputEfectivo));
    inputEfectivoMixto.addEventListener("input", () => manejarInput(inputEfectivoMixto));
    inputTarjetaMixto.addEventListener("input", () => manejarInput(inputTarjetaMixto));

    // Inicializar con la deuda en rojo
    inputCambioEfectivo.value = "-" + montoAPagar.toLocaleString("es-CL");
    inputCambioEfectivo.style.color = "red";
    inputCambioMixto.value = "-" + montoAPagar.toLocaleString("es-CL");
    inputCambioMixto.style.color = "red";
});
