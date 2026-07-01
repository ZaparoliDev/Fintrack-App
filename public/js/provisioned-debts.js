const PROV_COLORS = ['#f97316','#3b82f6','#22c55e','#a855f7','#ef4444','#eab308','#ec4899','#06b6d4'];
const PROV_ICONS  = ['📌','📶','💡','💧','🏠','📺','☎️','🛡️','🎵','🅿️'];

const ProvisionedDebts = {
  editingId: null,
  selColor: PROV_COLORS[0],
  selIcon:  PROV_ICONS[0],
  monthList: [],

  async load() {
    try {
      const data = await API.getProvisionedDebtsMonth({ month: Store.get('currentMonth'), year: Store.get('currentYear') });
      this.monthList = data;
      Store.set('provisionedDebts', data);
    } catch (err) {
      Utils.toast('Erro ao carregar dívidas provisionadas.', 'error');
    }
  },

  render() {
    const container = document.getElementById('provdebts-list');
    if (!container) return;
    const list = this.monthList;

    const pending  = list.filter(d => d.status === 'pending');
    const overdue  = list.filter(d => d.status === 'overdue');
    const paid     = list.filter(d => d.status === 'paid');

    const totalAll    = list.reduce((s,d)=>s+d.amount,0);
    const totalPaid   = paid.reduce((s,d)=>s+d.amount,0);
    const totalPend   = pending.reduce((s,d)=>s+d.amount,0);
    const totalOver   = overdue.reduce((s,d)=>s+d.amount,0);

    // ── Dashboard resumo ──
    const summary = document.getElementById('provdebts-summary');
    if (summary) {
      summary.innerHTML = `
        <div class="quick-stats">
          <div class="quick-stat"><div class="quick-stat-icon">📌</div><div class="quick-stat-label">Previsto no mês</div><div class="quick-stat-value">${Utils.formatCurrency(totalAll)}</div></div>
          <div class="quick-stat"><div class="quick-stat-icon">✅</div><div class="quick-stat-label">Pago</div><div class="quick-stat-value" style="color:var(--green)">${Utils.formatCurrency(totalPaid)}</div></div>
          <div class="quick-stat"><div class="quick-stat-icon">🕓</div><div class="quick-stat-label">Pendente</div><div class="quick-stat-value" style="color:var(--text-secondary)">${Utils.formatCurrency(totalPend)}</div></div>
          <div class="quick-stat"><div class="quick-stat-icon">⚠️</div><div class="quick-stat-label">Atrasado</div><div class="quick-stat-value" style="color:var(--red)">${Utils.formatCurrency(totalOver)}</div></div>
        </div>`;
    }

    if (!list.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📌</div>
        <div class="empty-title">Nenhuma dívida provisionada</div>
        <div class="empty-sub">Cadastre contas fixas recorrentes, como Wi-Fi ou aluguel, para acompanhar todo mês.</div>
      </div>`;
      return;
    }

    const section = (title, items, emptyMsg) => items.length ? `
      <div class="mb-4">
        <div class="section-header"><span class="section-title">${title}</span></div>
        <div class="categories-grid">${items.map(d=>this._card(d)).join('')}</div>
      </div>` : '';

    container.innerHTML =
      section(`⚠️ Atrasadas (${overdue.length})`, overdue) +
      section(`🕓 Pendentes (${pending.length})`, pending) +
      section(`✅ Pagas (${paid.length})`, paid);
  },

  _card(d) {
    const isPending = d.status === 'pending';
    const isOverdue = d.status === 'overdue';
    const isPaid    = d.status === 'paid';
    const dimmed = isPending ? ' style="opacity:0.55"' : '';
    const badge = isOverdue
      ? '<span class="smart-badge" style="background:var(--red-dim);color:var(--red)">ATRASADA</span>'
      : isPaid
        ? '<span class="smart-badge" style="background:var(--green-dim);color:var(--green)">PAGA</span>'
        : '';

    return `<div class="cat-card"${dimmed}>
      <div class="cat-icon" style="background:${d.color}22">${d.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="cat-name">${d.name}${badge}</div>
        <div class="cat-type">Vence dia ${d.dueDay} · ${Utils.formatCurrency(d.amount)}</div>
      </div>
      <div class="cat-actions">
        ${!isPaid ? `<button class="icon-btn" style="color:var(--green)" onclick="ProvisionedDebts.pay('${d.id}')" title="Marcar como paga">✓</button>` : ''}
        ${isPaid  ? `<button class="icon-btn" style="color:var(--red)" onclick="ProvisionedDebts.unpay('${d.id}')" title="Marcar como não paga">↺</button>` : ''}
        <button class="icon-btn" onclick="ProvisionedDebts.openEdit('${d.id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="ProvisionedDebts.delete('${d.id}')" title="Excluir cadastro">🗑️</button>
      </div>
    </div>`;
  },

  async pay(id) {
    if (!Utils.confirm('Marcar esta dívida provisionada como paga? Isso cria uma transação de despesa.')) return;
    try {
      await API.payProvisionedDebt(id, { month: Store.get('currentMonth'), year: Store.get('currentYear') });
      Utils.toast('Marcada como paga!', 'success');
      await this.load();
      this.render();
      await Transactions.load();
      Dashboard.refresh();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  },

  async unpay(id) {
    if (!Utils.confirm('Desfazer o pagamento? A transação criada será removida.')) return;
    try {
      await API.unpayProvisionedDebt(id, { month: Store.get('currentMonth'), year: Store.get('currentYear') });
      Utils.toast('Pagamento desfeito.', 'success');
      await this.load();
      this.render();
      await Transactions.load();
      Dashboard.refresh();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  },

  openCreate() {
    this.editingId = null;
    this.selColor = PROV_COLORS[0];
    this.selIcon  = PROV_ICONS[0];
    document.getElementById('modal-provdebt-title').textContent = 'Nova Dívida Provisionada';
    document.getElementById('form-provdebt').reset();
    this._renderPickers();
    Modal.open('modal-provdebt');
  },

  openEdit(id) {
    const d = this.monthList.find(x => String(x.id) === String(id));
    if (!d) return;
    this.editingId = id;
    this.selColor = d.color || PROV_COLORS[0];
    this.selIcon  = d.icon  || PROV_ICONS[0];
    document.getElementById('modal-provdebt-title').textContent = 'Editar Dívida Provisionada';
    document.getElementById('provdebt-name').value   = d.name;
    document.getElementById('provdebt-amount').value = d.amount;
    document.getElementById('provdebt-day').value    = d.dueDay;
    this._renderPickers();
    Modal.open('modal-provdebt');
  },

  _renderPickers() {
    document.getElementById('provdebt-color-picker').innerHTML =
      PROV_COLORS.map(c=>`<div class="color-dot${c===this.selColor?' selected':''}" style="background:${c}" onclick="ProvisionedDebts.selColor='${c}';ProvisionedDebts._renderPickers()"></div>`).join('');
    document.getElementById('provdebt-icon-picker').innerHTML =
      PROV_ICONS.map(i=>`<button type="button" class="icon-btn${i===this.selIcon?' active':''}" style="${i===this.selIcon?'background:var(--blue-dim);color:var(--blue)':''}" onclick="ProvisionedDebts.selIcon='${i}';ProvisionedDebts._renderPickers()">${i}</button>`).join('');
  },

  async save(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const body = {
      name:   document.getElementById('provdebt-name').value,
      amount: parseFloat(document.getElementById('provdebt-amount').value),
      dueDay: parseInt(document.getElementById('provdebt-day').value),
      icon: this.selIcon, color: this.selColor
    };
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (this.editingId) {
        await API.updateProvisionedDebt(this.editingId, body);
        Utils.toast('Dívida provisionada atualizada!', 'success');
      } else {
        await API.createProvisionedDebt(body);
        Utils.toast('Dívida provisionada criada!', 'success');
      }
      Modal.close('modal-provdebt');
      await this.load();
      this.render();
      Dashboard.refresh();
    } catch (err) {
      Utils.toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  },

  async delete(id) {
    if (!Utils.confirm('Excluir este cadastro? Isso remove a recorrência (transações já pagas não serão apagadas).')) return;
    try {
      await API.deleteProvisionedDebt(id);
      Utils.toast('Excluída.', 'success');
      await this.load();
      this.render();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }
};
