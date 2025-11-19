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
            // Mostrar todos los productos
            searchBar.value = '';
            app.renderProducts('');
            if (app.elements && app.elements.resetSearch) app.elements.resetSearch.classList.add('hidden');
        } else if (tab === 'kamil') {
            tabKamil.classList.add('ring-2', 'ring-blue-300', 'scale-105', 'shadow-lg');
            tabKamil.setAttribute('aria-pressed', 'true');
            // Filtrar por "Kamil"
            searchBar.value = '';
            app.renderProducts('Kamil');
            if (app.elements && app.elements.resetSearch) app.elements.resetSearch.classList.add('hidden');
        }
    }

    tabAdela.addEventListener('click', () => setActive('adela'));
    tabKamil.addEventListener('click', () => setActive('kamil'));

    // Si el usuario escribe en la barra de búsqueda, desactivar las pestañas
    searchBar.addEventListener('input', () => {
        clearActiveStyles();
    });

    // Inicializar con Adela activa (muestra todos los productos)
    setActive('adela');
});
