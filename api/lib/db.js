const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  // Verifica a variável SOMENTE quando a função for chamada, não na inicialização
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não encontrada. Verifique as variáveis de ambiente na Vercel.');
  }

  // Reutiliza conexão existente
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  // Cria nova conexão
  const client = new MongoClient(uri, {
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
  });

  cachedClient = await client.connect();
  cachedDb = client.db(process.env.MONGODB_DB || 'fintrack');
  
  return cachedDb;
}

module.exports = { getDb };
