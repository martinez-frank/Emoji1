# api/main.py
import os
from typing import Optional

import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Frankiemoji API", version="0.0.3")

SUPABASE_URL = os.getenv("SUPABASE_URL")  # e.g. https://xxxx.supabase.co
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


class UploadIn(BaseModel):
    file_url: str
    note: Optional[str] = None


@app.post("/api/upload")
def upload_file(payload: UploadIn):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel.",
        )

    # Supabase REST endpoint for table "uploads"
    endpoint = f"{SUPABASE_URL}/rest/v1/uploads"

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        # allow inserting without specifying all columns
        "Prefer": "return=representation",
    }

    json_payload = {
        "file_url": payload.file_url,
        "note": payload.note,
    }

    try:
        resp = requests.post(endpoint, headers=headers, json=json_payload, timeout=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reach Supabase: {e}")

    if resp.status_code >= 400:
        # Bubble up Supabase error so you see it in the browser
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    return {
        "ok": True,
        "received": payload.file_url,
        "note": payload.note,
        "status": "stored-db",
        "supabase": resp.json(),
    }


@app.get("/api/hello")
def hello():
    return {"message": "Frankiemoji backend alive — HTTP mode ✅"}


@app.get("/api/admin/ping")
def admin_ping(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token != "frankiemoji2025":
        raise HTTPException(status_code=401, detail="Not authorized")
    return {"ok": True, "service": "admin", "status": "ready"}

