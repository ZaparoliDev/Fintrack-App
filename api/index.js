// ===== FINTRACK — API UNIFICADA (1 serverless function) =====
import bcrypt   from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDb }        from './lib/db.js';
import { signToken, requireAuth } from './lib/auth.js';

const CORS_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ───────────────────────────── HANDLERS ─────────────────────────────

// AUTH
async function authRegister(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });

  const db = await getDb();
  if (await db.collection('users').findOne({ email: email.toLowerCase() }))
    return res.status(409).json({ error: 'E-mail já cadastrado.' });

  const hash   = await bcrypt.hash(password, 12);
  const result = await db.collection('users').insertOne({
    name, email: email.toLowerCase(), password: hash, createdAt: new Date()
  });
  const token = signToken({ id: result.insertedId.toString(), name, email: email.toLowerCase() });
  res.status(201).json({ token, user: { id: result.insertedId, name, email: email.toLowerCase() } });
}

async function authLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

  const db   = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Credenciais inválidas.' });

  const token = signToken({ id: user._id.toString(), name: user.name, email: user.email });
  res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email } });
}

// TRANSACTIONS
async function txList(req, res, user) {
  const { month, year, category, type } = req.query;
  const db     = await getDb();
  const filter = { userId: user.id };
  if (type)             filter.type       = type;
  if (category)         filter.categoryId = category;
  if (month && year) {
    filter.date = {
      $gte: new Date(+year, +month - 1, 1),
      $lte: new Date(+year, +month, 0, 23, 59, 59)
    };
  }
  const list = await db.collection('transactions').find(filter).sort({ date: -1 }).limit(500).toArray();
  res.status(200).json(list);
}

async function txCreate(req, res, user) {
  const { description, amount, type, categoryId, date, note } = req.body;
  if (!description || !amount || !type || !date)
    return res.status(400).json({ error: 'Campos obrigatórios: description, amount, type, date.' });
  if (!['income','expense'].includes(type))
    return res.status(400).json({ error: 'Tipo inválido.' });
  if (+amount <= 0)
    return res.status(400).json({ error: 'Valor deve ser positivo.' });

  const db  = await getDb();
  const doc = {
    userId: user.id, description: description.trim(),
    amount: +amount, type, categoryId: categoryId || null,
    date: new Date(date), note: note?.trim() || '', createdAt: new Date()
  };
  const r = await db.collection('transactions').insertOne(doc);
  res.status(201).json({ ...doc, _id: r.insertedId });
}

async function txUpdate(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido.' });
  const db     = await getDb();
  const update = { updatedAt: new Date() };
  const { description, amount, type, categoryId, date, note } = req.body;
  if (description !== undefined) update.description = description.trim();
  if (amount      !== undefined) update.amount      = +amount;
  if (type        !== undefined) update.type        = type;
  if (categoryId  !== undefined) update.categoryId  = categoryId;
  if (date        !== undefined) update.date        = new Date(date);
  if (note        !== undefined) update.note        = note.trim();
  const r = await db.collection('transactions').findOneAndUpdate(
    { _id: new ObjectId(id), userId: user.id },
    { $set: update }, { returnDocument: 'after' }
  );
  if (!r) return res.status(404).json({ error: 'Transação não encontrada.' });
  res.status(200).json(r);
}

async function txDelete(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido.' });
  const db = await getDb();
  const r  = await db.collection('transactions').deleteOne({ _id: new ObjectId(id), userId: user.id });
  if (!r.deletedCount) return res.status(404).json({ error: 'Transação não encontrada.' });
  res.status(200).json({ success: true });
}

