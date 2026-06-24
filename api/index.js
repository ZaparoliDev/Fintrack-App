// ===== FINTRACK — API UNIFICADA (1 serverless function) =====
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/db.js';
import { signToken, requireAuth } from './lib/auth.js';

const CORS_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const RESEND_KEY  = process.env.RESEND_API_KEY || '';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ─── EMAIL (Resend) ───
async function sendVerificationEmail(email, name, token) {
  if (!RESEND_KEY) return; // skip se não configurado
  const url = `${process.env.APP_URL || 'https://fintrack-app.vercel.app'}/verify?token=${token}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Fintrack <noreply@fintrack.app>',
      to: email,
      subject: '💸 Confirme seu e-mail — Fintrack',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#0a0c12;color:#eaecf2;border-radius:16px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#4f8ef7,#a78bfa);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">💸</div>
            <span style="font-size:1.4rem;font-weight:800">Fintrack</span>
          </div>
          <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:8px">Olá, ${name}! 👋</h2>
          <p style="color:#7c84a0;line-height:1.6;margin-bottom:28px">Confirme seu e-mail para ativar sua conta e começar a controlar suas finanças.</p>
          <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#4f8ef7,#a78bfa);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:1rem">✓ Confirmar e-mail</a>
          <p style="color:#404660;font-size:0.78rem;margin-top:28px">Este link expira em 24 horas. Se não criou esta conta, ignore este e-mail.</p>
        </div>`
    })
  });
}

// ─── AUTH ───
async function authRegister(req, res) {
  const { name, email, password, confirmPassword } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });
  if (confirmPassword !== undefined && password !== confirmPassword)
    return res.status(400).json({ error: 'As senhas não coincidem.' });

  const db = await getDb();
  if (await db.collection('users').findOne({ email: email.toLowerCase() }))
    return res.status(409).json({ error: 'E-mail já cadastrado.' });

  const hash     = await bcrypt.hash(password, 12);
  const verToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const result   = await db.collection('users').insertOne({
    name, email: email.toLowerCase(), password: hash,
    verified: !RESEND_KEY, // se não tem Resend, auto-verifica
    verificationToken: RESEND_KEY ? verToken : null,
    createdAt: new Date()
  });

  if (RESEND_KEY) {
    await sendVerificationEmail(email.toLowerCase(), name, verToken).catch(console.error);
    return res.status(201).json({ needsVerification: true, message: 'Verifique seu e-mail para ativar a conta.' });
  }

  const token = signToken({ id: result.insertedId.toString(), name, email: email.toLowerCase() });
  res.status(201).json({ token, user: { id: result.insertedId, name, email: email.toLowerCase() } });
}

async function authVerify(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token inválido.' });
  const db   = await getDb();
  const user = await db.collection('users').findOneAndUpdate(
    { verificationToken: token },
    { $set: { verified: true, verificationToken: null } },
    { returnDocument: 'after' }
  );
  if (!user) return res.status(400).json({ error: 'Token inválido ou expirado.' });
  const jwt = signToken({ id: user._id.toString(), name: user.name, email: user.email });
  res.status(200).json({ token: jwt, user: { id: user._id, name: user.name, email: user.email } });
}

async function authLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'E-mail inválido.' });

  const db   = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  if (RESEND_KEY && !user.verified)
    return res.status(403).json({ error: 'E-mail não verificado. Verifique sua caixa de entrada.', needsVerification: true });

  const token = signToken({ id: user._id.toString(), name: user.name, email: user.email });
  res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email } });
}

// ─── TRANSACTIONS ───
async function txList(req, res, user) {
  const { month, year, type, category } = req.query;
  const db = await getDb();
  const filter = { userId: user.id };
  if (type)     filter.type       = type;
  if (category) filter.categoryId = category;
  if (month && year) {
    filter.date = { $gte: new Date(+year,+month-1,1), $lte: new Date(+year,+month,0,23,59,59) };
  }
  res.status(200).json(await db.collection('transactions').find(filter).sort({ date:-1 }).limit(500).toArray());
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
  const doc = { userId:user.id, description:description.trim(), amount:+amount, type, categoryId:categoryId||null, date:new Date(date), note:note?.trim()||'', createdAt:new Date() };
  const r   = await db.collection('transactions').insertOne(doc);
  res.status(201).json({ ...doc, _id:r.insertedId });
}

