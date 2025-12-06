require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Delivery calculation
const DISTANCE_FEES = [ { maxKm: 10, fee: 10 }, { maxKm: 20, fee: 15 }, { maxKm: 30, fee: 20 }, { maxKm: Infinity, fee: 25 } ];
const POSTCODE_DISTANCES = {}; // Add your postcodes with distances
// Example: POSTCODE_DISTANCES[4000] = 5;

function getDeliveryFee(postcode) {
  const dist = POSTCODE_DISTANCES[Number(postcode)];
  if (dist === undefined) return -1;
  for (const df of DISTANCE_FEES) if (dist <= df.maxKm) return df.fee;
  return 25;
}

// Stripe Webhook
app.post('/api/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) { return res.status(400).send(`Webhook error: ${e.message}`); }

  const piId = event.data.object.id;
  if (event.type === 'payment_intent.succeeded') {
    await supabase.from('orders').update({ status: 'Successful', stripe_status: 'succeeded' }).eq('stripe_id', piId);
  } else if (event.type === 'payment_intent.payment_failed') {
    await supabase.from('orders').update({ status: 'Failed', stripe_status: 'failed' }).eq('stripe_id', piId);
  }
  res.json({ received: true });
});

// Routes
app.use('/api', require('./create-payment-intent'));
app.use('/api', require('./create-order'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
