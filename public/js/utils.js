const Utils = {
  formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL' }).format(val||0);
  },
  formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR',{ day:'2-digit', month:'2-digit', year:'numeric' });
  },
  formatDateInput(d) {
    if (!d) return '';
    return new Date(d).toISOString().slice(0,10);
  },
  monthName(m, y) {
    return new Date(y, m-1, 1).toLocaleDateString('pt-BR',{ month:'long', year:'numeric' });
  },
  initials(name) {
    return (name||'?').split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
  },
  pct(current, target) {
    if (!target) return 0;
    return Math.min(100, Math.round((current/target)*100));
  },
  daysLeft(deadline) {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline)-new Date())/(1000*60*60*24));
  },
  // Calcula Nº dia útil do mês (ex: 5º dia útil de junho/2026)
  getNthWorkday(year, month, n) {
    let count = 0;
    const days = new Date(year, month, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const dow = new Date(year, month-1, d).getDay();
      if (dow !== 0 && dow !== 6) { count++; if (count === n) return d; }
    }
    return null;
  },
  toast(msg, type='info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type==='success'?'✓':type==='error'?'✕':'ℹ'}</span> ${msg}`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.style.animation='fadeOut 0.3s ease forwards'; setTimeout(()=>el.remove(),300); }, 3200);
  },
  confirm(msg) { return window.confirm(msg); },
  showPageLoader(msg='Carregando...') {
    let el = document.getElementById('page-loader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'page-loader';
      el.innerHTML = `<div class="page-loader-inner"><div class="spinner"></div><span>${msg}</span></div>`;
      document.body.appendChild(el);
    }
    el.querySelector('span').textContent = msg;
    el.classList.add('show');
  },
  hidePageLoader() {
    document.getElementById('page-loader')?.classList.remove('show');
  }
};

const Store = {
  _data: {
    user:null, categories:[], transactions:[], goals:[], debts:[],
    summary:null, settings:{},
    currentMonth: new Date().getMonth()+1,
    currentYear:  new Date().getFullYear()
  },
  get(k)    { return this._data[k]; },
  set(k, v) { this._data[k] = v; }
};
