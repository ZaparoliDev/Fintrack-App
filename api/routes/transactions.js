const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// ============================================
// FUNÇÃO AUXILIAR: Pega o ID do usuário pelo Cookie
// ============================================
// Essa função "pesca" o token no cookie do navegador,
// descobre quem é o usuário e devolve o ID dele.
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
  const collection = db.collection('transactions');

  // --- 1. PEGA O USUÁRIO LOGADO ---
  const userId = getUserIdFromCookie(req);
  if (!userId) {
    return res.status(401).json({ error: 'Você precisa estar logado para fazer isso' });
  }

  // Converte o ID para o formato que o MongoDB entende
  const userObjectId = new ObjectId(userId);

  // --- 2. ROTA: LISTAR transações (GET) ---
  if (method === 'GET') {
    try {
      // Pega os filtros da URL (ex: ?type=income ou ?type=expense)
      const { type, category, limit = 50 } = req.query;
      
      // Monta o filtro para buscar SÓ as transações do usuário logado
      const filter = { userId: userObjectId };

      // Se veio um tipo (income/expense), adiciona no filtro
      if (type && ['income', 'expense'].includes(type)) {
        filter.type = type;
      }

      // Se veio uma categoria, adiciona no filtro
      if (category) {
        filter.categoryId = category;
      }

      // Busca no banco, ordena pela data mais recente primeiro
      const transactions = await collection
        .find(filter)
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .toArray();

      return res.json(transactions);
    } catch (error) {
      console.error('Erro ao listar transações:', error);
      return res.status(500).json({ error: 'Erro ao buscar transações' });
    }
  }

  // --- 3. ROTA: CRIAR transação (POST) ---
  if (method === 'POST') {
    try {
      const { description, amount, type, categoryId, date } = req.body;

      // Validação básica (não deixa faltar nada)
      if (!description || !amount || !type || !categoryId) {
        return res.status(400).json({ 
          error: 'Campos obrigatórios: description, amount, type, categoryId' 
        });
      }

      // Converte o valor para número (evita que mandem texto)
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: 'Amount deve ser um número positivo' });
      }

      // Só permite income ou expense
      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: 'Type deve ser "income" ou "expense"' });
      }

      // Monta o objeto que vai salvar no banco
      const newTransaction = {
        userId: userObjectId,
        description,
        amount: numericAmount,
        type,
        categoryId,
        date: date ? new Date(date) : new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insere no MongoDB
      const result = await collection.insertOne(newTransaction);

      // Busca o registro criado para devolver pro frontend
      const created = await collection.findOne({ _id: result.insertedId });

      return res.status(201).json(created);
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      return res.status(500).json({ error: 'Erro ao criar transação' });
    }
  }

  // --- 4. ROTA: DELETAR transação (DELETE) ---
  // A URL vem assim: /api/transactions?id=123456
  if (method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID da transação é obrigatório' });
      }

      // Verifica se a transação existe e PERTENCE ao usuário
      const transaction = await collection.findOne({
        _id: new ObjectId(id),
        userId: userObjectId
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }

      // Deleta
      await collection.deleteOne({ _id: new ObjectId(id) });

      return res.json({ message: 'Transação deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar transação:', error);
      return res.status(500).json({ error: 'Erro ao deletar transação' });
    }
  }

  // --- 5. ROTA: ATUALIZAR transação (PUT) ---
  if (method === 'PUT') {
    try {
      const { id } = req.query;
      const { description, amount, type, categoryId, date } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID da transação é obrigatório' });
      }

      // Verifica se a transação existe e PERTENCE ao usuário
      const transaction = await collection.findOne({
        _id: new ObjectId(id),
        userId: userObjectId
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }

      // Monta o objeto de atualização (só atualiza o que veio)
      const updateData = {
        updatedAt: new Date()
      };

      if (description) updateData.description = description;
      if (amount) {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
          return res.status(400).json({ error: 'Amount deve ser um número positivo' });
        }
        updateData.amount = numericAmount;
      }
      if (type && ['income', 'expense'].includes(type)) updateData.type = type;
      if (categoryId) updateData.categoryId = categoryId;
      if (date) updateData.date = new Date(date);

      // Atualiza no banco
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Busca a transação atualizada
      const updated = await collection.findOne({ _id: new ObjectId(id) });

      return res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      return res.status(500).json({ error: 'Erro ao atualizar transação' });
    }
  }

  // Se chegou aqui, é porque o método (GET, POST, DELETE, PUT) não foi encontrado
  return res.status(405).json({ error: 'Método não permitido' });
};