// CATEGORIES
const DEFAULT_CATS = [
  { name:'Salário',          icon:'💼', color:'#22c55e', type:'income',  smart:false },
  { name:'Freelance',        icon:'💻', color:'#3b82f6', type:'income',  smart:false },
  { name:'Investimentos',    icon:'📈', color:'#a855f7', type:'income',  smart:false },
  { name:'Outros (entrada)', icon:'➕', color:'#06b6d4', type:'income',  smart:false },
  { name:'Moradia',          icon:'🏠', color:'#f97316', type:'expense', smart:false },
  { name:'Alimentação',      icon:'🍽️', color:'#ef4444', type:'expense', smart:false },
  { name:'Transporte',       icon:'🚗', color:'#eab308', type:'expense', smart:false },
  { name:'Saúde',            icon:'🏥', color:'#ec4899', type:'expense', smart:false },
  { name:'Lazer',            icon:'🎮', color:'#8b5cf6', type:'expense', smart:false },
  { name:'Educação',         icon:'📚', color:'#14b8a6', type:'expense', smart:false },
  { name:'Roupas',           icon:'👕', color:'#f59e0b', type:'expense', smart:false },
  { name:'Outros (saída)',   icon:'➖', color:'#6b7280', type:'expense', smart:false },
];

async function catList(req, res, user) {
  const db  = await getDb();
  const col = db.collection('categories');
  let list  = await col.find({ userId: user.id }).sort({ name: 1 }).toArray();
  if (!list.length) {
    await col.insertMany(DEFAULT_CATS.map(c => ({ ...c, userId: user.id, createdAt: new Date() })));
    list = await col.find({ userId: user.id }).sort({ name: 1 }).toArray();
  }
  res.status(200).json(list);
}

async function catCreate(req, res, user) {
  const { name, icon, color, type, smart, smartDefaults } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
  const db  = await getDb();
  const doc = { userId: user.id, name: name.trim(), icon: icon||'📁', color: color||'#6b7280', type, smart:!!smart, smartDefaults:smartDefaults||null, createdAt: new Date() };
  const r   = await db.collection('categories').insertOne(doc);
  res.status(201).json({ ...doc, _id: r.insertedId });
}

async function catUpdate(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido.' });
  const db     = await getDb();
  const update = { updatedAt: new Date() };
  const fields = ['name','icon','color','type','smart','smartDefaults'];
  for (const f of fields) if (req.body[f] !== undefined) update[f] = req.body[f];
  if (update.name) update.name = update.name.trim();
  const r = await db.collection('categories').findOneAndUpdate(
    { _id: new ObjectId(id), userId: user.id }, { $set: update }, { returnDocument: 'after' }
  );
  if (!r) return res.status(404).json({ error: 'Categoria não encontrada.' });
  res.status(200).json(r);
}

async function catDelete(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido.' });
  const db = await getDb();
  const r  = await db.collection('categories').deleteOne({ _id: new ObjectId(id), userId: user.id });
  if (!r.deletedCount) return res.status(404).json({ error: 'Categoria não encontrada.' });
  res.status(200).json({ success: true });
}

// GOALS
async function goalList(req, res, user) {
  const db   = await getDb();
  const list = await db.collection('goals').find({ userId: user.id }).sort({ createdAt: -1 }).toArray();
  res.status(200).json(list);
}

async function goalCreate(req, res, user) {
  const { name, targetAmount, currentAmount, deadline, icon, color } = req.body;
  if (!name || !targetAmount) return res.status(400).json({ error: 'Nome e valor alvo são obrigatórios.' });
  const db  = await getDb();
  const doc = {
    userId: user.id, name: name.trim(),
    targetAmount: +targetAmount, currentAmount: +currentAmount || 0,
    deadline: deadline ? new Date(deadline) : null,
    icon: icon||'🎯', color: color||'#3b82f6',
    deposits: [], createdAt: new Date()
  };
  const r = await db.collection('goals').insertOne(doc);
  res.status(201).json({ ...doc, _id: r.insertedId });
}

