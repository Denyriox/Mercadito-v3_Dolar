// pagoMovil.js

// Datos del QR S7B (Suiche 7B) de Kamil. El payload es un JSON cifrado con
// AES-256-CBC (clave/IV en texto, tal como los usa la app del banco), en
// base64, seguido de merchantId y strong_id (timestamp de generación).
const QR_KAMIL = {
    merchantId: '0102',
    key: '871b17da0dd6d72e4bbfee126928e74c',
    iv: '8313014167d9aa6d',
    id: 'V29973432',
    phone: '584242644463',
    description: 'Pago con QR',
    versions: 'versionName: 1.0.8.16 - keyVersion: 1'
};

let qrKamilObserver = null;

async function obtenerDatosPagoMovil() {
    const response = await fetch('pago-movil.json');
    return await response.json();
}

// Convierte el total mostrado en el carrito (ej. "1.234,56") al formato
// de monto que espera Suiche 7B (ej. "1234,56"). Devuelve null si es 0,
// que es el caso en el que la app del banco omite el campo "amount".
function formatearMontoS7B(texto) {
    const limpio = String(texto || '0,00').trim()
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const numero = parseFloat(limpio);
    if (!isFinite(numero) || numero <= 0) return null;

    const [enteros, decimales = '00'] = numero.toFixed(2).split('.');
    let entero = enteros.replace(/^0+(?=\d)/, '');
    if (entero.length === 1) entero = '0' + entero;   // el banco exige al menos 2 dígitos
    if (entero.length > 8) entero = entero.slice(-8); // máximo 8 dígitos enteros
    return `${entero},${decimales}`;
}

// Genera el contenido del QR con el monto indicado (formato "XXXX,XX").
function generarPayloadQrKamil(monto) {
    const json = {
        id: QR_KAMIL.id,
        phone: QR_KAMIL.phone,
        bank: QR_KAMIL.merchantId,
        description: QR_KAMIL.description,
        ...(monto ? { amount: monto } : {}),
        versions: QR_KAMIL.versions
    };

    const cifrado = CryptoJS.AES.encrypt(
        JSON.stringify(json),
        CryptoJS.enc.Utf8.parse(QR_KAMIL.key),
        {
            iv: CryptoJS.enc.Utf8.parse(QR_KAMIL.iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    const datos = CryptoJS.enc.Base64.stringify(cifrado.ciphertext);
    const strongId = Math.floor(Date.now() / 1000);
    return `${datos}?merchantId=${QR_KAMIL.merchantId}&strong_id=${strongId}`;
}

// Dibuja el QR dinámico dentro del contenedor indicado.
function dibujarQrKamil(contenedor) {
    if (!contenedor) return;
    const totalBs = document.getElementById('cart-total-bs')?.textContent || '0,00';
    const payload = generarPayloadQrKamil(formatearMontoS7B(totalBs));
    contenedor.innerHTML = '';
    new QRCode(contenedor, {
        text: payload,
        width: 180,
        height: 180,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
    });
}

// Mantiene el QR sincronizado si cambia el total mientras la tarjeta está abierta.
function observarTotalCarrito(tarjeta) {
    if (qrKamilObserver) {
        qrKamilObserver.disconnect();
        qrKamilObserver = null;
    }
    const totalElem = document.getElementById('cart-total-bs');
    if (!totalElem || !tarjeta) return;
    qrKamilObserver = new MutationObserver(() => {
        if (!document.body.contains(tarjeta)) {
            qrKamilObserver.disconnect();
            qrKamilObserver = null;
            return;
        }
        dibujarQrKamil(tarjeta.querySelector('#qr-kamil-dinamico'));
    });
    qrKamilObserver.observe(totalElem, { childList: true, characterData: true, subtree: true });
}

function cerrarTarjeta(tarjeta) {
    if (qrKamilObserver) {
        qrKamilObserver.disconnect();
        qrKamilObserver = null;
    }
    tarjeta.remove();
}

function mostrarTarjetaPagoMovil(tab = 'Adela') {
    // Si ya existe una tarjeta, ciérrala y no abras otra
    const tarjetaExistente = document.querySelector('.tarjeta-pago-movil');
    if (tarjetaExistente) {
        cerrarTarjeta(tarjetaExistente);
        return;
    }
    obtenerDatosPagoMovil().then(datos => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-pago-movil';
        // Detectar modo oscuro y aplicar clase
        if (document.body.classList.contains('dark-mode')) {
            tarjeta.classList.add('dark');
        }
        // Obtener totales del carrito
        let totalBs = 0, totalUsd = 0;
        try {
            totalBs = document.getElementById('cart-total-bs')?.textContent || '0,00';
            //totalUsd = document.getElementById('cart-total-usd')?.textContent || '0,00';
        } catch(e) {}

        // Para Kamil se genera el QR con el monto actual del carrito;
        // para Adela se mantiene el QR estático.
        const qrHtml = tab === 'Kamil'
            ? `<div id="qr-kamil-dinamico" class="qr-kamil-dinamico" style="width:180px;height:180px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:white;box-shadow:0 2px 8px #0002;"></div>`
            : `<img src="qr/${tab.toLowerCase()}-qr.png" alt="QR ${tab}" style="max-width:180px;border-radius:16px;box-shadow:0 2px 8px #0002;">`;

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
                    ${qrHtml}
                    <div class="total-carrito-info">
                        <div><strong>Total Bs:</strong> <span style="color:#1a7f37;font-weight:bold;">${totalBs}</span></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(tarjeta);

        if (tab === 'Kamil') {
            dibujarQrKamil(tarjeta.querySelector('#qr-kamil-dinamico'));
            observarTotalCarrito(tarjeta);
        }

        // Tabs
        tarjeta.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                cerrarTarjeta(tarjeta);
                mostrarTarjetaPagoMovil(btn.dataset.tab);
            };
        });
        // Cerrar
        tarjeta.querySelector('.cerrar-tarjeta').onclick = () => cerrarTarjeta(tarjeta);
    });
}

// Inicializar botón QR del carrito al cargar
window.addEventListener('DOMContentLoaded', () => {
    const btnQr = document.getElementById('btn-qr-pago-movil');
    if (btnQr) {
        btnQr.onclick = () => mostrarTarjetaPagoMovil();
    }
});
