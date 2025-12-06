import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { trolley, customer } = req.body;

    if (!Array.isArray(trolley) || trolley.length === 0) 
      return res.status(400).json({ error: "Trolley is empty" });

    if (!customer || !customer.name || !customer.email)
      return res.status(400).json({ error: "Missing required customer info" });

    // Calculate subtotal and delivery fee
    const subtotal = trolley.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const deliveryFee = subtotal >= 120 ? 0 : 10;
    const totalAmount = subtotal + deliveryFee;

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
      currency: "aud",
      automatic_payment_methods: { enabled: true },
      metadata: { customer_name: customer.name, email: customer.email }
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret, totalAmount, deliveryFee });
  } catch (err) {
    console.error("Payment Intent Error:", err);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
}
