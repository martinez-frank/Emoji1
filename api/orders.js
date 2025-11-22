// api/orders.js — List recent emoji orders for admin using Supabase REST (Node + node-fetch)
import fetch from 'node-fetch';

const TABLE = 'emoji_orders';

export default async function handler(req, res) {
  try {
    // 1) Only allow GET
    if (req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed',
      });
    }

    // 2) Simple admin auth via header
    // Node lowercases all header names to "x-admin-key"
    const adminHeader = (req.headers['x-admin-key'] || '').toString();
    const adminSecret = process.env.ADMIN_ORDERS_KEY || '';

    if (!adminSecret || adminHeader !== adminSecret) {
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized',
      });
    }

    // 3) Supabase env vars (service role)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;

    if (!url || !key) {
      console.error('[orders] Missing Supabase env vars', {
        hasUrl: !!url,
        hasKey: !!key,
      });

      return res.status(500).json({
        ok: false,
        error: 'Server misconfigured: missing Supabase env vars',
      });
    }

    // 4) Pagination params
    const base = url.replace(/\/$/, ''); // remove trailing slash if any

    const limit = Math.min(
      parseInt(req.query.limit, 10) || 50,  // default 50
      500                                   // safety cap
    );
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const restUrl =
      `${base}/rest/v1/${TABLE}` +
      `?select=id,created_at,pack_type,expressions,email,phone,promo_code,` +
      `base_price_cents,final_price_cents,status` +
      `&order=created_at.desc` +
      `&limit=${limit}` +
      `&offset=${offset}`;

    // 5) Call Supabase REST with count
    const supaRes = await fetch(restUrl, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'count=exact', // so we get total row count
      },
    });

    if (!supaRes.ok) {
      const text = await supaRes.text().catch(() => '');
      console.error('[orders] Supabase REST error', supaRes.status, text);

      return res.status(500).json({
        ok: false,
        error: 'Failed to load orders',
      });
    }

    const data = await supaRes.json();

    // Parse "0-49/1234" → total = 1234
    const contentRange = supaRes.headers.get('content-range') || '';
    let total = null;
    const match = contentRange.match(/\/(\d+)$/);
    if (match) {
      total = parseInt(match[1], 10);
    }

    // 6) Success
    return res.status(200).json({
      ok: true,
      orders: data || [],
      page,
      limit,
      total,
    });
  } catch (err) {
    console.error('[orders] handler fatal error', err);

    return res.status(500).json({
      ok: false,
      error: 'Orders endpoint failed',
    });
  }
}
