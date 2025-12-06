import supabase from "../SupabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { order } = req.body;

    if (!order) return res.status(400).json({ error: "Missing order data" });

    // Example: insert notification into Supabase (or send email)
    const { error } = await supabase.from("admin_notifications").insert([
      { order_id: order.id, message: `New order from ${order.customer.name}` }
    ]);

    if (error) throw error;

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Notify Admin Error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
