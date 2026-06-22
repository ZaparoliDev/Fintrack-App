import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI não definida.');

let clientPromise;
if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    const c = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
    global._mongoClientPromise = c.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  const c = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
  clientPromise = c.connect();
}

export async function getDb() {
  const c = await clientPromise;
  return c.db(process.env.MONGODB_DB || 'fintrack');
}
