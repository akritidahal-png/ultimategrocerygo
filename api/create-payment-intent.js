import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Stripe setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

// Supabase setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      trolley,
      name,
      email,
      mobile,
      slot,
      unit,
      streetNo,
      streetName,
      suburb,
      postcode,
      state,
      subtotal,
      deliveryFee,
      total
    } = req.body;

    // --- Validation ---
    if (!Array.isArray(trolley) || trolley.length === 0)
      return res.status(400).json({ error: "Trolley is empty" });
    if (!name || !email || !mobile)
      return res.status(400).json({ error: "Missing customer details" });
    if (!slot)
      return res.status(400).json({ error: "Missing delivery slot" });
    if (!total)
      return res.status(400).json({ error: "Missing total amount" });

    const amountInCents = Math.round(total * 100);

    // --- Stripe PaymentIntent ---
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "aud",
      automatic_payment_methods: { enabled: true },
      metadata: {
        customer_name: name,
        customer_email: email,
        customer_mobile: mobile,
        delivery_slot: slot,
        trolley_items_json: JSON.stringify(trolley),
        subtotal: subtotal.toFixed(2),
        delivery_fee: deliveryFee.toFixed(2),
        grand_total: total.toFixed(2)
      }
    });

    // --- Supabase insert ---
    const fullAddress = `${streetNo} ${streetName}` + (unit ? `, Unit ${unit}` : '');
    const { error: supabaseError } = await supabase.from('orders').insert([
      {
        customer_name: name,
        customer_email: email,
        customer_mobile: mobile,
        delivery_slot: slot,
        shipping_address: fullAddress,
        suburb,
        postcode,
        state,
        trolley_items: JSON.stringify(trolley),
        subtotal,
        delivery_fee: deliveryFee,
        total,
        payment_status: 'pending', // Will be updated later via webhook
        stripe_payment_intent: paymentIntent.id
      }
    ]);

    if (supabaseError) throw supabaseError;

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Payment Intent / Supabase Error:", err);
    res.status(500).json({ error: err.message || "Server error occurred" });
  }
}
