import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe and Supabase
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, name, email, trolley } = req.body;

  // Validate input
  if (!amount || !name || !email || !Array.isArray(trolley) || trolley.length === 0) {
    return res.status(400).json({ error: "Missing required fields or trolley is empty" });
  }

  try {
    // Save a preliminary order in Supabase (optional, can add more fields)
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{ customer_name: name, email, items: trolley, total_amount: amount }])
      .select()
      .single();

    if (orderError) throw new Error(`Supabase order creation failed: ${orderError.message}`);

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert dollars to cents
      currency: "aud",
      payment_method_types: ["card"],
      metadata: { order_id: orderData.id },
      receipt_email: email
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error("Payment creation error:", err);
    res.status(500).json({ error: `Payment creation failed: ${err.message || "Unknown error"}` });
  }
}