async function goalUpdate(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido.' });
  const db     = await getDb();
  const filter = { _id: new ObjectId(id), userId: user.id };
  const { deposit, removeDepositIndex } = req.body;

  if (deposit !== undefined) {
    const amount = +deposit.amount;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido.' });
    const goal  = await db.collection('goals').findOne(filter);
    if (!goal) return res.status(404).json({ error: 'Meta não encontrada.' });
    const entry = { amount, note: deposit.note||'', date: new Date() };
    const r     = await db.collection('goals').findOneAndUpdate(
      filter,
      { $set: { currentAmount: goal.currentAmount + amount, updatedAt: new Date() }, $push: { deposits: entry } },
      { returnDocument: 'after' }
    );
    return res.status(200).json(r);
  }

  if (removeDepositIndex !== undefined) {
    const idx  = +removeDepositIndex;
    const goal = await db.collection('goals').findOne(filter);
    if (!goal) return res.status(404).json({ error: 'Meta não encontrada.' });
    const deps    = goal.deposits || [];
    if (idx < 0 || idx >= deps.length) return res.status(400).json({ error: 'Índice inválido.' });
    const removed = deps[idx];
    const r       = await db.collection('goals').findOneAndUpdate(
      filter,
      { $set: { deposits: deps.filter((_,i)=>i!==idx), currentAmount: Math.max(0, goal.currentAmount - removed.amount), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return res.status(200).json(r);
  }

  const update = { updatedAt: new Date() };
  const fields = ['name','targetAmount','currentAmount','deadline','icon','color'];
  for (const f of fields) if (req.body[f] !== undefined) update[f] = req.body[f];
  if (update.name)          update.name          = update.name.trim();
  if (update.targetAmount)  update.targetAmount  = +update.targetAmount;
  if (update.currentAmount !== undefined) update.currentAmount = +update.currentAmount;
  if (update.deadline !== undefined) update.deadline = update.deadline ? new Date(update.deadline) : null;

  const r = await db.collection('goals').findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' });
  if (!r) return res.status(404).json({ error: 'Meta não encontrada.' });
  res.status(200).json(r);
}

async function goalDelete(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido.' });
  const db = await getDb();
  const r  = await db.collection('goals').deleteOne({ _id: new ObjectId(id), userId: user.id });
  if (!r.deletedCount) return res.status(404).json({ error: 'Meta não encontrada.' });
  res.status(200).json({ success: true });
}

// REPORTS
async function reportSummary(req, res, user) {
  const { month, year } = req.query;
  const db = await getDb();
  const m  = +month || new Date().getMonth() + 1;
  const y  = +year  || new Date().getFullYear();
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 0, 23, 59, 59);

  const [byCategory, totals, monthly] = await Promise.all([
    db.collection('transactions').aggregate([
      { $match: { userId: user.id, date: { $gte: start, $lte: end } } },
      { $group: { _id: { categoryId:'$categoryId', type:'$type' }, total:{ $sum:'$amount' }, count:{ $sum:1 } } }
    ]).toArray(),
    db.collection('transactions').aggregate([
      { $match: { userId: user.id, date: { $gte: start, $lte: end } } },
      { $group: { _id:'$type', total:{ $sum:'$amount' } } }
    ]).toArray(),
    db.collection('transactions').aggregate([
      { $match: { userId: user.id, date: { $gte: new Date(y, m - 7, 1), $lte: end } } },
      { $group: { _id:{ year:{ $year:'$date' }, month:{ $month:'$date' }, type:'$type' }, total:{ $sum:'$amount' } } },
      { $sort: { '_id.year':1, '_id.month':1 } }
    ]).toArray()
  ]);

  const income  = totals.find(t => t._id === 'income')?.total  || 0;
  const expense = totals.find(t => t._id === 'expense')?.total || 0;
  res.status(200).json({ month: m, year: y, income, expense, balance: income - expense, byCategory, monthly });
}

// Meses com dados disponíveis
async function reportMonths(req, res, user) {
  const db = await getDb();
  const months = await db.collection('transactions').aggregate([
    { $match: { userId: user.id } },
    { $group: { _id: { year: { $year:'$date' }, month: { $month:'$date' } }, count: { $sum:1 }, total: { $sum:'$amount' } } },
    { $sort: { '_id.year': -1, '_id.month': -1 } }
  ]).toArray();
  res.status(200).json(months);
}

// Transações para export (sem paginação)
async function txExport(req, res, user) {
  const { month, year } = req.query;
  const db     = await getDb();
  const filter = { userId: user.id };
  if (month && year) {
    filter.date = {
      $gte: new Date(+year, +month - 1, 1),
      $lte: new Date(+year, +month, 0, 23, 59, 59)
    };
  }
  const list = await db.collection('transactions').find(filter).sort({ date: 1 }).limit(5000).toArray();
  res.status(200).json(list);
}

// SETTINGS
const SETTINGS_FIELDS = [
  'theme','cltMode','cltOnboardingDone','salaryDay','valeDay',
  'lastSalary','lastVale','salaryDismissedAt','salaryRegisteredMonth',
  'valeDismissedAt','valeRegisteredMonth'
];

async function settingsGet(req, res, user) {
  const db  = await getDb();
  const doc = await db.collection('settings').findOne({ userId: user.id });
  res.status(200).json(doc || {});
}

async function settingsPut(req, res, user) {
  const db     = await getDb();
  const update = { updatedAt: new Date() };
  for (const k of SETTINGS_FIELDS) if (req.body[k] !== undefined) update[k] = req.body[k];
  await db.collection('settings').updateOne({ userId: user.id }, { $set: update }, { upsert: true });
  const doc = await db.collection('settings').findOne({ userId: user.id });
  res.status(200).json(doc);
}

// ───────────────────────────── ROUTER ─────────────────────────────

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Parse path: /api/[...segments]
  // Vercel passa como req.query quando configurado com catch-all
  // Mas como é index.js, o path vem de req.url
  const url      = req.url.replace(/\?.*$/, '');                 // remove query string
  const segments = url.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [resource, idOrSub] = segments; // ex: ['transactions','abc123'] ou ['auth','login']
  const method   = req.method.toUpperCase();

  try {
    // ── AUTH (sem autenticação) ──
    if (resource === 'auth' && idOrSub === 'register' && method === 'POST') return await authRegister(req, res);
    if (resource === 'auth' && idOrSub === 'login'    && method === 'POST') return await authLogin(req, res);

    // ── ROTAS AUTENTICADAS ──
    const user = requireAuth(req, res);
    if (!user) return;

    // TRANSACTIONS
    if (resource === 'transactions') {
      if (idOrSub === 'export' && method === 'GET') return await txExport(req, res, user);
      if (!idOrSub) {
        if (method === 'GET')  return await txList(req, res, user);
        if (method === 'POST') return await txCreate(req, res, user);
      } else {
        if (method === 'PUT')    return await txUpdate(req, res, user, idOrSub);
        if (method === 'DELETE') return await txDelete(req, res, user, idOrSub);
      }
    }

    // CATEGORIES
    if (resource === 'categories') {
      if (!idOrSub) {
        if (method === 'GET')  return await catList(req, res, user);
        if (method === 'POST') return await catCreate(req, res, user);
      } else {
        if (method === 'PUT')    return await catUpdate(req, res, user, idOrSub);
        if (method === 'DELETE') return await catDelete(req, res, user, idOrSub);
      }
    }

    // GOALS
    if (resource === 'goals') {
      if (!idOrSub) {
        if (method === 'GET')  return await goalList(req, res, user);
        if (method === 'POST') return await goalCreate(req, res, user);
      } else {
        if (method === 'PUT')    return await goalUpdate(req, res, user, idOrSub);
        if (method === 'DELETE') return await goalDelete(req, res, user, idOrSub);
      }
    }

    // REPORTS
    if (resource === 'reports') {
      if (idOrSub === 'summary') return await reportSummary(req, res, user);
      if (idOrSub === 'months')  return await reportMonths(req, res, user);
    }

    // SETTINGS
    if (resource === 'settings') {
      if (method === 'GET') return await settingsGet(req, res, user);
      if (method === 'PUT') return await settingsPut(req, res, user);
    }

    res.status(404).json({ error: 'Rota não encontrada.' });

  } catch (err) {
    console.error('[API Error]', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
