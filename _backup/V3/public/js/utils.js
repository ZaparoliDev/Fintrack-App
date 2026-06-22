// ===== UTILS =====
const Utils = {
  formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  },

  formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateInput(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toISOString().slice(0, 10);
  },

  monthName(m, y) {
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  },

  initials(name) {
    return (name || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  },

  pct(current, target) {
    if (!target) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  },

  daysLeft(deadline) {
    if (!deadline) return null;
    const diff = new Date(deadline) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },

  toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
      el.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  confirm(msg) { return window.confirm(msg); }
};

// Shallow state store
const Store = {
  _data: {
    user: null,
    categories: [],
    transactions: [],
    goals: [],
    summary: null,
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear(),
  },
  get(k) { return this._data[k]; },
  set(k, v) { this._data[k] = v; }
};