async function txUpdate(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error:'ID inválido.' });
  const db = await getDb();
  const u  = { updatedAt:new Date() };
  const { description,amount,type,categoryId,date,note } = req.body;
  if (description!==undefined) u.description=description.trim();
  if (amount!==undefined)      u.amount=+amount;
  if (type!==undefined)        u.type=type;
  if (categoryId!==undefined)  u.categoryId=categoryId;
  if (date!==undefined)        u.date=new Date(date);
  if (note!==undefined)        u.note=note.trim();
  const r = await db.collection('transactions').findOneAndUpdate(
    { _id:new ObjectId(id), userId:user.id }, { $set:u }, { returnDocument:'after' }
  );
  if (!r) return res.status(404).json({ error:'Transação não encontrada.' });
  res.status(200).json(r);
}

async function txDelete(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error:'ID inválido.' });
  const db = await getDb();
  const r  = await db.collection('transactions').deleteOne({ _id:new ObjectId(id), userId:user.id });
  if (!r.deletedCount) return res.status(404).json({ error:'Transação não encontrada.' });
  res.status(200).json({ success:true });
}

async function txExport(req, res, user) {
  const { month, year } = req.query;
  const db = await getDb();
  const filter = { userId:user.id };
  if (month && year) filter.date = { $gte:new Date(+year,+month-1,1), $lte:new Date(+year,+month,0,23,59,59) };
  res.status(200).json(await db.collection('transactions').find(filter).sort({ date:1 }).limit(5000).toArray());
}

async function txImport(req, res, user) {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || !transactions.length)
    return res.status(400).json({ error: 'Nenhuma transação para importar.' });
  const db   = await getDb();
  const docs = transactions.map(t => ({
    userId:      user.id,
    description: (t.description || t.Descrição || t.descricao || 'Importado').trim(),
    amount:      Math.abs(parseFloat(t.amount || t.Valor || t.valor || 0)),
    type:        t.type || (parseFloat(t.amount||t.Valor||0) >= 0 ? 'income' : 'expense'),
    categoryId:  t.categoryId || null,
    date:        t.date ? new Date(t.date) : (t.Data ? new Date(t.Data.split('/').reverse().join('-')) : new Date()),
    note:        (t.note || t.Observação || t.observacao || '').trim(),
    importedAt:  new Date(),
    createdAt:   new Date()
  })).filter(t => t.amount > 0);
  const r = await db.collection('transactions').insertMany(docs);
  res.status(201).json({ imported: r.insertedCount });
}

// ─── CATEGORIES ───
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
  const db  = await getDb();
  const col = db.collection('categories');
  let list  = await col.find({ userId:user.id }).sort({ name:1 }).toArray();
  if (!list.length) {
    await col.insertMany(DEFAULT_CATS.map(c=>({ ...c, userId:user.id, createdAt:new Date() })));
    list = await col.find({ userId:user.id }).sort({ name:1 }).toArray();
  }
  res.status(200).json(list);
}
async function catCreate(req, res, user) {
  const { name,icon,color,type,smart,smartDefaults } = req.body;
  if (!name||!type) return res.status(400).json({ error:'Nome e tipo são obrigatórios.' });
  const db=await getDb();
  const doc={ userId:user.id, name:name.trim(), icon:icon||'📁', color:color||'#6b7280', type, smart:!!smart, smartDefaults:smartDefaults||null, createdAt:new Date() };
  const r=await db.collection('categories').insertOne(doc);
  res.status(201).json({ ...doc, _id:r.insertedId });
}
async function catUpdate(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error:'ID inválido.' });
  const db=await getDb();
  const u={ updatedAt:new Date() };
  for (const f of ['name','icon','color','type','smart','smartDefaults']) if (req.body[f]!==undefined) u[f]=req.body[f];
  if (u.name) u.name=u.name.trim();
  const r=await db.collection('categories').findOneAndUpdate({ _id:new ObjectId(id), userId:user.id },{ $set:u },{ returnDocument:'after' });
  if (!r) return res.status(404).json({ error:'Categoria não encontrada.' });
  res.status(200).json(r);
}
async function catDelete(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error:'ID inválido.' });
  const db=await getDb();
  const r=await db.collection('categories').deleteOne({ _id:new ObjectId(id), userId:user.id });
  if (!r.deletedCount) return res.status(404).json({ error:'Categoria não encontrada.' });
  res.status(200).json({ success:true });
}

