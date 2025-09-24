document.addEventListener('DOMContentLoaded', () => {
    const app = {
        dolar: 0,
        products: [],
    cart: {},
    // Maintain insertion order of product ids added to the cart
    cartOrder: [],
        elements: {
            dolarValue: document.getElementById('dolar-value'),
            productList: document.getElementById('product-list'),
            searchBar: document.getElementById('search-bar'),
            resetSearch: document.getElementById('reset-search'),
            cartButton: document.getElementById('cart-button'),
            cartSidebar: document.getElementById('cart-sidebar'),
            closeCart: document.getElementById('close-cart'),
            cartItems: document.getElementById('cart-items'),
            cartTotalItems: document.getElementById('cart-total-items'),
            cartTotalBs: document.getElementById('cart-total-bs'),
            cartTotalUsd: document.getElementById('cart-total-usd'),
            cartProductCount: document.getElementById('cart-product-count'),
            checkoutButton: document.getElementById('checkout-button'),
            cartPreviewBar: document.getElementById('cart-preview-bar'),
            cartPreviewItems: document.getElementById('cart-preview-items'),
            cartPreviewTotal: document.getElementById('cart-preview-total'),
            openCartPreview: document.getElementById('open-cart-preview'),
        },
        init() {
            this.loadData();
            this.attachEventListeners();
            lucide.createIcons();
        },
        async loadData() {
            try {
                const response = await fetch('productos.json');
                const data = await response.json();
                this.dolar = data.dolar;
                this.products = data.productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
                this.elements.dolarValue.textContent = this.dolar.toFixed(2);
                this.loadCart();
                this.renderProducts();
            } catch (error) {
                console.error('Error loading products:', error);
            }
        },
        renderProducts(filter = '') {
            this.elements.productList.innerHTML = '';
            const filterWords = this.normalizeText(filter).split(' ').filter(Boolean);
            const filteredProducts = this.products.filter(p => {
                const nombreNorm = this.normalizeText(p.nombre);
                return filterWords.every(word => nombreNorm.includes(word));
            });
            filteredProducts.forEach(product => {
                const productCard = this.createProductCard(product);
                this.elements.productList.appendChild(productCard);
            });
        },
        createProductCard(product) {
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-lg shadow flex items-center justify-between gap-2';
            const quantity = this.cart[product.id] || 0;
            card.innerHTML = `
                <div class="flex-1 min-w-0">
                    <span class="font-bold">${product.nombre}</span>
                    <span class="text-xs text-gray-500 ml-2">${product.gramos}g</span>
                </div>
                <span class="mx-2 font-bold whitespace-nowrap">Bs. ${product.precio.toFixed(2)}</span>
                <div class="flex items-center space-x-1">
                    <button class="minus-button bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-red-400" data-id="${product.id}" aria-label="Restar">
                        <i class="bi bi-dash-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;"></i>
                    </button>
                    <span class="mx-1 w-8 text-center quantity">${quantity}</span>
                    <button class="plus-button bg-green-500 hover:bg-green-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-green-400" data-id="${product.id}" aria-label="Sumar">
                        <i class="bi bi-plus-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;"></i>
                    </button>
                </div>
            `;
            return card;
        },
        attachEventListeners() {
            this.elements.searchBar.addEventListener('input', (e) => {
                this.renderProducts(e.target.value);
                this.elements.resetSearch.classList.toggle('hidden', !e.target.value);
            });
            this.elements.resetSearch.addEventListener('click', () => {
                this.elements.searchBar.value = '';
                this.renderProducts();
                this.elements.resetSearch.classList.add('hidden');
            });
            this.elements.productList.addEventListener('click', (e) => {
                const plusBtn = e.target.closest('.plus-button');
                const minusBtn = e.target.closest('.minus-button');
                if (plusBtn) {
                    this.updateCart(plusBtn.dataset.id, 1);
                }
                if (minusBtn) {
                    this.updateCart(minusBtn.dataset.id, -1);
                }
            });
            this.elements.cartButton.addEventListener('click', () => this.toggleCart(true));
            this.elements.closeCart.addEventListener('click', () => this.toggleCart(false));
            this.elements.checkoutButton.addEventListener('click', () => this.checkout());
            this.elements.cartItems.addEventListener('click', (e) => {
                if (e.target.closest('.restar')) {
                    this.updateCart(e.target.closest('.restar').dataset.id, -1);
                }
                if (e.target.closest('.sumar')) {
                    this.updateCart(e.target.closest('.sumar').dataset.id, 1);
                }
            });
            // Barra de previsualización del carrito
            if (this.elements.openCartPreview) {
                this.elements.openCartPreview.addEventListener('click', () => this.toggleCart(true));
            }
            // doble toque / doble click en el valor del dolar para abrir historial
            if (this.elements.dolarValue) {
                let lastTap = 0;
                const onDouble = (ev) => {
                    ev.preventDefault();
                    this.openHistoryModal();
                };
                this.elements.dolarValue.addEventListener('dblclick', onDouble);
                this.elements.dolarValue.addEventListener('touchend', (e) => {
                    const currentTime = Date.now();
                    const tapLength = currentTime - lastTap;
                    if (tapLength < 400 && tapLength > 0) {
                        onDouble(e);
                    }
                    lastTap = currentTime;
                });
            }
        },
        updateCart(productId, change) {
            const id = parseInt(productId);
            const prev = this.cart[id] || 0;
            const next = prev + change;
            if (next > 0) {
                // if new item and not present in order, push to cartOrder
                if (!this.cart[id]) {
                    this.cartOrder.push(id);
                }
                this.cart[id] = next;
            } else {
                // removed completely
                if (this.cart[id]) {
                    delete this.cart[id];
                    const idx = this.cartOrder.indexOf(id);
                    if (idx !== -1) this.cartOrder.splice(idx, 1);
                }
            }
            this.saveCart();
            this.renderProducts(this.elements.searchBar.value);
            this.updateCartView();
        },
        removeFromCart(productId) {
            const id = parseInt(productId);
            if (this.cart[id]) delete this.cart[id];
            const idx = this.cartOrder.indexOf(id);
            if (idx !== -1) this.cartOrder.splice(idx, 1);
            this.saveCart();
            this.renderProducts(this.elements.searchBar.value);
            this.updateCartView();
        },
        updateCartView() {

            this.elements.cartItems.innerHTML = '';
            let totalItems = 0;
            let totalBs = 0;
            let productCount = 0;

            // Obtener los productos del carrito en el orden en que fueron agregados (cartOrder).
            // Si no existe cartOrder, o está vacío, usar las keys del cart como fallback.
            const order = Array.isArray(this.cartOrder) && this.cartOrder.length > 0
                ? this.cartOrder
                : Object.keys(this.cart).map(k => parseInt(k));

            const cartProductList = order
                .map(id => {
                    // id may be stored as number or string
                    const pid = parseInt(id);
                    const product = this.products.find(p => p.id == pid);
                    return product && this.cart[pid] ? { product, quantity: this.cart[pid] } : null;
                })
                .filter(Boolean);

            cartProductList.forEach(({ product, quantity }) => {
                totalItems += quantity;
                totalBs += product.precio * quantity;
                productCount++;
                const cartItem = this.createCartItem(product, quantity);
                this.elements.cartItems.appendChild(cartItem);
            });

            // Actualizar contador de productos distintos
            if (this.elements.cartProductCount) {
                this.elements.cartProductCount.textContent = productCount;
            }
            // Actualizar productos totales
            const totalProductsElem = document.getElementById('cart-total-products');
            if (totalProductsElem) {
                totalProductsElem.textContent = totalItems;
            }
            this.elements.cartTotalItems.textContent = totalItems;
            this.elements.cartTotalBs.textContent = totalBs.toFixed(2);
            const totalUsd = totalBs / this.dolar;
            this.elements.cartTotalUsd.textContent = totalUsd.toFixed(2);

            // Calcular vuelto/cambio
            const cartChangeInfo = document.getElementById('cart-change-info');
            if (cartChangeInfo) {
                if (totalUsd > 0) {
                    const usdUp = Math.ceil(totalUsd); // redondeo hacia arriba
                    const usdDown = Math.floor(totalUsd); // redondeo hacia abajo
                    const faltaUsd = +(usdUp - totalUsd).toFixed(2);
                    const devolverUsd = +(totalUsd - usdDown).toFixed(2);
                    const faltaBs = (faltaUsd * this.dolar).toFixed(2);
                    const devolverBs = (devolverUsd * this.dolar).toFixed(2);
                    cartChangeInfo.innerHTML =
                        `<span><span style="color: red;">Vuelto:</span> <b>Bs. ${faltaBs}</b> si paga <b>${usdUp} USD</b></span>` +
                        `<span><span style="color: green;">Completar:</span> <b>Bs. ${devolverBs}</b> si paga <b>${usdDown === 0 ? '' : usdDown + ' USD'}</b>${usdDown === 0 ? '' : ''}</span>`;
                } else {
                    cartChangeInfo.innerHTML = '';
                }
            }

            // Actualizar barra de previsualización
            if (this.elements.cartPreviewBar) {
                // Cantidad de productos
                const countElem = this.elements.cartPreviewBar.querySelector('.cart-preview-count');
                if (countElem) countElem.textContent = totalItems;
                // Texto productos
                const labelElem = this.elements.cartPreviewBar.querySelector('.cart-preview-label');
                if (labelElem) labelElem.textContent = `producto${totalItems === 1 ? '' : 's'}`;
                // Monto en Bs
                const amountElem = this.elements.cartPreviewBar.querySelector('.cart-preview-amount');
                if (amountElem) amountElem.textContent = totalBs.toFixed(2);
                // Mostrar/ocultar barra según si hay productos y si el carrito está cerrado
                const cartOpen = !this.elements.cartSidebar.classList.contains('translate-x-full');
                this.elements.cartPreviewBar.style.display = (!cartOpen && totalItems > 0) ? 'flex' : 'none';
            }
        },
        createCartItem(product, quantity) {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between gap-2 mb-2';
            item.innerHTML = `
                <div class="flex-1 min-w-0">
                    <div>
                        <span class="font-semibold">${product.nombre}</span>
                        <span class="text-xs text-gray-500 ml-2">${product.gramos}g</span>
                    </div>
                    <div class="text-xs text-gray-500">Bs. ${product.precio.toFixed(2)} c/u</div>
                </div>
                <span class="mx-2 font-bold whitespace-nowrap">Bs. ${(product.precio * quantity).toFixed(2)}</span>
                <div class="flex items-center space-x-1">
                    <button class="restar bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-red-400" data-id="${product.id}" aria-label="Restar">
                        <i class="bi bi-dash-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;"></i>
                    </button>
                    <span class="mx-1">${quantity}</span>
                    <button class="sumar bg-green-500 hover:bg-green-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-green-400" data-id="${product.id}" aria-label="Sumar">
                        <i class="bi bi-plus-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;"></i>
                    </button>
                </div>
            `;
            return item;
        },
        toggleCart(open) {
            this.elements.cartSidebar.classList.toggle('translate-x-full', !open);
            // Ocultar barra de previsualización cuando el carrito está abierto
            if (this.elements.cartPreviewBar) {
                this.elements.cartPreviewBar.style.display = open ? 'none' : (Object.values(this.cart).reduce((a,b)=>a+b,0) > 0 ? 'flex' : 'none');
            }
        },
        checkout() {
            // build history entry before clearing cart
            const cartSnapshot = Object.keys(this.cart).map(id => {
                const product = this.products.find(p => p.id == id);
                return product ? { id: product.id, nombre: product.nombre, precio: product.precio, cantidad: this.cart[id] } : null;
            }).filter(Boolean);
            const totalBs = cartSnapshot.reduce((s, it) => s + it.precio * it.cantidad, 0);
            const totalUsd = +(totalBs / this.dolar).toFixed(2);
            const entry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                dolar: this.dolar,
                totalBs: +totalBs.toFixed(2),
                totalUsd,
                items: cartSnapshot
            };
            this.pushHistoryEntry(entry);

            this.cart = {};
            this.cartOrder = [];
            this.saveCart();
            this.renderProducts(this.elements.searchBar.value);
            this.updateCartView();
            this.toggleCart(false);
        },

        // Historial de pagos
        getHistory() {
            try {
                const raw = localStorage.getItem('mercadito-history');
                return raw ? JSON.parse(raw) : [];
            } catch (e) {
                console.error('Error reading history', e);
                return [];
            }
        },
        saveHistory(history) {
            try {
                localStorage.setItem('mercadito-history', JSON.stringify(history));
            } catch (e) {
                console.error('Error saving history', e);
            }
        },
        pushHistoryEntry(entry) {
            const history = this.getHistory();
            history.unshift(entry); // newest first
            if (history.length > 200) history.length = 200;
            this.saveHistory(history);
        },
        saveCart() {
            try {
                const payload = { cart: this.cart, order: this.cartOrder };
                localStorage.setItem('mercadito-cart', JSON.stringify(payload));
            } catch (e) {
                console.error('Error saving cart', e);
            }
        },
        loadCart() {
            const saved = localStorage.getItem('mercadito-cart');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Support legacy format where cart was stored as plain object
                    if (parsed && typeof parsed === 'object' && (parsed.cart || parsed.order || Object.keys(parsed).some(k => !isNaN(parseInt(k))))) {
                        if (parsed.cart) {
                            this.cart = parsed.cart;
                            this.cartOrder = Array.isArray(parsed.order) ? parsed.order : Object.keys(this.cart).map(k => parseInt(k));
                        } else {
                            // legacy: saved directly as cart object
                            this.cart = parsed;
                            this.cartOrder = Object.keys(this.cart).map(k => parseInt(k));
                        }
                    }
                } catch (e) {
                    console.error('Error parsing saved cart', e);
                }
            }
            this.updateCartView();
        },
        normalizeText(text) {
            return text
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[-]/g, ' ')
                .replace(/\s+/g, ' ') // Opcional: normaliza espacios múltiples
                .trim();
        }
    };

    // --- Modal de historial ---
    app.openHistoryModal = function() {
        // remove existing
        let existing = document.getElementById('history-modal');
        if (existing) return; // already open
        const modal = document.createElement('div');
        modal.id = 'history-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
        const history = app.getHistory();
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black opacity-50"></div>
            <div class="relative bg-white w-11/12 max-w-3xl rounded-2xl shadow-2xl p-4 max-h-[80vh] overflow-auto">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-xl font-bold">Historial - Pagos procesados</h3>
                    <div class="flex items-center gap-2">
                        <button id="clear-history" class="text-sm text-red-500">Limpiar</button>
                        <button id="close-history" class="text-sm text-gray-600">Cerrar</button>
                    </div>
                </div>
                <div id="history-list">
                ${history.length === 0 ? '<div class="text-sm text-gray-500">No hay pagos procesados.</div>' : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('close-history').onclick = () => modal.remove();
        document.getElementById('clear-history').onclick = () => {
            if (confirm('¿Borrar todo el historial de pagos?')) {
                app.saveHistory([]);
                app.renderHistoryList();
            }
        };
        app.renderHistoryList();
    };

    app.renderHistoryList = function() {
        const container = document.getElementById('history-list');
        if (!container) return;
        const history = app.getHistory();
        container.innerHTML = '';
        if (history.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-500">No hay pagos procesados.</div>';
            return;
        }
        history.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'p-3 mb-2 border rounded-lg hover:bg-gray-50 cursor-pointer';
            const date = new Date(entry.timestamp);
            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-semibold">${date.toLocaleString()}</div>
                        <div class="text-xs text-gray-500">Bs. ${entry.totalBs.toFixed(2)} • USD ${entry.totalUsd.toFixed(2)} • $${entry.dolar.toFixed(2)}</div>
                    </div>
                    <div class="text-sm text-gray-600">${entry.items.length} ítems</div>
                </div>
                <div class="mt-2 text-xs text-gray-700" style="display:none;" data-details>
                    ${entry.items.map(it => `<div>${it.cantidad} x ${it.nombre} — Bs. ${(it.precio*it.cantidad).toFixed(2)}</div>`).join('')}
                </div>
            `;
            div.addEventListener('click', () => {
                const details = div.querySelector('[data-details]');
                if (details) details.style.display = details.style.display === 'none' ? 'block' : 'none';
            });
            container.appendChild(div);
        });
    };
    // --- Inactividad y recordatorio de pago ---
    let inactivityTimeout;
    let reminderShown = false;
    function resetInactivityTimer() {
        clearTimeout(inactivityTimeout);
        if (Object.values(app.cart).reduce((a, b) => a + b, 0) > 0) {
            inactivityTimeout = setTimeout(() => {
                if (!reminderShown) {
                    showPaymentReminder();
                }
            }, 30000);
        }
    }

    function showPaymentReminder() {
        reminderShown = true;
        let reminder = document.getElementById('payment-reminder');
        if (!reminder) {
            reminder = document.createElement('div');
            reminder.id = 'payment-reminder';
            reminder.innerHTML = `
                    <div class="fixed inset-0 z-50 flex items-center justify-center">
                        <div class="absolute inset-0 bg-gray-900 opacity-60 pointer-events-auto transition-all"></div>
                        <div class="relative bg-white p-8 rounded-3xl shadow-2xl border-4 border-green-400 text-center max-w-xs z-10 flex flex-col items-center animate-fade-in">
                            <div class="mb-4 text-2xl font-extrabold text-green-700 flex items-center gap-2">
                                <i class='bi bi-clock-history text-green-500' style="font-size:2rem;line-height:1;display:flex;align-items:center;justify-content:center;"></i>
                                ¡Recuerda procesar el pago!
                            </div>
                            <button id="close-reminder" class="w-full bg-green-500 hover:bg-green-600 transition-colors text-white rounded-full py-3 text-lg font-semibold shadow-md flex items-center justify-center gap-2 mt-4">
                                Cerrar
                            </button>
                        </div>
                    </div>
                    <style>
                    @keyframes fade-in { from { opacity: 0; transform: scale(0.95);} to { opacity: 1; transform: scale(1);} }
                    .animate-fade-in { animation: fade-in 0.3s ease; }
                    </style>
            `;
            document.body.appendChild(reminder);
            document.getElementById('close-reminder').onclick = () => {
                reminder.remove();
                reminderShown = false;
                resetInactivityTimer();
            };
        }
    }

    // Detectar actividad del usuario
    ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, true);
    });

    // Reiniciar temporizador cuando cambia el carrito
    const origUpdateCart = app.updateCart.bind(app);
    app.updateCart = function(...args) {
        origUpdateCart(...args);
        resetInactivityTimer();
    };
    const origRemoveFromCart = app.removeFromCart.bind(app);
    app.removeFromCart = function(...args) {
        origRemoveFromCart(...args);
        resetInactivityTimer();
    };
    // También al cargar el carrito
    const origLoadCart = app.loadCart.bind(app);
    app.loadCart = function(...args) {
        origLoadCart(...args);
        resetInactivityTimer();
    };

    // Al hacer checkout, ocultar recordatorio
    const origCheckout = app.checkout.bind(app);
    app.checkout = function(...args) {
        origCheckout(...args);
        let reminder = document.getElementById('payment-reminder');
        if (reminder) reminder.remove();
        reminderShown = false;
        resetInactivityTimer();
    };

    app.init();
    // Iniciar temporizador si hay productos en el carrito al cargar
    resetInactivityTimer();
});
