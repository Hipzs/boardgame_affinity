#!/usr/bin/env python3
"""Serveur de développement de l'interface web : http.server sans cache navigateur.

Sert le dossier web/ (celui de ce fichier), quel que soit le répertoire courant, avec « Cache-Control: no-store » :
chaque rechargement relit les fichiers, plus besoin de versions « ?v=N » dans les HTML.
Usage : python3 web/serve.py [port]   (défaut 8765, écoute sur 127.0.0.1 seulement)
Secours sans ce script : python3 -m http.server 8765 --directory web  (mais le navigateur peut garder en cache).
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

WEB = Path(__file__).resolve().parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # journal compact : une ligne par requête, sans date
        sys.stderr.write("%s %s\n" % (self.command, self.path))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = partial(NoCacheHandler, directory=str(WEB))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"http://127.0.0.1:{port}  (dossier {WEB}, sans cache ; Ctrl+C pour arrêter)", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