// ─── GOALS ───
async function goalList(req, res, user) {
  const db=await getDb();
  res.status(200).json(await db.collection('goals').find({ userId:user.id }).sort({ createdAt:-1 }).toArray());
}
async function goalCreate(req, res, user) {
  const { name,targetAmount,currentAmount,deadline,icon,color } = req.body;
  if (!name||!targetAmount) return res.status(400).json({ error:'Nome e valor alvo são obrigatórios.' });
  const db=await getDb();
  const doc={ userId:user.id, name:name.trim(), targetAmount:+targetAmount, currentAmount:+currentAmount||0, deadline:deadline?new Date(deadline):null, icon:icon||'🎯', color:color||'#3b82f6', deposits:[], createdAt:new Date() };
  const r=await db.collection('goals').insertOne(doc);
  res.status(201).json({ ...doc, _id:r.insertedId });
}
async function goalUpdate(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error:'ID inválido.' });
  const db=await getDb();
  const filter={ _id:new ObjectId(id), userId:user.id };
  const { deposit,removeDepositIndex } = req.body;
  if (deposit!==undefined) {
    const amount=+deposit.amount;
    if (!amount||amount<=0) return res.status(400).json({ error:'Valor inválido.' });
    const goal=await db.collection('goals').findOne(filter);
    if (!goal) return res.status(404).json({ error:'Meta não encontrada.' });
    const r=await db.collection('goals').findOneAndUpdate(filter,{ $set:{ currentAmount:goal.currentAmount+amount, updatedAt:new Date() }, $push:{ deposits:{ amount, note:deposit.note||'', date:new Date() } } },{ returnDocument:'after' });
    return res.status(200).json(r);
  }
  if (removeDepositIndex!==undefined) {
    const idx=+removeDepositIndex;
    const goal=await db.collection('goals').findOne(filter);
    if (!goal) return res.status(404).json({ error:'Meta não encontrada.' });
    const deps=goal.deposits||[];
    if (idx<0||idx>=deps.length) return res.status(400).json({ error:'Índice inválido.' });
    const r=await db.collection('goals').findOneAndUpdate(filter,{ $set:{ deposits:deps.filter((_,i)=>i!==idx), currentAmount:Math.max(0,goal.currentAmount-deps[idx].amount), updatedAt:new Date() } },{ returnDocument:'after' });
    return res.status(200).json(r);
  }
  const u={ updatedAt:new Date() };
  for (const f of ['name','targetAmount','currentAmount','deadline','icon','color']) if (req.body[f]!==undefined) u[f]=req.body[f];
  if (u.name) u.name=u.name.trim();
  if (u.targetAmount) u.targetAmount=+u.targetAmount;
  if (u.currentAmount!==undefined) u.currentAmount=+u.currentAmount;
  if (u.deadline!==undefined) u.deadline=u.deadline?new Date(u.deadline):null;
  const r=await db.collection('goals').findOneAndUpdate(filter,{ $set:u },{ returnDocument:'after' });
  if (!r) return res.status(404).json({ error:'Meta não encontrada.' });
  res.status(200).json(r);
}
async function goalDelete(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error:'ID inválido.' });
  const db=await getDb();
  const r=await db.collection('goals').deleteOne({ _id:new ObjectId(id), userId:user.id });
  if (!r.deletedCount) return res.status(404).json({ error:'Meta não encontrada.' });
  res.status(200).json({ success:true });
}

