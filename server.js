require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const bodyParser = require('body-parser');

// --- Env Variables ---
const stripe = Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- Postcodes & Zones (from your checkout.html) ---
const approvedPostcodes = ["4000","4005","4006","4007","4008","4009","4010","4011","4012","4013","4014","4017","4018","4025","4029","4030","4031","4032","4034","4035","4036","4051","4053","4054","4055","4059","4060","4061","4064","4065","4066","4067","4068","4069","4070","4072","4073","4074","4075","4076","4077","4078","4101","4102","4103","4104","4105","4106","4107","4108","4109","4110","4111","4112","4113","4114","4115","4116","4117","4118","4119","4120","4121","4122","4123","4124","4125","4127","4128","4129","4130","4132","4133","4151","4152","4153","4154","4155","4156","4157","4158","4159","4160","4161","4163","4164","4165","4169","4170","4171","4172","4173","4174","4178","4179","4183","4184","4205","4207","4280","4285","4300","4301","4303","4304","4305","4306","4307","4308","4311","4340","4346","4500","4501","4502","4503","4504","4505","4506","4507","4508","4509","4510","4511","4512","4513","4514","4515","4516","4517","4518","4519","4520","4521"];

const ZONES = {
  1: ["4030","4031","4032","4034","4035","4036","4025","4029","4183","4184","4151","4152","4153","4154","4155","4156","4157","4158","4159"],
  2: ["4000","4005","4006","4007","4008","4009","4010","4011","4012","4013","4014","4017","4018","4064","4065","4066","4067","4068","4069","4070","4072","4073","4074","4075","4076","4077","4078","4101","4102","4103","4104","4105","4106","4107","4108","4109"],
  3: ["4110","4111","4112","4113","4114","4115","4116","4117","4118","4119","4120","4121","4122","4123","4124","4125","4127","4128","4129","4130","4132","4133","4160","4161","4163","4164","4165","4169","4170","4171","4172","4173","4174","4178","4179","4205","4207","4280","4285","4300","4301","4303","4304","4305","4306","4307","4308","4311","4340","4346","4500","4501","4502","4503","4504","4505","4506","4507","4508","4509","4510","4511","4512","4513","4514","4515","4516","4517","4518","4519","4520","4521"]
};

// --- Delivery fee logic ---
function getDeliveryFee(subtotal){
  return subtotal >= 120 ? 0 : 10;
}

// --- Helper: Validate postcode & get zone ---
function getZone(postcode){
  for(const z in ZONES){
    if(ZONES[z].includes(postcode)) return parseInt(z);
  }
  return null;
}

// --- Stripe Webhook ---
app.post('/api/stripe-webhook', bodyParser.raw({type:'application/json'}), async (req,res)=>{
  const sig = req.headers['stripe-signature'];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret); }
  catch(e){ return res.status(400).send(`Webhook error: ${e.message}`); }

  if(event.type==='payment_intent.succeeded'){
    const piId = event.data.object.id;
    await supabase.from('orders').update({ status:'Successful', stripe_status:'succeeded' }).eq('stripe_id', piId);
  } else if(event.type==='payment_intent.payment_failed'){
    const piId = event.data.object.id;
    await supabase.from('orders').update({ status:'Failed', stripe_status:'failed' }).eq('stripe_id', piId);
  }
  res.json({received:true});
});

// --- Create Payment Intent ---
app.post('/api/create-payment-intent', async (req,res)=>{
  try{
    const { trolley, name, email } = req.body;

    if(!Array.isArray(trolley) || trolley.length===0) return res.status(400).json({ error:'Trolley is empty' });
    if(!name || !email) return res.status(400).json({ error:'Missing customer info' });

    const subtotal = trolley.reduce((s,i)=>s+(i.price||0)*(i.quantity||1),0);
    const deliveryFee = getDeliveryFee(subtotal);
    const total = subtotal + deliveryFee;
    const amountInCents = Math.round(total*100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'aud',
      automatic_payment_methods: { enabled:true },
      metadata: { customer_name: name, email }
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch(err){
    console.error('Payment Intent Error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// --- Create Order ---
app.post('/api/create-order', async (req,res)=>{
  try{
    const { order_number_prefix, customer_name, email, phone, address_line1, suburb, postcode, state, country, items, total_amount, delivery_fee, stripe_id, stripe_status, delivery_slot } = req.body;
    if(!customer_name || !items || !stripe_id) return res.status(400).json({ error:'Missing required fields' });

    const { error } = await supabase.from('orders').insert([{
      order_number: `${order_number_prefix}-${Date.now()}`,
      customer_name,
      email,
      phone,
      address_line1,
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
      status: 'pending'
    }]);

    if(error) return res.status(500).json({ error: 'Failed to save order' });

    res.status(200).json({ order_number: `${order_number_prefix}-${Date.now()}` });

  } catch(err){ console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// --- Admin: Get Orders ---
app.get('/api/get-orders', async (req,res)=>{
  const { data: orders, error } = await supabase.from('orders').select('*').order('created_at',{ascending:false});
  if(error) return res.status(500).json({ error:'Failed to fetch orders' });
  res.status(200).json({ orders });
});

// --- Start Server ---
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));

module.exports = app;
