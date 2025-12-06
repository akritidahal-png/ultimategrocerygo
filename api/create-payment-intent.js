import Stripe from "stripe";
// import supabase from "../SupabaseClient.js"; 

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
        // 1. Destructure the FULL data payload sent from the revised frontend
        const { trolley, customer, shipping, amount } = req.body; 

        // --- 2. Robust Validation ---
        if (!Array.isArray(trolley) || trolley.length === 0)
            return res.status(400).json({ error: "Trolley is empty" });
        if (!customer || !customer.name || !customer.email || !customer.mobile)
            return res.status(400).json({ error: "Missing customer data (name, email, or mobile)" });
        if (!shipping || !shipping.address || !shipping.postcode || !shipping.deliverySlot)
            return res.status(400).json({ error: "Missing shipping details (address, postcode, or deliverySlot)" });
        if (!amount)
            return res.status(400).json({ error: "Missing total amount" });

        const grandTotal = amount; 
        const amountInCents = Math.round(grandTotal * 100);

        // --- 3. Create Comprehensive Metadata (CRITICAL for Webhook) ---
        const metadata = {
            customer_name: customer.name,
            customer_email: customer.email,
            customer_mobile: customer.mobile,
            delivery_slot: shipping.deliverySlot,
            
            // Store complex objects as JSON strings for the webhook to parse
            shipping_details_json: JSON.stringify(shipping), 
            trolley_items_json: JSON.stringify(trolley), 
            grand_total: grandTotal.toFixed(2), // Storing total for verification
        };

        // --- 4. Create Payment Intent ---
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: "aud",
            automatic_payment_methods: { enabled: true },
            metadata: metadata, // Pass the full, secure metadata object
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error("Payment Intent Error:", err);
        res.status(500).json({ error: err.message || "Server error occurred during payment intent creation." });
    }
}
