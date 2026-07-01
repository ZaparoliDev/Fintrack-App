# 💸 Fintrack

Gestão financeira pessoal — multi-usuário, serverless, Supabase + Vercel.

## Stack

| Camada    | Tecnologia                     |
|-----------|---------------------------------|
| Frontend  | HTML/CSS/JS vanilla (SPA)      |
| Backend   | Node.js serverless (Vercel) — função única |
| Banco     | Supabase (PostgreSQL)          |
| Auth      | JWT + bcrypt                   |
| Gráficos  | Chart.js                       |

## Módulos

- ✅ **Multi-usuário** — cadastro, login, dados isolados por usuário
- 💳 **Transações** — receitas e despesas, filtros, paginação
- 🏷️ **Categorias** — personalizáveis com ícone e cor, seed automático
- 🎯 **Metas** — progresso visual, prazo, depósitos
- 📉 **Dívidas** — controle de parcelas, valor pago/restante
- 📅 **Payday** — configuração de data de pagamento/ciclo financeiro
- 📈 **Relatórios** — gráfico de barras mensal + donut por categoria, saldo acumulado real
- 📤 **Importação/Exportação** — entrada e saída de dados
- 🧭 **Onboarding** — fluxo inicial de configuração
- ⚙️ **Configurações** — preferências do usuário
- 🌓 **Tema** — modo claro/escuro

## Setup local

```bash
# 1. Clone e instale dependências
npm install

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Supabase e o JWT_SECRET

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
npx vercel env add SUPABASE_URL
npx vercel env add SUPABASE_SERVICE_KEY
npx vercel env add JWT_SECRET
npx vercel env add ALLOWED_ORIGIN

# Deploy de produção
npx vercel --prod
```

## Estrutura

```
fintrack/
├── api/
│   ├── index.js          # Função serverless única — todas as rotas da API
│   └── lib/
│       ├── db.js         # Cliente Supabase
│       └── auth.js       # JWT helpers (sign + middleware requireAuth)
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js          # Wrapper de chamadas à API
│       ├── utils.js        # Helpers gerais e estado (Store)
│       ├── auth.js         # Login/cadastro
│       ├── app.js          # Bootstrap da SPA, navegação entre meses
│       ├── dashboard.js    # Saldo, resumo do mês, gráfico
│       ├── transactions.js # CRUD de transações
│       ├── categories.js   # CRUD de categorias
│       ├── goals.js        # Metas financeiras
│       ├── debts.js        # Dívidas e parcelas
│       ├── payday.js       # Ciclo financeiro / data de pagamento
│       ├── reports.js      # Relatórios e gráficos
│       ├── import.js       # Importação de dados
│       ├── export.js       # Exportação de dados
│       ├── onboarding.js   # Fluxo inicial de configuração
│       ├── settings.js     # Preferências do usuário
│       └── theme.js        # Modo claro/escuro
├── vercel.json
├── package.json
└── .env.example
```

## Variáveis de ambiente necessárias

| Variável                | Descrição                                       |
|--------------------------|--------------------------------------------------|
| `SUPABASE_URL`           | URL do projeto Supabase                          |
| `SUPABASE_SERVICE_KEY`   | Service role key do Supabase (uso server-side)   |
| `JWT_SECRET`             | Segredo para assinar tokens JWT                  |
| `ALLOWED_ORIGIN`         | Domínio permitido no CORS (`*` em dev)           |

## Notas de lógica importantes

- **Saldo do dashboard**: o saldo exibido é **acumulado** — soma todas as transações do usuário desde o início até o fim do mês selecionado, não apenas as transações daquele mês. Isso garante que o saldo real "carregue" corretamente de um mês para o outro. Já `income` e `expense` retornados pela API de resumo continuam representando apenas o mês selecionado (usados na barra de gasto mensal e no gráfico).
