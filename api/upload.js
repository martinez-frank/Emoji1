// /api/upload.js — Vercel Edge Function
import { createClient } from '@supabase/supabase-js';
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE,
      { auth: { persistSession: false } }
    );

    const form = await req.formData();
    const file = form.get('file');                           // Blob
    const email = (form.get('email') || '').toString();
    const phone = (form.get('phone') || '').toString();
    const expressions = JSON.parse((form.get('expressions') || '[]').toString());

    if (!file || typeof file === 'string') return new Response('No file', { status: 400 });

    // 1) create order
    const { data: ins, error: insErr } = await sb
      .from('orders')
      .insert({ email, phone, status: 'received', expressions })
      .select('id')
      .single();
    if (insErr) throw insErr;

    const orderId = ins.id;
    const filename = file.name || 'upload';
    const path = `${orderId}/${filename}`;

    // 2) upload selfie
    const { error: upErr } = await sb.storage.from('emoji_uploads').upload(
      path, file, { contentType: file.type || 'application/octet-stream', upsert: false }
    );
    if (upErr) throw upErr;

    // 3) public URL + update row
    const { data: pub } = sb.storage.from('emoji_uploads').getPublicUrl(path);
    const { error: updErr } = await sb.from('orders')
      .update({ filename, file_url: pub.publicUrl, status: 'queued' })
      .eq('id', orderId);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, order_id: orderId }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    console.error(e);
    return new Response('Upload failed', { status: 500 });
  }
}
