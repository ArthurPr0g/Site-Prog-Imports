"""Confere o site de cada empresa do CSV e grava a coluna `site_check`.

Valores: `fora` (não abre), `parado` (domínio estacionado ou à venda), `sem_https`, `sem_celular` (sem meta viewport, ou
seja, não se adapta ao celular), `vende_online` (já tem loja virtual), `ok`, ou
vazio quando não há site. Mais de um valor vira lista separada por "+"
(ex.: `sem_https+sem_celular`).

São argumentos de venda que o painel de Captação usa na nota. Só a biblioteca
padrão; roda local, depois da busca (o captar.ps1 chama sozinho):

    python checar-sites.py arquivo.csv [--ramo X --cidade "Cidade, UF" --pais BR]

Com --ramo/--cidade/--pais, grava também busca_ramo, busca_cidade, busca_estado
e busca_pais em cada linha: a importação da Captação lê dali e não precisa
perguntar nada (dá para importar vários arquivos de uma vez).
"""
import argparse
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
# Domínio estacionado ou à venda: a página abre, mas o site da empresa morreu
# (ex.: GoDaddy "O domínio clinica.com.br está à venda").
PARADO = re.compile(
    rb"est[a\xc3\xa1]+ [a\xc3\xa0]+ venda|is for sale|domain (?:name )?(?:is )?(?:for sale|available)|buy this domain"
    rb"|dom[i\xc3\xad]+nio (?:est[a\xc3\xa1]+ )?dispon[i\xc3\xad]+vel|godaddy\.com/domain|sedo\.com|dan\.com/buy|afternic"
    rb"|hugedomains|parkingcrew|bodis\.com|domain parking|parked (?:free|domain)|this domain has expired"
    # GoDaddy estacionado: página vazia que redireciona por JavaScript para /lander.
    rb"|location\.href\s*=\s*[\"']/lander",
    re.I,
)
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
    if PARADO.search(html) or re.search(r"forsale\.|sedoparking|parkingcrew|/lander", final, re.I):
        return "parado"
    problemas = []
    if not final.lower().startswith("https://"):
        problemas.append("sem_https")
    if not VIEWPORT.search(html):
        problemas.append("sem_celular")
    # Não é problema, mas evita oferecer loja virtual a quem já vende online.
    if LOJA.search(html):
        problemas.append("vende_online")
    return "+".join(problemas) or "ok"


def main(caminho: str, busca: dict) -> None:
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))
    if not linhas:
        print("CSV vazio.")
        return
    campos = list(linhas[0].keys())
    if "site_check" not in campos:
        campos.append("site_check")
    for k in busca:
        if k not in campos:
            campos.append(k)

    with ThreadPoolExecutor(max_workers=8) as ex:
        resultados = list(ex.map(lambda l: checar(l.get("website", "")), linhas))
    for l, r in zip(linhas, resultados):
        l["site_check"] = r
        l.update(busca)

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
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--ramo")
    ap.add_argument("--cidade", help='"Cidade, UF" (a sigla depois da vírgula vira o estado)')
    ap.add_argument("--pais", choices=["BR", "US", "PT", "ES"])
    a = ap.parse_args()
    busca = {}
    if a.ramo:
        busca["busca_ramo"] = a.ramo
    if a.cidade:
        cidade, _, estado = a.cidade.partition(",")
        busca["busca_cidade"] = cidade.strip()
        busca["busca_estado"] = estado.strip().upper()
    if a.pais:
        busca["busca_pais"] = a.pais
    main(a.csv, busca)
