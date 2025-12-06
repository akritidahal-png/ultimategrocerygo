import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { trolley, customer } = req.body;

    if (!trolley || !Array.isArray(trolley) || trolley.length === 0)
      return res.status(400).json({ error: 'Trolley is empty' });

    if (!customer || !customer.name || !customer.email)
      return res.status(400).json({ error: 'Missing required customer info' });

    const subtotal = trolley.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
    const deliveryFee = subtotal >= 120 ? 0 : 10; // match your checkout logic
    const total = subtotal + deliveryFee;
    const amount = Math.round(total * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'aud',
      automatic_payment_methods: { enabled: true },
      metadata: {
        customer_name: customer.name,
        email: customer.email
      }
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret, total, deliveryFee });
  } catch (err) {
    console.error('Payment Intent Error:', err);
    res.status(500).json({ error: err.message || 'Server error creating payment intent' });
  }
}
