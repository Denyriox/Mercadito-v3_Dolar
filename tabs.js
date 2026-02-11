document.addEventListener('DOMContentLoaded', () => {

    // Esperar a que la app esté disponible
    const appInterval = setInterval(() => {
        const app = window.mercaditoApp || window.app;
        if (!app || !app.products) return;
        clearInterval(appInterval);

        const quickTabsContainer = document.getElementById('quick-tabs');
        const searchBar = document.getElementById('search-bar');
        if (!quickTabsContainer || !searchBar) return;

        // Obtener categorías únicas
        const categorias = Array.from(new Set(app.products.map(p => p.categoria)));
        // Ordenar: General primero, Kamil segundo, el resto alfabético
        const otras = categorias.filter(c => c !== 'General' && c !== 'Kamil').sort((a, b) => a.localeCompare(b));
        const ordenadas = ['General', 'Kamil', ...otras].filter((v, i, arr) => categorias.includes(v) && arr.indexOf(v) === i);

        // Leer colores desde colores-pestañas.json
        fetch('colores-pestañas.json').then(r => r.json()).then(colores => {
            // Limpiar tabs existentes
            quickTabsContainer.innerHTML = '';
            // Crear pestañas
            ordenadas.forEach((cat, idx) => {
                const btn = document.createElement('button');
                btn.className = 'px-4 py-2 rounded-full text-white font-semibold transition-all';
                btn.textContent = cat;
                btn.dataset.categoria = cat;
                // Color
                let color = colores[cat] || colores['Otros'] || '#9E9E9E';
                btn.style.backgroundColor = color;
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                btn.setAttribute('aria-pressed', 'false');
                quickTabsContainer.appendChild(btn);
            });

            // Función para limpiar estilos activos
            function clearActiveStyles() {
                Array.from(quickTabsContainer.children).forEach(btn => {
                    btn.classList.remove('ring-2', 'scale-105', 'shadow-lg');
                    btn.setAttribute('aria-pressed', 'false');
                });
            }

            // Activar pestaña y filtrar productos
            function setActiveCategoria(cat) {
                clearActiveStyles();
                const btn = Array.from(quickTabsContainer.children).find(b => b.dataset.categoria === cat);
                if (btn) {
                    btn.classList.add('ring-2', 'scale-105', 'shadow-lg');
                    btn.setAttribute('aria-pressed', 'true');
                }
                app.activeQuickTab = cat;
                searchBar.value = '';
                if (app.elements && app.elements.resetSearch) app.elements.resetSearch.classList.add('hidden');
                // Filtrar productos por categoría
                app.renderProducts('', cat);
            }

            // Añadir listeners
            Array.from(quickTabsContainer.children).forEach(btn => {
                btn.addEventListener('click', () => setActiveCategoria(btn.dataset.categoria));
            });

            // Desactivar pestañas si se escribe en la barra de búsqueda
            searchBar.addEventListener('input', () => {
                clearActiveStyles();
                try { app.activeQuickTab = null; } catch (e) { /* noop */ }
            });

            // Activar General por defecto
            setActiveCategoria('General');
        });
    }, 100);
});
