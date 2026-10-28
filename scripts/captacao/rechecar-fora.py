"""Recheca os sites marcados como "fora" (ou "parado") na base da Captação e
corrige `site_check` de quem abriu. Depois rode a reavaliação para recalcular
nota, motivos e pacote:  npx -y tsx scripts/captacao/reavaliar-base.ts

    python scripts/captacao/rechecar-fora.py            # grava
    python scripts/captacao/rechecar-fora.py --simular  # só mostra

Usa NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY do .env.local.
Criado em 28/10/2026, quando a IA disse a um lead que o site estava fora do ar e
ele estava no ar (a checagem antiga marcava "fora" em qualquer falha passageira).
"""
import importlib.util
import json
import sys
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("checar_sites", Path(__file__).with_name("checar-sites.py"))
checar_sites = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checar_sites)

env = {}
for linha in (RAIZ / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in linha and not linha.lstrip().startswith("#"):
        k, v = linha.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
URL, CHAVE = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SECRET_KEY"]
CAB = {"apikey": CHAVE, "Authorization": f"Bearer {CHAVE}", "Content-Type": "application/json"}


def rest(metodo, caminho, corpo=None):
    req = urllib.request.Request(f"{URL}/rest/v1/{caminho}", method=metodo, headers=CAB,
                                 data=json.dumps(corpo).encode() if corpo is not None else None)
    with urllib.request.urlopen(req, timeout=30) as r:
        txt = r.read()
        return json.loads(txt) if txt else None


simular = "--simular" in sys.argv
filtro = urllib.parse.quote("(site_check.like.*fora*,site_check.like.*parado*)")
leads = rest("GET", f"leads?select=id,name,website,site_check&or={filtro}&limit=5000")
print(f"{len(leads)} leads marcados como fora/parado; rechecando…")

with ThreadPoolExecutor(max_workers=6) as ex:
    novos = list(ex.map(lambda l: checar_sites.checar(l["website"] or ""), leads))

mudou = Counter()
for l, novo in zip(leads, novos):
    if novo == l["site_check"]:
        continue
    mudou[f'{l["site_check"]} -> {novo or "(vazio)"}'] += 1
    if not simular:
        rest("PATCH", f'leads?id=eq.{l["id"]}', {"site_check": novo or None})
print("Mudanças:", dict(mudou) or "nenhuma")
print("(simulação: nada gravado)" if simular else "Gravado.")
