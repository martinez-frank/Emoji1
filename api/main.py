# api/main.py
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from supabase import create_client, Client

# Initialize FastAPI
app = FastAPI(title="Frankiemoji API", version="0.0.2")

# Setup Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Data shape for uploads
class UploadIn(BaseModel):
    file_url: str  # required
    note: Optional[str] = None  # optional field for comments

@app.post("/api/upload")
def upload_file(payload: UploadIn):
    try:
        # insert data into uploads table
        data = {
            "file_url": payload.file_url,
            "note": payload.note,
        }
        result = supabase.table("uploads").insert(data).execute()

        return {
            "ok": True,
            "received": payload.file_url,
            "note": payload.note,
            "status": "stored-db",
            "result": result.data,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/hello")
def hello():
    return {"message": "Frankiemoji backend connected to Supabase — peace!"}

@app.get("/api/admin/ping")
def admin_ping(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token != "frankiemoji2025":
        raise HTTPException(status_code=401, detail="Not authorized")
    return {"ok": True, "service": "admin", "status": "ready"}
