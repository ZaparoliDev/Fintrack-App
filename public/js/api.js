// ===== FINTRACK API CLIENT =====
const API = {
  base: '/api',

  token() { return localStorage.getItem('ft_token'); },

  async req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const tok = this.token();
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  },

  get(path)          { return this.req('GET', path); },
  post(path, body)   { return this.req('POST', path, body); },
  put(path, body)    { return this.req('PUT', path, body); },
  delete(path)       { return this.req('DELETE', path); },

  // Auth
  register(data)     { return this.post('/auth/register', data); },
  login(data)        { return this.post('/auth/login', data); },

  // Transactions
  getTransactions(q) { return this.get('/transactions' + (q ? '?' + new URLSearchParams(q) : '')); },
  createTransaction(d) { return this.post('/transactions', d); },
  updateTransaction(id, d) { return this.put(`/transactions/${id}`, d); },
  deleteTransaction(id)    { return this.delete(`/transactions/${id}`); },

  // Categories
  getCategories()    { return this.get('/categories'); },
  createCategory(d)  { return this.post('/categories', d); },
  updateCategory(id, d) { return this.put(`/categories/${id}`, d); },
  deleteCategory(id)    { return this.delete(`/categories/${id}`); },

  // Goals
  getGoals()         { return this.get('/goals'); },
  createGoal(d)      { return this.post('/goals', d); },
  updateGoal(id, d)  { return this.put(`/goals/${id}`, d); },
  deleteGoal(id)     { return this.delete(`/goals/${id}`); },

  // Settings
  getSettings()      { return this.get('/settings'); },
  saveSettings(d)    { return this.put('/settings', d); },

  // Reports
  getSummary(q)        { return this.get('/reports/summary' + (q ? '?' + new URLSearchParams(q) : '')); },
  getAvailableMonths() { return this.get('/reports/months'); },
  exportTransactions(q){ return this.get('/transactions/export' + (q ? '?' + new URLSearchParams(q) : '')); }
};
