from http.server import BaseHTTPRequestHandler
import os, json, uuid
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")
BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "emoji-uploads")

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
        try:
            file_id = str(uuid.uuid4()) + ".png"
            object_path = f"{file_id}"
            resp = supabase.storage.from_(BUCKET).create_signed_upload_url(object_path, 3600)
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "ok": True,
                "upload_url": resp["signedUrl"],
                "object_path": object_path
            }).encode("utf-8"))
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
