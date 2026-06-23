// ============================================
// index.js - COM LOG PARA DEBUG
// ============================================

console.log('🚀 Iniciando função serverless...');

// Carrega a conexão (mas não executa ainda)
const { getDb } = require('../lib/db.js');

module.exports = async (req, res) => {
  console.log(`📥 Requisição recebida: ${req.method} ${req.url}`);

  // 1. CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 2. Conecta ao banco (AGORA SIM executa)
    console.log('🔄 Tentando conectar ao MongoDB...');
    const db = await getDb();
    console.log('✅ Conectado ao MongoDB com sucesso!');

    const { resource, id } = req.query;
    req.db = db;
    req.resource = resource;
    req.id = id;

    // 3. Carrega as rotas (apenas se o banco conectou)
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
    // Isso vai capturar ERROS DE CONEXÃO e devolver uma mensagem clara
    console.error('🔥 ERRO FATAL:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      detalhe: error.message || 'Erro desconhecido'
    });
  }
};
