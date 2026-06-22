import { getDb } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { handleCors } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const user = requireAuth(req, res);
  if (!user) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const { month, year } = req.query;
  const db = await getDb();

  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year) || new Date().getFullYear();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  // Agregação por categoria no mês
  const byCategory = await db.collection('transactions').aggregate([
    { $match: { userId: user.id, date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { categoryId: '$categoryId', type: '$type' },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  // Totais gerais do mês
  const totals = await db.collection('transactions').aggregate([
    { $match: { userId: user.id, date: { $gte: start, $lte: end } } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } }
  ]).toArray();

  // Evolução dos últimos 6 meses
  const sixMonthsAgo = new Date(y, m - 7, 1);
  const monthly = await db.collection('transactions').aggregate([
    { $match: { userId: user.id, date: { $gte: sixMonthsAgo, $lte: end } } },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]).toArray();

  const income = totals.find(t => t._id === 'income')?.total || 0;
  const expense = totals.find(t => t._id === 'expense')?.total || 0;

  res.status(200).json({
    month: m, year: y,
    income, expense,
    balance: income - expense,
    byCategory,
    monthly
  });
}
