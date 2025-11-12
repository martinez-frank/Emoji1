// /api/orders/list.js — Edge list API
import { createClient } from '@supabase/supabase-js';
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE,
      { auth: { persistSession: false } }
    );

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const status = searchParams.get('status') || '';
    const phone  = searchParams.get('phone') || '';
    const email  = searchParams.get('email') || '';

    let q = sb.from('orders')
      .select('id,email,phone,filename,file_url,status,created_at,expressions')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('status', status);
    if (phone)  q = q.ilike('phone', `%${phone}%`);
    if (email)  q = q.ilike('email', `%${email}%`);

    const { data, error } = await q;
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok:false, error:'list_failed' }), { status: 500 });
  }
}
