import Stripe from "stripe";
import supabase from "../SupabaseClient.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const buf = await new Promise((resolve, reject) => {
      let data = [];
      req.on("data", chunk => data.push(chunk));
      req.on("end", () => resolve(Buffer.concat(data)));
      req.on("error", err => reject(err));
    });

    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;

        // Update order status in Supabase
        const { error } = await supabase
          .from("orders")
          .update({ status: "paid" })
          .eq("payment_intent_id", paymentIntent.id);

        if (error) throw error;
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook Processing Error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
