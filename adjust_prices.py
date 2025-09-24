#!/usr/bin/env python3
"""
Script para aumentar o disminuir los precios en `productos.json`.

Funcionalidad:
- Abre `productos.json` en el mismo directorio.
- Crea un backup `productos.json.bak` antes de guardar.
- Pregunta si desea aumentar o disminuir.
- Pregunta la cantidad (acepta porcentaje como "10%" o un monto numérico como "50").
- Manejo de errores para E/S y entradas inválidas.
- Pide presionar Enter para cerrar el script.

Uso: ejecutar desde la carpeta del proyecto.
"""

import json
import shutil
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
JSON_PATH = PROJECT_DIR / 'productos.json'
BACKUP_PATH = PROJECT_DIR / 'productos.json.bak'


def read_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise
    except json.JSONDecodeError as e:
        raise


def write_json(path, data):
    try:
        # Intentamos preservar el formato original: reescribimos solo el arreglo `productos`
        write_json_preserve_format(path, data)
    except Exception:
        # Fallback: volcar con indent si algo falla
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            raise


def write_json_preserve_format(path, data):
    """Reescribe el archivo JSON manteniendo la mayor parte del formato original.

    Estrategia:
    - Lee el archivo original como texto.
    - Busca la clave "productos" y localiza el bloque array [ ... ].
    - Reemplaza el contenido de ese array por una versión donde cada objeto producto
      está en una sola línea (una línea por producto), manteniendo la sangría detectada.
    - Si no encuentra la sección, lanza RuntimeError y el caller hará fallback.
    """
    text = Path(path).read_text(encoding='utf-8')
    key = '"productos"'
    idx = text.find(key)
    if idx == -1:
        raise RuntimeError('No se encontró la clave "productos" en el archivo original')

    # localizar '[' que inicia el array, después de la clave
    arr_start = text.find('[', idx)
    if arr_start == -1:
        raise RuntimeError('No se encontró inicio del array de productos')

    # Encontrar el ']' correspondiente al array (contando niveles de corchetes)
    i = arr_start
    depth = 0
    end_idx = -1
    while i < len(text):
        ch = text[i]
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                end_idx = i
                break
        i += 1
    if end_idx == -1:
        raise RuntimeError('No se encontró fin del array de productos')

    # Determinar la sangría prefijada en la línea del '['
    line_start = text.rfind('\n', 0, arr_start) + 1
    prefix = text[line_start:arr_start]
    # calcular indentación: todo lo que hay entre line_start y arr_start
    indent = ''
    for ch in prefix:
        if ch in (' ', '\t'):
            indent += ch
        else:
            indent = ''
    # construir nuevo contenido del array: una línea por producto
    productos = data.get('productos', [])
    prod_lines = []
    for p in productos:
        # serializar objeto en una sola línea
        line = json.dumps(p, ensure_ascii=False, separators=(', ', ': '))
        prod_lines.append(f'{indent}  {line}')
    new_array = '[\n' + ',\n'.join(prod_lines) + '\n' + indent + ']'

    # reemplazar en el texto original
    new_text = text[:arr_start] + new_array + text[end_idx+1:]
    Path(path).write_text(new_text, encoding='utf-8')


def parse_amount(text):
    """Parsea la entrada del usuario: si termina en '%' es porcentaje, si no es monto absoluto.

    Retorna una tupla (is_percent: bool, value: float).
    Lanza ValueError si no es válido.
    """
    text = text.strip()
    if text.endswith('%'):
        num = text[:-1].strip()
        if not num:
            raise ValueError('Porcentaje vacío')
        val = float(num.replace(',', '.'))
        return True, val
    else:
        val = float(text.replace(',', '.'))
        return False, val


def apply_change(products, increase, is_percent, amount):
    """Aplica el cambio y devuelve (n_changed, samples).
    Modifica in-place la lista de productos.
    """
    n = 0
    samples = []
    factor = None
    for p in products:
        if 'precio' not in p:
            continue
        old = p['precio']
        if is_percent:
            change = old * (amount / 100.0)
        else:
            change = amount
        if not increase:
            change = -change
        new_price = old + change
        # redondear a 2 decimales, pero si es entero, dejar int
        new_price = round(new_price, 2)
        if abs(new_price - int(new_price)) < 1e-9:
            new_price = int(new_price)
        p['precio'] = new_price
        n += 1
        if len(samples) < 5:
            samples.append((p.get('id'), p.get('nombre'), old, new_price))
    return n, samples


def main():
    print('Abrir:', JSON_PATH)
    try:
        data = read_json(JSON_PATH)
    except FileNotFoundError:
        print('Error: no se encontró', JSON_PATH)
        input('Presione Enter para cerrar...')
        sys.exit(1)
    except json.JSONDecodeError as e:
        print('Error: el archivo JSON está corrupto o no es válido:', e)
        input('Presione Enter para cerrar...')
        sys.exit(1)

    productos = data.get('productos')
    if not isinstance(productos, list):
        print('Error: `productos` no es una lista en el JSON.')
        input('Presione Enter para cerrar...')
        sys.exit(1)

    # Preguntar aumento o disminución
    while True:
        mode = input('¿Desea aumentar o disminuir los precios? (aumentar/disminuir) [a/d]: ').strip().lower()
        if mode in ('a', 'aumentar', 'subir', 's'):
            increase = True
            break
        if mode in ('d', 'disminuir', 'bajar'):
            increase = False
            break
        print('Por favor responda "a" para aumentar o "d" para disminuir.')

    # Preguntar cantidad
    while True:
        raw = input('Ingrese la cantidad (por ejemplo "10%" para porcentaje o "50" para monto absoluto): ').strip()
        try:
            is_percent, amount = parse_amount(raw)
            break
        except ValueError:
            print('Entrada inválida. Use un número o un porcentaje como "12%".')
        except Exception as e:
            print('Error al leer la cantidad:', e)

    # Mostrar resumen y pedir confirmación
    typ = 'porcentaje' if is_percent else 'monto absoluto'
    sign = 'aumentar' if increase else 'disminuir'
    print(f'Vas a {sign} todos los precios en {amount} {typ}.')
    ok = input('Confirma y guarda los cambios? (s/n): ').strip().lower()
    if ok not in ('s', 'si', 'y', 'yes'):
        print('Operación cancelada. No se realizaron cambios.')
        input('Presione Enter para cerrar...')
        return

    # Crear backup
    try:
        shutil.copy2(JSON_PATH, BACKUP_PATH)
        print('Backup creado en', BACKUP_PATH)
    except Exception as e:
        print('Advertencia: no se pudo crear backup:', e)

    # Aplicar cambios
    n_changed, samples = apply_change(productos, increase, is_percent, amount)
    try:
        write_json(JSON_PATH, data)
    except Exception as e:
        print('Error al guardar el archivo:', e)
        print('Se intentará restaurar el backup...')
        try:
            shutil.copy2(BACKUP_PATH, JSON_PATH)
            print('Restaurado desde backup.')
        except Exception as e2:
            print('No se pudo restaurar el backup:', e2)
        input('Presione Enter para cerrar...')
        sys.exit(1)

    print(f'Actualizados {n_changed} productos. Ejemplos:')
    for s in samples:
        pid, nombre, old, new = s
        print(f'  id={pid} | {nombre} : {old} -> {new}')

    print('Listo. Se guardó en', JSON_PATH)
    input('Presione Enter para cerrar...')


if __name__ == '__main__':
    main()
