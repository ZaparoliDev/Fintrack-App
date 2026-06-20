import bcrypt from 'bcryptjs';
import { getDb } from '../lib/db.js';
import { signToken } from '../lib/auth.js';
import { handleCors } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });

  const db = await getDb();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'E-mail já cadastrado.' });

  const hash = await bcrypt.hash(password, 12);
  const result = await db.collection('users').insertOne({
    name,
    email: email.toLowerCase(),
    password: hash,
    createdAt: new Date()
  });

  const token = signToken({ id: result.insertedId.toString(), name, email: email.toLowerCase() });
  res.status(201).json({ token, user: { id: result.insertedId, name, email: email.toLowerCase() } });
}
