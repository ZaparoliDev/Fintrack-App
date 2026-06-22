import { getDb } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { handleCors } from '../lib/cors.js';

const DEFAULT_CATEGORIES = [
  { name: 'Salário',          icon: '💼', color: '#22c55e', type: 'income',  smart: false },
  { name: 'Freelance',        icon: '💻', color: '#3b82f6', type: 'income',  smart: false },
  { name: 'Investimentos',    icon: '📈', color: '#a855f7', type: 'income',  smart: false },
  { name: 'Outros (entrada)', icon: '➕', color: '#06b6d4', type: 'income',  smart: false },
  { name: 'Moradia',          icon: '🏠', color: '#f97316', type: 'expense', smart: false },
  { name: 'Alimentação',      icon: '🍽️', color: '#ef4444', type: 'expense', smart: false },
  { name: 'Transporte',       icon: '🚗', color: '#eab308', type: 'expense', smart: false },
  { name: 'Saúde',            icon: '🏥', color: '#ec4899', type: 'expense', smart: false },
  { name: 'Lazer',            icon: '🎮', color: '#8b5cf6', type: 'expense', smart: false },
  { name: 'Educação',         icon: '📚', color: '#14b8a6', type: 'expense', smart: false },
  { name: 'Roupas',           icon: '👕', color: '#f59e0b', type: 'expense', smart: false },
  { name: 'Outros (saída)',   icon: '➖', color: '#6b7280', type: 'expense', smart: false }
];

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const user = requireAuth(req, res);
  if (!user) return;

  const db = await getDb();
  const col = db.collection('categories');

  if (req.method === 'GET') {
    let categories = await col.find({ userId: user.id }).sort({ name: 1 }).toArray();
    if (categories.length === 0) {
      const docs = DEFAULT_CATEGORIES.map(c => ({ ...c, userId: user.id, createdAt: new Date() }));
      await col.insertMany(docs);
      categories = await col.find({ userId: user.id }).sort({ name: 1 }).toArray();
    }
    return res.status(200).json(categories);
  }

  if (req.method === 'POST') {
    const { name, icon, color, type, smart, smartDefaults } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
    const doc = {
      userId: user.id,
      name: name.trim(),
      icon: icon || '📁',
      color: color || '#6b7280',
      type,
      smart: smart || false,
      smartDefaults: smartDefaults || null,
      createdAt: new Date()
    };
    const result = await col.insertOne(doc);
    return res.status(201).json({ ...doc, _id: result.insertedId });
  }

  res.status(405).json({ error: 'Método não permitido.' });
}
