// ===== REPORTS MODULE =====
const Reports = {
  charts: {},

  async load() {
    try {
      const data = await API.getSummary({
        month: Store.get('currentMonth'),
        year:  Store.get('currentYear')
      });
      Store.set('summary', data);
      this.render(data);
    } catch (err) {
      Utils.toast('Erro ao carregar relatório.', 'error');
    }
  },

  render(data) {
    // O ID do canvas muda conforme a página ativa
    const onDashboard = !document.getElementById('page-reports') || 
                        document.getElementById('page-reports').classList.contains('hidden');
    this.renderMonthly(data.monthly, onDashboard ? 'chart-monthly' : 'chart-monthly-r');
    if (!onDashboard) this.renderDonut(data.byCategory);
    this.renderSummaryCards(data);
  },

  renderSummaryCards(data) {
    // Dashboard IDs
    ['rep-income','rep-expense','rep-balance'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'rep-income')  el.textContent = Utils.formatCurrency(data.income);
      if (id === 'rep-expense') el.textContent = Utils.formatCurrency(data.expense);
      if (id === 'rep-balance') {
        el.textContent = Utils.formatCurrency(data.balance);
        el.className = 'stat-value ' + (data.balance >= 0 ? 'green' : 'red');
      }
    });
    // Reports page IDs
    ['rep-income-r','rep-expense-r','rep-balance-r'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'rep-income-r')  el.textContent = Utils.formatCurrency(data.income);
      if (id === 'rep-expense-r') el.textContent = Utils.formatCurrency(data.expense);
      if (id === 'rep-balance-r') {
        el.textContent = Utils.formatCurrency(data.balance);
        el.className = 'stat-value ' + (data.balance >= 0 ? 'green' : 'red');
      }
    });
  },

  renderMonthly(monthly, canvasId) {
    const canvas = document.getElementById(canvasId || 'chart-monthly');
    if (!canvas) return;

    // Build last 6 months labels
    const months = [];
    const m = Store.get('currentMonth');
    const y = Store.get('currentYear');
    for (let i = 5; i >= 0; i--) {
      let mo = m - i; let yr = y;
      if (mo <= 0) { mo += 12; yr--; }
      months.push({ m: mo, y: yr, label: new Date(yr, mo - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) });
    }

    const incomeData  = months.map(({ m, y }) => {
      const e = monthly.find(r => r._id.month === m && r._id.year === y && r._id.type === 'income');
      return e ? e.total : 0;
    });
    const expenseData = months.map(({ m, y }) => {
      const e = monthly.find(r => r._id.month === m && r._id.year === y && r._id.type === 'expense');
      return e ? e.total : 0;
    });

    if (this.charts.monthly) this.charts.monthly.destroy();
    this.charts.monthly = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months.map(x => x.label),
        datasets: [
          { label: 'Receitas', data: incomeData,  backgroundColor: 'rgba(34,197,94,0.7)',  borderRadius: 6 },
          { label: 'Despesas', data: expenseData, backgroundColor: 'rgba(239,68,68,0.7)',  borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#8890a4', font: { family: 'Inter' } } } },
        scales: {
          x: { ticks: { color: '#8890a4' }, grid: { color: '#1e2230' } },
          y: {
            ticks: { color: '#8890a4', callback: v => 'R$ ' + (v/1000).toFixed(0) + 'k' },
            grid: { color: '#1e2230' }
          }
        }
      }
    });
  },

  renderDonut(byCategory) {
    const canvas = document.getElementById('chart-donut');
    if (!canvas) return;

    const cats = Store.get('categories');
    const expenses = byCategory.filter(x => x._id.type === 'expense');
    const labels = expenses.map(x => {
      const cat = cats.find(c => c._id === x._id.categoryId);
      return cat ? cat.icon + ' ' + cat.name : 'Outros';
    });
    const values = expenses.map(x => x.total);
    const colors = expenses.map((x, i) => {
      const cat = cats.find(c => c._id === x._id.categoryId);
      return cat?.color || `hsl(${i * 40}, 70%, 55%)`;
    });

    if (this.charts.donut) this.charts.donut.destroy();

    if (!values.length) {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Sem dados de despesas</div></div>';
      return;
    }

    this.charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
      options: {
        responsive: true, cutout: '68%',
        plugins: { legend: { display: false } }
      }
    });

    // Custom legend
    const total = values.reduce((a, b) => a + b, 0);
    document.getElementById('donut-legend').innerHTML = labels.map((l, i) =>
      `<div class="legend-item">
        <div class="legend-dot" style="background:${colors[i]}"></div>
        <span class="legend-label">${l}</span>
        <span class="legend-val">${Utils.formatCurrency(values[i])}</span>
        <span class="text-muted text-sm">${Math.round(values[i]/total*100)}%</span>
      </div>`
    ).join('');
  }
};
