// FINTRACK API — Supabase — 1 serverless function
import bcrypt from 'bcryptjs';
import { getDb } from './lib/db.js';
import { signToken, requireAuth } from './lib/auth.js';

const CORS = process.env.ALLOWED_ORIGIN || '*';

// Retorna o último dia real do mês (28/29/30/31), evitando datas inválidas
// como "2026-06-31" que não existem e quebram a query no Postgres.
function lastDayOfMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ── AUTH ──────────────────────────────────────────
async function authRegister(req, res) {
  const { name, email, password, confirmPassword } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });
  if (confirmPassword !== undefined && password !== confirmPassword) return res.status(400).json({ error: 'As senhas não coincidem.' });
  const db = getDb();
  const { data: ex } = await db.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
  if (ex) return res.status(409).json({ error: 'E-mail já cadastrado.' });
  const hash = await bcrypt.hash(password, 12);
  const { data: user, error } = await db.from('users').insert({ name, email: email.toLowerCase(), password: hash, created_at: new Date().toISOString() }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  const token = signToken({ id: String(user.id), name, email: email.toLowerCase() });
  res.status(201).json({ token, user: { id: user.id, name, email: email.toLowerCase() } });
}

async function authLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  const db = getDb();
  const { data: user } = await db.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Credenciais inválidas.' });
  const token = signToken({ id: String(user.id), name: user.name, email: user.email });
  res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email } });
}

