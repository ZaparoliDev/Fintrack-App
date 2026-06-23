const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { z } = require('zod');

// ============================================
// 1. VALIDAÇÃO DE DADOS (Zod) - Mantido porque é seguro
// ============================================
const registerSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
});

// ============================================
// 2. FUNÇÕES AUXILIARES (Cookies)
// ============================================
function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', [
    `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
  ]);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', [
    `token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`
  ]);
}

// ============================================
// 3. FUNÇÃO PARA PEGAR O CAMINHO CERTO
// ============================================
// A Vercel envia a URL completa (/api/auth/login), mas nosso switch espera só o final
function getRoutePath(req) {
  const fullUrl = req.url || '';
  // Remove a parte da query string (ex: ?teste=1)
  const path = fullUrl.split('?')[0];
  // Remove o prefixo '/api' se existir, para comparar com '/auth/login'
  if (path.startsWith('/api')) {
    return path.substring(4); // Remove '/api'
  }
  return path;
}

// ============================================
// 4. ROTAS DE AUTENTICAÇÃO
// ============================================
module.exports = async (req, res) => {
  const { method } = req;
  const db = req.db;
  const usersCollection = db.collection('users');
  
  // Pega o caminho limpo (ex: '/auth/login' ou '/auth/register')
  const routePath = getRoutePath(req);

  try {
    // ---- ROTA: POST /auth/register ----
    if (method === 'POST' && routePath === '/auth/register') {
      const validatedData = registerSchema.parse(req.body);
      const { name, email, password } = validatedData;

      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const result = await usersCollection.insertOne({
        name,
        email,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const user = await usersCollection.findOne(
        { _id: result.insertedId },
        { projection: { password: 0 } }
      );

      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      setAuthCookie(res, token);

      return res.status(201).json({
        user: { id: user._id, name: user.name, email: user.email }
      });
    }

    // ---- ROTA: POST /auth/login (SEM RATE LIMIT POR ENQUANTO) ----
    if (method === 'POST' && routePath === '/auth/login') {
      const validatedData = loginSchema.parse(req.body);
      const { email, password } = validatedData;

      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Email ou senha inválidos' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Email ou senha inválidos' });
      }

      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      setAuthCookie(res, token);

      return res.json({
        user: { id: user._id, name: user.name, email: user.email }
      });
    }

    // ---- ROTA: POST /auth/logout ----
    if (method === 'POST' && routePath === '/auth/logout') {
      clearAuthCookie(res);
      return res.json({ message: 'Logout realizado com sucesso' });
    }

    // ---- ROTA: GET /auth/me ----
    if (method === 'GET' && routePath === '/auth/me') {
      const token = req.headers.cookie?.split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await usersCollection.findOne(
        { _id: new ObjectId(decoded.userId) },
        { projection: { password: 0 } }
      );

      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }

      return res.json({
        user: { id: user._id, name: user.name, email: user.email }
      });
    }

    // ---- ROTA: PUT /auth/profile ----
    if (method === 'PUT' && routePath === '/auth/profile') {
      const token = req.headers.cookie?.split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { name } = req.body;

      if (!name || name.length < 2) {
        return res.status(400).json({ error: 'Nome deve ter no mínimo 2 caracteres' });
      }

      await usersCollection.updateOne(
        { _id: new ObjectId(decoded.userId) },
        { $set: { name, updatedAt: new Date() } }
      );

      const user = await usersCollection.findOne(
        { _id: new ObjectId(decoded.userId) },
        { projection: { password: 0 } }
      );

      return res.json({
        user: { id: user._id, name: user.name, email: user.email }
      });
    }

    // Se nenhuma rota bater, retorna 404
    return res.status(404).json({ error: 'Rota de autenticação não encontrada' });

  } catch (error) {
    // Se for erro de validação do Zod
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: error.errors 
      });
    }
    // Qualquer outro erro
    console.error('Erro no auth:', error);
    return res.status(500).json({ error: 'Erro interno no servidor de autenticação' });
  }
};
