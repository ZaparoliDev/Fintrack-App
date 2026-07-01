const API = {
  base: '/api',
  token() { return localStorage.getItem('ft_token'); },
  async req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const tok = this.token();
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
    const res = await fetch(this.base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  },
  get(p)        { return this.req('GET',    p); },
  post(p, b)    { return this.req('POST',   p, b); },
  put(p, b)     { return this.req('PUT',    p, b); },
  delete(p)     { return this.req('DELETE', p); },

  register(d)           { return this.post('/auth/register', d); },
  login(d)              { return this.post('/auth/login', d); },
  verifyEmail(token)    { return this.get(`/auth/verify?token=${token}`); },

  getTransactions(q)    { return this.get('/transactions' + (q ? '?'+new URLSearchParams(q) : '')); },
  createTransaction(d)  { return this.post('/transactions', d); },
  updateTransaction(i,d){ return this.put(`/transactions/${i}`, d); },
  deleteTransaction(i)  { return this.delete(`/transactions/${i}`); },
  exportTransactions(q) { return this.get('/transactions/export' + (q ? '?'+new URLSearchParams(q) : '')); },
  importTransactions(d) { return this.post('/transactions/import', d); },

  getCategories()       { return this.get('/categories'); },
  createCategory(d)     { return this.post('/categories', d); },
  updateCategory(i,d)   { return this.put(`/categories/${i}`, d); },
  deleteCategory(i)     { return this.delete(`/categories/${i}`); },

  getGoals()            { return this.get('/goals'); },
  createGoal(d)         { return this.post('/goals', d); },
  updateGoal(i,d)       { return this.put(`/goals/${i}`, d); },
  deleteGoal(i)         { return this.delete(`/goals/${i}`); },

  getDebts()            { return this.get('/debts'); },
  createDebt(d)         { return this.post('/debts', d); },
  updateDebt(i,d)       { return this.put(`/debts/${i}`, d); },
  deleteDebt(i)         { return this.delete(`/debts/${i}`); },

  getProvisionedDebts()        { return this.get('/provisioned-debts'); },
  getProvisionedDebtsMonth(q)  { return this.get('/provisioned-debts/month' + (q ? '?'+new URLSearchParams(q) : '')); },
  createProvisionedDebt(d)     { return this.post('/provisioned-debts', d); },
  updateProvisionedDebt(i,d)   { return this.put(`/provisioned-debts/${i}`, d); },
  deleteProvisionedDebt(i)     { return this.delete(`/provisioned-debts/${i}`); },
  payProvisionedDebt(i,d)      { return this.post(`/provisioned-debts/${i}/pay`, d); },
  unpayProvisionedDebt(i,d)    { return this.post(`/provisioned-debts/${i}/unpay`, d); },

  getSummary(q)         { return this.get('/reports/summary' + (q ? '?'+new URLSearchParams(q) : '')); },
  getAvailableMonths()  { return this.get('/reports/months'); },

  getSettings()         { return this.get('/settings'); },
  saveSettings(d)       { return this.put('/settings', d); }
};
