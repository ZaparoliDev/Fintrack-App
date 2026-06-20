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
  const col = db.collection('categories');
  const filter = { _id: new ObjectId(id), userId: user.id };

  if (req.method === 'PUT') {
    const { name, icon, color, type, smart, smartDefaults } = req.body;
    const update = { updatedAt: new Date() };
    if (name !== undefined) update.name = name.trim();
    if (icon !== undefined) update.icon = icon;
    if (color !== undefined) update.color = color;
    if (type !== undefined) update.type = type;
    if (smart !== undefined) update.smart = smart;
    if (smartDefaults !== undefined) update.smartDefaults = smartDefaults;

    const result = await col.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'Categoria não encontrada.' });
    return res.status(200).json(result);
  }

  if (req.method === 'DELETE') {
    const result = await col.deleteOne(filter);
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Categoria não encontrada.' });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Método não permitido.' });
}
