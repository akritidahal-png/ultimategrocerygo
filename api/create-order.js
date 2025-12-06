import supabase from "../SupabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { trolley, customer, paymentIntentId } = req.body;

    if (!Array.isArray(trolley) || trolley.length === 0)
      return res.status(400).json({ error: "Trolley is empty" });

    if (!customer || !customer.name || !customer.email)
      return res.status(400).json({ error: "Missing customer data" });

    // Insert order into Supabase
    const { data, error } = await supabase.from("orders").insert([
      {
        trolley,
        customer,
        payment_intent_id: paymentIntentId,
        status: "pending"
      }
    ]);

    if (error) throw error;

    res.status(200).json({ order: data });
  } catch (err) {
    console.error("Create Order Error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
