// ============================================
// index.js - Versão 100% CommonJS
// ============================================

const { getDb } = require('../lib/db.js'); // <--- Agora é require normal

module.exports = async (req, res) => {
  // 1. Configurações de CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 2. Conecta ao banco de dados
    const db = await getDb();
    const { resource, id } = req.query;
    req.db = db;
    req.resource = resource;
    req.id = id;

    // 3. Carrega as rotas
    const authRoutes = require('./routes/auth');
    const transactionRoutes = require('./routes/transactions');
    const reportRoutes = require('./routes/reports');
    const categoryRoutes = require('./routes/categories');
    const goalRoutes = require('./routes/goals');
    const settingsRoutes = require('./routes/settings');

    // 4. Roteador
    switch (resource) {
      case 'auth':
        return await authRoutes(req, res);
      case 'transactions':
        return await transactionRoutes(req, res);
      case 'reports':
        return await reportRoutes(req, res);
      case 'categories':
        return await categoryRoutes(req, res);
      case 'goals':
        return await goalRoutes(req, res);
      case 'settings':
        return await settingsRoutes(req, res);
      default:
        return res.status(404).json({ error: 'Recurso não encontrado' });
    }
  } catch (error) {
    console.error('🔥 Erro fatal:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      detalhe: error.message 
    });
  }
};
