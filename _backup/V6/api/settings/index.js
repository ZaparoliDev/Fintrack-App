import { getDb } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { handleCors } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const user = requireAuth(req, res);
  if (!user) return;

  const db  = await getDb();
  const col = db.collection('settings');

  if (req.method === 'GET') {
    const doc = await col.findOne({ userId: user.id });
    return res.status(200).json(doc || {});
  }

  if (req.method === 'PUT') {
    const allowed = ['theme', 'lastSalary', 'lastVale', 'salaryDismissedAt', 'salaryRegisteredMonth', 'valeDismissedAt', 'valeRegisteredMonth'];
    const update  = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    update.updatedAt = new Date();

    await col.updateOne(
      { userId: user.id },
      { $set: update },
      { upsert: true }
    );
    const doc = await col.findOne({ userId: user.id });
    return res.status(200).json(doc);
  }

  res.status(405).json({ error: 'Método não permitido.' });
}
