import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      customer_name,
      email,
      phone = "",
      address_line1 = "",
      address_line2 = "",
      suburb = "",
      postcode = "",
      state = "",
      country = "Australia",
      items,
      total_amount,
      delivery_fee = 0,
      stripe_id = null,
      stripe_status = null,
      delivery_slot = null
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Order items missing" });

    if (!customer_name || !email || !total_amount)
      return res.status(400).json({ error: "Missing required order info" });

    // Generate unique order number
    let orderNumber = `GG-${Date.now()}`;

    const { error } = await supabase.from("orders").insert([{
      order_number: orderNumber,
      customer_name,
      email,
      phone,
      address_line1,
      address_line2,
      suburb,
      postcode,
      state,
      country,
      items: JSON.stringify(items),
      total_amount,
      delivery_fee,
      stripe_id,
      stripe_status,
      delivery_slot,
      status: "pending",
      fulfillment_status: "unfulfilled"
    }]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: "Failed to save order" });
    }

    res.status(200).json({ order_number: orderNumber });
  } catch (err) {
    console.error("Create Order Error:", err);
    res.status(500).json({ error: "Server error creating order" });
  }
}
