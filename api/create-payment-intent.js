import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { trolley, name, email, mobile, unit, streetNo, streetName, suburb, postcode, state, slot, subtotal, deliveryFee, total } = req.body;

    if (!Array.isArray(trolley) || trolley.length === 0) return res.status(400).json({ error: 'Trolley empty' });
    if (!name || !email || !mobile) return res.status(400).json({ error: 'Missing customer details' });
    if (!slot) return res.status(400).json({ error: 'Missing delivery slot' });
    if (!total) return res.status(400).json({ error: 'Missing total' });

    const amountInCents = Math.round(Number(total) * 100);

    // Generate sequential GGX order number
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('order_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextOrderNum = 1;
    if (lastOrder && lastOrder.order_number) {
      const lastNum = parseInt(lastOrder.order_number.replace('GGX',''));
      if (!isNaN(lastNum)) nextOrderNum = lastNum + 1;
    }
    const orderNumber = 'GGX' + String(nextOrderNum).padStart(4, '0');

    // Create Stripe PaymentIntent
    const trolleySummary = trolley.map(i => i.name).join(', ').slice(0, 500); // truncate to max 500 chars
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'aud',
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_number: orderNumber,
        customer_name: name,
        customer_email: email,
        customer_mobile: mobile,
        delivery_slot: slot,
        trolley_summary: trolleySummary // small summary instead of full JSON
      }
    });

    // Insert pending order in Supabase
    const { error: insertError } = await supabase.from('orders').insert([{
      order_number: orderNumber,
      customer_name: name,
      email,
      phone: mobile,
      address_line1: `${streetNo} ${streetName}`,
      address_line2: unit || null,
      suburb,
      postcode,
      state,
      items: trolley,
      total_amount: total,
      delivery_fee: deliveryFee,
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      stripe_id: paymentIntent.id,
      stripe_status: 'requires_payment_method',
      delivery_slot: slot,
    }]);

    if (insertError) { 
      console.error('Supabase Insert Error:', insertError); 
      throw insertError; 
    }

    // Return clientSecret and orderNumber for frontend
    return res.status(200).json({ clientSecret: paymentIntent.client_secret, orderNumber });

  } catch (err) {
    console.error('Payment Intent Error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
