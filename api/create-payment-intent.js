const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { trolley, customer } = req.body;

    if (!trolley || trolley.length === 0) return res.status(400).json({ error: 'Trolley is empty' });
    if (!customer) return res.status(400).json({ error: 'Missing customer data' });

    const subtotal = trolley.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
    const deliveryFee = subtotal >= 120 ? 0 : 10;
    const total = subtotal + deliveryFee;
    const amount = Math.round(total * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'aud',
      automatic_payment_methods: { enabled: true },
      metadata: { customer_name: customer.name || 'Anonymous', email: customer.email || '' }
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Payment Intent Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
