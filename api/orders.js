// /api/orders.js — List recent emoji orders for admin
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const TABLE = 'emoji_orders';

export default async function handler(req) {
  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'content-type': 'application/json' } }
    );
  }

  // --- Simple admin auth via header ---
  const adminHeader = req.headers.get('x-admin-key') || '';
  const adminSecret = process.env.ADMIN_ORDERS_KEY || '';

  if (!adminSecret || adminHeader !== adminSecret) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }

  // --- Supabase client (service role) ---
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    console.error('[orders] Missing Supabase env vars', { hasUrl: !!url, hasKey: !!key });
    return new Response(
      JSON.stringify({ ok: false, error: 'Server misconfigured: missing Supabase env vars' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // --- Query recent orders ---
  const { data, error } = await sb
    .from(TABLE)
    .select('id, created_at, pack_type, expressions, email, phone')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[orders] Supabase select error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to load orders' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, orders: data || [] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