// ── TRANSACTIONS ──────────────────────────────────
async function txList(req, res, user) {
  const { month, year, type, category } = req.query;
  const db = getDb();
  let q = db.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(500);
  if (type) q = q.eq('type', type);
  if (category) q = q.eq('category_id', category);
  if (month && year) {
    const m = String(+month).padStart(2, '0');
    const lastDay = String(lastDayOfMonth(year, month)).padStart(2, '0');
    q = q.gte('date', `${year}-${m}-01`).lte('date', `${year}-${m}-${lastDay}`);
  }
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function txCreate(req, res, user) {
  const { description, amount, type, categoryId, date, note } = req.body;
  if (!description || !amount || !type || !date) return res.status(400).json({ error: 'Campos obrigatórios: description, amount, type, date.' });
  if (!['income','expense'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  if (+amount <= 0) return res.status(400).json({ error: 'Valor deve ser positivo.' });
  const db = getDb();
  const { data, error } = await db.from('transactions').insert({
    user_id: user.id, description: description.trim(), amount: +amount,
    type, category_id: categoryId || null, date, note: note?.trim() || '',
    created_at: new Date().toISOString()
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

async function txUpdate(req, res, user, id) {
  const db = getDb();
  const u = { updated_at: new Date().toISOString() };
  const { description, amount, type, categoryId, date, note } = req.body;
  if (description !== undefined) u.description = description.trim();
  if (amount !== undefined) u.amount = +amount;
  if (type !== undefined) u.type = type;
  if (categoryId !== undefined) u.category_id = categoryId;
  if (date !== undefined) u.date = date;
  if (note !== undefined) u.note = note.trim();
  const { data, error } = await db.from('transactions').update(u).eq('id', id).eq('user_id', user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Transação não encontrada.' });
  res.json(data);
}

async function txDelete(req, res, user, id) {
  const db = getDb();
  const { error } = await db.from('transactions').delete().eq('id', id).eq('user_id', user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}

async function txExport(req, res, user) {
  const { month, year } = req.query;
  const db = getDb();
  let q = db.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: true }).limit(5000);
  if (month && year) { const m = String(+month).padStart(2,'0'); const lastDay = String(lastDayOfMonth(year, month)).padStart(2,'0'); q = q.gte('date', `${year}-${m}-01`).lte('date', `${year}-${m}-${lastDay}`); }
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function txImport(req, res, user) {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || !transactions.length) return res.status(400).json({ error: 'Nenhuma transação para importar.' });
  const db = getDb();
  const docs = transactions.map(t => ({
    user_id: user.id,
    description: String(t.description || 'Importado').trim().slice(0, 200),
    amount: Math.abs(parseFloat(t.amount) || 0),
    type: t.type === 'income' ? 'income' : 'expense',
    category_id: t.categoryId || null,
    date: t.date || new Date().toISOString().slice(0, 10),
    note: String(t.note || '').trim(),
    created_at: new Date().toISOString()
  })).filter(t => t.amount > 0);
  const { data, error } = await db.from('transactions').insert(docs).select();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ imported: data.length });
}

// ── CATEGORIES ────────────────────────────────────
const DEFAULT_CATS = [
  { name:'Salário',icon:'💼',color:'#22c55e',type:'income',smart:false },
  { name:'Freelance',icon:'💻',color:'#3b82f6',type:'income',smart:false },
  { name:'Investimentos',icon:'📈',color:'#a855f7',type:'income',smart:false },
  { name:'Outros (entrada)',icon:'➕',color:'#06b6d4',type:'income',smart:false },
  { name:'Moradia',icon:'🏠',color:'#f97316',type:'expense',smart:false },
  { name:'Alimentação',icon:'🍽️',color:'#ef4444',type:'expense',smart:false },
  { name:'Transporte',icon:'🚗',color:'#eab308',type:'expense',smart:false },
  { name:'Saúde',icon:'🏥',color:'#ec4899',type:'expense',smart:false },
  { name:'Lazer',icon:'🎮',color:'#8b5cf6',type:'expense',smart:false },
  { name:'Educação',icon:'📚',color:'#14b8a6',type:'expense',smart:false },
  { name:'Roupas',icon:'👕',color:'#f59e0b',type:'expense',smart:false },
  { name:'Outros (saída)',icon:'➖',color:'#6b7280',type:'expense',smart:false },
];

async function catList(req, res, user) {
  const db = getDb();
  let { data } = await db.from('categories').select('*').eq('user_id', user.id).order('name');
  if (!data || !data.length) {
    const seed = DEFAULT_CATS.map(c => ({ ...c, user_id: user.id, created_at: new Date().toISOString() }));
    const { data: ins } = await db.from('categories').insert(seed).select();
    data = ins || [];
  }
  res.json(data);
}

async function catCreate(req, res, user) {
  const { name, icon, color, type, smart, smartDefaults } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
  const db = getDb();
  const { data, error } = await db.from('categories').insert({
    user_id: user.id, name: name.trim(), icon: icon||'📁',
    color: color||'#6b7280', type, smart: !!smart,
    smart_defaults: smartDefaults||null, created_at: new Date().toISOString()
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

async function catUpdate(req, res, user, id) {
  const db = getDb();
  const u = { updated_at: new Date().toISOString() };
  const { name,icon,color,type,smart,smartDefaults } = req.body;
  if (name!==undefined) u.name=name.trim();
  if (icon!==undefined) u.icon=icon;
  if (color!==undefined) u.color=color;
  if (type!==undefined) u.type=type;
  if (smart!==undefined) u.smart=smart;
  if (smartDefaults!==undefined) u.smart_defaults=smartDefaults;
  const { data, error } = await db.from('categories').update(u).eq('id',id).eq('user_id',user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Categoria não encontrada.' });
  res.json(data);
}

async function catDelete(req, res, user, id) {
  const db = getDb();
  const { error } = await db.from('categories').delete().eq('id',id).eq('user_id',user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}

// ── GOALS ─────────────────────────────────────────
async function goalList(req, res, user) {
  const db = getDb();
  const { data, error } = await db.from('goals').select('*').eq('user_id',user.id).order('created_at',{ascending:false});
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function goalCreate(req, res, user) {
  const { name,targetAmount,currentAmount,deadline,icon,color } = req.body;
  if (!name||!targetAmount) return res.status(400).json({ error: 'Nome e valor alvo são obrigatórios.' });
  const db = getDb();
  const { data, error } = await db.from('goals').insert({
    user_id:user.id, name:name.trim(), target_amount:+targetAmount,
    current_amount:+currentAmount||0, deadline:deadline||null,
    icon:icon||'🎯', color:color||'#3b82f6', deposits:[],
    created_at:new Date().toISOString()
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

async function goalUpdate(req, res, user, id) {
  const db = getDb();
  const { deposit, removeDepositIndex, name, targetAmount, currentAmount, deadline, icon, color } = req.body;
  if (deposit !== undefined) {
    const amount = +deposit.amount;
    if (!amount||amount<=0) return res.status(400).json({ error: 'Valor inválido.' });
    const { data: goal } = await db.from('goals').select('*').eq('id',id).eq('user_id',user.id).single();
    if (!goal) return res.status(404).json({ error: 'Meta não encontrada.' });
    const deps = [...(goal.deposits||[]), { amount, note:deposit.note||'', date:new Date().toISOString() }];
    const { data, error } = await db.from('goals').update({ current_amount:(goal.current_amount||0)+amount, deposits:deps, updated_at:new Date().toISOString() }).eq('id',id).eq('user_id',user.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (removeDepositIndex !== undefined) {
    const idx = +removeDepositIndex;
    const { data: goal } = await db.from('goals').select('*').eq('id',id).eq('user_id',user.id).single();
    if (!goal) return res.status(404).json({ error: 'Meta não encontrada.' });
    const deps = (goal.deposits||[]).filter((_,i)=>i!==idx);
    const removed = (goal.deposits||[])[idx];
    const { data, error } = await db.from('goals').update({ deposits:deps, current_amount:Math.max(0,(goal.current_amount||0)-(removed?.amount||0)), updated_at:new Date().toISOString() }).eq('id',id).eq('user_id',user.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  const u = { updated_at: new Date().toISOString() };
  if (name!==undefined) u.name=name.trim();
  if (targetAmount!==undefined) u.target_amount=+targetAmount;
  if (currentAmount!==undefined) u.current_amount=+currentAmount;
  if (deadline!==undefined) u.deadline=deadline||null;
  if (icon!==undefined) u.icon=icon;
  if (color!==undefined) u.color=color;
  const { data, error } = await db.from('goals').update(u).eq('id',id).eq('user_id',user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Meta não encontrada.' });
  res.json(data);
}

async function goalDelete(req, res, user, id) {
  const db = getDb();
  const { error } = await db.from('goals').delete().eq('id',id).eq('user_id',user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}

// ── DEBTS ─────────────────────────────────────────
async function debtList(req, res, user) {
  const db = getDb();
  const { data, error } = await db.from('debts').select('*').eq('user_id',user.id).order('created_at',{ascending:false});
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

async function debtCreate(req, res, user) {
  const { name,totalAmount,installmentAmount,totalInstallments,paidInstallments,startDate,icon,color,categoryId } = req.body;
  if (!name||!installmentAmount||!totalInstallments) return res.status(400).json({ error: 'Nome, valor da parcela e total de parcelas são obrigatórios.' });
  const db = getDb();
  const { data, error } = await db.from('debts').insert({
    user_id:user.id, name:name.trim(),
    total_amount:+totalAmount||(+installmentAmount*+totalInstallments),
    installment_amount:+installmentAmount, total_installments:+totalInstallments,
    paid_installments:+paidInstallments||0,
    start_date:startDate||new Date().toISOString().slice(0,10),
    icon:icon||'💳', color:color||'#ef4444',
    category_id:categoryId||null, active:true,
    created_at:new Date().toISOString()
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

async function debtUpdate(req, res, user, id) {
  const db = getDb();
  const u = { updated_at: new Date().toISOString() };
  const map = { name:'name',totalAmount:'total_amount',installmentAmount:'installment_amount',
    totalInstallments:'total_installments',paidInstallments:'paid_installments',
    startDate:'start_date',icon:'icon',color:'color',categoryId:'category_id',active:'active' };
  for (const [k,col] of Object.entries(map)) if (req.body[k]!==undefined) u[col]=req.body[k];
  const { data, error } = await db.from('debts').update(u).eq('id',id).eq('user_id',user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Dívida não encontrada.' });
  res.json(data);
}

async function debtDelete(req, res, user, id) {
  const db = getDb();
  const { error } = await db.from('debts').delete().eq('id',id).eq('user_id',user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}

// ── REPORTS ───────────────────────────────────────
async function reportSummary(req, res, user) {
  const { month, year } = req.query;
  const m = String(+month||new Date().getMonth()+1).padStart(2,'0');
  const y = year||new Date().getFullYear();
  const lastDay = String(lastDayOfMonth(y, m)).padStart(2,'0');
  const start=`${y}-${m}-01`, end=`${y}-${m}-${lastDay}`;
  const db = getDb();
  const [{ data: txs },{ data: debts },{ data: allTxsUpToMonth }] = await Promise.all([
    db.from('transactions').select('*').eq('user_id',user.id).gte('date',start).lte('date',end),
    db.from('debts').select('*').eq('user_id',user.id).eq('active',true),
    // Saldo real = acumulado de TODAS as transações desde o início até o fim do mês selecionado,
    // não apenas as do mês corrente. Isso evita que o saldo "zere" ao trocar de mês.
    db.from('transactions').select('amount,type').eq('user_id',user.id).lte('date',end)
  ]);
  const income  = (txs||[]).filter(t=>t.type==='income').reduce((s,t)=>s+(+t.amount),0);
  const expense = (txs||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+(+t.amount),0);
  const totalIncomeAccum  = (allTxsUpToMonth||[]).filter(t=>t.type==='income').reduce((s,t)=>s+(+t.amount),0);
  const totalExpenseAccum = (allTxsUpToMonth||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+(+t.amount),0);
  const balance = totalIncomeAccum - totalExpenseAccum;
  const byCategory = {};
  for (const t of (txs||[])) {
    const k=`${t.category_id||'null'}_${t.type}`;
    if (!byCategory[k]) byCategory[k]={ _id:{ categoryId:t.category_id, type:t.type }, total:0, count:0 };
    byCategory[k].total += +t.amount; byCategory[k].count++;
  }
  const sixAgo = new Date(+y, +m-7, 1).toISOString().slice(0,10);
  const { data: hist } = await db.from('transactions').select('date,amount,type').eq('user_id',user.id).gte('date',sixAgo).lte('date',end);
  const monthly = {};
  for (const t of (hist||[])) {
    const d=new Date(t.date), k=`${d.getFullYear()}_${d.getMonth()+1}_${t.type}`;
    if (!monthly[k]) monthly[k]={ _id:{ year:d.getFullYear(), month:d.getMonth()+1, type:t.type }, total:0 };
    monthly[k].total += +t.amount;
  }
  const debtInstallments = (debts||[]).map(d=>({
    _id:d.id, name:d.name, icon:d.icon, color:d.color,
    installmentAmount:d.installment_amount, paidInstallments:d.paid_installments,
    totalInstallments:d.total_installments, remaining:d.total_installments-d.paid_installments
  }));
  res.json({ month:+m, year:+y, income, expense, balance, byCategory:Object.values(byCategory), monthly:Object.values(monthly), debtInstallments });
}

async function reportMonths(req, res, user) {
  const db = getDb();
  const { data } = await db.from('transactions').select('date').eq('user_id',user.id);
  const months = {};
  for (const t of (data||[])) {
    const d=new Date(t.date), k=`${d.getFullYear()}_${d.getMonth()+1}`;
    if (!months[k]) months[k]={ _id:{ year:d.getFullYear(), month:d.getMonth()+1 }, count:0 };
    months[k].count++;
  }
  res.json(Object.values(months).sort((a,b)=>b._id.year-a._id.year||b._id.month-a._id.month));
}

// ── SETTINGS ──────────────────────────────────────
function toFE(d) {
  if (!d) return {};
  return { theme:d.theme, cltMode:d.clt_mode, cltOnboardingDone:d.clt_onboarding_done,
    salaryDay:d.salary_day, salaryDayType:d.salary_day_type, valeDay:d.vale_day, valeDayType:d.vale_day_type,
    lastSalary:d.last_salary, lastVale:d.last_vale, salaryDismissedAt:d.salary_dismissed_at,
    salaryRegisteredMonth:d.salary_registered_month, valeDismissedAt:d.vale_dismissed_at,
    valeRegisteredMonth:d.vale_registered_month };
}

async function settingsGet(req, res, user) {
  const db = getDb();
  const { data } = await db.from('settings').select('*').eq('user_id',user.id).maybeSingle();
  res.json(toFE(data));
}

async function settingsPut(req, res, user) {
  const db = getDb();
  const u = { user_id:user.id, updated_at:new Date().toISOString() };
  const map = { theme:'theme', cltMode:'clt_mode', cltOnboardingDone:'clt_onboarding_done',
    salaryDay:'salary_day', salaryDayType:'salary_day_type', valeDay:'vale_day', valeDayType:'vale_day_type',
    lastSalary:'last_salary', lastVale:'last_vale', salaryDismissedAt:'salary_dismissed_at',
    salaryRegisteredMonth:'salary_registered_month', valeDismissedAt:'vale_dismissed_at',
    valeRegisteredMonth:'vale_registered_month' };
  for (const [k,col] of Object.entries(map)) if (req.body[k]!==undefined) u[col]=req.body[k];
  const { data, error } = await db.from('settings').upsert(u, { onConflict:'user_id' }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toFE(data));
}

// ── ROUTER ────────────────────────────────────────
export default async function handler(req, res) {
  cors(res);
  if (req.method==='OPTIONS') return res.status(204).end();
  const url = req.url.replace(/\?.*$/,'');
  const segs = url.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  const [resource, idOrSub] = segs;
  const method = req.method.toUpperCase();
  try {
    if (resource==='auth'&&idOrSub==='register'&&method==='POST') return await authRegister(req,res);
    if (resource==='auth'&&idOrSub==='login'   &&method==='POST') return await authLogin(req,res);
    const user = requireAuth(req,res);
    if (!user) return;
    if (resource==='transactions') {
      if (idOrSub==='export'&&method==='GET')  return await txExport(req,res,user);
      if (idOrSub==='import'&&method==='POST') return await txImport(req,res,user);
      if (!idOrSub) { if (method==='GET') return await txList(req,res,user); if (method==='POST') return await txCreate(req,res,user); }
      else { if (method==='PUT') return await txUpdate(req,res,user,idOrSub); if (method==='DELETE') return await txDelete(req,res,user,idOrSub); }
    }
    if (resource==='categories') {
      if (!idOrSub) { if (method==='GET') return await catList(req,res,user); if (method==='POST') return await catCreate(req,res,user); }
      else { if (method==='PUT') return await catUpdate(req,res,user,idOrSub); if (method==='DELETE') return await catDelete(req,res,user,idOrSub); }
    }
    if (resource==='goals') {
      if (!idOrSub) { if (method==='GET') return await goalList(req,res,user); if (method==='POST') return await goalCreate(req,res,user); }
      else { if (method==='PUT') return await goalUpdate(req,res,user,idOrSub); if (method==='DELETE') return await goalDelete(req,res,user,idOrSub); }
    }
    if (resource==='debts') {
      if (!idOrSub) { if (method==='GET') return await debtList(req,res,user); if (method==='POST') return await debtCreate(req,res,user); }
      else { if (method==='PUT') return await debtUpdate(req,res,user,idOrSub); if (method==='DELETE') return await debtDelete(req,res,user,idOrSub); }
    }
    if (resource==='reports') {
      if (idOrSub==='summary') return await reportSummary(req,res,user);
      if (idOrSub==='months')  return await reportMonths(req,res,user);
    }
    if (resource==='settings') {
      if (method==='GET') return await settingsGet(req,res,user);
      if (method==='PUT') return await settingsPut(req,res,user);
    }
    res.status(404).json({ error: 'Rota não encontrada.' });
  } catch(err) {
    console.error('[API]',err);
    res.status(500).json({ error: err.message||'Erro interno.' });
  }
}
