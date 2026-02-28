// pagoMovil.js

async function obtenerDatosPagoMovil() {
    const response = await fetch('pago-movil.json');
    return await response.json();
}

function mostrarTarjetaPagoMovil(tab = 'Adela') {
    obtenerDatosPagoMovil().then(datos => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-pago-movil';
        tarjeta.innerHTML = `
            <div class="tarjeta-header">
                <div class="tabs">
                    <button class="tab-btn" data-tab="Adela">Adela</button>
                    <button class="tab-btn" data-tab="Kamil">Kamil</button>
                </div>
                <button class="cerrar-tarjeta">&times;</button>
            </div>
            <div class="tarjeta-body">
                <div class="datos-pago">
                    <strong>Banco:</strong> <span id="banco">${datos[tab].banco}</span><br>
                    <strong>Cédula:</strong> <span id="cedula">${datos[tab].cedula}</span><br>
                    <strong>Teléfono:</strong> <span id="telefono">${datos[tab].telefono}</span><br>
                </div>
                <div class="qr-pago">
                    <img src="qr/${tab.toLowerCase()}-qr.png" alt="QR ${tab}" style="max-width:180px;">
                </div>
            </div>
        `;
        document.body.appendChild(tarjeta);

        // Tabs
        tarjeta.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                mostrarTarjetaPagoMovil(btn.dataset.tab);
                tarjeta.remove();
            };
        });
        // Cerrar
        tarjeta.querySelector('.cerrar-tarjeta').onclick = () => tarjeta.remove();
    });
}

function agregarBotonPagoMovil() {
    const btn = document.createElement('button');
    btn.className = 'btn-pago-movil';
    btn.innerHTML = '<i class="bi bi-credit-card"></i> Pago Móvil';
    btn.style.position = 'fixed';
    btn.style.left = '16px';
    btn.style.bottom = '16px';
    btn.style.zIndex = '1000';
    btn.onclick = () => mostrarTarjetaPagoMovil();
    document.body.appendChild(btn);
}

// Inicializar botón al cargar
window.addEventListener('DOMContentLoaded', agregarBotonPagoMovil);
