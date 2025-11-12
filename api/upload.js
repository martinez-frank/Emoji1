// /api/upload.js — Vercel Edge Function
import { createClient } from '@supabase/supabase-js';
export const config = { runtime: 'edge' };

const TABLE = 'emoji_orders';         // ← your table
const BUCKET = 'emoji-uploads';       // ← matches your Supabase bucket (dash, not underscore)

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 1) Supabase (service role) client
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE,
      { auth: { persistSession: false } }
    );

    // 2) Read form
    const form = await req.formData();
    const file = form.get('file');                     // File (Blob)
    const email = (form.get('email') || '').toString();
    const phone = (form.get('phone') || '').toString();
    const expressions = JSON.parse(form.get('expressions') || '[]');
    const packType = req.headers.get('x-pack') || 'standard';

    if (!file || typeof file === 'string') {
      return new Response('No file', { status: 400 });
    }

    // 3) Create the order row first
    const { data: ins, error: insErr } = await sb
      .from(TABLE)
      .insert({
        pack_type: packType,
        expressions,
        email,
        phone,
        image_path: null,
        status: 'received'
      })
      .select('id')
      .single();

    if (insErr) throw insErr;
    const orderId = ins.id;

    // 4) Upload selfie to storage
    const filename = (file.name || 'upload').toString();
    const path = `${orderId}/${filename}`;

    const { error: upErr } = await sb
      .storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (upErr) throw upErr;

    // 5) Make public URL & update order with image_path + status
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub?.publicUrl || null;

    const { error: updErr } = await sb
      .from(TABLE)
      .update({ image_path: publicUrl, status: 'queued' })
      .eq('id', orderId);

    if (updErr) throw updErr;

    // 6) Done
    return new Response(JSON.stringify({ ok: true, order_id: orderId }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (e) {
    console.error(e);
    return new Response('Upload failed', { status: 500 });
  }
}
