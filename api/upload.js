const TABLE = 'emoji_orders';

// --- Pack prices in cents ---
const PACK_PRICES = {
  starter: 500,   // $5
  standard: 1500, // $15
  premium: 2500,  // $25
};

// --- Promo definitions: all percent discounts ---
const PROMO_DEFINITIONS = {
  frankie10:   { type: 'percent', value: 10 },
  // Backwards-compat alias in case anyone still uses it
  frankiemoj10:{ type: 'percent', value: 10 },

  holiday15:   { type: 'percent', value: 15 },
  crew100:     { type: 'percent', value: 100 },

  aaronemoji10:{ type: 'percent', value: 10 },
  donniemoji10:{ type: 'percent', value: 10 },
};

function calculatePriceForPack(packKeyRaw, promoRaw) {
  const packKey = (packKeyRaw || 'starter').toLowerCase();
  const base = PACK_PRICES[packKey] ?? PACK_PRICES.starter;

  let final = base;
  let appliedPromo = '';

  const code = (promoRaw || '').trim().toLowerCase();
  if (code) {
    const def = PROMO_DEFINITIONS[code];
    if (def && def.type === 'percent') {
      const discount = Math.round(base * (def.value / 100));
      final = Math.max(0, base - discount);
      appliedPromo = code; // normalized code we actually applied
    }
  }

  return { base, final, appliedPromo };
}

export default async function handler(req, res) {
  try {
    // 1) Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed',
      });
    }

    // 2) Read JSON body (works for Next/Vercel body or raw stream)
    const body =
      req.body && Object.keys(req.body).length
        ? req.body
        : await readBody(req);

    if (!body) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid JSON body',
      });
    }

    // 3) Expected fields from the upload form
    const {
      pack = 'starter',      // "starter" | "standard" | "premium"
      email = '',
      phone = '',
      file_url = '',
      expressions = [],
      promo_code = '',       // raw promo from frontend/localStorage
    } = body;

    // 4) Basic validation
    if (!file_url) {
      return res.status(400).json({
        ok: false,
        error: 'Missing file_url',
      });
    }

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: 'Missing email',
      });
    }

    // 5) Supabase env vars (service role)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;

    if (!url || !key) {
      console.error('[upload] Missing Supabase env vars', {
        hasUrl: !!url,
        hasKey: !!key,
      });

      return res.status(500).json({
        ok: false,
        error: 'Server misconfigured: missing Supabase env vars',
      });
    }

    // 6) Price calculation (base + final, with promo)
    const { base, final, appliedPromo } = calculatePriceForPack(
      pack,
      promo_code
    );

    // 7) Build the row exactly to match your `emoji_orders` columns
    const row = {
      pack_type:         (pack || 'starter').toLowerCase(),
      email,
      phone,
      image_path:        file_url,
      expressions,
      status:            'received',

      // promo + pricing fields
      promo_code:        appliedPromo,       // normalized or '' if none
      base_price_cents:  base,              // e.g. 500, 1500, 2500
      final_price_cents: final,             // after promo applied
    };

    // 8) Call Supabase REST
    const baseUrl = url.replace(/\/$/, ''); // remove trailing slash
    const restUrl = `${baseUrl}/rest/v1/${TABLE}`;

    const insertRes = await fetch(restUrl, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([row]), // REST API expects an array of rows
    });

    const data = await insertRes.json().catch(() => null);

    if (!insertRes.ok) {
      console.error('[upload] Supabase insert failed', {
        status: insertRes.status,
        data,
      });

      return res.status(insertRes.status || 500).json({
        ok: false,
        error:
          (data && data.message) ||
          `Supabase insert failed (${insertRes.status})`,
      });
    }

    // 9) Success — return the new order id
    const inserted = Array.isArray(data) ? data[0] : data;
    const orderId  = inserted && inserted.id ? inserted.id : null;

    return res.status(200).json({
      ok: true,
      order_id: orderId,
    });
  } catch (err) {
    console.error('[upload] handler fatal error', err);

    return res.status(500).json({
      ok: false,
      error: 'Upload failed',
    });
  }
}

// Helper to read raw JSON body if req.body is empty
async function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve(null);
      }
    });
  });
}
