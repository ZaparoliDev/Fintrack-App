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
  const collection = db.collection('categories');

  // --- 1. VERIFICA SE O USUÁRIO ESTÁ LOGADO ---
  const userId = getUserIdFromCookie(req);
  if (!userId) {
    return res.status(401).json({ error: 'Você precisa estar logado para isso' });
  }

  const userObjectId = new ObjectId(userId);

  // --- 2. ROTA: LISTAR categorias (GET) ---
  if (method === 'GET') {
    try {
      // Busca todas as categorias do usuário, ordenadas por nome
      const categories = await collection
        .find({ userId: userObjectId })
        .sort({ name: 1 })
        .toArray();

      return res.json(categories);
    } catch (error) {
      console.error('Erro ao listar categorias:', error);
      return res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
  }

  // --- 3. ROTA: CRIAR categoria (POST) ---
  if (method === 'POST') {
    try {
      const { name, icon, color, type } = req.body;

      // Validação básica
      if (!name || !type) {
        return res.status(400).json({ 
          error: 'Campos obrigatórios: name, type' 
        });
      }

      // Só permite income ou expense
      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ 
          error: 'Type deve ser "income" ou "expense"' 
        });
      }

      // Verifica se já existe uma categoria com esse nome para esse usuário
      const existing = await collection.findOne({
        userId: userObjectId,
        name: { $regex: new RegExp(`^${name}$`, 'i') } // Case insensitive
      });

      if (existing) {
        return res.status(400).json({ 
          error: 'Já existe uma categoria com este nome' 
        });
      }

      // Monta a categoria
      const newCategory = {
        userId: userObjectId,
        name,
        icon: icon || '📌', // Emoji padrão se não mandar
        color: color || '#6B7280', // Cor cinza padrão
        type,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insere no banco
      const result = await collection.insertOne(newCategory);

      // Busca a categoria criada
      const created = await collection.findOne({ _id: result.insertedId });

      return res.status(201).json(created);
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      return res.status(500).json({ error: 'Erro ao criar categoria' });
    }
  }

  // --- 4. ROTA: ATUALIZAR categoria (PUT) ---
  if (method === 'PUT') {
    try {
      const { id } = req.query;
      const { name, icon, color, type } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID da categoria é obrigatório' });
      }

      // Verifica se a categoria existe e PERTENCE ao usuário
      const category = await collection.findOne({
        _id: new ObjectId(id),
        userId: userObjectId
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      // Monta os dados para atualizar
      const updateData = { updatedAt: new Date() };
      if (name) updateData.name = name;
      if (icon) updateData.icon = icon;
      if (color) updateData.color = color;
      if (type && ['income', 'expense'].includes(type)) updateData.type = type;

      // Atualiza
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Busca a categoria atualizada
      const updated = await collection.findOne({ _id: new ObjectId(id) });

      return res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      return res.status(500).json({ error: 'Erro ao atualizar categoria' });
    }
  }

  // --- 5. ROTA: DELETAR categoria (DELETE) ---
  if (method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID da categoria é obrigatório' });
      }

      // Verifica se a categoria existe e PERTENCE ao usuário
      const category = await collection.findOne({
        _id: new ObjectId(id),
        userId: userObjectId
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      // Deleta
      await collection.deleteOne({ _id: new ObjectId(id) });

      return res.json({ message: 'Categoria deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar categoria:', error);
      return res.status(500).json({ error: 'Erro ao deletar categoria' });
    }
  }

  // Se chegou aqui, método não é permitido
  return res.status(405).json({ error: 'Método não permitido' });
};
