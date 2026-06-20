# 💸 Fintrack

Gestão financeira pessoal — multi-usuário, serverless, MongoDB Atlas + Vercel.

## Stack

| Camada    | Tecnologia                     |
|-----------|-------------------------------|
| Frontend  | HTML/CSS/JS vanilla (SPA)     |
| Backend   | Node.js serverless (Vercel)   |
| Banco     | MongoDB Atlas                 |
| Auth      | JWT + bcrypt                  |
| Gráficos  | Chart.js                      |

## Módulos

- ✅ **Multi-usuário** — cadastro, login, dados isolados por usuário
- 💳 **Transações** — receitas e despesas, filtros, paginação
- 🏷️ **Categorias** — personalizáveis com ícone e cor, seed automático
- 🎯 **Metas** — progresso visual, prazo, depósitos
- 📈 **Relatórios** — gráfico de barras mensal + donut por categoria

## Setup local

```bash
# 1. Clone e instale dependências
npm install

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com sua MONGODB_URI e JWT_SECRET

# 3. Rode localmente
npx vercel dev
```

## Deploy (Vercel)

```bash
# Login
npx vercel login

# Deploy inicial
npx vercel

# Adicionar variáveis de ambiente
npx vercel env add MONGODB_URI
npx vercel env add JWT_SECRET
npx vercel env add MONGODB_DB
npx vercel env add ALLOWED_ORIGIN

# Deploy de produção
npx vercel --prod
```

## Estrutura

```
fintrack/
├── api/
│   ├── lib/
│   │   ├── db.js        # Conexão MongoDB (pool reutilizável)
│   │   ├── auth.js      # JWT helpers
│   │   └── cors.js      # CORS headers
│   ├── auth/
│   │   ├── register.js
│   │   └── login.js
│   ├── transactions/
│   │   ├── index.js     # GET + POST
│   │   └── [id].js      # PUT + DELETE
│   ├── categories/
│   │   ├── index.js
│   │   └── [id].js
│   ├── goals/
│   │   ├── index.js
│   │   └── [id].js
│   └── reports/
│       └── summary.js
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js
│       ├── utils.js
│       ├── auth.js
│       ├── dashboard.js
│       ├── transactions.js
│       ├── categories.js
│       ├── goals.js
│       ├── reports.js
│       └── app.js
├── vercel.json
├── package.json
└── .env.example
```

## Variáveis de ambiente necessárias

| Variável         | Descrição                          |
|------------------|------------------------------------|
| `MONGODB_URI`    | URI de conexão do MongoDB Atlas    |
| `MONGODB_DB`     | Nome do banco (padrão: `fintrack`) |
| `JWT_SECRET`     | Segredo para assinar tokens JWT    |
| `ALLOWED_ORIGIN` | Domínio permitido no CORS (`*` em dev) |
