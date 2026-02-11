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
            try {
                if (window.lucide && lucide.createIcons) lucide.createIcons();
            } catch (e) {
                // If lucide isn't available, ignore - icons will fallback to bootstrap icons or SVGs
                console.warn('lucide.createIcons() failed or lucide not available', e);
            }
        },
        async loadData() {
            try {
                // Cargar productos
                const respProd = await fetch('productos.json');
                const data = await respProd.json();

                // Intentar cargar dolar.json (opcional)
                let externalDolar = 0;
                try {
                    const respD = await fetch('dolar.json');
                    if (respD.ok) {
                        const jsonD = await respD.json();
                        externalDolar = Number(jsonD && jsonD.dolar) || 0;
                    }
                } catch (e) {
                    // Si no existe o falla, seguir usando el dólar de productos.json
                    externalDolar = 0;
                }

                const prodDolar = Number(data.dolar) || 0;
                // Usar el valor más alto entre productos.json y dolar.json
                this.dolar = Math.max(prodDolar, externalDolar);

                // Ordenar productos por nombre
                let products = Array.isArray(data.productos) ? data.productos.slice() : [];
                products.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));

                // Filtrar productos cuyo nombre sea la cadena 'null' (ignorando mayúsculas y espacios)
                products = products.filter(p => {
                    const name = (p && p.nombre) ? String(p.nombre).trim().toLowerCase() : '';
                    return name !== 'null' && name !== '';
                });

                // Normalizar precios:
                // - Si el precio viene como string en el JSON => se interpreta como USD y se convierte a Bs usando la tasa `dolar`.
                // - Si el precio viene como número => se interpreta como Bs y se deja tal cual.
                // Guardamos también metadatos auxiliares para depuración o posibles futuras vistas.
                products = products.map(p => {
                    const prod = Object.assign({}, p);
                    if (typeof prod.precio === 'string') {
                        // Detectar si hay precio especial por 2 unidades
                        const match = prod.precio.match(/^([0-9,.]+)(?:\s*\(([^)]+)\))?$/);
                        if (match) {
                            // Precio unitario
                            const raw1 = match[1].trim().replace(/,/, '.');
                            const usd1 = parseFloat(raw1);
                            let bs1 = 0;
                            if (!isNaN(usd1)) {
                                const bsRaw1 = usd1 * this.dolar;
                                bs1 = Math.ceil(bsRaw1 / 10) * 10;
                            }
                            prod.precio = Number(bs1);
                            prod._precio_original = { value: usd1, currency: 'USD' };
                            prod._precio_is_usd = true;
                            // Precio por 2 unidades
                            if (match[2]) {
                                const raw2 = match[2].trim().replace(/,/, '.');
                                const usd2 = parseFloat(raw2);
                                let bs2 = 0;
                                if (!isNaN(usd2)) {
                                    const bsRaw2 = usd2 * this.dolar;
                                    bs2 = Math.ceil(bsRaw2 / 10) * 10;
                                }
                                prod.precio2 = Number(bs2);
                                prod._precio2_original = { value: usd2, currency: 'USD' };
                            }
                        } else {
                            // Normalizar precio simple
                            const raw = prod.precio.trim().replace(/,/, '.');
                            const usd = parseFloat(raw);
                            let bs = 0;
                            if (!isNaN(usd)) {
                                const bsRaw = usd * this.dolar;
                                bs = Math.ceil(bsRaw / 10) * 10;
                            }
                            prod.precio = Number(bs);
                            prod._precio_original = { value: usd, currency: 'USD' };
                            prod._precio_is_usd = true;
                        }
                    } else {
                        // asegurar que sea número
                        const val = Number(prod.precio);
                        prod.precio = isNaN(val) ? 0 : val;
                        prod._precio_original = { value: prod.precio, currency: 'Bs' };
                        prod._precio_is_usd = false;
                    }
                    return prod;
                });

                // Detectar ids duplicados en el JSON y avisar (previene errores al añadir al carrito)
                const idCounts = products.reduce((acc, it) => {
                    acc[it.id] = (acc[it.id] || 0) + 1;
                    return acc;
                }, {});
                const dupIds = Object.keys(idCounts).filter(k => idCounts[k] > 1);
                if (dupIds.length) {
                    console.warn('productos.json: se detectaron ids duplicados en productos:', dupIds);
                }

                this.products = products;
                this.elements.dolarValue.textContent = this.dolar.toFixed(2);
                this.loadCart();
                // Cargar estado de modo oscuro persistido (si existe)
                if (typeof this.loadDarkModeState === 'function') this.loadDarkModeState();
                this.renderProducts();
            } catch (error) {
                console.error('Error loading products:', error);
            }
        },
        renderProducts(filter = '', categoria = null) {
            // Respect quick-tab override when no explicit filter is provided

            const quickTab = (window && window.mercaditoApp && window.mercaditoApp.activeQuickTab) ? window.mercaditoApp.activeQuickTab : null;
            let effectiveCategoria = categoria || quickTab || null;
            let effectiveFilter = (filter && String(filter).trim()) || '';
            this.elements.productList.innerHTML = '';
            const filterNormalized = this.normalizeText(effectiveFilter);
            const filterWords = filterNormalized.split(' ').filter(Boolean);

            // Filtrar por categoría si está definida
            let filteredProducts = this.products;
            if (effectiveCategoria) {
                filteredProducts = filteredProducts.filter(p => p.categoria === effectiveCategoria);
            }

            // Filtrar por inclusión de todas las palabras (comportamiento existente)
            if (filterNormalized) {
                filteredProducts = filteredProducts.filter(p => {
                    const nombreNorm = this.normalizeText(p.nombre);
                    return filterWords.every(word => nombreNorm.includes(word));
                });
            }

            // Si hay filtro, priorizar productos cuyo nombre (o alguna palabra del nombre)
            // comienza con lo que se está escribiendo. Después ordenar alfabéticamente.
            if (filterNormalized) {
                filteredProducts.sort((a, b) => {
                    const aName = this.normalizeText(a.nombre);
                    const bName = this.normalizeText(b.nombre);

                    const startsWithFullA = aName.startsWith(filterNormalized);
                    const startsWithFullB = bName.startsWith(filterNormalized);

                    // Prefiere coincidencias que empiecen por la búsqueda completa
                    if (startsWithFullA && !startsWithFullB) return -1;
                    if (!startsWithFullA && startsWithFullB) return 1;

                    // Si ninguna o ambas empiezan por la búsqueda completa, comprobar
                    // si alguna palabra del nombre empieza por la primera palabra de la consulta
                    const firstToken = filterWords[0] || '';
                    const wordStartA = firstToken && aName.split(' ').some(w => w.startsWith(firstToken));
                    const wordStartB = firstToken && bName.split(' ').some(w => w.startsWith(firstToken));
                    if (wordStartA && !wordStartB) return -1;
                    if (!wordStartA && wordStartB) return 1;

                    // Fallback: ordenar alfabéticamente por nombre normalizado
                    return aName.localeCompare(bName);
                });
            } else {
                // Sin filtro, mantener orden alfabético (o el orden cargado)
                filteredProducts.sort((a, b) => this.normalizeText(a.nombre).localeCompare(this.normalizeText(b.nombre)));
            }

            filteredProducts.forEach(product => {
                const productCard = this.createProductCard(product);
                this.elements.productList.appendChild(productCard);
            });
        },
        createProductCard(product) {
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-lg shadow flex flex-col gap-2';
            const quantity = this.cart[product.id] || 0;
                let precio2Html = '';
                if (product.precio2) {
                    precio2Html = `<div class=\"mt-1 text-xs text-blue-600 font-semibold\">x2</div><div class=\"text-xs font-bold text-blue-700\">Bs. ${product.precio2.toFixed(2)}${product._precio2_original ? ` <span class='text-xs text-gray-500'>($${product._precio2_original.value.toFixed(2)})</span>` : ''}</div>`;
                }
                card.innerHTML = `
                    <div class="flex flex-row items-baseline min-w-0 mb-2">
                        <span class="font-bold text-lg product-title-wrap">${product.nombre}</span>
                        <span class="text-xs text-gray-500 ml-2">${product.gramos}g</span>
                    </div>
                    <div class="flex flex-row items-center justify-between w-full">
                        <div class="flex flex-col items-start">
                            <span class="mx-2 font-bold whitespace-nowrap">Bs. ${product.precio.toFixed(2)}${this.getOriginalPriceLabel(product)}</span>
                            ${precio2Html ? `<div>${precio2Html}</div>` : ''}
                        </div>
                        <div class="flex items-center space-x-1">
                            <button class="minus-button bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-red-400" data-id="${product.id}" aria-label="Restar">
                                <i class="bi bi-dash-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;"></i>
                            </button>
                            <span class="mx-1 w-8 text-center quantity">${quantity}</span>
                            <button class="plus-button bg-green-500 hover:bg-green-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-green-400" data-id="${product.id}" aria-label="Sumar">
                                <i class="bi bi-plus-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin-auto;"></i>
                            </button>
                        </div>
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
                let subtotal = 0;
                if (product.precio2 && quantity >= 2) {
                    // Usar precio especial por cada par de unidades
                    const pares = Math.floor(quantity / 2);
                    const resto = quantity % 2;
                    subtotal = (product.precio2 * pares) + (product.precio * resto);
                } else {
                    subtotal = product.precio * quantity;
                }
                totalBs += subtotal;
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
                // Calcular subtotal igual que en updateCartView
                let subtotal = 0;
                let detalle = '';
                if (product.precio2 && quantity >= 2) {
                    const pares = Math.floor(quantity / 2);
                    const resto = quantity % 2;
                    subtotal = (product.precio2 * pares) + (product.precio * resto);
                    detalle = `<span class='text-xs text-blue-700 ml-1'>(x2 Bs. ${product.precio2.toFixed(2)}${pares > 0 ? ` × ${pares}` : ''}${resto > 0 ? ` + x1 Bs. ${product.precio.toFixed(2)} × ${resto}` : ''})</span>`;
                } else {
                    subtotal = product.precio * quantity;
                }
                item.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <div>
                            <span class="font-semibold">${product.nombre}</span>
                            <span class="text-xs text-gray-500 ml-2">${product.gramos}g</span>
                        </div>
                        <div class="text-xs text-gray-500">Bs. ${product.precio.toFixed(2)} c/u${this.getOriginalPriceLabel(product)}${detalle}</div>
                    </div>
                    <span class="mx-2 font-bold whitespace-nowrap">Bs. ${subtotal.toFixed(2)}</span>
                    <div class="flex items-center space-x-1">
                        <button class="restar bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-red-400" data-id="${product.id}" aria-label="Restar">
                            <i class="bi bi-dash-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;"></i>
                        </button>
                        <span class="mx-1">${quantity}</span>
                        <button class="sumar bg-green-500 hover:bg-green-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-green-400" data-id="${product.id}" aria-label="Sumar">
                            <i class="bi bi-plus-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin-auto;"></i>
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

        // Historial de Pedidos
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
        // Comprueba si el pedido procesado cumple el trigger secreto
        checkSecretDarkMode(entry) {
            try {
                if (!entry || !Array.isArray(entry.items) || entry.items.length === 0) return;
                // Identificar productos "Kamil" en la lista de productos cargados
                const kamilProducts = (this.products || []).filter(p => {
                    try { return String(p.nombre).toLowerCase().startsWith('kamil'); } catch (e) { return false; }
                }).map(p => p.id);
                if (kamilProducts.length === 0) return; // no hay productos Kamil definidos

                // Mapear items del entry por id => cantidad
                const map = {};
                entry.items.forEach(it => { map[Number(it.id)] = Number(it.cantidad) || 0; });

                // Condición: cada producto Kamil debe estar presente con al menos 6 unidades
                const all6 = kamilProducts.every(id => (map[id] || 0) >= 6);
                if (!all6) return;

                // Si cumple, alternar el modo oscuro (toggle)
                const currently = document.body.classList.contains('dark-mode');
                const next = !currently;
                this.applyDarkMode(next);
                console.info('Secret dark-mode trigger activated:', next ? 'ENABLED' : 'DISABLED');
            } catch (e) {
                console.error('Error checking secret dark mode trigger', e);
            }
        },

        // Aplica o quita la clase dark-mode y persiste el estado
        applyDarkMode(enabled) {
            try {
                document.body.classList.toggle('dark-mode', !!enabled);
                localStorage.setItem('mercadito-dark-mode', !!enabled ? '1' : '0');
            } catch (e) {
                console.error('Error applying dark mode', e);
            }
        },

        // Cargar estado persistido del modo oscuro
        loadDarkModeState() {
            try {
                const raw = localStorage.getItem('mercadito-dark-mode');
                const enabled = raw === '1';
                document.body.classList.toggle('dark-mode', !!enabled);
            } catch (e) {
                console.error('Error loading dark mode state', e);
            }
        },
        pushHistoryEntry(entry) {
            const history = this.getHistory();
            history.unshift(entry); // newest first
            if (history.length > 200) history.length = 200;
            this.saveHistory(history);
            // Revisar si el pedido recién procesado cumple el trigger secreto
            if (typeof this.checkSecretDarkMode === 'function') {
                try { this.checkSecretDarkMode(entry); } catch (e) { console.error(e); }
            }
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
        ,
        // Devuelve una etiqueta HTML pequeña con el precio original en USD si existe
        getOriginalPriceLabel(product) {
            try {
                if (product && product._precio_is_usd && product._precio_original && !isNaN(Number(product._precio_original.value))) {
                    const usd = Number(product._precio_original.value);
                    return ` <span class="text-xs text-gray-500">($${usd.toFixed(2)})</span>`;
                }
            } catch (e) {
                // noop
            }
            return '';
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
                    <h3 class="text-xl font-bold">Historial - Pedidos procesados</h3>
                    <div class="flex items-center gap-2">
                        <button id="clear-history" class="text-sm text-red-500">Limpiar</button>
                        <button id="close-history" class="text-sm text-gray-600">Cerrar</button>
                    </div>
                </div>
                <div id="history-list">
                ${history.length === 0 ? '<div class="text-sm text-gray-500">No hay pedidos procesados.</div>' : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('close-history').onclick = () => modal.remove();
        document.getElementById('clear-history').onclick = () => {
            if (confirm('¿Borrar todo el historial de pedidos?')) {
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
            container.innerHTML = '<div class="text-sm text-gray-500">No hay pedidos procesados.</div>';
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
                                ¡Recuerda procesar el pedido!
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

    // Hacer accesible la instancia para scripts externos (p.ej. tabs.js)
    window.mercaditoApp = app;
    app.init();
    // Iniciar temporizador si hay productos en el carrito al cargar
    resetInactivityTimer();
});
