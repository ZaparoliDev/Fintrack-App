// ============================================
// DIAGNÓSTICO DE DEPENDÊNCIAS
// ============================================
console.log('🚀 Iniciando index.js');

let MongoClient, bcrypt, jwt, z, ObjectId;

try {
  const mongodb = require('mongodb');
  MongoClient = mongodb.MongoClient;
  ObjectId = mongodb.ObjectId;
  console.log('✅ mongodb carregado');
} catch (e) {
  console.error('❌ Falha ao carregar mongodb:', e.message);
}

try {
  bcrypt = require('bcryptjs');
  console.log('✅ bcryptjs carregado');
} catch (e) {
  console.error('❌ Falha ao carregar bcryptjs:', e.message);
}

try {
  jwt = require('jsonwebtoken');
  console.log('✅ jsonwebtoken carregado');
} catch (e) {
  console.error('❌ Falha ao carregar jsonwebtoken:', e.message);
}

try {
  z = require('zod');
  console.log('✅ zod carregado');
} catch (e) {
  console.error('❌ Falha ao carregar zod:', e.message);
}

// Se alguma dependência faltar, retorna erro claro
if (!MongoClient || !bcrypt || !jwt || !z) {
  module.exports = (req, res) => {
    res.status(500).json({
      error: 'Dependências não instaladas',
      detalhe: 'Verifique se o package.json está correto e se a Vercel instalou as dependências.'
    });
  };
  return;
}

// ============================================
// CONEXÃO COM O BANCO (dentro do próprio arquivo)
// ============================================
let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedClient && cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não definida');
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
  });

  cachedClient = await client.connect();
  cachedDb = client.db(process.env.MONGODB_DB || 'fintrack');
  return cachedDb;
}

// ============================================
// VALIDAÇÃO (Zod)
// ============================================
const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// ============================================
// HANDLER PRINCIPAL
// ============================================
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('📥 Requisição:', req.method, req.url);
    const db = await getDb();
    const users = db.collection('users');
    const path = req.url.split('?')[0].replace(/^\/api/, '');

    // --- REGISTRO ---
    if (req.method === 'POST' && path === '/auth/register') {
      const { name, email, password } = registerSchema.parse(req.body);
      const existing = await users.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      const hashed = await bcrypt.hash(password, 12);
      const result = await users.insertOne({ name, email, password: hashed, createdAt: new Date() });
      const user = await users.findOne({ _id: result.insertedId }, { projection: { password: 0 } });
      const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`);
      return res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
    }

    // --- LOGIN ---
    if (req.method === 'POST' && path === '/auth/login') {
      const { email, password } = loginSchema.parse(req.body);
      const user = await users.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Email ou senha inválidos' });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Email ou senha inválidos' });
      }
      const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`);
      return res.json({ user: { id: user._id, name: user.name, email: user.email } });
    }

    // --- LOGOUT ---
    if (req.method === 'POST' && path === '/auth/logout') {
      res.setHeader('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
      return res.json({ message: 'Logout realizado' });
    }

    // --- ME ---
    if (req.method === 'GET' && path === '/auth/me') {
      const token = req.headers.cookie?.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
      if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await users.findOne({ _id: new ObjectId(decoded.userId) }, { projection: { password: 0 } });
      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }
      return res.json({ user: { id: user._id, name: user.name, email: user.email } });
    }

    return res.status(404).json({ error: 'Rota não encontrada' });

  } catch (error) {
    console.error('❌ Erro no handler:', error);
    return res.status(500).json({
      error: 'Erro interno',
      detalhe: error.message || 'Erro desconhecido'
    });
  }
};
