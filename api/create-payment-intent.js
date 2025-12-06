import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe and Supabase clients
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { trolley, total_amount, delivery_fee, customer, delivery_slot } = req.body;

  // Validate required fields
  if (!trolley || !Array.isArray(trolley) || trolley.length === 0) {
    return res.status(400).json({ error: "Trolley is empty" });
  }
  if (!total_amount || !customer || !customer.name || !customer.email) {
    return res.status(400).json({ error: "Missing customer or total info" });
  }

  try {
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total_amount * 100), // cents
      currency: "aud",
      payment_method_types: ["card"],
      receipt_email: customer.email,
      metadata: {
        customer_name: customer.name,
        customer_email: customer.email,
        delivery_slot: delivery_slot || "N/A"
      }
    });

    // Return client secret for frontend
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Stripe payment intent error:", err);
    res.status(500).json({ error: err.message || "Payment intent creation failed" });
  }
}
