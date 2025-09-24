La aplicación es una lista de compras digital, diseñada para ser rápida, intuitiva y fácil de usar, especialmente en dispositivos móviles. Su propósito principal es permitir a los usuarios seleccionar productos de una lista predefinida, ajustar las cantidades deseadas y ver un total de su compra tanto en la moneda local (Bolívares - Bs.) como en su equivalente en dólares (USD).

Interfaz Principal y Lista de Productos:

Al abrir la aplicación, el usuario ve una interfaz limpia con una lista de productos.
Cada producto en la lista se muestra en una fila horizontal con la siguiente información:
Nombre del producto y su peso en gramos (ej: "Manzanas Orgánicas", 500g).
Precio individual en Bolívares (ej: "Bs. 518.70").
Un control de cantidad numérico que comienza en "0" y puede ser ajustado con dos botones: uno para sumar (+) y otro para restar (-).
La lista de productos se carga ordenada alfabéticamente por defecto.
Fuente de Datos (JSON):

Toda la información de los productos (ID, nombre, gramos, precio, categoría) y el tipo de cambio del dólar no están fijos en el código, sino que se leen desde un archivo externo: productos.json.
Esto permite una fácil actualización de precios, productos y del valor del dólar sin necesidad de modificar el código fuente de la aplicación.
Barra de Navegación y Búsqueda:

En la parte superior, hay una barra de navegación fija que contiene:
A la izquierda, el valor actual del dólar representado con un ícono de dólar ($) seguido del monto (ej: 130.00). Esto proporciona una referencia rápida del tipo de cambio que se usa para los cálculos.
En el centro, una barra de búsqueda que ocupa la mayor parte del espacio. Permite al usuario filtrar la lista de productos en tiempo real.
La búsqueda es inteligente: no distingue entre mayúsculas y minúsculas, y es insensible a los acentos (buscar "cafe" encontrará "Café").
A la derecha de la búsqueda, aparece un ícono de reinicio (<RotateCcw />) solo cuando el usuario ha escrito algo. Al hacer clic, borra el texto de la búsqueda y restaura la lista completa de productos.
Gestión del Carrito:

Los productos se añaden al carrito simplemente incrementando su cantidad desde la lista principal. No hay un botón de "Añadir al carrito" por producto, haciendo el proceso más directo.
El botón para disminuir la cantidad (-) se vuelve de color rojo cuando la cantidad de un producto es mayor a cero, sirviendo como una señal visual de que se puede "eliminar" o reducir la selección.
Carrito Flotante y Resumen:

En la parte inferior de la pantalla, un botón flotante está siempre visible. Este botón muestra un resumen en tiempo real del carrito:
La cantidad total de productos seleccionados.
El monto total a pagar en Bolívares.
Al hacer clic en este botón, se despliega una vista lateral del carrito con más detalles.
Vista Detallada del Carrito:

La vista lateral del carrito muestra:
Un listado de solo los productos cuya cantidad es mayor a cero.
Para cada producto: su nombre, precio unitario, los controles para seguir ajustando la cantidad, y el subtotal en Bolívares para ese producto.
Un botón para eliminar completamente un producto del carrito (<Trash2 />).
En la parte inferior de esta vista, se presenta un resumen final:
El Total en Bs.
El Total en USD, calculado dinámicamente usando el valor del dólar del archivo JSON.
Finalmente, un botón de "Proceder a Pagar". Al presionarlo, el carrito se vacía por completo y la vista lateral se cierra, dejando la aplicación lista para una nueva compra.

Persistencia: El contenido del carrito se guarda en el localStorage del navegador. Esto significa que si el usuario cierra o recarga la página, su lista de compras permanecerá intacta.
Componentes: La interfaz está modularizada en componentes reutilizables (ProductCard, Cart, etc.) utilizando ShadCN UI para los elementos de la interfaz, lo que garantiza un diseño moderno y consistente.
Estilo: Se utiliza Tailwind CSS para un diseño responsivo y personalizable.
En resumen, es un sistema de compras optimizado para la eficiencia, con una interfaz minimalista, funcionalidades inteligentes como la búsqueda insensible a acentos y la persistencia de datos, y una clara separación entre la lógica de la aplicación y los datos de los productos.