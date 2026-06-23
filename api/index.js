const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

// ============================================
// 1. CONEXÃO DIRETA COM O MONGODB (sem lib externa)
// ============================================
let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedClient && cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não definida nas variáveis de ambiente');
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
// 2. VALIDAÇÃO (Zod)
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
// 3. COOKIES
// ============================================
function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`);
}

// ============================================
// 4. HANDLER PRINCIPAL
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
    // Conecta ao banco
    const db = await getDb();
    const users = db.collection('users');

    // Pega o caminho sem o /api
    const path = req.url.split('?')[0].replace(/^\/api/, '');

    // --- ROTA: REGISTRO ---
    if (req.method === 'POST' && path === '/auth/register') {
      const { name, email, password } = registerSchema.parse(req.body);
      const existing = await users.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      const hashed = await bcrypt.hash(password, 12);
      const result = await users.insertOne({
        name,
        email,
        password: hashed,
        createdAt: new Date()
      });
      const user = await users.findOne(
        { _id: result.insertedId },
        { projection: { password: 0 } }
      );
      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      setAuthCookie(res, token);
      return res.status(201).json({
        user: { id: user._id, name: user.name, email: user.email }
      });
    }

    // --- ROTA: LOGIN ---
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
      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      setAuthCookie(res, token);
      return res.json({
        user: { id: user._id, name: user.name, email: user.email }
      });
    }

    // --- ROTA: LOGOUT ---
    if (req.method === 'POST' && path === '/auth/logout') {
      res.setHeader('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
      return res.json({ message: 'Logout realizado' });
    }

    // --- ROTA: ME ---
    if (req.method === 'GET' && path === '/auth/me') {
      const token = req.headers.cookie?.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
      if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await users.findOne(
        { _id: new require('mongodb').ObjectId(decoded.userId) },
        { projection: { password: 0 } }
      );
      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }
      return res.json({
        user: { id: user._id, name: user.name, email: user.email }
      });
    }

    // Se nenhuma rota bater
    return res.status(404).json({ error: 'Rota não encontrada' });

  } catch (error) {
    console.error('❌ Erro no servidor:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      detalhe: error.message || 'Erro desconhecido'
    });
  }
};
