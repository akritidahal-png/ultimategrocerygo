import Stripe from "stripe";
import supabase from "../SupabaseClient.js"; // Ensure this client uses the Service Role Key

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

// IMPORTANT: Configuration for Next.js/Vercel to disable automatic body parsing
export const config = {
    api: { bodyParser: false }, 
};

export default async function handler(req, res) {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    // --- 1. Signature Verification and Raw Body Reading ---
    try {
        // Utility function to read raw body data chunks
        const buf = await new Promise((resolve, reject) => {
            let data = [];
            req.on("data", chunk => data.push(chunk));
            req.on("end", () => resolve(Buffer.concat(data)));
            req.on("error", err => reject(err));
        });

        event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
        console.error("Webhook Error: Signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: Signature verification failed.`);
    }

    // --- 2. Event Processing ---
    try {
        if (event.type === "payment_intent.succeeded") {
            const paymentIntent = event.data.object;
            const metadata = paymentIntent.metadata;

            // CRITICAL FIX: Extract all order details from secure metadata
            const shippingDetails = JSON.parse(metadata.shipping_details_json);
            const cartItems = JSON.parse(metadata.trolley_items_json);

            // Map data to your Supabase 'orders' table schema
            const finalOrder = {
                order_number: paymentIntent.id.substring(3), // Example short order ID
                customer_name: metadata.customer_name,
                email: metadata.customer_email,
                phone: metadata.customer_mobile,
                
                address_line1: shippingDetails.address,
                suburb: shippingDetails.suburb,
                postcode: shippingDetails.postcode,
                state: shippingDetails.state,
                country: shippingDetails.state === 'ACT' ? 'Australia' : 'Australia', // Keep as 'Australia'
                
                items: cartItems, // Directly inserted into jsonb column
                total_amount: parseFloat(metadata.grand_total),
                delivery_fee: shippingDetails.deliveryFee || 10.00,
                delivery_slot: metadata.delivery_slot,
                
                status: 'paid', // Order is created with confirmed payment status
                stripe_id: paymentIntent.id,
                stripe_status: paymentIntent.status,
                fulfillment_status: 'unfulfilled',
            };

            // CRITICAL FIX: Insert the order instead of relying on a previous update
            const { error: insertError } = await supabase
                .from("orders")
                .insert([finalOrder]); 

            if (insertError) {
                console.error("Supabase Order Insert Error:", insertError);
                // Return 500 to tell Stripe to retry
                throw new Error("Failed to save paid order to database.");
            }

            console.log(`Order successfully created for Payment Intent: ${paymentIntent.id}`);
        } else {
            console.log(`Unhandled event type: ${event.type}`);
        }

        // Return 200 OK for successful processing or unhandled events
        res.status(200).json({ received: true });
        
    } catch (err) {
        console.error("Webhook Processing Error:", err);
        // Return 500 so Stripe attempts to re-send the webhook later
        res.status(500).json({ error: err.message || "Server error" });
    }
}
