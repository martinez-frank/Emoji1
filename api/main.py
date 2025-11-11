# api/main.py
import os
from typing import Optional

import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Frankiemoji API", version="0.0.4")

# allow your sites to call this API
origins = [
    "https://frankiemoji.com",
    "https://www.frankiemoji.com",
    "https://emoji1-sandy.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
UPLOAD_SECRET = os.getenv("FRANKIEMOJI_UPLOAD_SECRET")  # optional

class UploadIn(BaseModel):
    file_url: str
    note: Optional[str] = None

@app.get("/api/upload")
def upload_info():
    return {"detail": "This endpoint accepts POST with JSON: { 'file_url': '...', 'note': '...' }"}

@app.post("/api/upload")
def upload_file(payload: UploadIn, x_upload_key: Optional[str] = Header(None)):
    # if you set FRANKIEMOJI_UPLOAD_SECRET in Vercel, enforce it
    if UPLOAD_SECRET and x_upload_key != UPLOAD_SECRET:
        raise HTTPException(status_code=401, detail="Not authorized")

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel.",
        )

    endpoint = f"{SUPABASE_URL}/rest/v1/uploads"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
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
    return {"message": "Frankiemoji backend alive — CORS ready ✅"}
