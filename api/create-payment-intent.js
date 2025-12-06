import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { trolley, name, email } = req.body;

    if (!Array.isArray(trolley) || trolley.length === 0) 
      return res.status(400).json({ error: 'Trolley is empty' });
    if (!name || !email) 
      return res.status(400).json({ error: 'Missing customer info' });

    const subtotal = trolley.reduce((s,i)=>s+(i.price||0)*(i.quantity||1),0);
    const deliveryFee = subtotal >= 120 ? 0 : 10;
    const total = subtotal + deliveryFee;
    const amountInCents = Math.round(total * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'aud',
      automatic_payment_methods: { enabled: true },
      metadata: { customer_name: name, email }
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Payment Intent Error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
