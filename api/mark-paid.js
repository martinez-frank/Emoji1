import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Server misconfigured' });
  }

  const { orderId } = req.body || {};
  if (!orderId) {
    return res.status(400).json({ ok: false, error: 'Missing orderId' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('emoji_orders')
      .update({ status: 'paid' })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, order: data });
  } catch (err) {
    console.error('[mark-paid] Failed to mark paid', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to mark paid',
      detail: err.message,
    });
  }
}
