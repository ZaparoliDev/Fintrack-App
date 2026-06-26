import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url) throw new Error('SUPABASE_URL não definida.');
if (!key) throw new Error('SUPABASE_SERVICE_KEY não definida.');
let _client;
export function getDb() {
  if (!_client) _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
