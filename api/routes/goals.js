const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// ============================================
// FUNÇÃO AUXILIAR: Pega o ID do usuário pelo Cookie
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
  const collection = db.collection('goals');

  // --- 1. VERIFICA SE O USUÁRIO ESTÁ LOGADO ---
  const userId = getUserIdFromCookie(req);
  if (!userId) {
    return res.status(401).json({ error: 'Você precisa estar logado para isso' });
  }

  const userObjectId = new ObjectId(userId);

  // --- 2. ROTA: LISTAR metas (GET) ---
  if (method === 'GET') {
    try {
      // Busca todas as metas do usuário, ordena pela data de criação (mais nova primeiro)
      const goals = await collection
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .toArray();

      return res.json(goals);
    } catch (error) {
      console.error('Erro ao listar metas:', error);
      return res.status(500).json({ error: 'Erro ao buscar metas' });
    }
  }

  // --- 3. ROTA: CRIAR meta (POST) ---
  if (method === 'POST') {
    try {
      const { 
        name, 
        targetAmount, 
        currentAmount = 0, 
        deadline, 
        categoryId,
        status = 'active' // active ou completed
      } = req.body;

      // Validação básica
      if (!name || !targetAmount) {
        return res.status(400).json({ 
          error: 'Campos obrigatórios: name, targetAmount' 
        });
      }

      // Converte targetAmount para número
      const numericTarget = parseFloat(targetAmount);
      if (isNaN(numericTarget) || numericTarget <= 0) {
        return res.status(400).json({ error: 'targetAmount deve ser um número positivo' });
      }

      // Converte currentAmount para número (se veio)
      const numericCurrent = parseFloat(currentAmount) || 0;

      // Calcula o progresso automaticamente (percentual)
      const progress = Math.min((numericCurrent / numericTarget) * 100, 100);

      // Monta a meta
      const newGoal = {
        userId: userObjectId,
        name,
        targetAmount: numericTarget,
        currentAmount: numericCurrent,
        progress: Math.round(progress * 100) / 100, // Arredonda para 2 casas decimais
        deadline: deadline ? new Date(deadline) : null,
        categoryId: categoryId || null,
        status: status === 'completed' ? 'completed' : 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insere no banco
      const result = await collection.insertOne(newGoal);

      // Busca a meta criada
      const created = await collection.findOne({ _id: result.insertedId });

      return res.status(201).json(created);
    } catch (error) {
      console.error('Erro ao criar meta:', error);
      return res.status(500).json({ error: 'Erro ao criar meta' });
    }
  }

  // --- 4. ROTA: ATUALIZAR meta (PUT) ---
  if (method === 'PUT') {
    try {
      const { id } = req.query;
      const { 
        name, 
        targetAmount, 
        currentAmount, 
        deadline, 
        categoryId,
        status 
      } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID da meta é obrigatório' });
      }

      // Verifica se a meta existe e PERTENCE ao usuário
      const goal = await collection.findOne({
        _id: new ObjectId(id),
        userId: userObjectId
      });

      if (!goal) {
        return res.status(404).json({ error: 'Meta não encontrada' });
      }

      // Monta os dados para atualizar
      const updateData = { updatedAt: new Date() };
      
      if (name) updateData.name = name;
      
      if (targetAmount) {
        const numericTarget = parseFloat(targetAmount);
        if (isNaN(numericTarget) || numericTarget <= 0) {
          return res.status(400).json({ error: 'targetAmount deve ser um número positivo' });
        }
        updateData.targetAmount = numericTarget;
      }

      if (currentAmount !== undefined) {
        const numericCurrent = parseFloat(currentAmount);
        if (isNaN(numericCurrent)) {
          return res.status(400).json({ error: 'currentAmount deve ser um número' });
        }
        updateData.currentAmount = numericCurrent;
        
        // Recalcula o progresso com base no novo valor
        const target = updateData.targetAmount || goal.targetAmount;
        const progress = Math.min((numericCurrent / target) * 100, 100);
        updateData.progress = Math.round(progress * 100) / 100;
      }

      if (deadline !== undefined) {
        updateData.deadline = deadline ? new Date(deadline) : null;
      }

      if (categoryId !== undefined) {
        updateData.categoryId = categoryId || null;
      }

      if (status && ['active', 'completed'].includes(status)) {
        updateData.status = status;
      }

      // Atualiza
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Busca a meta atualizada
      const updated = await collection.findOne({ _id: new ObjectId(id) });

      return res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar meta:', error);
      return res.status(500).json({ error: 'Erro ao atualizar meta' });
    }
  }

  // --- 5. ROTA: DELETAR meta (DELETE) ---
  if (method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID da meta é obrigatório' });
      }

      // Verifica se a meta existe e PERTENCE ao usuário
      const goal = await collection.findOne({
        _id: new ObjectId(id),
        userId: userObjectId
      });

      if (!goal) {
        return res.status(404).json({ error: 'Meta não encontrada' });
      }

      // Deleta
      await collection.deleteOne({ _id: new ObjectId(id) });

      return res.json({ message: 'Meta deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar meta:', error);
      return res.status(500).json({ error: 'Erro ao deletar meta' });
    }
  }

  // Se chegou aqui, método não é permitido
  return res.status(405).json({ error: 'Método não permitido' });
};
