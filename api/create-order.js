import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { trolley, total_amount, delivery_fee, customer, delivery_slot, stripe_id, stripe_status } = req.body;

  if (!trolley || trolley.length === 0) return res.status(400).json({ error: "Trolley is empty" });
  if (!customer || !customer.name || !customer.email) return res.status(400).json({ error: "Missing customer info" });

  try {
    const { data, error } = await supabase
      .from("orders")
      .insert([{
        order_number: `GG-${Date.now()}`,
        customer_name: customer.name,
        email: customer.email,
        phone: customer.mobile || "",
        address_line1: `${customer.unit ? customer.unit + "/" : ""}${customer.streetNo} ${customer.streetName}`,
        suburb: customer.suburb,
        postcode: customer.postcode,
        state: customer.state,
        country: "Australia",
        items: trolley,
        total_amount,
        delivery_fee,
        stripe_id,
        stripe_status,
        delivery_slot
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, order_number: data.order_number });
  } catch (err) {
    console.error("Supabase order creation error:", err);
    res.status(500).json({ error: err.message || "Order creation failed" });
  }
}
