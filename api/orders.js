// api/orders.js – List recent emoji orders for admin (Node.js / ESM style)
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
    // Node normalises header names to lowercase, so this is the one that matters.
    const adminHeader = (req.headers['x-admin-key'] || '').toString();
    const adminSecret = process.env.ADMIN_ORDERS_KEY || '';

    if (!adminHeader || adminHeader !== adminSecret) {
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized',
      });
    }

    // 3) Supabase env vars (service role)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE; // same value as SUPABASE_SERVICE_KEY

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

    // 4) Supabase client (service role, no session)
    const sb = createClient(url, key, {
      auth: { persistSession: false },
    });

    // 5) Query latest orders
    const { data, error } = await sb
      .from(TABLE)
      .select('id, created_at, pack_type, expressions, email, phone')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[orders] Supabase select error:', error);

      return res.status(500).json({
        ok: false,
        error: 'Failed to load orders',
      });
    }

    // 6) Success
    return res.status(200).json({
      ok: true,
      orders: data || [],
    });
  } catch (err) {
    console.error('[orders] handler fatal error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Orders endpoint failed',
    });
  }
}
