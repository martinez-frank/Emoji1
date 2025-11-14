// api/orders.js — List recent emoji orders for admin

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';

const TABLE = 'emoji_orders';

export default async function handler(req) {
  try {
    // 1) Only allow GET
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // 2) Read admin key from headers (same header name the form uses)
    let adminHeader = '';

    // Vercel gives us a Web Request-like object, so headers.get should exist
    if (req.headers && typeof req.headers.get === 'function') {
      adminHeader = req.headers.get('x-admin-key') || '';
    } else if (req.headers) {
      // Fallback for plain object style
      adminHeader =
        req.headers['x-admin-key'] ||
        req.headers['X-Admin-Key'] ||
        '';
    }

    const adminSecret = process.env.ADMIN_ORDERS_KEY || '';

    if (!adminSecret || adminHeader !== adminSecret) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // 3) Supabase env vars
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE; // same as upload.js

    if (!url || !key) {
      console.error('[orders] Missing Supabase env vars', {
        hasUrl: !!url,
        hasKey: !!key,
      });

      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Server misconfigured: missing Supabase env vars',
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // 4) Supabase client (service role)
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
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Failed to load orders',
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, orders: data || [] }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[orders] handler fatal error:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Orders endpoint failed',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
