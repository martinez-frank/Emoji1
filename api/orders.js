// api/orders.js — List recent emoji orders for admin using Supabase JS client
import { createClient } from '@supabase/supabase-js';

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

    // 4) Create Supabase client
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    // 5) Query latest orders
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, created_at, pack_type, expressions, email, phone, promo_code, status, base_price_cents, final_price_cents')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[orders] Supabase query error', error);
      return res.status(500).json({
        ok: false,
        error: 'Failed to load orders (db)',
        detail: error.message,
      });
    }

    // 6) Success
    return res.status(200).json({
      ok: true,
      orders: data || [],
    });
  } catch (err) {
    console.error('[orders] handler fatal error', err);

    return res.status(500).json({
      ok: false,
      error: 'Orders endpoint failed',
      detail: err.message,
    });
  }
}
