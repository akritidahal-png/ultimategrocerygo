import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      customer_name,
      email,
      phone,
      address_line1,
      suburb,
      postcode,
      state,
      country = 'Australia',
      items,
      total_amount,
      delivery_fee,
      stripe_id,
      stripe_status,
      delivery_slot
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'No items to save' });

    // Generate order number
    const { data: serialResult, error: serialError } = await supabase.rpc('get_next_serial_number');
    let orderNumber;
    if (serialError || !serialResult) orderNumber = `GGO-${Math.floor(10000 + Math.random() * 90000)}`;
    else orderNumber = `GGO-${String(serialResult).padStart(4, '0')}`;

    const { error } = await supabase.from('orders').insert([{
      order_number: orderNumber,
      customer_name: customer_name || 'Unknown',
      email: email || '',
      phone: phone || '',
      address_line1: address_line1 || '',
      suburb: suburb || '',
      postcode: postcode || '',
      state: state || '',
      country,
      items: JSON.stringify(items),
      total_amount: total_amount || 0,
      delivery_fee: delivery_fee || 0,
      stripe_id: stripe_id || '',
      stripe_status: stripe_status || 'pending',
      delivery_slot: delivery_slot || 'Anytime',
      status: 'pending',
      fulfillment_status: 'unfulfilled'
    }]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save order' });
    }

    res.status(200).json({ order_number: orderNumber });
  } catch (err) {
    console.error('Create Order Error:', err);
    res.status(500).json({ error: err.message || 'Server error saving order' });
  }
}
