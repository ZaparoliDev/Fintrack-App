const Dashboard = {
  async refresh() {
    const summary = await this._loadSummary();
    this.renderHero(summary);
    this.renderRecentTransactions();
    this.renderChart(summary?.monthly || []);
    this.renderDebtWidget(summary?.debtInstallments || []);
  },

  async _loadSummary() {
    try {
      const data = await API.getSummary({ month:Store.get('currentMonth'), year:Store.get('currentYear') });
      Store.set('summary', data);
      return data;
    } catch { return null; }
  },

  renderHero(data) {
    const income  = data?.income  || 0;
    const expense = data?.expense || 0;
    const balance = data?.balance || 0;
    const txs     = Store.get('transactions');
    const goals   = Store.get('goals');
    const debts   = Store.get('debts');
    const el      = id => document.getElementById(id);

    const heroVal = el('dash-balance-hero');
    if (heroVal) { heroVal.textContent = Utils.formatCurrency(balance); heroVal.className = 'balance-hero-value'+(balance<0?' negative':''); }
    if (el('dash-income-mini'))  el('dash-income-mini').textContent  = Utils.formatCurrency(income);
    if (el('dash-expense-mini')) el('dash-expense-mini').textContent = Utils.formatCurrency(expense);
    if (el('dash-tx-count'))     el('dash-tx-count').textContent     = txs.length;
    // CORRIGIDO: current_amount e target_amount (snake_case)
    if (el('dash-goals-count'))  el('dash-goals-count').textContent  = goals.filter(g=>Utils.pct(g.current_amount,g.target_amount)<100).length;
    if (el('dash-debts-count'))  el('dash-debts-count').textContent  = debts.filter(d=>d.active!==false).length;
    if (el('dash-avg-expense')) {
      const expTxs = txs.filter(t=>t.type==='expense');
      el('dash-avg-expense').textContent = Utils.formatCurrency(expTxs.length ? expense/expTxs.length : 0);
    }
    if (el('dash-month-bar-fill') && income > 0) {
      const pct = Math.min(100, Math.round((expense/income)*100));
      el('dash-month-bar-fill').style.width = pct+'%';
      el('dash-month-bar-fill').className = 'month-bar-fill'+(pct>90?' danger':pct>70?' warning':'');
      if (el('dash-month-pct')) el('dash-month-pct').textContent = pct+'% gasto';
    }
    const set = (id, val, cls) => { const e=el(id); if(!e)return; e.textContent=val; if(cls)e.className=cls; };
    set('rep-income-r',  Utils.formatCurrency(income));
    set('rep-expense-r', Utils.formatCurrency(expense));
    set('rep-balance-r', Utils.formatCurrency(balance), 'stat-value '+(balance>=0?'green':'red'));
    const rate = income>0 ? Math.round((expense/income)*100) : 0;
    set('rep-rate',    rate+'%', 'stat-value '+(rate>100?'red':rate>80?'amber':'green'));
    set('rep-savings', Utils.formatCurrency(Math.max(0, income-expense)));
  },

  renderChart(monthly) {
    const canvas = document.getElementById('chart-monthly');
    if (!canvas) return;
    const m=Store.get('currentMonth'), y=Store.get('currentYear');
    const months=[];
    for(let i=5;i>=0;i--){ let mo=m-i,yr=y; if(mo<=0){mo+=12;yr--;} months.push({m:mo,y:yr,label:new Date(yr,mo-1).toLocaleDateString('pt-BR',{month:'short'})}); }
    const inc = months.map(({m,y})=>monthly.find(r=>r._id.month===m&&r._id.year===y&&r._id.type==='income')?.total||0);
    const exp = months.map(({m,y})=>monthly.find(r=>r._id.month===m&&r._id.year===y&&r._id.type==='expense')?.total||0);
    if (window._dashChart) window._dashChart.destroy();
    window._dashChart = new Chart(canvas, {
      type:'bar',
      data:{ labels:months.map(x=>x.label), datasets:[
        {label:'Receitas',data:inc,backgroundColor:'rgba(34,197,94,0.75)',borderRadius:6},
        {label:'Despesas',data:exp,backgroundColor:'rgba(240,77,77,0.75)',borderRadius:6}
      ]},
      options:{ responsive:true,
        plugins:{legend:{labels:{color:'#7c84a0',font:{family:'Inter',size:11}}}},
        scales:{
          x:{ticks:{color:'#7c84a0',font:{size:11}},grid:{color:'#191c28'}},
          y:{ticks:{color:'#7c84a0',font:{size:11},callback:v=>'R$'+(v>=1000?(v/1000).toFixed(0)+'k':v)},grid:{color:'#191c28'}}
        }
      }
    });
  },

  renderDebtWidget(debtInstallments) {
    const el = document.getElementById('dash-debt-widget');
    if (!el) return;
    const active = debtInstallments.filter(d=>d.remaining>0);
    if (!active.length) { el.style.display='none'; return; }
    el.style.display='block';
    // CORRIGIDO: installmentAmount vem do backend formatado corretamente no reportSummary
    const totalMonthly = active.reduce((s,d)=>s+d.installmentAmount,0);
    el.innerHTML=`<div class="section-header"><span class="section-title">🏦 Parcelas do mês</span><span class="text-muted text-sm">${Utils.formatCurrency(totalMonthly)}/mês</span></div>
    ${active.slice(0,4).map(d=>`<div class="recent-tx-item">
      <div class="tx-icon" style="background:${d.color}22;flex-shrink:0">${d.icon}</div>
      <div style="flex:1;min-width:0"><div class="tx-description">${d.name}</div>
        <div class="text-muted text-sm">${d.paidInstallments}/${d.totalInstallments} parcelas</div></div>
      <div class="recent-tx-right"><div class="recent-tx-amount tx-amount expense">- ${Utils.formatCurrency(d.installmentAmount)}</div>
        <div class="recent-tx-date">${d.remaining} restante${d.remaining!==1?'s':''}</div></div>
    </div>`).join('')}`;
  },

  renderRecentTransactions() {
    const container = document.getElementById('dash-recent');
    if (!container) return;
    const txs=Store.get('transactions').slice(0,6), cats=Store.get('categories');
    if (!txs.length) { container.innerHTML=`<div class="empty-state" style="padding:30px"><div class="empty-icon">🧾</div><div class="empty-title">Nenhuma transação este mês</div></div>`; return; }
    container.innerHTML=txs.map(t=>{
      // CORRIGIDO: c.id e t.category_id
      const cat=cats.find(c=>String(c.id)===String(t.category_id));
      const icon=cat?cat.icon:(t.type==='income'?'💰':'💸');
      const bg=cat?cat.color+'22':(t.type==='income'?'#22c55e22':'#ef444422');
      return `<div class="recent-tx-item">
        <div class="tx-icon" style="background:${bg};flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0"><div class="tx-description" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.description}</div>
          <div class="text-muted text-sm">${cat?cat.name:'Sem categoria'}</div></div>
        <div class="recent-tx-right">
          <div class="recent-tx-amount tx-amount ${t.type}">${t.type==='income'?'+':'-'} ${Utils.formatCurrency(t.amount)}</div>
          <div class="recent-tx-date">${Utils.formatDate(t.date)}</div>
        </div></div>`;
    }).join('');
  }
};
