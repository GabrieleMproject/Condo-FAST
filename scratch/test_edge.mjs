import fetch from 'node-fetch';

async function test() {
  const url = 'https://aapksiokakavarwaumwy.supabase.co/functions/v1/stripe-checkout-telematici';
  
  // Need to get an anon key or service role key to pass the JWT format check!
  const anonKey = process.env.SUPABASE_ANON_KEY || 'no-key'; // I'll run this inside deploy_all's context or just fetch it
}
test();
