# api/main.py
import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

# try to import supabase client
from supabase import create_client, Client

app = FastAPI(title="Frankiemoji API", version="0.0.2")

# --- Supabase setup ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    # we'll still start, but uploading will fail with a clear message
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# data shape from the front-end
class UploadIn(BaseModel):
    file_url: str
    note: Optional[str] = None


@app.post("/api/upload")
def upload_file(payload: UploadIn):
    # guard: do we have a client?
    if supabase is None:
        raise HTTPException(
            status_code=500,
            detail="Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_KEY.",
        )

    try:
        insert_data = {
            "file_url": payload.file_url,
            "note": payload.note,
        }

        result = supabase.table("uploads").insert(insert_data).execute()

        return {
            "ok": True,
            "received": payload.file_url,
            "note": payload.note,
            "status": "stored-db",
            "result": result.data,
        }
    except Exception as e:
        # bubble up the actual reason so you can see it in Vercel logs
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/hello")
def hello():
    return {"message": "Frankiemoji backend connected to Supabase — peace!"}


@app.get("/api/admin/ping")
def admin_ping(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token != "frankiemoji2025":
        raise HTTPException(status_code=401, detail="Not authorized")
    return {"ok": True, "service": "admin", "status": "ready"}
