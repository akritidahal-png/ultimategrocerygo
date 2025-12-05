import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  try {
    const orderData = req.body;
    const { data, error } = await supabase.from('orders').insert([orderData]).select();

    if(error) throw error;

    res.status(200).json({ order_number: data[0].order_number || `GG-${Date.now()}` });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
