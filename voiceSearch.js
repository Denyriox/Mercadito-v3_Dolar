// Activar o desactivar la función de búsqueda por voz en la interfaz
const ENABLE_VOICE_SEARCH = true;

document.addEventListener('DOMContentLoaded', () => {
    const voiceSearchBtn = document.getElementById('voice-search-btn');
    const voiceSearchIcon = document.getElementById('voice-search-icon');
    const searchBar = document.getElementById('search-bar');
    
    // Si la función está desactivada o el botón no existe, no hacemos nada más
    if (!ENABLE_VOICE_SEARCH || !voiceSearchBtn) {
        if (voiceSearchBtn) {
            voiceSearchBtn.style.display = 'none';
        }
        return;
    }

    // Verificar si el navegador soporta la Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('El navegador no soporta la API de reconocimiento de voz.');
        voiceSearchBtn.style.display = 'none'; // ocultar si no hay soporte
        return;
    }

    // Mostrar el botón si hay soporte y está habilitado
    voiceSearchBtn.classList.remove('hidden');

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES'; // Configurar idioma a español
    recognition.continuous = false; // Solo escuchar una frase y detenerse
    recognition.interimResults = false; // Solo resultados finales, no intermedios

    let isListening = false;

    // Cuando se presiona el botón
    voiceSearchBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (e) {
                console.error("Error al iniciar el reconocimiento (quizás ya estaba iniciado):", e);
            }
        }
    });

    // Evento: cuando el reconocimiento de voz comienza
    recognition.addEventListener('start', () => {
        isListening = true;
        // Feedback visual: Icono se pone rojo y palpita ligeramente
        voiceSearchIcon.classList.remove('text-gray-700', 'bi-mic');
        voiceSearchIcon.classList.add('text-red-500', 'bi-mic-fill', 'animate-pulse');
        searchBar.placeholder = "Escuchando...";
    });

    // Evento: cuando se obtiene un resultado
    recognition.addEventListener('result', (event) => {
        // Limpiamos el texto de punto final si el sistema lo agrega automáticamente
        let transcript = event.results[0][0].transcript;
        if (transcript.endsWith('.')) {
            transcript = transcript.slice(0, -1);
        }
        
        // Poner el texto reconocido en la barra de búsqueda
        searchBar.value = transcript;

        // Disparar el evento 'input' para que script.js filtre los productos
        const inputEvent = new Event('input', { bubbles: true });
        searchBar.dispatchEvent(inputEvent);
    });

    // Evento: cuando termina de escuchar (ya sea por error, resultado o detenido manualmente)
    recognition.addEventListener('end', () => {
        isListening = false;
        // Restaurar estado visual
        voiceSearchIcon.classList.remove('text-red-500', 'bi-mic-fill', 'animate-pulse');
        voiceSearchIcon.classList.add('text-gray-700', 'bi-mic');
        searchBar.placeholder = "Buscar productos...";
    });

    // Manejo de errores
    recognition.addEventListener('error', (event) => {
        console.error('Error en el reconocimiento de voz:', event.error);
        if (event.error === 'not-allowed') {
            alert('Por favor, permite el acceso al micrófono para usar la búsqueda por voz.');
        }
        recognition.stop();
    });
});
