// ===== DASHBOARD MODULE =====
const Dashboard = {
  async refresh() {
    const summary = await this._loadSummary();
    this.renderHero(summary);
    this.renderRecentTransactions();
    this.renderChart(summary?.monthly || []);
  },

  async _loadSummary() {
    try {
      const data = await API.getSummary({
        month: Store.get('currentMonth'),
        year:  Store.get('currentYear')
      });
      Store.set('summary', data);
      return data;
    } catch { return null; }
  },

  renderHero(data) {
    const income  = data?.income  || 0;
    const expense = data?.expense || 0;
    const balance = data?.balance || 0;
    const txs = Store.get('transactions');
    const goals = Store.get('goals');

    // Saldo hero
    const heroVal = document.getElementById('dash-balance-hero');
    if (heroVal) {
      heroVal.textContent = Utils.formatCurrency(balance);
      heroVal.className = 'balance-hero-value' + (balance < 0 ? ' negative' : '');
    }
    const el = id => document.getElementById(id);
    if (el('dash-income-mini'))  el('dash-income-mini').textContent  = Utils.formatCurrency(income);
    if (el('dash-expense-mini')) el('dash-expense-mini').textContent = Utils.formatCurrency(expense);

    // Quick stats
    if (el('dash-tx-count'))   el('dash-tx-count').textContent   = txs.length;
    if (el('dash-goals-count')) el('dash-goals-count').textContent = goals.length;
    if (el('dash-avg-expense')) {
      const expTxs = txs.filter(t => t.type === 'expense');
      const avg = expTxs.length ? expense / expTxs.length : 0;
      el('dash-avg-expense').textContent = Utils.formatCurrency(avg);
    }
    if (el('dash-top-cat')) {
      const bycat = {};
      txs.filter(t => t.type === 'expense' && t.categoryId).forEach(t => {
        bycat[t.categoryId] = (bycat[t.categoryId] || 0) + t.amount;
      });
      const topId = Object.entries(bycat).sort((a,b)=>b[1]-a[1])[0]?.[0];
      const topCat = topId ? Store.get('categories').find(c=>c._id===topId) : null;
      el('dash-top-cat').textContent = topCat ? topCat.icon + ' ' + topCat.name : '—';
    }

    // Barra de progresso mensal (gasto vs renda)
    if (el('dash-month-bar-fill') && income > 0) {
      const pct = Math.min(100, Math.round((expense / income) * 100));
      el('dash-month-bar-fill').style.width = pct + '%';
      el('dash-month-bar-fill').className = 'month-bar-fill' + (pct > 90 ? ' danger' : '');
      if (el('dash-month-pct')) el('dash-month-pct').textContent = pct + '% gasto';
    }

    // Stats cards de relatório
    ['rep-income','rep-expense','rep-balance'].forEach(id => {
      const el2 = document.getElementById(id);
      if (!el2) return;
      if (id === 'rep-income')  el2.textContent = Utils.formatCurrency(income);
      if (id === 'rep-expense') el2.textContent = Utils.formatCurrency(expense);
      if (id === 'rep-balance') {
        el2.textContent = Utils.formatCurrency(balance);
        el2.className = 'stat-value ' + (balance >= 0 ? 'green' : 'red');
      }
    });
  },

  renderChart(monthly) {
    const canvas = document.getElementById('chart-monthly');
    if (!canvas) return;
    const m = Store.get('currentMonth');
    const y = Store.get('currentYear');
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let mo = m - i; let yr = y;
      if (mo <= 0) { mo += 12; yr--; }
      months.push({ m: mo, y: yr, label: new Date(yr, mo-1).toLocaleDateString('pt-BR', { month: 'short' }) });
    }
    const incomeData  = months.map(({m,y}) => monthly.find(r=>r._id.month===m&&r._id.year===y&&r._id.type==='income')?.total || 0);
    const expenseData = months.map(({m,y}) => monthly.find(r=>r._id.month===m&&r._id.year===y&&r._id.type==='expense')?.total || 0);

    if (window._dashChart) window._dashChart.destroy();
    window._dashChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months.map(x=>x.label),
        datasets: [
          { label: 'Receitas', data: incomeData,  backgroundColor: 'rgba(34,197,94,0.75)',  borderRadius: 6 },
          { label: 'Despesas', data: expenseData, backgroundColor: 'rgba(239,68,68,0.75)',  borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#8890a4', font: { family: 'Inter', size: 11 } } } },
        scales: {
          x: { ticks: { color: '#8890a4', font:{size:11} }, grid: { color: '#1e2230' } },
          y: { ticks: { color: '#8890a4', font:{size:11}, callback: v => 'R$' + (v>=1000 ? (v/1000).toFixed(0)+'k' : v) }, grid: { color: '#1e2230' } }
        }
      }
    });
  },

  renderRecentTransactions() {
    const container = document.getElementById('dash-recent');
    if (!container) return;
    const txs  = Store.get('transactions').slice(0, 6);
    const cats = Store.get('categories');

    if (!txs.length) {
      container.innerHTML = `<div class="empty-state" style="padding:30px">
        <div class="empty-icon">🧾</div>
        <div class="empty-title">Nenhuma transação este mês</div>
        <div class="empty-sub">Clique em "Nova transação" para começar.</div>
      </div>`;
      return;
    }

    container.innerHTML = txs.map(t => {
      const cat  = cats.find(c => c._id === t.categoryId);
      const icon = cat ? cat.icon : (t.type === 'income' ? '💰' : '💸');
      const bg   = cat ? cat.color + '22' : (t.type === 'income' ? '#22c55e22' : '#ef444422');
      return `<div class="recent-tx-item">
        <div class="tx-icon" style="background:${bg};flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
          <div class="tx-description" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.description}</div>
          <div class="text-muted text-sm">${cat ? cat.name : 'Sem categoria'}</div>
        </div>
        <div class="recent-tx-right">
          <div class="recent-tx-amount tx-amount ${t.type}">${t.type==='income'?'+':'-'} ${Utils.formatCurrency(t.amount)}</div>
          <div class="recent-tx-date">${Utils.formatDate(t.date)}</div>
        </div>
      </div>`;
    }).join('');
  }
};
