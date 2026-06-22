import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI não definida.');

let cachedClient = null;
let cachedDb = null;

export async function getDb() {
  // Reutiliza conexão existente
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  // Cria nova conexão se não existe
  const client = new MongoClient(uri, {
    maxPoolSize: 1, // IMPORTANTE: serverless precisa ser 1
    serverSelectionTimeoutMS: 5000,
  });

  cachedClient = await client.connect();
  cachedDb = cachedClient.db(process.env.MONGODB_DB || 'fintrack');
  
  return cachedDb;
}
