const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

router.post('/create-order', async (req, res) => {
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

    if (!items || items.length === 0) return res.status(400).json({ error: 'Trolley is empty' });
    if (!total_amount) return res.status(400).json({ error: 'Total amount missing' });

    const orderNumber = `${order_number_prefix || 'GG'}-${Date.now()}`;

    const { error } = await supabase.from('orders').insert([{
      order_number: orderNumber,
      customer_name: customer_name || 'Anonymous',
      email: email || '',
      phone: phone || '',
      address_line1: address_line1 || '',
      address_line2: '',
      suburb: suburb || '',
      postcode: postcode || '',
      state: state || 'QLD',
      country: country || 'Australia',
      items: JSON.stringify(items),
      total_amount: total_amount,
      delivery_fee: delivery_fee || 0,
      stripe_id: stripe_id || null,
      stripe_status: stripe_status || 'pending',
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      delivery_slot: delivery_slot || null
    }]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save order.' });
    }

    res.status(200).json({ order_number: orderNumber });
  } catch (err) {
    console.error('Create Order Error:', err);
    res.status(500).json({ error: 'Server error saving order.' });
  }
});

module.exports = router;