// ─── DEBTS (Dívidas de crédito) ───
async function debtList(req, res, user) {
  const db=await getDb();
  res.status(200).json(await db.collection('debts').find({ userId:user.id }).sort({ createdAt:-1 }).toArray());
}
async function debtCreate(req, res, user) {
  const { name,totalAmount,installmentAmount,totalInstallments,paidInstallments,startDate,icon,color,categoryId } = req.body;
  if (!name||!installmentAmount||!totalInstallments)
    return res.status(400).json({ error:'Nome, valor da parcela e total de parcelas são obrigatórios.' });
  const db=await getDb();
  const doc={
    userId:user.id, name:name.trim(),
    totalAmount:+totalAmount||(+installmentAmount*+totalInstallments),
    installmentAmount:+installmentAmount,
    totalInstallments:+totalInstallments,
    paidInstallments:+paidInstallments||0,
    startDate:startDate?new Date(startDate):new Date(),
    icon:icon||'💳', color:color||'#ef4444',
    categoryId:categoryId||null,
    active:true, createdAt:new Date()
  };
  const r=await db.collection('debts').insertOne(doc);
  res.status(201).json({ ...doc, _id:r.insertedId });
}
async function debtUpdate(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error:'ID inválido.' });
  const db=await getDb();
  const u={ updatedAt:new Date() };
  const fields=['name','totalAmount','installmentAmount','totalInstallments','paidInstallments','startDate','icon','color','categoryId','active'];
  for (const f of fields) if (req.body[f]!==undefined) u[f]=req.body[f];
  if (u.name) u.name=u.name.trim();
  if (u.startDate) u.startDate=new Date(u.startDate);
  const r=await db.collection('debts').findOneAndUpdate({ _id:new ObjectId(id), userId:user.id },{ $set:u },{ returnDocument:'after' });
  if (!r) return res.status(404).json({ error:'Dívida não encontrada.' });
  res.status(200).json(r);
}
async function debtDelete(req, res, user, id) {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error:'ID inválido.' });
  const db=await getDb();
  const r=await db.collection('debts').deleteOne({ _id:new ObjectId(id), userId:user.id });
  if (!r.deletedCount) return res.status(404).json({ error:'Dívida não encontrada.' });
  res.status(200).json({ success:true });
}

// ─── REPORTS ───
async function reportSummary(req, res, user) {
  const { month,year } = req.query;
  const db=await getDb();
  const m=+month||new Date().getMonth()+1;
  const y=+year||new Date().getFullYear();
  const start=new Date(y,m-1,1);
  const end=new Date(y,m,0,23,59,59);
  const [byCategory,totals,monthly,debts]=await Promise.all([
    db.collection('transactions').aggregate([
      { $match:{ userId:user.id, date:{ $gte:start,$lte:end } } },
      { $group:{ _id:{ categoryId:'$categoryId', type:'$type' }, total:{ $sum:'$amount' }, count:{ $sum:1 } } }
    ]).toArray(),
    db.collection('transactions').aggregate([
      { $match:{ userId:user.id, date:{ $gte:start,$lte:end } } },
      { $group:{ _id:'$type', total:{ $sum:'$amount' } } }
    ]).toArray(),
    db.collection('transactions').aggregate([
      { $match:{ userId:user.id, date:{ $gte:new Date(y,m-7,1),$lte:end } } },
      { $group:{ _id:{ year:{ $year:'$date' }, month:{ $month:'$date' }, type:'$type' }, total:{ $sum:'$amount' } } },
      { $sort:{ '_id.year':1,'_id.month':1 } }
    ]).toArray(),
    db.collection('debts').find({ userId:user.id, active:true }).toArray()
  ]);
  const income=totals.find(t=>t._id==='income')?.total||0;
  const expense=totals.find(t=>t._id==='expense')?.total||0;
  // Parcelas do mês para os débitos ativos
  const debtInstallments = debts.map(d => ({
    _id: d._id, name: d.name, icon: d.icon, color: d.color,
    installmentAmount: d.installmentAmount,
    paidInstallments: d.paidInstallments,
    totalInstallments: d.totalInstallments,
    remaining: d.totalInstallments - d.paidInstallments
  }));
  res.status(200).json({ month:m, year:y, income, expense, balance:income-expense, byCategory, monthly, debtInstallments });
}

