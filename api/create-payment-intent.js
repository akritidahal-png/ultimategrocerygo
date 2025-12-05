import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe and Supabase clients
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Determine the base URL dynamically based on the environment
const BASE_URL = process.env.NODE_ENV === "production"
  ? process.env.NEXT_PUBLIC_API_URL // This will be set to your Vercel URL in production
  : "http://localhost:3000"; // Local URL for development

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, name, email, trolley } = req.body;

  // Validate incoming data
  if (!amount || !name || !email || !Array.isArray(trolley) || trolley.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Save order to Supabase before payment
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{ name, email, trolley, amount }])
      .select()
      .single();

    if (orderError) throw new Error(`Supabase order creation failed: ${orderError.message}`);

    // Create the payment intent in Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),  // Ensure amount is in cents
      currency: "aud",
      payment_method_types: ["card"],
      metadata: { order_id: orderData.id },
    });

    // Send the client secret to frontend for Stripe.js to complete the payment
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Payment creation error:", err);
    res.status(500).json({ error: err.message });
  }
}
