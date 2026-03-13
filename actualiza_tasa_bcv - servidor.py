import requests
import re
import json
import os
import subprocess
import sys

# === CONFIGURACIÓN DE TELEGRAM ===
TOKEN = "8321740202:AAE7WJrcYpXV9Al09eXjj0geYwEMbjLynKI"
CHAT_ID = "880553446"

def enviar_mensaje_telegram(mensaje):
    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    payload = {"chat_id": CHAT_ID, "text": mensaje}
    try:
        requests.post(url, data=payload, timeout=10)
    except Exception as e:
        print(f"Error al enviar mensaje de Telegram: {e}")

def programar_reintento():
    try:
        script_path = os.path.abspath(__file__)
        # Extraemos el directorio y el nombre del archivo para armar el comando correctamente
        directorio = os.path.dirname(script_path)
        nombre_archivo = os.path.basename(script_path)
        # Usamos at para programar el reintento a las 10 PM. Cd garantiza que el script tenga su contexto local
        comando = f"echo 'cd \"{directorio}\" && python3 \"{nombre_archivo}\"' | at 22:00"
        subprocess.run(comando, shell=True, check=True)
        print("Reintento programado para las 10 PM.")
    except Exception as e:
        print(f"Error al programar el reintento: {e}")
        enviar_mensaje_telegram(f"⚠️ Error al programar el reintento con 'at' para las 10 PM: {e}")

def obtener_tasa_bcv():
    url = "https://www.bcv.org.ve/"
    try:
        # Proveemos headers por si el BCV bloquea requests de clientes no identificados
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        resp = requests.get(url, timeout=10, verify=False, headers=headers)
        resp.raise_for_status()
        html = resp.text
        # Buscar el valor de la tasa en el HTML
        match = re.search(r'<div id="dolar".*?<strong>\s*([\d,.]+)\s*</strong>', html, re.DOTALL)
        if match:
            tasa = match.group(1).replace('.', '').replace(',', '.')
            tasa_float = float(tasa)
            return tasa_float
        else:
            msg = "⚠️ No se encontró la tasa en la página del BCV."
            print(msg)
            enviar_mensaje_telegram(msg)
            programar_reintento()
            return None
    except Exception as e:
        print(f"Error al obtener la tasa: {e}")
        msg = f"❌ Error al obtener la tasa del BCV:\n{e}\n\nSe programará un reintento a las 10 PM."
        enviar_mensaje_telegram(msg)
        programar_reintento()
        return None

def leer_tasa_actual(ruta_json):
    try:
        if os.path.exists(ruta_json):
            with open(ruta_json, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('dolar', 0.0)
        return 0.0
    except Exception as e:
        print(f"Error al leer {ruta_json}: {e}")
        return 0.0

def actualizar_dolar_json(tasa, ruta_json):
    try:
        tasa_actual = leer_tasa_actual(ruta_json)
        
        # Guardar la tasa con solo 2 decimales, truncando sin redondear
        tasa_str = str(tasa)
        if '.' in tasa_str:
            parte_entera, parte_decimal = tasa_str.split('.')
            parte_decimal = parte_decimal[:2].ljust(2, '0')
            tasa_trunc = float(f"{parte_entera}.{parte_decimal}")
        else:
            tasa_trunc = float(tasa_str)
            
        # Comparar con la tasa actual (si es mayor, actualiza)
        if tasa_trunc > tasa_actual:
            if os.path.exists(ruta_json):
                with open(ruta_json, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = {}
                
            data['dolar'] = tasa_trunc
            with open(ruta_json, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            msg = f"✅ Tasa del BCV actualizada automáticamente.\n\n📈 Nueva tasa: {tasa_trunc} Bs/$\n📉 Tasa anterior: {tasa_actual} Bs/$"
            print(msg)
            enviar_mensaje_telegram(msg)
            return True
        else:
            msg = f"ℹ️ La tasa obtenida ({tasa_trunc}) no es mayor a la actual ({tasa_actual}). No se actualiza."
            print(msg)
            # Descomenta esto si quieres que también mande mensaje cuando NO se actualiza
            # enviar_mensaje_telegram(msg)
            return False
            
    except Exception as e:
        msg = f"Error actualizando {ruta_json}: {e}"
        print(msg)
        enviar_mensaje_telegram(f"⚠️ {msg}")
        return False

def git_commit_and_sync(ruta_json, tasa):
    try:
        # 1. Obtener cambios remotos primero
        subprocess.run(["git", "fetch"], check=True)
        
        # 2. Hacer pull permitiendo merge automático
        result = subprocess.run(
            ["git", "pull", "--no-rebase", "origin", "main"],
            capture_output=True,
            text=True
        )
        
        # Si hay conflicto en dolar.json, resolver preferiendo el valor LOCAL
        if "CONFLICT" in result.stdout or "CONFLICT" in result.stderr:
            print("Detectado conflicto, resolviendo...")
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
            print("✅ Sincronización en Git completada.")
        else:
            print("ℹ️ Sin cambios para commitear en Git.")
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Error en git: {e}")
        enviar_mensaje_telegram(f"⚠️ Error al sincronizar con Git (commit/push):\n{e}")

if __name__ == "__main__":
    # Cambiamos al directorio del script para evitar ubicaciones relativas erróneas
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    ruta_json = "dolar.json"
    tasa = obtener_tasa_bcv()
    
    if tasa:
        print(f"Tasa encontrada en BCV: {tasa}")
        actualizado = actualizar_dolar_json(tasa, ruta_json)
        
        if actualizado:
            git_commit_and_sync(ruta_json, tasa)
