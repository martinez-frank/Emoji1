# api/main.py
import os
from typing import List, Optional

import requests
import stripe
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Frankiemoji API", version="0.0.5")

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

# ---------- Stripe config ----------
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "https://frankiemoji.com")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


class UploadIn(BaseModel):
    file_url: str
    note: Optional[str] = None


class CheckoutIn(BaseModel):
    pack_type: str              # "starter" | "standard" | "premium"
    expressions: List[str]      # ["Smirk", "Cool (Sunglasses)", ...]
    email: str
    phone: Optional[str] = None
    promo_code: Optional[str] = None
    image_url: str              # Uploadcare CDN URL


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


# ---------- NEW: create-checkout-session for Stripe ----------

@app.post("/api/create-checkout-session")
def create_checkout_session(payload: CheckoutIn):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe secret key not configured.")

    # Map pack types to Stripe Price IDs
    # 👉 Set these as env vars in Vercel, or replace the fallback strings with your real price IDs.
    PACK_PRICE_IDS = {
        "starter": os.getenv("STRIPE_PRICE_STARTER", "price_STARTER_REPLACE_ME"),
        "standard": os.getenv("STRIPE_PRICE_STANDARD", "price_STANDARD_REPLACE_ME"),
        "premium": os.getenv("STRIPE_PRICE_PREMIUM", "price_PREMIUM_REPLACE_ME"),
    }

    pack = payload.pack_type.lower()
    if pack not in PACK_PRICE_IDS:
        raise HTTPException(status_code=400, detail="Invalid pack type")

    try:
        metadata = {
            "pack_type": pack,
            "promo_code": payload.promo_code or "",
            "email": payload.email,
            "phone": payload.phone or "",
            "image_url": payload.image_url,
            "expressions": ",".join(payload.expressions or []),
        }

        checkout_session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price": PACK_PRICE_IDS[pack],
                    "quantity": 1,
                }
            ],
            customer_email=payload.email,
            success_url=(
                f"{FRONTEND_BASE_URL}/upload.html"
                "?paid=1&session_id={{CHECKOUT_SESSION_ID}}"
            ),
            cancel_url=f"{FRONTEND_BASE_URL}/upload.html?canceled=1",
            metadata=metadata,
        )

        return {"checkoutUrl": checkout_session.url}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/hello")
def hello():
    return {"message": "Frankiemoji backend alive — CORS ready ✅"}
