import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      order_number_prefix,
      customer_name,
      email,
      phone,
      address_line1,
      suburb,
      postcode,
      state,
      country,
      items,
      total_amount,
      delivery_fee,
      stripe_id,
      stripe_status,
      delivery_slot
    } = req.body;

    if (!customer_name || !items || !stripe_id)
      return res.status(400).json({ error: 'Missing required fields' });

    const order_number = `${order_number_prefix}-${Date.now()}`;

    const { error } = await supabase.from('orders').insert([{
      order_number,
      customer_name,
      email,
      phone,
      address_line1,
      suburb,
      postcode,
      state,
      country,
      items: JSON.stringify(items),
      total_amount,
      delivery_fee,
      stripe_id,
      stripe_status,
      delivery_slot,
      status: 'pending'
    }]);

    if (error) return res.status(500).json({ error: 'Failed to save order' });

    res.status(200).json({ order_number });
  } catch (err) {
    console.error('Create Order Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
