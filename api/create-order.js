import { supabase } from "../supabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      customer_name,
      email,
      phone,
      address_line1,
      suburb,
      postcode,
      state,
      country = "Australia",
      items,
      total_amount,
      delivery_fee,
      stripe_id,
      stripe_status,
      delivery_slot,
      order_number_prefix = "GG",
    } = req.body;

    if (!customer_name || !email || !items || !Array.isArray(items))
      return res.status(400).json({ error: "Missing required order fields" });

    // Generate order number (simple fallback)
    const orderNumber = `${order_number_prefix}-${Date.now()}`;

    const { error } = await supabase.from("orders").insert([
      {
        order_number: orderNumber,
        customer_name,
        email,
        phone: phone || null,
        address_line1: address_line1 || null,
        suburb: suburb || null,
        postcode: postcode || null,
        state: state || null,
        country,
        items: JSON.stringify(items),
        total_amount: total_amount || 0,
        delivery_fee: delivery_fee || 0,
        stripe_id: stripe_id || null,
        stripe_status: stripe_status || null,
        delivery_slot: delivery_slot || null,
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: "Failed to save order" });
    }

    res.status(200).json({ order_number: orderNumber });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
