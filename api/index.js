const { connectToDatabase } = require('./_lib/mongodb');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');

module.exports = async (req, res) => {
  // Configurações de CORS e Headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { db } = await connectToDatabase();
    const { resource, id } = req.query;
    req.db = db;
    req.resource = resource;
    req.id = id;

    // Roteamento inteligente
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
    console.error('Erro na API:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
