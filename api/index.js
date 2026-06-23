// ============================================
// NOVO index.js - Adaptado para seu lib/db.js
// ============================================

module.exports = async (req, res) => {
  // 1. Configurações de CORS e Headers (segurança)
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Responde rapidinho às requisições de "preflight" do navegador
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ------------------------------------------
    // 2. A MÁGICA ACONTECE AQUI!
    // Importa seu arquivo lib/db.js dinamicamente
    // e chama a função getDb() que você criou
    // ------------------------------------------
    const { getDb } = await import('../lib/db.js');
    const db = await getDb(); // <--- Aqui ele pega seu banco de dados

    // Guarda o banco e os parâmetros da URL no objeto "req"
    // para que as rotas (auth, transactions, etc.) possam usar
    const { resource, id } = req.query;
    req.db = db;
    req.resource = resource;
    req.id = id;

    // 3. Importa as rotas que você criou (dentro da pasta routes)
    const authRoutes = require('./routes/auth');
    const transactionRoutes = require('./routes/transactions');
    const reportRoutes = require('./routes/reports');
    const categoryRoutes = require('./routes/categories');
    const goalRoutes = require('./routes/goals');
    const settingsRoutes = require('./routes/settings');

    // 4. Roteador (maestro que direciona cada requisição)
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
        // Se o recurso não existir, retorna 404
        return res.status(404).json({ error: 'Recurso não encontrado' });
    }
  } catch (error) {
    // Se QUALQUER coisa quebrar, esse bloco captura o erro
    // e mostra uma mensagem amigável (e o erro exato no console da Vercel)
    console.error('🔥 Erro fatal no index.js:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      detalhe: error.message 
    });
  }
};
