const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

// ============================================
// 1. VALIDAÇÃO DE DADOS (Zod)
// ============================================
// Isso garante que os dados que chegam têm o formato correto
// Se faltar campo ou vier com tipo errado, a função nem tenta processar

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
// 2. RATE LIMIT (Proteção contra ataques de força bruta)
// ============================================
// Cada IP só pode tentar login 5 vezes em 15 minutos
// Isso impede que um hacker fique testando senhas infinitamente

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// 3. FUNÇÕES AUXILIARES (Cookies)
// ============================================

// Cria um cookie seguro com o token JWT
function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', [
    `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
  ]);
  // Max-Age = 604800 segundos = 7 dias
}

// Remove o cookie (logout)
function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', [
    `token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`
  ]);
}

// ============================================
// 4. ROTAS DE AUTENTICAÇÃO
// ============================================

module.exports = async (req, res) => {
  const { method } = req;
  const db = req.db;
  const usersCollection = db.collection('users');

  // ---- ROTA: POST /auth/register ----
  if (method === 'POST' && req.url === '/auth/register') {
    try {
      // Valida os dados recebidos
      const validatedData = registerSchema.parse(req.body);
      const { name, email, password } = validatedData;

      // Verifica se o email já está cadastrado
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      // Criptografa a senha
      const hashedPassword = await bcrypt.hash(password, 12);

      // Cria o usuário no banco
      const result = await usersCollection.insertOne({
        name,
        email,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Busca o usuário criado (sem a senha)
      const user = await usersCollection.findOne(
        { _id: result.insertedId },
        { projection: { password: 0 } }
      );

      // Gera o token JWT
      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Coloca o token num cookie seguro
      setAuthCookie(res, token);

      // Retorna os dados do usuário (sem token)
      return res.status(201).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      // Erro de validação do Zod
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: 'Dados inválidos', 
          details: error.errors 
        });
      }
      console.error('Erro no registro:', error);
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  }

  // ---- ROTA: POST /auth/login (COM RATE LIMIT) ----
  if (method === 'POST' && req.url === '/auth/login') {
    // Aplica o rate limit ANTES de processar
    return loginLimiter(req, res, async () => {
      try {
        // Valida os dados recebidos
        const validatedData = loginSchema.parse(req.body);
        const { email, password } = validatedData;

        // Busca o usuário no banco (inclui a senha para comparar)
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        // Compara a senha fornecida com a senha criptografada
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        // Gera o token JWT
        const token = jwt.sign(
          { userId: user._id.toString() },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Coloca o token num cookie seguro
        setAuthCookie(res, token);

        // Retorna os dados do usuário (sem a senha)
        return res.json({
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          }
        });
      } catch (error) {
        if (error.name === 'ZodError') {
          return res.status(400).json({ 
            error: 'Dados inválidos', 
            details: error.errors 
          });
        }
        console.error('Erro no login:', error);
        return res.status(500).json({ error: 'Erro ao fazer login' });
      }
    });
  }

  // ---- ROTA: POST /auth/logout ----
  if (method === 'POST' && req.url === '/auth/logout') {
    clearAuthCookie(res);
    return res.json({ message: 'Logout realizado com sucesso' });
  }

  // ---- ROTA: GET /auth/me (retorna o usuário atual) ----
  if (method === 'GET' && req.url === '/auth/me') {
    try {
      // Pega o token do cookie
      const token = req.headers.cookie?.split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      // Verifica o token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await usersCollection.findOne(
        { _id: new ObjectId(decoded.userId) },
        { projection: { password: 0 } }
      );

      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }

      return res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return res.status(401).json({ error: 'Token inválido' });
    }
  }

  // ---- ROTA: PUT /auth/profile (atualiza dados do usuário) ----
  if (method === 'PUT' && req.url === '/auth/profile') {
    try {
      // Pega o token do cookie
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

      // Atualiza no banco
      await usersCollection.updateOne(
        { _id: new ObjectId(decoded.userId) },
        { $set: { name, updatedAt: new Date() } }
      );

      const user = await usersCollection.findOne(
        { _id: new ObjectId(decoded.userId) },
        { projection: { password: 0 } }
      );

      return res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
  }

  // Se nenhuma rota foi encontrada
  return res.status(404).json({ error: 'Rota de autenticação não encontrada' });
};
