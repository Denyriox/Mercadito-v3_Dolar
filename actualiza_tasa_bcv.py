import requests
import re
import json
import os
import subprocess

def obtener_tasa_api():
    url_api = "https://ve.dolarapi.com/v1/dolares/oficial"
    try:
        resp = requests.get(url_api, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if "promedio" in data and data["promedio"] is not None:
            return float(data["promedio"])
    except Exception as e:
        print(f"Error al obtener tasa de la API: {e}")
    return None

def obtener_tasa_bcv():
    # Intentar primero con la API
    tasa_api = obtener_tasa_api()
    if tasa_api is not None:
        print(f"Tasa obtenida mediante API: {tasa_api}")
        return tasa_api
        
    print("Falló la API, intentando scraping del BCV...")
    url = "https://www.bcv.org.ve/"
    try:
        resp = requests.get(url, timeout=10, verify=False)
        resp.raise_for_status()
        html = resp.text
        # Buscar el valor de la tasa en el HTML
        match = re.search(r'<div id="dolar".*?<strong>\s*([\d,.]+)\s*</strong>', html, re.DOTALL)
        if match:
            tasa = match.group(1).replace('.', '').replace(',', '.')
            tasa_float = float(tasa)
            return tasa_float
        else:
            print("No se encontró la tasa en la página.")
            return None
    except Exception as e:
        print(f"Error al obtener la tasa: {e}")
        return None

def actualizar_dolar_json(tasa, ruta_json):
    try:
        with open(ruta_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Guardar la tasa con solo 2 decimales, truncando sin redondear
        tasa_str = str(tasa)
        if '.' in tasa_str:
            parte_entera, parte_decimal = tasa_str.split('.')
            parte_decimal = parte_decimal[:2].ljust(2, '0')
            tasa_trunc = float(f"{parte_entera}.{parte_decimal}")
        else:
            tasa_trunc = float(tasa_str)
        data['dolar'] = tasa_trunc
        with open(ruta_json, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Tasa actualizada en {ruta_json}: {data['dolar']}")
    except Exception as e:
        print(f"Error actualizando {ruta_json}: {e}")

def git_commit_and_sync(ruta_json):
    try:
        # 1. Obtener cambios remotos primero
        subprocess.run(["git", "fetch"], check=True)
        
        # 2. Hacer pull permitiendo merge automático (estrategia: preferir remotos para otros archivos)
        # Esto evita que falle si solo hay cambios en archivos que NO son dolar.json
        result = subprocess.run(
            ["git", "pull", "--no-rebase", "origin", "main"],
            capture_output=True,
            text=True
        )
        
        # Si hay conflicto en dolar.json, resolver preferiendo el valor LOCAL (tu tasa actual)
        if "CONFLICT" in result.stdout or "CONFLICT" in result.stderr:
            print("Detectado conflicto, resolviendo...")
            # Forzar uso de nuestra versión para dolar.json
            subprocess.run(["git", "checkout", "--ours", ruta_json], check=True)
            subprocess.run(["git", "add", ruta_json], check=True)
            subprocess.run(["git", "commit", "-m", "Resuelve conflicto: mantiene tasa local"], check=True)
        
        # 3. Ahora sí, commit de nuestros cambios
        subprocess.run(["git", "add", ruta_json], check=True)
        
        # Verificar si hay cambios para commitear
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
        if ruta_json in status.stdout:
            subprocess.run(["git", "commit", "-m", f"Actualiza tasa BCV: {tasa}"], check=True)
            subprocess.run(["git", "push"], check=True)
            print("✅ Sincronización completada.")
        else:
            print("ℹ️ Sin cambios para commitear.")
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Error en git: {e}")
        # No hacer exit(1) para permitir que el script termine gracefulmente

if __name__ == "__main__":
    ruta_json = "dolar.json"
    tasa = obtener_tasa_bcv()
    if tasa:
        print(f"Tasa encontrada en BCV: {tasa}")
        aceptar = input("¿Desea aceptar esta tasa y actualizar dolar.json? (s/n): ").strip().lower()
        if aceptar == 's':
            actualizar_dolar_json(tasa, ruta_json)
            git_commit_and_sync(ruta_json)
    input("Presione enter para terminar el script...")
