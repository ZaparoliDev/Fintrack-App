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
  const col = db.collection('goals');
  const filter = { _id: new ObjectId(id), userId: user.id };

  if (req.method === 'PUT') {
    const { name, targetAmount, currentAmount, deadline, icon, color, deposit } = req.body;
    const update = { updatedAt: new Date() };

    // Depósito: adiciona ao array de histórico e incrementa currentAmount
    if (deposit !== undefined) {
      const amount = Number(deposit.amount);
      const entry = { amount, note: deposit.note || '', date: new Date() };
      const goal = await col.findOne(filter);
      if (!goal) return res.status(404).json({ error: 'Meta não encontrada.' });
      update.currentAmount = goal.currentAmount + amount;
      update.$push = { deposits: entry }; // tratado abaixo separadamente
      const result = await col.findOneAndUpdate(
        filter,
        { $set: { currentAmount: update.currentAmount, updatedAt: new Date() }, $push: { deposits: entry } },
        { returnDocument: 'after' }
      );
      return res.status(200).json(result);
    }

    if (name !== undefined) update.name = name.trim();
    if (targetAmount !== undefined) update.targetAmount = Number(targetAmount);
    if (currentAmount !== undefined) update.currentAmount = Number(currentAmount);
    if (deadline !== undefined) update.deadline = deadline ? new Date(deadline) : null;
    if (icon !== undefined) update.icon = icon;
    if (color !== undefined) update.color = color;

    const result = await col.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'Meta não encontrada.' });
    return res.status(200).json(result);
  }

  if (req.method === 'DELETE') {
    const result = await col.deleteOne(filter);
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Método não permitido.' });
}
