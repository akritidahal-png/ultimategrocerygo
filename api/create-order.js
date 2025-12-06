import { createClient } from '@supabase/supabase-js';

// --- Supabase client ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to generate order numbers
async function generateOrderNumber() {
  // You can replace this with a proper sequence/RPC if you have one
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `GG-${randomNum}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      order_number_prefix, // optional prefix
      customer_name,
      email,
      phone,
      address_line1,
      address_line2 = '',
      suburb,
      postcode,
      state,
      country = 'Australia',
      items,
      total_amount,
      delivery_fee = 0,
      stripe_id = null,
      stripe_status = null,
      delivery_slot = null
    } = req.body;

    // --- Validation ---
    if (!customer_name || !email || !items || !Array.isArray(items) || items.length === 0 || !total_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // --- Generate order number if missing ---
    let order_number = req.body.order_number;
    if (!order_number) {
      order_number = await generateOrderNumber();
    }

    // --- Insert into Supabase ---
    const { data, error } = await supabase.from('orders').insert([{
      order_number,
      customer_name,
      email,
      phone: phone || '',
      address_line1,
      address_line2,
      suburb: suburb || '',
      postcode: postcode || '',
      state: state || '',
      country,
      items: JSON.stringify(items),
      total_amount,
      delivery_fee,
      stripe_id,
      stripe_status,
      delivery_slot,
      status: 'pending',
      fulfillment_status: 'unfulfilled'
    }]).select().single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save order' });
    }

    res.status(200).json({ message: 'Order created successfully', order_number: data.order_number });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error while creating order' });
  }
}
