"""Confere o site de cada empresa do CSV e grava a coluna `site_check`.

Valores: `fora` (não abre), `sem_https`, `sem_celular` (sem meta viewport, ou
seja, não se adapta ao celular), `vende_online` (já tem loja virtual), `ok`, ou
vazio quando não há site. Mais de um valor vira lista separada por "+"
(ex.: `sem_https+sem_celular`).

São argumentos de venda que o painel de Captação usa na nota. Só a biblioteca
padrão; roda local, depois da busca (o captar.ps1 chama sozinho):

    python checar-sites.py arquivo.csv
"""
import csv
import re
import ssl
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TIMEOUT = 15
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
# Endereços que não são site da empresa: o painel já trata como "site fraco".
NAO_E_SITE = re.compile(r"instagram\.com|facebook\.com|fb\.(com|me)|wa\.me|whatsapp|linktr\.ee|linkin\.bio", re.I)
VIEWPORT = re.compile(rb"<meta[^>]+name=[\"']?viewport", re.I)
# Sinais de loja virtual na página inicial (plataformas e carrinho).
LOJA = re.compile(
    rb"vtex|shopify|nuvemshop|tray\.com|lojaintegrada|woocommerce|magento|bigcommerce|wix-ecommerce"
    rb"|add-to-cart|addtocart|/carrinho|/cart\b|/checkout|minicart",
    re.I,
)


def checar(url: str) -> str:
    url = url.strip()
    if not url or NAO_E_SITE.search(url):
        return ""
    if not re.match(r"https?://", url, re.I):
        url = "http://" + url
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        # Certificado inválido também é problema real, mas aqui só queremos saber se abre.
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as r:
            final = r.geturl()
            html = r.read(400_000)
    except urllib.error.HTTPError:
        # Respondeu com erro (403 de proteção anti-robô, 503 do Cloudflare...):
        # o site existe, só não deu para olhar. Não é argumento de venda.
        return "ok"
    except Exception:
        # DNS que não resolve, conexão recusada, tempo esgotado: fora do ar.
        return "fora"
    problemas = []
    if not final.lower().startswith("https://"):
        problemas.append("sem_https")
    if not VIEWPORT.search(html):
        problemas.append("sem_celular")
    # Não é problema, mas evita oferecer loja virtual a quem já vende online.
    if LOJA.search(html):
        problemas.append("vende_online")
    return "+".join(problemas) or "ok"


def main(caminho: str) -> None:
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))
    if not linhas:
        print("CSV vazio.")
        return
    campos = list(linhas[0].keys())
    if "site_check" not in campos:
        campos.append("site_check")

    with ThreadPoolExecutor(max_workers=8) as ex:
        resultados = list(ex.map(lambda l: checar(l.get("website", "")), linhas))
    for l, r in zip(linhas, resultados):
        l["site_check"] = r

    with open(caminho, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=campos)
        w.writeheader()
        w.writerows(linhas)

    contagem = {}
    for r in resultados:
        for p in (r or "sem site/rede social").split("+"):
            contagem[p] = contagem.get(p, 0) + 1
    print("Sites conferidos:", ", ".join(f"{k}: {v}" for k, v in sorted(contagem.items())))


if __name__ == "__main__":
    main(sys.argv[1])
