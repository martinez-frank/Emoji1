# api/main.py
import os
from typing import List, Optional

import logging

import requests
import stripe
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Frankiemoji API", version="0.0.5")

# -------------------------------------------------------------------
# CORS: allow your frontends
# -------------------------------------------------------------------
origins = [
    "https://frankiemoji.com",
    "https://www.frankiemoji.com",
    "https://frankiemoji.vercel.app",
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

# -------------------------------------------------------------------
# Supabase config
# -------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
UPLOAD_SECRET = os.getenv("FRANKIEMOJI_UPLOAD_SECRET")  # optional shared secret

# -------------------------------------------------------------------
# Stripe config
# -------------------------------------------------------------------
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "https://frankiemoji.com")
# Base prices in cents (keep in sync with Stripe prices)
BASE_PRICE_CENTS = {
    "starter": 500,   # $5.00
    "standard": 1500, # $15.00
    "premium": 2500,  # $25.00
}

logger = logging.getLogger("uvicorn.error")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
else:
    logger.warning(
        "STRIPE_SECRET_KEY is not set. /api/create-checkout-session will return 500 until configured."
    )

# -------------------------------------------------------------------
# Pydantic models
# -------------------------------------------------------------------
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


# -------------------------------------------------------------------
# Simple health/info endpoints
# -------------------------------------------------------------------
@app.get("/api/hello")
def hello():
    return {"message": "Frankiemoji backend alive — CORS ready ✅"}


@app.get("/api/upload")
def upload_info():
    return {"detail": "This endpoint accepts POST with JSON: { 'file_url': '...', 'note': '...' }"}


# -------------------------------------------------------------------
# /api/upload  → store Uploadcare file URL in Supabase
# -------------------------------------------------------------------
@app.post("/api/upload")
def upload_file(payload: UploadIn, x_upload_key: Optional[str] = Header(None)):
    # Optional shared-secret protection
    if UPLOAD_SECRET and x_upload_key != UPLOAD_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authorized")

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
        logger.exception("Error calling Supabase in /api/upload")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not reach Supabase: {e}",
        )

    if resp.status_code >= 400:
        logger.error("Supabase error in /api/upload: %s", resp.text)
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    return {
        "ok": True,
        "received": payload.file_url,
        "note": payload.note,
        "status": "stored-db",
        "supabase": resp.json(),
    }


# -------------------------------------------------------------------
# /api/create-checkout-session  → Stripe Checkout + emoji_orders row
# -------------------------------------------------------------------
@app.post("/api/create-checkout-session")
def create_checkout_session(payload: CheckoutIn):
    if not STRIPE_SECRET_KEY:
        logger.error("Stripe secret key missing")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe secret key not configured.",
        )

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase config missing")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel.",
        )

    PACK_PRICE_IDS = {
        "starter": os.getenv("STRIPE_PRICE_STARTER", "price_STARTER_REPLACE_ME"),
        "standard": os.getenv("STRIPE_PRICE_STANDARD", "price_STANDARD_REPLACE_ME"),
        "premium": os.getenv("STRIPE_PRICE_PREMIUM", "price_PREMIUM_REPLACE_ME"),
    }

    PROMO_ENV_MAP = {
        "frankie10": "STRIPE_PROMO_FRANKIE10",
        "frankiemoji10": "STRIPE_PROMO_FRANKIE10",
        "holiday15": "STRIPE_PROMO_HOLIDAY15",
        "crew100": "STRIPE_PROMO_CREW100",
        "aaronemoji10": "STRIPE_PROMO_AARON10",
        "donniemoji10": "STRIPE_PROMO_DONNI10",
    }

    # 1) Validate pack + price
    pack = (payload.pack_type or "").lower()
    if pack not in PACK_PRICE_IDS:
        raise HTTPException(status_code=400, detail="Invalid pack type")

    price_id = PACK_PRICE_IDS[pack]

    if not price_id.startswith("price_") or "REPLACE_ME" in price_id:
        raise HTTPException(
            status_code=500,
            detail=f"Missing Stripe price for pack '{pack}'. Set env STRIPE_PRICE_{pack.upper()}",
        )

    base_price_cents = BASE_PRICE_CENTS.get(pack)
    if base_price_cents is None:
        raise HTTPException(
            status_code=500,
            detail=f"Missing base price cents for pack '{pack}'.",
        )

    # 2) Normalize promo + look up promotion_code ID from env
    promo_raw = (payload.promo_code or "").strip().lower()
    promotion_code_id: Optional[str] = None

    if promo_raw:
        env_key = PROMO_ENV_MAP.get(promo_raw)
        if env_key:
            promotion_code_id = os.getenv(env_key)

    # 3) Create emoji_orders row in Supabase (status = payment_pending)
    emoji_orders_endpoint = f"{SUPABASE_URL}/rest/v1/emoji_orders"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    order_payload = {
        "pack_type": pack.capitalize(),        # "Starter" / "Standard" / "Premium"
        "expressions": payload.expressions,    # text[] column
        "email": payload.email,
        "phone": payload.phone,
        "image_path": payload.image_url,       # map image_url -> image_path in DB
        "status": "payment_pending",
        "promo_code": promo_raw or None,
        "base_price_cents": base_price_cents,
        "final_price_cents": base_price_cents,  # will be updated by webhook later
    }

    try:
        db_resp = requests.post(
            emoji_orders_endpoint,
            headers=headers,
            params={"select": "id"},
            json=order_payload,
            timeout=10,
        )
    except Exception as e:
        logger.exception("Error calling Supabase in /api/create-checkout-session")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not reach Supabase: {e}",
        )

    if db_resp.status_code >= 400:
        logger.error("Supabase error in /api/create-checkout-session: %s", db_resp.text)
        raise HTTPException(
            status_code=db_resp.status_code,
            detail=f"Supabase insert failed: {db_resp.text}",
        )

    try:
        order_row = db_resp.json()[0]
        order_id = order_row["id"]
    except Exception:
        logger.exception("Unexpected Supabase response in /api/create-checkout-session")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected Supabase response when creating order.",
        )

    # 4) Build Stripe metadata and discounts
    metadata = {
        "order_id": str(order_id),
        "pack_type": pack,
        "promo_code": promo_raw,
        "email": payload.email,
        "phone": payload.phone or "",
        "image_url": payload.image_url,
        "expressions": ",".join(payload.expressions or []),
    }

    extra_args = {}
    if promotion_code_id:
        extra_args["discounts"] = [{"promotion_code": promotion_code_id}]

    # 5) Create Stripe Checkout Session
    try:
        checkout_session = stripe.checkout.Session.create(
    mode="payment",
    payment_method_types=["card"],
    line_items=[{"price": price_id, "quantity": 1}],
    customer_email=payload.email,
    success_url=f"{FRONTEND_BASE_URL}/upload.html?paid=1&order_id={order_id}",
    cancel_url=f"{FRONTEND_BASE_URL}/upload.html?canceled=1",
    metadata=metadata,
    **extra_args,
)

        return {
            "ok": True,
            "checkoutUrl": checkout_session.url,
            "order_id": order_id,
        }

    except Exception as e:
        logger.exception("Error creating Stripe Checkout session")
        raise HTTPException(status_code=500, detail=str(e))
