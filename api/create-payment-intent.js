// /api/create-payment-intent.js

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Supabase (Service Role is required)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
      total,
    } = req.body;

    console.log("Received checkout:", req.body);

    // -------------------------------
    // VALIDATION
    // -------------------------------
    if (!Array.isArray(trolley) || trolley.length === 0) {
      return res.status(400).json({ error: "Empty trolley" });
    }

    if (!name || !email || !mobile) {
      return res.status(400).json({ error: "Missing customer details" });
    }

    if (!slot) {
      return res.status(400).json({ error: "Missing delivery slot" });
    }

    if (!total || Number(total) <= 0) {
      return res.status(400).json({ error: "Invalid total" });
    }

    const amountInCents = Math.round(Number(total) * 100);

    // -------------------------------
    // SHIPPING DETAILS (metadata)
    // -------------------------------
    const shippingDetails = {
      unit: unit || "",
      street: `${streetNo} ${streetName}`,
      suburb,
      postcode,
      state,
      deliveryFee,
    };

    // -------------------------------
    // STRIPE PAYMENT INTENT
    // -------------------------------
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "aud",
      automatic_payment_methods: { enabled: true },

      metadata: {
        customer_name: name,
        customer_email: email,
        customer_mobile: mobile,
        delivery_slot: slot,
        trolley_items: JSON.stringify(trolley),
        shipping_details: JSON.stringify(shippingDetails),
        subtotal: String(subtotal),
        delivery_fee: String(deliveryFee),
        grand_total: String(total),
      },
    });

    // --------------------------------
    // ORDER NUMBER
    // --------------------------------
    const orderNumber = "ORD-" + paymentIntent.id.slice(-8).toUpperCase();

    // --------------------------------
    // INSERT INITIAL ORDER RECORD
    // (Webhook will update after payment)
    // --------------------------------
    const { error: insertError } = await supabase.from("orders").insert([
      {
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
        total_amount: Number(total),
        delivery_fee: Number(deliveryFee),

        status: "pending",
        fulfillment_status: "unfulfilled",

        stripe_id: paymentIntent.id,
        stripe_status: "requires_payment_method",

        delivery_slot: slot,
      },
    ]);

    if (insertError) {
      console.error("Supabase Insert Error:", insertError);
      return res.status(500).json({ error: "Order insert failed" });
    }

    // --------------------------------
    // SEND CLIENT SECRET
    // --------------------------------
    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      orderNumber,
    });
  } catch (err) {
    console.error("Payment Intent Error:", err);
    return res.status(500).json({
      error: "Server error during payment intent creation",
    });
  }
}
