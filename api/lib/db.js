import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'https://pkqgozqhwmmubfwaxgje.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY;

if (!key) throw new Error('SUPABASE_SERVICE_KEY não definida nas variáveis de ambiente da Vercel.');

let _client;
export function getDb() {
  if (!_client) _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

