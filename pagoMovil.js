// pagoMovil.js

async function obtenerDatosPagoMovil() {
    const response = await fetch('pago-movil.json');
    return await response.json();
}

function mostrarTarjetaPagoMovil(tab = 'Adela') {
    // Si ya existe una tarjeta, ciérrala y no abras otra
    const tarjetaExistente = document.querySelector('.tarjeta-pago-movil');
    if (tarjetaExistente) {
        tarjetaExistente.remove();
        return;
    }
    obtenerDatosPagoMovil().then(datos => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-pago-movil';
        // Detectar modo oscuro correctamente y aplicar fondo
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            tarjeta.style.background = '#23272f';
            tarjeta.style.color = '#fff';
        } else {
            tarjeta.style.background = '#fff';
            tarjeta.style.color = '#222';
        }
        // Obtener totales del carrito
        let totalBs = 0, totalUsd = 0;
        try {
            totalBs = document.getElementById('cart-total-bs')?.textContent || '0.00';
            totalUsd = document.getElementById('cart-total-usd')?.textContent || '0.00';
        } catch(e) {}
        tarjeta.innerHTML = `
            <div class="tarjeta-header">
                <div class="tabs">
                    <button class="tab-btn${tab === 'Adela' ? ' active' : ''}" data-tab="Adela">Adela</button>
                    <button class="tab-btn${tab === 'Kamil' ? ' active' : ''}" data-tab="Kamil">Kamil</button>
                </div>
                <button class="cerrar-tarjeta">&times;</button>
            </div>
            <div class="tarjeta-body">
                <div class="datos-pago">
                    <strong>Banco:</strong> <span id="banco">${datos[tab].banco}</span><br>
                    <strong>Cédula:</strong> <span id="cedula">${datos[tab].cedula}</span><br>
                    <strong>Teléfono:</strong> <span id="telefono">${datos[tab].telefono}</span><br>
                </div>
                <div class="qr-pago" style="display:flex;flex-direction:column;align-items:center;gap:10px;">
                    <img src="qr/${tab.toLowerCase()}-qr.png" alt="QR ${tab}" style="max-width:180px;border-radius:16px;box-shadow:0 2px 8px #0002;">
                    <div class="total-carrito-info" style="margin-top:8px;text-align:center;font-size:1.1em;background:#f6f6f6;padding:8px 16px;border-radius:12px;box-shadow:0 1px 4px #0001;">
                        <div><strong>Total Bs:</strong> <span style="color:#1a7f37;font-weight:bold;">${totalBs}</span></div>
                        <div><strong>Total USD:</strong> <span style="color:#0a5c9c;font-weight:bold;">${totalUsd}</span></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(tarjeta);

        // Tabs
        tarjeta.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                tarjeta.remove();
                mostrarTarjetaPagoMovil(btn.dataset.tab);
            };
        });
        // Cerrar
        tarjeta.querySelector('.cerrar-tarjeta').onclick = () => tarjeta.remove();
    });
}

// Inicializar botón QR del carrito al cargar
window.addEventListener('DOMContentLoaded', () => {
    const btnQr = document.getElementById('btn-qr-pago-movil');
    if (btnQr) {
        btnQr.onclick = () => mostrarTarjetaPagoMovil();
    }
});
