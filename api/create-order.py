from http.server import BaseHTTPRequestHandler
import json, os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

class handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        data = json.loads(body)

        pack_type = data.get("pack_type")
        expressions = data.get("expressions", [])
        email = data.get("email")
        phone = data.get("phone")
        image_path = data.get("image_path")

        try:
            res = supabase.table("emoji_orders").insert({
                "pack_type": pack_type,
                "expressions": expressions,
                "email": email,
                "phone": phone,
                "image_path": image_path,
                "status": "new"
            }).execute()

            self._set_headers(200)
            self.wfile.write(json.dumps({"ok": True, "order": res.data}).encode("utf-8"))
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
