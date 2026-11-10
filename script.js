document.addEventListener('DOMContentLoaded', () => {
    const app = {
        dolar: 0,
        products: [],
    cart: {},
    // Maintain insertion order of product ids added to the cart
    cartOrder: [],
    // Productos temporales creados por el usuario (id negativo -> producto)
    customProducts: {},
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

                // Filtrar productos cuyo nombre sea la cadena 'null' o comience con '*' (ignorando espacios)
                products = products.filter(p => {
                    const name = (p && p.nombre) ? String(p.nombre).trim().toLowerCase() : '';
                    return name !== 'null' && name !== '' && !name.startsWith('*');
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
                this.elements.dolarValue.textContent = this.formatPrice(this.dolar);
                this.loadCart();
                // Cargar estado de modo oscuro persistido (si existe)
                if (typeof this.loadDarkModeState === 'function') this.loadDarkModeState();
                this.renderProducts();
            } catch (error) {
                console.error('Error loading products:', error);
            }
        },
        createCustomProductCard() {
            const card = document.createElement('div');
            card.className = 'custom-product-card bg-white p-4 rounded-lg shadow flex flex-col gap-2';
            card.innerHTML = `
                <div class="flex flex-row items-center justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <i class="bi bi-pencil-square text-blue-600"></i>
                            <span class="font-bold text-lg product-title-wrap">Producto personalizado</span>
                        </div>
                        <div class="text-xs text-gray-500">Monto libre en Bs o $ para hacer cálculos en el carrito</div>
                    </div>
                    <button type="button" class="add-custom-product bg-blue-500 hover:bg-blue-600 transition-colors text-white rounded-full px-4 py-2 flex items-center gap-1 shadow-md" aria-label="Añadir producto personalizado">
                        <i class="bi bi-plus-lg"></i>
                        <span>Añadir</span>
                    </button>
                </div>
            `;
            return card;
        },
        renderProducts(filter = '', categoria = null) {
            // Respect quick-tab override when no explicit filter is provided

            const quickTab = (window && window.mercaditoApp && window.mercaditoApp.activeQuickTab) ? window.mercaditoApp.activeQuickTab : null;
            let effectiveFilter = (filter && String(filter).trim()) || '';
            let effectiveCategoria = categoria || (effectiveFilter ? null : quickTab) || null;
            this.elements.productList.innerHTML = '';
            // La tarjeta para crear productos personalizados siempre va al inicio
            this.elements.productList.appendChild(this.createCustomProductCard());
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
        // Formatea un número como precio: punto para miles y coma para decimales (ej. 1.234,56)
        formatPrice(value) {
            const num = Number(value);
            const safe = isNaN(num) ? 0 : num;
            const [intPart, decPart] = Math.abs(safe).toFixed(2).split('.');
            const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            return `${safe < 0 ? '-' : ''}${grouped},${decPart}`;
        },
        createProductCard(product) {
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-lg shadow flex flex-col gap-2';
            const quantity = this.cart[product.id] || 0;
                let precio2Html = '';
                if (product.precio2) {
                    precio2Html = `<div class=\"mt-1 text-xs text-blue-600 font-semibold\">x2</div><div class=\"text-xs font-bold text-blue-700\">Bs. ${this.formatPrice(product.precio2)}${product._precio2_original ? ` <span class='text-xs text-gray-500'>($${this.formatPrice(product._precio2_original.value)})</span>` : ''}</div>`;
                }
                card.innerHTML = `
                    <div class="flex flex-row items-baseline min-w-0 mb-2">
                        <span class="font-bold text-lg product-title-wrap">${product.nombre.replace(/^Kamil\s*/i, '')}</span>
                        <span class="text-xs text-gray-500 ml-2">${product.gramos}g</span>
                    </div>
                    <div class="flex flex-row items-center justify-between w-full">
                        <div class="flex flex-col items-start">
                            <span class="mx-2 font-bold whitespace-nowrap">Bs. ${this.formatPrice(product.precio)}${this.getOriginalPriceLabel(product)}</span>
                            ${precio2Html ? `<div>${precio2Html}</div>` : ''}
                        </div>
                        <div class="flex items-center space-x-1">
                            <button class="minus-button bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-red-400" data-id="${product.id}" aria-label="Restar">
                                <i class="bi bi-dash-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;"></i>
                            </button>
                            <span class="mx-1 w-8 text-center quantity">${quantity}</span>
                            <button class="plus-button pl-1 bg-green-500 hover:bg-green-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-green-400" data-id="${product.id}" aria-label="Sumar">
                                <i class="bi bi-plus-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin-auto;"></i>
                            </button>
                        </div>
                    </div>
                `;
            return card;
        },
        // Subtotal de una línea del carrito (respeta el precio especial por par)
        getItemSubtotal(product, quantity) {
            if (!product) return 0;
            if (product.precio2 && quantity >= 2) {
                const pares = Math.floor(quantity / 2);
                const resto = quantity % 2;
                return (product.precio2 * pares) + (product.precio * resto);
            }
            return product.precio * quantity;
        },
        // Busca un producto normal o uno personalizado por id
        findProduct(id) {
            const normal = this.products.find(p => p.id == id);
            if (normal) return normal;
            return this.customProducts[String(id)] || null;
        },
        escapeHtml(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },
        generateCustomProductId() {
            // Los ids personalizados son negativos para no chocar con productos.json
            let id = -Date.now();
            while (this.customProducts[String(id)] || this.cart[id]) id -= 1;
            return id;
        },
        // Acepta montos como "10", "10,50", "10.50" o "1.234,56"
        parseCustomAmount(raw) {
            let value = String(raw == null ? '' : raw).trim().replace(/\s/g, '');
            if (!value) return NaN;
            const commas = (value.match(/,/g) || []).length;
            const dots = (value.match(/\./g) || []).length;
            if (commas && dots) {
                if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
                    value = value.replace(/\./g, '').replace(/,/g, '.');
                } else {
                    value = value.replace(/,/g, '');
                }
            } else if (commas) {
                value = value.replace(/,/g, '.');
            } else if (dots > 1) {
                value = value.replace(/\./g, '');
            }
            const amount = parseFloat(value);
            return isFinite(amount) ? amount : NaN;
        },
        // Convierte USD a Bs y redondea hacia arriba a la decena (igual que productos.json)
        convertUsdToBs(usd) {
            const raw = Number(usd) * this.dolar;
            if (!isFinite(raw)) return 0;
            return Math.ceil(raw / 10) * 10;
        },
        addCustomProduct({ nombre, monto, moneda }) {
            const amount = Number(monto);
            if (!isFinite(amount) || amount <= 0) return false;
            const precioBs = moneda === 'USD' ? this.convertUsdToBs(amount) : amount;
            const precio = moneda === 'USD' ? precioBs : Math.round(precioBs * 100) / 100;
            if (!(precio > 0)) return false;

            const id = this.generateCustomProductId();
            const product = {
                id,
                nombre: String(nombre || '').trim() || 'Producto personalizado',
                precio,
                gramos: '',
                _personalizado: true,
                _moneda_original: moneda === 'USD' ? 'USD' : 'Bs',
                _monto_original: amount,
                _precio_is_usd: moneda === 'USD',
                _precio_original: moneda === 'USD' ? { value: amount, currency: 'USD' } : null
            };

            this.customProducts[String(id)] = product;
            this.cart[id] = 1;
            this.cartOrder.push(id);
            this.saveCart();
            this.renderProducts(this.elements.searchBar.value);
            this.updateCartView();
            if (typeof resetInactivityTimer === 'function') resetInactivityTimer();
            return true;
        },
        openCustomProductModal() {
            if (document.getElementById('custom-product-modal')) return;
            const self = this;
            let currency = 'Bs';

            const modal = document.createElement('div');
            modal.id = 'custom-product-modal';
            modal.className = 'custom-modal-overlay';
            modal.innerHTML = `
                <div class="custom-modal-backdrop" data-close></div>
                <form class="custom-modal-panel" novalidate>
                    <div class="custom-modal-header">
                        <div>
                            <h3 class="custom-modal-title">Producto personalizado</h3>
                            <p class="custom-modal-subtitle">Agrega un monto temporal al carrito.</p>
                        </div>
                        <button type="button" class="custom-modal-close" data-close aria-label="Cerrar">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div class="custom-field">
                        <label for="custom-product-name">Nombre (opcional)</label>
                        <input id="custom-product-name" class="custom-input" type="text" autocomplete="off" maxlength="80" placeholder="Ej: Bolsa extra">
                    </div>

                    <div class="custom-field">
                        <label for="custom-product-amount">Monto</label>
                        <div class="custom-amount-row">
                            <input id="custom-product-amount" class="custom-input" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" required>
                            <div class="currency-toggle" role="group" aria-label="Moneda del monto">
                                <button type="button" data-currency="Bs" class="active" aria-pressed="true">Bs</button>
                                <button type="button" data-currency="USD" aria-pressed="false">$</button>
                            </div>
                        </div>
                        <div id="custom-product-hint" class="custom-hint">Ingresa un monto mayor a 0.</div>
                    </div>

                    <div class="custom-modal-actions">
                        <button type="button" class="custom-btn-secondary" data-close>Cancelar</button>
                        <button type="submit" class="custom-btn-primary">
                            <i class="bi bi-plus-lg"></i>
                            <span>Añadir al carrito</span>
                        </button>
                    </div>
                </form>
            `;
            document.body.appendChild(modal);

            const form = modal.querySelector('form');
            const nameInput = modal.querySelector('#custom-product-name');
            const amountInput = modal.querySelector('#custom-product-amount');
            const hint = modal.querySelector('#custom-product-hint');
            const currencyButtons = Array.from(modal.querySelectorAll('[data-currency]'));

            function updateHint() {
                const amount = self.parseCustomAmount(amountInput.value);
                hint.classList.remove('custom-hint-error');
                if (!isFinite(amount) || amount <= 0) {
                    hint.textContent = 'Ingresa un monto mayor a 0.';
                    return;
                }
                if (currency === 'USD') {
                    hint.textContent = `≈ Bs. ${self.formatPrice(self.convertUsdToBs(amount))} (tasa ${self.formatPrice(self.dolar)}, redondeo a la decena)`;
                } else {
                    hint.textContent = `≈ $ ${self.formatPrice(self.dolar ? amount / self.dolar : 0)} (tasa ${self.formatPrice(self.dolar)})`;
                }
            }

            function setCurrency(next) {
                currency = next === 'USD' ? 'USD' : 'Bs';
                currencyButtons.forEach(btn => {
                    const active = btn.dataset.currency === currency;
                    btn.classList.toggle('active', active);
                    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                updateHint();
            }

            function closeModal() {
                document.removeEventListener('keydown', onKeyDown);
                modal.remove();
            }

            function onKeyDown(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeModal();
                }
            }

            currencyButtons.forEach(btn => {
                btn.addEventListener('click', () => setCurrency(btn.dataset.currency));
            });
            amountInput.addEventListener('input', updateHint);
            modal.querySelectorAll('[data-close]').forEach(el => {
                el.addEventListener('click', closeModal);
            });
            document.addEventListener('keydown', onKeyDown);

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const amount = self.parseCustomAmount(amountInput.value);
                if (!isFinite(amount) || amount <= 0) {
                    hint.textContent = 'Ingresa un monto mayor a 0.';
                    hint.classList.add('custom-hint-error');
                    amountInput.focus();
                    return;
                }
                const added = self.addCustomProduct({
                    nombre: nameInput.value,
                    monto: amount,
                    moneda: currency
                });
                if (!added) {
                    hint.textContent = 'No se pudo agregar el producto. Revisa el monto.';
                    hint.classList.add('custom-hint-error');
                    return;
                }
                closeModal();
                self.toggleCart(true);
            });

            setCurrency('Bs');
            amountInput.focus();
        },
        attachEventListeners() {
            this.elements.searchBar.addEventListener('input', (e) => {
                this.renderProducts(e.target.value);
                this.elements.resetSearch.classList.toggle('hidden', !e.target.value);
            });
            // Evita que el botón robe el foco al input (en Android eso cierra el teclado)
            this.elements.resetSearch.addEventListener('pointerdown', (e) => {
                e.preventDefault();
            });
            this.elements.resetSearch.addEventListener('click', () => {
                this.elements.searchBar.value = '';
                this.renderProducts();
                this.elements.resetSearch.classList.add('hidden');
                // Mantiene el foco (y el teclado abierto) en el buscador
                this.elements.searchBar.focus();
            });
            this.elements.productList.addEventListener('click', (e) => {
                if (e.target.closest('.add-custom-product')) {
                    this.openCustomProductModal();
                    return;
                }
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
                    if (this.customProducts[String(id)]) delete this.customProducts[String(id)];
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
            if (this.customProducts[String(id)]) delete this.customProducts[String(id)];
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
                    const product = this.findProduct(pid);
                    return product && this.cart[pid] ? { product, quantity: this.cart[pid] } : null;
                })
                .filter(Boolean);

            cartProductList.forEach(({ product, quantity }) => {
                totalItems += quantity;
                totalBs += this.getItemSubtotal(product, quantity);
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
            this.elements.cartTotalBs.textContent = this.formatPrice(totalBs);
            const totalUsd = totalBs / this.dolar;
            this.elements.cartTotalUsd.textContent = this.formatPrice(totalUsd);

            // Calcular vuelto/cambio
            const cartChangeInfo = document.getElementById('cart-change-info');
            if (cartChangeInfo) {
                if (totalUsd > 0) {
                    const usdUp = Math.ceil(totalUsd); // redondeo hacia arriba
                    const usdDown = Math.floor(totalUsd); // redondeo hacia abajo
                    const faltaUsd = +(usdUp - totalUsd).toFixed(2);
                    const devolverUsd = +(totalUsd - usdDown).toFixed(2);
                    const faltaBs = +(faltaUsd * this.dolar).toFixed(2);
                    const devolverBs = +(devolverUsd * this.dolar).toFixed(2);
                    cartChangeInfo.innerHTML =
                        `<span><span style="color: red;">Vuelto:</span> <b>Bs. ${this.formatPrice(faltaBs)}</b> si paga <b>${usdUp} USD</b></span>` +
                        `<span><span style="color: green;">Completar:</span> <b>Bs. ${this.formatPrice(devolverBs)}</b> si paga <b>${usdDown === 0 ? '' : usdDown + ' USD'}</b>${usdDown === 0 ? '' : ''}</span>`;
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
                if (amountElem) amountElem.textContent = this.formatPrice(totalBs);
                // Mostrar/ocultar barra según si hay productos y si el carrito está cerrado
                const cartOpen = !this.elements.cartSidebar.classList.contains('translate-x-full');
                this.elements.cartPreviewBar.style.display = (!cartOpen && totalItems > 0) ? 'flex' : 'none';
            }
        },
        createCartItem(product, quantity) {
            const item = document.createElement('div');
            const isCustom = !!product._personalizado;
            item.className = 'flex items-center justify-between gap-2 mb-2' + (isCustom ? ' custom-cart-item' : '');
                const subtotal = this.getItemSubtotal(product, quantity);
                let detalle = '';
                if (product.precio2 && quantity >= 2) {
                    const pares = Math.floor(quantity / 2);
                    const resto = quantity % 2;
                    detalle = `<span class='text-xs text-blue-700 ml-1'>(x2 Bs. ${this.formatPrice(product.precio2)}${pares > 0 ? ` × ${pares}` : ''}${resto > 0 ? ` + x1 Bs. ${this.formatPrice(product.precio)} × ${resto}` : ''})</span>`;
                }
                const nombre = this.escapeHtml(String(product.nombre || '').replace(/^Kamil\s*/i, ''));
                const gramosHtml = !isCustom && product.gramos ? `<span class="text-xs text-gray-500 ml-2">${this.escapeHtml(product.gramos)}g</span>` : '';
                const badgeHtml = isCustom ? '<span class="custom-badge">Personalizado</span>' : '';
                item.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <div>
                            <span class="font-semibold">${nombre}</span>
                            ${gramosHtml}
                            ${badgeHtml}
                        </div>
                        <div class="text-xs text-gray-500">Bs. ${this.formatPrice(product.precio)} c/u${this.getOriginalPriceLabel(product)}${detalle}</div>
                    </div>
                    <span class="mx-2 font-bold whitespace-nowrap">Bs. ${this.formatPrice(subtotal)}</span>
                    <div class="flex items-center space-x-1">
                        <button class="restar bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-red-400" data-id="${product.id}" aria-label="Restar">
                            <i class="bi bi-dash-lg" style="font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;"></i>
                        </button>
                        <span class="mx-1">${quantity}</span>
                        <button class="sumar pl-1 bg-green-500 hover:bg-green-600 transition-colors text-white rounded-full p-0 w-8 h-8 flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-green-400" data-id="${product.id}" aria-label="Sumar">
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
            const order = Array.isArray(this.cartOrder) && this.cartOrder.length > 0
                ? this.cartOrder
                : Object.keys(this.cart).map(k => parseInt(k));
            let totalBs = 0;
            const cartSnapshot = order.map(id => {
                const pid = parseInt(id);
                const product = this.findProduct(pid);
                const cantidad = this.cart[pid];
                if (!product || !cantidad) return null;
                totalBs += this.getItemSubtotal(product, cantidad);
                const item = {
                    id: product.id,
                    nombre: product.nombre,
                    precio: product.precio,
                    cantidad
                };
                if (product._personalizado) {
                    item.personalizado = true;
                    item.monedaOriginal = product._moneda_original;
                    item.montoOriginal = product._monto_original;
                }
                return item;
            }).filter(Boolean);
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
            // Los productos personalizados eran temporales: se descartan al procesar el pedido
            this.customProducts = {};
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
                const payload = { cart: this.cart, order: this.cartOrder, customProducts: this.customProducts };
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
                            this.customProducts = (parsed.customProducts && typeof parsed.customProducts === 'object')
                                ? parsed.customProducts
                                : {};
                        } else {
                            // legacy: saved directly as cart object
                            this.cart = parsed;
                            this.cartOrder = Object.keys(this.cart).map(k => parseInt(k));
                            this.customProducts = {};
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
                    return ` <span class="text-xs text-gray-500">($${this.formatPrice(usd)})</span>`;
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
                        <div class="text-xs text-gray-500">Bs. ${app.formatPrice(entry.totalBs)} • USD ${app.formatPrice(entry.totalUsd)} • $${app.formatPrice(entry.dolar)}</div>
                    </div>
                    <div class="text-sm text-gray-600 flex flex-col items-end gap-1">
                        <span>${entry.items.length} ítems</span>
                        <span class="text-xs font-semibold text-blue-500 hover:text-blue-700 cursor-pointer" data-replicate>Replicar pedido</span>
                    </div>
                </div>
                <div class="mt-2 text-xs text-gray-700" style="display:none;" data-details>
                    ${entry.items.map(it => `<div>${it.cantidad} x ${app.escapeHtml(String(it.nombre).replace(/^Kamil\s*/i, ''))}${it.personalizado ? ' <span class="custom-badge">Personalizado</span>' : ''} — Bs. ${app.formatPrice(it.precio*it.cantidad)}</div>`).join('')}
                </div>
            `;
            const replicateBtn = div.querySelector('[data-replicate]');
            if (replicateBtn) {
                replicateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('¿Replicar este pedido? Esto sobreescribirá tu carrito actual.')) {
                        app.cart = {};
                        app.cartOrder = [];
                        app.customProducts = {};
                        entry.items.forEach(it => {
                            if (it.personalizado) {
                                const moneda = it.monedaOriginal === 'USD' ? 'USD' : 'Bs';
                                app.customProducts[String(it.id)] = {
                                    id: it.id,
                                    nombre: it.nombre,
                                    precio: it.precio,
                                    gramos: '',
                                    _personalizado: true,
                                    _moneda_original: moneda,
                                    _monto_original: it.montoOriginal,
                                    _precio_is_usd: moneda === 'USD',
                                    _precio_original: moneda === 'USD' ? { value: it.montoOriginal, currency: 'USD' } : null
                                };
                            }
                            app.cart[it.id] = it.cantidad;
                            app.cartOrder.push(it.id);
                        });
                        app.saveCart();
                        app.renderProducts(app.elements.searchBar.value);
                        app.updateCartView();
                        const modal = document.getElementById('history-modal');
                        if (modal) modal.remove();
                    }
                });
            }
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
