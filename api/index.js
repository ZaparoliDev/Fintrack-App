const { getDb } = require('../lib/db.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { ObjectId } = require('mongodb');

const registerSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await getDb();
    const users = db.collection('users');
    const path = req.url.split('?')[0].replace('/api', '');

    if (req.method === 'POST' && path === '/auth/register') {
      const { name, email, password } = registerSchema.parse(req.body);
      const existing = await users.findOne({ email });
      if (existing) return res.status(400).json({ error: 'Email já cadastrado' });
      const hashed = await bcrypt.hash(password, 12);
      const result = await users.insertOne({ name, email, password: hashed, createdAt: new Date() });
      const user = await users.findOne({ _id: result.insertedId }, { projection: { password: 0 } });
      const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
      setAuthCookie(res, token);
      return res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
    }

    if (req.method === 'POST' && path === '/auth/login') {
      const { email, password } = loginSchema.parse(req.body);
      const user = await users.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Email ou senha inválidos' });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: 'Email ou senha inválidos' });
      const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
      setAuthCookie(res, token);
      return res.json({ user: { id: user._id, name: user.name, email: user.email } });
    }

    return res.status(404).json({ error: 'Rota não encontrada' });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno', detalhe: error.message });
  }
};
