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
    const onDashboard = document.getElementById('page-reports')?.classList.contains('hidden');
    this.renderMonthly(data.monthly, onDashboard ? 'chart-monthly' : 'chart-monthly-r');
    if (!onDashboard) {
      this.renderDonut(data.byCategory);
      this.renderPie(data);
      this.renderReportCards(data);
    }
    this.renderSummaryCards(data);
  },

  renderSummaryCards(data) {
    const set = (id, val, cls) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = val;
      if (cls) el.className = cls;
    };
    set('rep-income-r',  Utils.formatCurrency(data.income));
    set('rep-expense-r', Utils.formatCurrency(data.expense));
    set('rep-balance-r', Utils.formatCurrency(data.balance), 'stat-value ' + (data.balance >= 0 ? 'green' : 'red'));
  },

  renderReportCards(data) {
    const set = (id, val, cls) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = val;
      if (cls) el.className = cls;
    };
    const rate = data.income > 0 ? Math.round((data.expense / data.income) * 100) : 0;
    set('rep-rate', rate + '%', 'stat-value ' + (rate > 100 ? 'red' : rate > 80 ? 'amber' : 'green'));
    set('rep-savings', Utils.formatCurrency(Math.max(0, data.income - data.expense)));
  },

  renderMonthly(monthly, canvasId) {
    const canvas = document.getElementById(canvasId || 'chart-monthly');
    if (!canvas) return;

    const m = Store.get('currentMonth');
    const y = Store.get('currentYear');
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let mo = m - i; let yr = y;
      if (mo <= 0) { mo += 12; yr--; }
      months.push({ m: mo, y: yr, label: new Date(yr, mo - 1).toLocaleDateString('pt-BR', { month: 'short' }) });
    }

    const incomeData  = months.map(({ m, y }) => monthly.find(r => r._id.month === m && r._id.year === y && r._id.type === 'income')?.total  || 0);
    const expenseData = months.map(({ m, y }) => monthly.find(r => r._id.month === m && r._id.year === y && r._id.type === 'expense')?.total || 0);

    const key = canvasId || 'monthly';
    if (this.charts[key]) this.charts[key].destroy();
    this.charts[key] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months.map(x => x.label),
        datasets: [
          { label: 'Receitas', data: incomeData,  backgroundColor: 'rgba(34,197,94,0.75)',  borderRadius: 7, borderSkipped: false },
          { label: 'Despesas', data: expenseData, backgroundColor: 'rgba(240,77,77,0.75)',  borderRadius: 7, borderSkipped: false }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#7c84a0', font: { family: 'Inter', size: 11, weight: '600' } } } },
        scales: {
          x: { ticks: { color: '#7c84a0', font: { size: 11 } }, grid: { color: '#191c28' } },
          y: {
            ticks: { color: '#7c84a0', font: { size: 11 }, callback: v => 'R$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) },
            grid: { color: '#191c28' }
          }
        }
      }
    });
  },

  renderDonut(byCategory) {
    const wrap = document.getElementById('donut-wrap');
    if (!wrap) return;

    const cats = Store.get('categories');
    const expenses = byCategory.filter(x => x._id.type === 'expense');
    if (!expenses.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-icon">📊</div><div class="empty-title">Sem despesas este mês</div></div>';
      return;
    }
    wrap.innerHTML = '<canvas id="chart-donut"></canvas><div id="donut-legend" class="donut-legend"></div>';
    const canvas = document.getElementById('chart-donut');

    const labels = expenses.map(x => { const c = cats.find(c => c._id === x._id.categoryId); return c ? c.icon + ' ' + c.name : '📦 Outros'; });
    const values = expenses.map(x => x.total);
    const colors = expenses.map((x, i) => { const c = cats.find(c => c._id === x._id.categoryId); return c?.color || `hsl(${i*40},70%,55%)`; });

    if (this.charts.donut) this.charts.donut.destroy();
    this.charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 10 }] },
      options: { responsive: true, cutout: '70%', plugins: { legend: { display: false } } }
    });

    const total = values.reduce((a, b) => a + b, 0);
    document.getElementById('donut-legend').innerHTML = labels.map((l, i) =>
      `<div class="legend-item">
        <div class="legend-dot" style="background:${colors[i]}"></div>
        <span class="legend-label">${l}</span>
        <span class="legend-val">${Utils.formatCurrency(values[i])}</span>
        <span class="text-muted text-sm">${Math.round(values[i]/total*100)}%</span>
      </div>`
    ).join('');
  },

  renderPie(data) {
    const wrap = document.getElementById('pie-wrap');
    if (!wrap) return;
    if (!data.income && !data.expense) {
      wrap.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-icon">🥧</div><div class="empty-title">Sem dados este mês</div></div>';
      return;
    }
    wrap.innerHTML = '<canvas id="chart-pie"></canvas><div id="pie-legend" class="donut-legend mt-2"></div>';
    const canvas = document.getElementById('chart-pie');

    if (this.charts.pie) this.charts.pie.destroy();
    this.charts.pie = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Receitas', 'Despesas'],
        datasets: [{ data: [data.income, data.expense], backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(240,77,77,0.8)'], borderWidth: 0, hoverOffset: 8 }]
      },
      options: { responsive: true, cutout: '65%', plugins: { legend: { display: false } } }
    });

    document.getElementById('pie-legend').innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div><span class="legend-label">Receitas</span><span class="legend-val">${Utils.formatCurrency(data.income)}</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:#f04d4d"></div><span class="legend-label">Despesas</span><span class="legend-val">${Utils.formatCurrency(data.expense)}</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:#4f8ef7"></div><span class="legend-label">Saldo</span><span class="legend-val" style="color:${data.balance>=0?'var(--green)':'var(--red)'}">${Utils.formatCurrency(data.balance)}</span></div>
    `;
  }
};
