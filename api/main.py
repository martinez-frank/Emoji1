# api/main.py
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Frankiemoji API", version="0.0.1")

@app.get("/api/hello")
def hello():
    return {"message": "Frankiemoji backend alive - peace!"}

# example protected route for later
@app.get("/api/admin/ping")
def admin_ping(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token != "frankiemoji2025":
        raise HTTPException(status_code=401, detail="Not authorized")
    return {"ok": True, "service": "admin", "status": "ready"}
