/** @type {import('tailwindcss').Config} */
module.exports = {
  // Solo se escanean los archivos que contienen clases de Tailwind.
  // Las clases generadas dinámicamente en JS están escritas como literales
  // en estos archivos, por lo que el escaneo las detecta.
  content: [
    './index.html',
    './script.js',
    './tabs.js',
    './pagoMovil.js',
    './voiceSearch.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
