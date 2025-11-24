// /api/orders.js — list emoji orders for the admin panel with pagination

import { createClient } from '@supabase/supabase-js';

// ---------- Env + clients ----------

const supabaseUrl   = process.env.SUPABASE_URL;
const supabaseKey   = process.env.SUPABASE_SERVICE_ROLE;
const adminKey      = process.env.ADMIN_ORDERS_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[orders] Missing Supabase env vars');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ---------- Helpers ----------

function unauthorized(res, message = 'Unauthorized') {
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: message }));
}

function badRequest(res, message = 'Bad request') {
  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: message }));
}

function serverError(res, message = 'Server error') {
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: message }));
}

// ---------- Handler ----------

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return badRequest(res, 'Only GET is allowed');
  }

  if (!supabase) {
    console.error('[orders] Supabase client not initialized');
    return serverError(res, 'Supabase not configured');
  }

  // Simple admin-key header check
  const headerKey = req.headers['x-admin-key'];
  if (!adminKey || headerKey !== adminKey) {
    console.warn('[orders] Unauthorized access attempt');
    return unauthorized(res);
  }

  try {
    // Pagination params
    const { limit, offset } = req.query || {};
    const pageSize = Math.min(parseInt(limit, 10) || 20, 100); // cap at 100
    const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const from = pageOffset;
    const to   = pageOffset + pageSize - 1;

    // Pull orders newest first + total count
    const { data, error, count } = await supabase
      .from('emoji_orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[orders] Supabase query error', error);
      return serverError(res, 'Error fetching orders');
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      orders: data || [],
      total: typeof count === 'number' ? count : (data ? data.length : 0),
      limit: pageSize,
      offset: pageOffset,
    }));
  } catch (err) {
    console.error('[orders] Unexpected error', err);
    return serverError(res, 'Unexpected error');
  }
}
