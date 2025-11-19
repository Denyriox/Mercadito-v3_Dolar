document.addEventListener('DOMContentLoaded', () => {
    const app = window.mercaditoApp;
    if (!app) return;

    const tabAdela = document.getElementById('tab-adela');
    const tabKamil = document.getElementById('tab-kamil');
    const searchBar = document.getElementById('search-bar');

    if (!tabAdela || !tabKamil || !searchBar) return;

    function clearActiveStyles() {
        tabAdela.classList.remove('ring-2', 'ring-pink-300', 'scale-105', 'shadow-lg');
        tabKamil.classList.remove('ring-2', 'ring-blue-300', 'scale-105', 'shadow-lg');
        tabAdela.setAttribute('aria-pressed', 'false');
        tabKamil.setAttribute('aria-pressed', 'false');
    }

    function setActive(tab) {
        clearActiveStyles();
        if (tab === 'adela') {
            tabAdela.classList.add('ring-2', 'ring-pink-300', 'scale-105', 'shadow-lg');
            tabAdela.setAttribute('aria-pressed', 'true');
            // Marcar pestaña activa y mostrar todos los productos
            app.activeQuickTab = 'adela';
            searchBar.value = '';
            if (app.elements && app.elements.resetSearch) app.elements.resetSearch.classList.add('hidden');
            app.renderProducts('');
        } else if (tab === 'kamil') {
            tabKamil.classList.add('ring-2', 'ring-blue-300', 'scale-105', 'shadow-lg');
            tabKamil.setAttribute('aria-pressed', 'true');
            // Marcar pestaña activa y filtrar por "Kamil"
            app.activeQuickTab = 'kamil';
            searchBar.value = '';
            if (app.elements && app.elements.resetSearch) app.elements.resetSearch.classList.add('hidden');
            app.renderProducts('');
        }
    }

    tabAdela.addEventListener('click', () => setActive('adela'));
    tabKamil.addEventListener('click', () => setActive('kamil'));

    // Si el usuario escribe en la barra de búsqueda, desactivar las pestañas
    searchBar.addEventListener('input', () => {
        clearActiveStyles();
        // quitar la pestaña activa para que la búsqueda manual tenga prioridad
        try { app.activeQuickTab = null; } catch (e) { /* noop */ }
    });

    // Inicializar con Adela activa (muestra todos los productos)
    setActive('adela');
});
