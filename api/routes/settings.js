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
// FUNÇÃO AUXILIAR: Cria configurações padrão
// ============================================
function getDefaultSettings() {
  return {
    currency: 'BRL',
    currencySymbol: 'R$',
    locale: 'pt-BR',
    theme: 'light',
    notifications: {
      email: true,
      push: false,
      weeklyReport: true
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// ============================================
// ROTA PRINCIPAL
// ============================================
module.exports = async (req, res) => {
  const { method } = req;
  const db = req.db;
  const collection = db.collection('settings');
  const usersCollection = db.collection('users');

  // --- 1. VERIFICA SE O USUÁRIO ESTÁ LOGADO ---
  const userId = getUserIdFromCookie(req);
  if (!userId) {
    return res.status(401).json({ error: 'Você precisa estar logado para isso' });
  }

  const userObjectId = new ObjectId(userId);

  // --- 2. ROTA: BUSCAR configurações (GET) ---
  if (method === 'GET') {
    try {
      // Tenta buscar as configurações do usuário
      let settings = await collection.findOne({ userId: userObjectId });

      // Se não existir, cria as configurações padrão automaticamente
      if (!settings) {
        const defaultSettings = getDefaultSettings();
        const newSettings = {
          userId: userObjectId,
          ...defaultSettings
        };

        const result = await collection.insertOne(newSettings);
        settings = await collection.findOne({ _id: result.insertedId });
      }

      // Busca também os dados básicos do usuário (nome e email)
      const user = await usersCollection.findOne(
        { _id: userObjectId },
        { projection: { password: 0 } }
      );

      return res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        settings: {
          currency: settings.currency,
          currencySymbol: settings.currencySymbol,
          locale: settings.locale,
          theme: settings.theme,
          notifications: settings.notifications || {
            email: true,
            push: false,
            weeklyReport: true
          }
        }
      });
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      return res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
  }

  // --- 3. ROTA: ATUALIZAR configurações (PUT) ---
  if (method === 'PUT') {
    try {
      const { 
        currency, 
        currencySymbol, 
        locale, 
        theme, 
        notifications,
        name // Permitimos atualizar o nome junto com as configurações
      } = req.body;

      // Monta o objeto de atualização
      const updateData = { updatedAt: new Date() };

      if (currency) updateData.currency = currency;
      if (currencySymbol) updateData.currencySymbol = currencySymbol;
      if (locale) updateData.locale = locale;
      if (theme && ['light', 'dark', 'system'].includes(theme)) {
        updateData.theme = theme;
      }
      if (notifications) {
        updateData.notifications = {
          email: notifications.email !== undefined ? notifications.email : true,
          push: notifications.push !== undefined ? notifications.push : false,
          weeklyReport: notifications.weeklyReport !== undefined ? notifications.weeklyReport : true
        };
      }

      // Verifica se o usuário já tem configurações
      const existing = await collection.findOne({ userId: userObjectId });

      if (existing) {
        // Atualiza as configurações existentes
        await collection.updateOne(
          { userId: userObjectId },
          { $set: updateData }
        );
      } else {
        // Cria configurações do zero com os dados enviados
        const defaultSettings = getDefaultSettings();
        const newSettings = {
          userId: userObjectId,
          ...defaultSettings,
          ...updateData,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await collection.insertOne(newSettings);
      }

      // Se veio um nome para atualizar, atualiza também na coleção de usuários
      if (name && name.length >= 2) {
        await usersCollection.updateOne(
          { _id: userObjectId },
          { $set: { name, updatedAt: new Date() } }
        );
      }

      // Busca os dados atualizados para retornar
      const updatedSettings = await collection.findOne({ userId: userObjectId });
      const user = await usersCollection.findOne(
        { _id: userObjectId },
        { projection: { password: 0 } }
      );

      return res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        settings: {
          currency: updatedSettings.currency,
          currencySymbol: updatedSettings.currencySymbol,
          locale: updatedSettings.locale,
          theme: updatedSettings.theme,
          notifications: updatedSettings.notifications
        }
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      return res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
  }

  // Se chegou aqui, método não é permitido
  return res.status(405).json({ error: 'Método não permitido' });
};
