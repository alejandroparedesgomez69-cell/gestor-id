# Servidor local del Gestor I+D.
#  - Sirve la app (index.html, app.js, styles.css) en http://127.0.0.1:8770
#  - Hace de puente hacia GitHub usando la sesión de GitHub CLI (`gh auth login`),
#    así el navegador no necesita guardar ningún token.
#  - Solo escucha en 127.0.0.1 y solo permite el repositorio indicado en --repo.
#
# Uso: python servidor.py --repo usuario/gestor-id-datos [--port 8770]
import argparse, json, os, re, subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--repo", required=True, help="usuario/repositorio permitido")
ap.add_argument("--port", type=int, default=8770)
A = ap.parse_args()
REPO = A.repo.strip().lower()
STATIC = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/styles.css": "styles.css"}
ROUTE = re.compile(r"^/gh/repos/([^/]+)/([^/]+)(/contents/[^?]+|/git/blobs/[0-9a-f]+)?(\?ref=[\w.\-/%]+)?$")


def gh_api(method, path, body=None):
    """Llama a `gh api` y devuelve (status, bytes)."""
    cmd = ["gh", "api", "-X", method, "--include", "-H", "Accept: application/vnd.github+json", path]
    if body is not None:
        cmd += ["--input", "-"]
    p = subprocess.run(cmd, input=body, capture_output=True, timeout=60)
    out = p.stdout.decode("utf-8", "replace")
    m = re.match(r"HTTP/[\d.]+ (\d{3})", out)
    if not m:
        msg = (p.stderr.decode("utf-8", "replace") or out).strip()
        return 502, json.dumps({"message": "gh: " + msg[:300]}).encode()
    head, _, rest = out.partition("\r\n\r\n")
    if not _:
        head, _, rest = out.partition("\n\n")
    return int(m.group(1)), rest.encode("utf-8")


class H(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if "/gh/" in (args[0] if args else ""):
            print("[GH]", fmt % args, flush=True)

    def _send(self, code, body, ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy(self, method):
        m = ROUTE.match(self.path)
        if not m or f"{m.group(1)}/{m.group(2)}".lower() != REPO:
            return self._send(403, json.dumps({"message": f"Solo se permite el repositorio {REPO}"}).encode())
        if method == "PUT" and not (m.group(3) or "").startswith("/contents/"):
            return self._send(405, b'{"message":"metodo no permitido"}')
        body = None
        if method == "PUT":
            n = int(self.headers.get("Content-Length", 0))
            if n > 20_000_000:
                return self._send(413, b'{"message":"archivo demasiado grande"}')
            body = self.rfile.read(n)
        code, data = gh_api(method, self.path[len("/gh/"):], body)
        self._send(code, data)

    def do_GET(self):
        if self.path.startswith("/gh/"):
            return self._proxy("GET")
        if self.path == "/gh-info":
            return self._send(200, json.dumps({"repo": A.repo}).encode())
        f = STATIC.get(self.path.split("?")[0])
        if not f:
            return self._send(404, b"no encontrado", "text/plain")
        ctype = {"html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8"}[f.rsplit(".", 1)[1]]
        with open(os.path.join(HERE, f), "rb") as fh:
            self._send(200, fh.read(), ctype)

    def do_PUT(self):
        if self.path.startswith("/gh/"):
            return self._proxy("PUT")
        self._send(405, b"", "text/plain")


if __name__ == "__main__":
    st = subprocess.run(["gh", "auth", "status"], capture_output=True)
    if st.returncode != 0:
        raise SystemExit("GitHub CLI no tiene sesión. Ejecuta: gh auth login")
    print(f"[SERVIDOR] Gestor I+D en http://127.0.0.1:{A.port}/  ·  repo permitido: {A.repo}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", A.port), H).serve_forever()
