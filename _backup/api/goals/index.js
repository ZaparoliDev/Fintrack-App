import { getDb } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { handleCors } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const user = requireAuth(req, res);
  if (!user) return;

  const db = await getDb();
  const col = db.collection('goals');

  if (req.method === 'GET') {
    const goals = await col.find({ userId: user.id }).sort({ createdAt: -1 }).toArray();
    return res.status(200).json(goals);
  }

  if (req.method === 'POST') {
    const { name, targetAmount, currentAmount, deadline, icon, color } = req.body;
    if (!name || !targetAmount)
      return res.status(400).json({ error: 'Nome e valor alvo são obrigatórios.' });

    const doc = {
      userId: user.id,
      name: name.trim(),
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount) || 0,
      deadline: deadline ? new Date(deadline) : null,
      icon: icon || '🎯',
      color: color || '#3b82f6',
      createdAt: new Date()
    };
    const result = await col.insertOne(doc);
    return res.status(201).json({ ...doc, _id: result.insertedId });
  }

  res.status(405).json({ error: 'Método não permitido.' });
}
