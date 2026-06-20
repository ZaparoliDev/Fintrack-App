import { ObjectId } from 'mongodb';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { handleCors } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const user = requireAuth(req, res);
  if (!user) return;

  const db = await getDb();
  const col = db.collection('transactions');

  if (req.method === 'GET') {
    const { month, year, category, type } = req.query;
    const filter = { userId: user.id };
    if (type) filter.type = type;
    if (category) filter.categoryId = category;
    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }
    const transactions = await col.find(filter).sort({ date: -1 }).limit(500).toArray();
    return res.status(200).json(transactions);
  }

  if (req.method === 'POST') {
    const { description, amount, type, categoryId, date, note } = req.body;
    if (!description || !amount || !type || !date)
      return res.status(400).json({ error: 'Campos obrigatórios: description, amount, type, date.' });
    if (!['income', 'expense'].includes(type))
      return res.status(400).json({ error: 'Tipo inválido. Use income ou expense.' });
    if (amount <= 0)
      return res.status(400).json({ error: 'Valor deve ser positivo.' });

    const doc = {
      userId: user.id,
      description: description.trim(),
      amount: Number(amount),
      type,
      categoryId: categoryId || null,
      date: new Date(date),
      note: note?.trim() || '',
      createdAt: new Date()
    };
    const result = await col.insertOne(doc);
    return res.status(201).json({ ...doc, _id: result.insertedId });
  }

  res.status(405).json({ error: 'Método não permitido.' });
}
