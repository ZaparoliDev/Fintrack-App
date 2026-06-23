const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// ============================================
// FUNÇÃO AUXILIAR: Pega o ID do usuário pelo Cookie
// (Igualzinho a que usamos nas transações)
// ============================================
function getUserIdFromCookie(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const token = cookieHeader.split('; ')
    .find(row => row.startsWith('token='))
    ?.split('=')[1];

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

// ============================================
// ROTA PRINCIPAL
// ============================================
module.exports = async (req, res) => {
  const { method } = req;
  const db = req.db;
  const transactionsCollection = db.collection('transactions');
  
  // Essa rota só responde a requisições GET (buscar dados)
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // --- 1. VERIFICA SE O USUÁRIO ESTÁ LOGADO ---
  const userId = getUserIdFromCookie(req);
  if (!userId) {
    return res.status(401).json({ error: 'Você precisa estar logado para isso' });
  }

  const userObjectId = new ObjectId(userId);

  try {
    // --- 2. PEGA OS FILTROS (Mês/Ano) ---
    // O frontend pode mandar ?month=2025-03
    const { month, type } = req.query;
    
    // Monta o filtro base: só transações do usuário
    const matchFilter = { userId: userObjectId };

    // Se veio o mês (ex: "2025-03"), filtra por data
    if (month) {
      // Exemplo: month = "2025-03"
      const [year, monthNumber] = month.split('-').map(Number);
      
      // Cria a data de início (dia 1 do mês) e fim (último dia do mês)
      const startDate = new Date(year, monthNumber - 1, 1);
      const endDate = new Date(year, monthNumber, 0, 23, 59, 59); // Último dia do mês
      
      matchFilter.date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // --- 3. CASO 1: RELATÓRIO GERAL (SALDO, RECEITAS E DESPESAS) ---
    // Se o frontend pedir ?type=summary ou não mandar tipo, faz o resumo geral
    if (!type || type === 'summary') {
      // Agregação para somar receitas e despesas separadamente
      const result = await transactionsCollection.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$type', // Agrupa por "income" ou "expense"
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();

      // Organiza os dados em um objeto bonito
      let totalIncome = 0;
      let totalExpense = 0;

      result.forEach(item => {
        if (item._id === 'income') totalIncome = item.total;
        if (item._id === 'expense') totalExpense = item.total;
      });

      const balance = totalIncome - totalExpense;

      return res.json({
        totalIncome,
        totalExpense,
        balance,
        month: month || 'todos os meses'
      });
    }

    // --- 4. CASO 2: RELATÓRIO POR CATEGORIA ---
    // Se o frontend pedir ?type=byCategory
    if (type === 'byCategory') {
      // Agrupa por categoria e soma os valores
      const result = await transactionsCollection.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$categoryId', // Agrupa pelo ID da categoria
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]).toArray();

      // Se não tiver transações, retorna array vazio
      if (result.length === 0) {
        return res.json([]);
      }

      // Busca os nomes das categorias no banco (para mostrar "Alimentação", "Lazer"...)
      const categoryIds = result.map(item => new ObjectId(item._id));
      const categoriesCollection = db.collection('categories');
      
      const categories = await categoriesCollection
        .find({ _id: { $in: categoryIds } })
        .toArray();

      // Junta os dados: soma + nome da categoria
      const reportWithCategories = result.map(item => {
        const category = categories.find(cat => cat._id.toString() === item._id);
        return {
          categoryId: item._id,
          categoryName: category ? category.name : 'Categoria removida',
          total: item.total,
          count: item.count
        };
      });

      // Ordena do maior gasto/ganho para o menor
      reportWithCategories.sort((a, b) => b.total - a.total);

      return res.json(reportWithCategories);
    }

    // --- 5. CASO 3: RELATÓRIO DE TRANSAÇÕES RECENTES ---
    // Se o frontend pedir ?type=recent&limit=5
    if (type === 'recent') {
      const limit = parseInt(req.query.limit) || 10;

      const transactions = await transactionsCollection
        .find(matchFilter)
        .sort({ date: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      return res.json(transactions);
    }

    // Se o tipo de relatório for desconhecido
    return res.status(400).json({ 
      error: 'Tipo de relatório inválido. Use "summary", "byCategory" ou "recent"' 
    });

  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
};
