const TABLE = 'emoji_orders';

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
      promo_code = '',       // <-- new field
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

    // 6) Build the row exactly to match your `emoji_orders` columns
    const row = {
      pack_type:   pack,
      email,
      phone,
      promo_code,          // <-- stored in Supabase
      image_path:  file_url,
      expressions,
      status:      'received',
    };

    // 7) Call Supabase REST
    const base    = url.replace(/\/$/, ''); // remove trailing slash
    const restUrl = `${base}/rest/v1/${TABLE}`;

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

    // 8) Success — return the new order id
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
