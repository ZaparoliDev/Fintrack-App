const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI não definida.');

let cachedClient = null;
let cachedDb = null;

async function getDb() {
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
  cachedDb = client.db(process.env.MONGODB_DB || 'fintrack');
  
  return cachedDb;
}

module.exports = { getDb };
