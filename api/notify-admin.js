export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { order_number, email } = req.body;
    // You can use email service or just log for demo
    console.log(`Admin notified of order ${order_number}, customer email: ${email}`);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
