import Stripe from "stripe";
import supabase from "../SupabaseClient.js";

import { buffer } from "micro";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const piId = event.data.object.id;

  if (event.type === "payment_intent.succeeded") {
    await supabase.from("orders").update({ status: "Successful", stripe_status: "succeeded" }).eq("stripe_id", piId);
  } else if (event.type === "payment_intent.payment_failed") {
    await supabase.from("orders").update({ status: "Failed", stripe_status: "failed" }).eq("stripe_id", piId);
  }

  res.json({ received: true });
}
