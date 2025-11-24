// /api/orders.js — paginated emoji orders API for admin panel
import { createClient } from '@supabase/supabase-js';

// ---------- Env ----------
const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE;
const adminKey     = process.env.ADMIN_ORDERS_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[orders] Missing Supabase env vars');
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ---------- Helpers ----------
function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function unauthorized(res) {
  return send(res, 401, { ok: false, error: 'Unauthorized' });
}

function badRequest(res, msg = 'Bad request') {
  return send(res, 400, { ok: false, error: msg });
}

function serverError(res, msg = 'Server error') {
  return send(res, 500, { ok: false, error: msg });
}

// ---------- Handler ----------
export default async function handler(req, res) {
  // Only GET allowed
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return badRequest(res, 'Only GET is allowed');
  }

  if (!supabase) {
    console.error('[orders] Supabase client not initialized');
    return serverError(res, 'Supabase not configured');
  }

  // Admin key check
  const headerKey = req.headers['x-admin-key'];
  if (!adminKey || headerKey !== adminKey) {
    console.warn('[orders] Unauthorized access attempt');
    return unauthorized(res);
  }

  try {
    // Pagination params
    const { limit, offset } = req.query || {};

    // Page size options: 50, 100, 250, 500
    const pageSize = [50, 100, 250, 500].includes(parseInt(limit, 10))
      ? parseInt(limit, 10)
      : 50;

    const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const from = pageOffset;
    const to   = pageOffset + pageSize - 1;

    // Fetch orders newest first WITH total count
    const { data, error, count } = await supabase
      .from('emoji_orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[orders] Supabase query error:', error);
      return serverError(res, 'Error fetching orders');
    }

    return send(res, 200, {
      ok: true,
      orders: data || [],
      totalCount: typeof count === 'number' ? count : 0,
      limit: pageSize,
      offset: pageOffset,
      page: Math.floor(pageOffset / pageSize) + 1,
      pageCount: count ? Math.ceil(count / pageSize) : 1
    });

  } catch (err) {
    console.error('[orders] Unexpected error:', err);
    return serverError(res, 'Unexpected error');
  }
}