async function reportMonths(req, res, user) {
  const db=await getDb();
  const months=await db.collection('transactions').aggregate([
    { $match:{ userId:user.id } },
    { $group:{ _id:{ year:{ $year:'$date' }, month:{ $month:'$date' } }, count:{ $sum:1 }, total:{ $sum:'$amount' } } },
    { $sort:{ '_id.year':-1,'_id.month':-1 } }
  ]).toArray();
  res.status(200).json(months);
}

// ─── SETTINGS ───
const SETTINGS_FIELDS=['theme','cltMode','cltOnboardingDone','salaryDay','salaryDayType','valeDay','valeDayType','lastSalary','lastVale','salaryDismissedAt','salaryRegisteredMonth','valeDismissedAt','valeRegisteredMonth'];
async function settingsGet(req, res, user) {
  const db=await getDb();
  res.status(200).json(await db.collection('settings').findOne({ userId:user.id })||{});
}
async function settingsPut(req, res, user) {
  const db=await getDb();
  const u={ updatedAt:new Date() };
  for (const k of SETTINGS_FIELDS) if (req.body[k]!==undefined) u[k]=req.body[k];
  await db.collection('settings').updateOne({ userId:user.id },{ $set:u },{ upsert:true });
  res.status(200).json(await db.collection('settings').findOne({ userId:user.id }));
}

// ─── ROUTER ───
export default async function handler(req, res) {
  cors(res);
  if (req.method==='OPTIONS') return res.status(204).end();

  const url      = req.url.replace(/\?.*$/,'');
  const segments = url.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  const [resource,idOrSub] = segments;
  const method   = req.method.toUpperCase();

  try {
    // Public
    if (resource==='auth'&&idOrSub==='register'&&method==='POST') return await authRegister(req,res);
    if (resource==='auth'&&idOrSub==='login'   &&method==='POST') return await authLogin(req,res);
    if (resource==='auth'&&idOrSub==='verify'  &&method==='GET')  return await authVerify(req,res);

    const user=requireAuth(req,res);
    if (!user) return;

    if (resource==='transactions') {
      if (idOrSub==='export'&&method==='GET')  return await txExport(req,res,user);
      if (idOrSub==='import'&&method==='POST') return await txImport(req,res,user);
      if (!idOrSub) {
        if (method==='GET')  return await txList(req,res,user);
        if (method==='POST') return await txCreate(req,res,user);
      } else {
        if (method==='PUT')    return await txUpdate(req,res,user,idOrSub);
        if (method==='DELETE') return await txDelete(req,res,user,idOrSub);
      }
    }
    if (resource==='categories') {
      if (!idOrSub) {
        if (method==='GET')  return await catList(req,res,user);
        if (method==='POST') return await catCreate(req,res,user);
      } else {
        if (method==='PUT')    return await catUpdate(req,res,user,idOrSub);
        if (method==='DELETE') return await catDelete(req,res,user,idOrSub);
      }
    }
    if (resource==='goals') {
      if (!idOrSub) {
        if (method==='GET')  return await goalList(req,res,user);
        if (method==='POST') return await goalCreate(req,res,user);
      } else {
        if (method==='PUT')    return await goalUpdate(req,res,user,idOrSub);
        if (method==='DELETE') return await goalDelete(req,res,user,idOrSub);
      }
    }
    if (resource==='debts') {
      if (!idOrSub) {
        if (method==='GET')  return await debtList(req,res,user);
        if (method==='POST') return await debtCreate(req,res,user);
      } else {
        if (method==='PUT')    return await debtUpdate(req,res,user,idOrSub);
        if (method==='DELETE') return await debtDelete(req,res,user,idOrSub);
      }
    }
    if (resource==='reports') {
      if (idOrSub==='summary') return await reportSummary(req,res,user);
      if (idOrSub==='months')  return await reportMonths(req,res,user);
    }
    if (resource==='settings') {
      if (method==='GET') return await settingsGet(req,res,user);
      if (method==='PUT') return await settingsPut(req,res,user);
    }

    res.status(404).json({ error:'Rota não encontrada.' });
  } catch(err) {
    console.error('[API]',err);
    res.status(500).json({ error:'Erro interno do servidor.' });
  }
}
