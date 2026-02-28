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
        // Detectar modo oscuro correctamente
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            tarjeta.classList.add('dark');
        }
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
                <div class="qr-pago">
                    <img src="qr/${tab.toLowerCase()}-qr.png" alt="QR ${tab}">
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
window.addEventListener('DOMContentLoaded', () => {
    // Elimina el botón flotante si existe
    const btnFlotante = document.querySelector('.btn-pago-movil');
    if (btnFlotante) btnFlotante.remove();
    // Asigna evento al botón QR en el carrito
    const btnQr = document.getElementById('btn-qr-pago-movil');
    if (btnQr) {
        btnQr.onclick = () => mostrarTarjetaPagoMovil();
    }
});
