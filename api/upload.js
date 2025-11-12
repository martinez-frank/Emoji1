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

   // 1) create order in emoji_orders
const pack_type = (req.headers.get('x-pack') || 'standard'); // fallback if you’re not sending it yet
const image_path_to_save = (pub?.publicUrl /* if you got it */) || path || '';

const { data: ins, error: insErr } = await sb
  .from('emoji_orders')
  .insert([{
    pack_type,                // 'starter' | 'standard' | 'premium' (or 'standard' fallback)
    expressions,              // array or JSON string you collected
    email,
    phone,
    image_path: image_path_to_save,
    status: 'received'        // your default workflow status
  }])
  .select('id')
  .single();

if (insErr) throw insErr;

const orderId = ins.id;

    if (insErr) throw insErr;

    const orderId = ins.id;
    const filename = file.name || 'upload';
    const path = `${orderId}/${filename}`;

    // 2) upload selfie
    const { error: upErr } = await sb.storage.from('emoji-uploads').upload(
      path, file, { contentType: file.type || 'application/octet-stream', upsert: false }
    );
    if (upErr) throw upErr;

    // 3) public URL + update row
    const { data: pub } = sb.storage.from('emoji_uploads').getPublicUrl(path);
    const { error: updErr } = await sb
     .from('emoji_orders')
     .update({ 
     image_path: pub.publicUrl, 
     status: 'queued' 
  })
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
