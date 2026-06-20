// ===== DASHBOARD MODULE =====
const Dashboard = {
  async refresh() {
    await Reports.load();
    this.renderRecentTransactions();
  },

  renderRecentTransactions() {
    const container = document.getElementById('dash-recent');
    if (!container) return;
    const txs  = Store.get('transactions').slice(0, 5);
    const cats = Store.get('categories');

    if (!txs.length) {
      container.innerHTML = `<div class="empty-state" style="padding:30px">
        <div class="empty-icon">🧾</div>
        <div class="empty-title">Nenhuma transação este mês</div>
      </div>`;
      return;
    }

    container.innerHTML = txs.map(t => {
      const cat = cats.find(c => c._id === t.categoryId);
      const icon = cat ? cat.icon : (t.type === 'income' ? '💰' : '💸');
      const bg   = cat ? cat.color + '22' : (t.type === 'income' ? '#22c55e22' : '#ef444422');
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-soft)">
        <div class="tx-icon" style="background:${bg};flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
          <div class="tx-description" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.description}</div>
          <div class="text-muted text-sm">${Utils.formatDate(t.date)}</div>
        </div>
        <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'} ${Utils.formatCurrency(t.amount)}</span>
      </div>`;
    }).join('');
  }
};
