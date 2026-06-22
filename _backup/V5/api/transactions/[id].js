import { ObjectId } from 'mongodb';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { handleCors } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const user = requireAuth(req, res);
  if (!user) return;

  const { id } = req.query;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido.' });

  const db = await getDb();
  const col = db.collection('transactions');
  const filter = { _id: new ObjectId(id), userId: user.id };

  if (req.method === 'PUT') {
    const { description, amount, type, categoryId, date, note } = req.body;
    const update = {};
    if (description) update.description = description.trim();
    if (amount) update.amount = Number(amount);
    if (type) update.type = type;
    if (categoryId !== undefined) update.categoryId = categoryId;
    if (date) update.date = new Date(date);
    if (note !== undefined) update.note = note.trim();
    update.updatedAt = new Date();

    const result = await col.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'Transação não encontrada.' });
    return res.status(200).json(result);
  }

  if (req.method === 'DELETE') {
    const result = await col.deleteOne(filter);
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Transação não encontrada.' });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Método não permitido.' });
}
