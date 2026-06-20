// ===== GOALS MODULE =====
const GOAL_COLORS = ['#3b82f6','#22c55e','#a855f7','#ef4444','#f97316','#eab308','#ec4899','#06b6d4'];
const GOAL_ICONS  = ['🎯','🏠','✈️','🚗','📱','💍','🎓','💊','📦','🛍️','💰','🌍'];

const Goals = {
  editingId: null,
  selectedColor: GOAL_COLORS[0],
  selectedIcon:  GOAL_ICONS[0],
  openDepositId: null,

  async load() {
    try {
      const data = await API.getGoals();
      Store.set('goals', data);
    } catch (err) {
      Utils.toast('Erro ao carregar metas.', 'error');
    }
  },

  render() {
    const container = document.getElementById('goals-list');
    if (!container) return;
    const goals = Store.get('goals');

    if (!goals.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🎯</div>
        <div class="empty-title">Nenhuma meta ainda</div>
        <div class="empty-sub">Crie uma meta financeira e acompanhe seu progresso.</div>
      </div>`;
      return;
    }

    container.innerHTML = `<div class="goals-grid">${goals.map(g => this._goalCard(g)).join('')}</div>`;
  },

  _goalCard(g) {
    const pct  = Utils.pct(g.currentAmount, g.targetAmount);
    const days = Utils.daysLeft(g.deadline);
    const done = pct >= 100;
    const remaining = Math.max(0, g.targetAmount - g.currentAmount);

    const deposits = (g.deposits || []).slice(-5).reverse();
    const depositHistory = deposits.length
      ? deposits.map(d => `
          <div class="deposit-entry">
            <span class="deposit-amount">+ ${Utils.formatCurrency(d.amount)}</span>
            <span class="deposit-note">${d.note || '—'}</span>
            <span class="deposit-date">${Utils.formatDate(d.date)}</span>
          </div>`).join('')
      : '<div class="text-muted text-sm" style="padding:6px 0">Nenhum depósito ainda.</div>';

    return `<div class="goal-card" id="goal-card-${g._id}">
      <div class="goal-header">
        <div class="flex gap-2" style="align-items:flex-start">
          <div class="goal-icon-wrap" style="background:${g.color}22">${g.icon}</div>
          <div>
            <div class="goal-name">${g.name} ${done ? '🏆' : ''}</div>
            ${g.deadline ? `<div class="goal-deadline">
              ${days !== null ? (days > 0 ? `${days} dias restantes` : '<span style="color:var(--red)">Prazo encerrado</span>') : ''}
              · ${Utils.formatDate(g.deadline)}
            </div>` : ''}
          </div>
        </div>
        <div class="flex gap-2">
          <button class="icon-btn" onclick="Goals.openEdit('${g._id}')" title="Editar">✏️</button>
          <button class="icon-btn danger" onclick="Goals.delete('${g._id}')" title="Excluir">🗑️</button>
        </div>
      </div>

      <div class="goal-progress-bar">
        <div class="goal-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,${g.color},${g.color}99)"></div>
      </div>
      <div class="goal-amounts">
        <span class="goal-current" style="color:${g.color}">${Utils.formatCurrency(g.currentAmount)}</span>
        <span class="goal-pct">${pct}%</span>
        <span class="goal-target">${Utils.formatCurrency(g.targetAmount)}</span>
      </div>

      ${!done ? `<div class="mt-1 text-sm text-muted" style="text-align:center">
        Faltam <strong style="color:${g.color}">${Utils.formatCurrency(remaining)}</strong>
      </div>` : `<div class="mt-1 text-sm" style="text-align:center;color:var(--green);font-weight:700">✓ Meta atingida!</div>`}

      <button class="btn btn-secondary btn-sm btn-full mt-2"
        onclick="Goals.toggleDeposit('${g._id}')"
        id="btn-deposit-${g._id}">
        💰 Adicionar valor
      </button>

      <div class="goal-deposit-panel" id="deposit-panel-${g._id}">
        <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px;color:var(--text-secondary)">NOVO DEPÓSITO</div>
        <div class="form-row" style="margin-bottom:8px">
          <div>
            <label class="form-label">Valor (R$)</label>
            <input type="number" class="form-input" id="dep-amount-${g._id}" placeholder="0,00" min="0.01" step="0.01" />
          </div>
          <div>
            <label class="form-label">Observação</label>
            <input type="text" class="form-input" id="dep-note-${g._id}" placeholder="Opcional" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm btn-full" onclick="Goals.saveDeposit('${g._id}')">Confirmar depósito</button>

        ${deposits.length ? `
        <div class="divider" style="margin:12px 0 8px"></div>
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">ÚLTIMOS DEPÓSITOS</div>
        <div class="deposit-history">${depositHistory}</div>
        ` : ''}
      </div>
    </div>`;
  },

  toggleDeposit(id) {
    const panel = document.getElementById(`deposit-panel-${id}`);
    panel.classList.toggle('open');
    const btn = document.getElementById(`btn-deposit-${id}`);
    btn.textContent = panel.classList.contains('open') ? '✕ Fechar' : '💰 Adicionar valor';
  },

  async saveDeposit(id) {
    const amountEl = document.getElementById(`dep-amount-${id}`);
    const noteEl   = document.getElementById(`dep-note-${id}`);
    const amount = parseFloat(amountEl.value);
    if (!amount || amount <= 0) { Utils.toast('Informe um valor válido.', 'error'); return; }

    try {
      await API.updateGoal(id, { deposit: { amount, note: noteEl.value } });
      Utils.toast('Depósito registrado!', 'success');
      amountEl.value = '';
      noteEl.value = '';
      await this.load();
      this.render();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  },

  openCreate() {
    this.editingId = null;
    document.getElementById('modal-goal-title').textContent = 'Nova Meta';
    document.getElementById('form-goal').reset();
    this.selectedColor = GOAL_COLORS[0];
    this.selectedIcon  = GOAL_ICONS[0];
    this._renderPickers();
    Modal.open('modal-goal');
  },

  openEdit(id) {
    const g = Store.get('goals').find(x => x._id === id);
    if (!g) return;
    this.editingId = id;
    document.getElementById('modal-goal-title').textContent = 'Editar Meta';
    document.getElementById('goal-name').value = g.name;
    document.getElementById('goal-target').value = g.targetAmount;
    document.getElementById('goal-current').value = g.currentAmount;
    document.getElementById('goal-deadline').value = Utils.formatDateInput(g.deadline);
    this.selectedColor = g.color || GOAL_COLORS[0];
    this.selectedIcon  = g.icon  || GOAL_ICONS[0];
    this._renderPickers();
    Modal.open('modal-goal');
  },

  _renderPickers() {
    document.getElementById('goal-color-picker').innerHTML =
      GOAL_COLORS.map(c => `<div class="color-dot${c === this.selectedColor ? ' selected' : ''}" style="background:${c}" onclick="Goals.selectColor('${c}')"></div>`).join('');
    document.getElementById('goal-icon-picker').innerHTML =
      GOAL_ICONS.map(i => `<button type="button" class="icon-btn${i === this.selectedIcon ? ' active' : ''}"
        style="${i === this.selectedIcon ? 'background:var(--blue-dim);color:var(--blue)' : ''}"
        onclick="Goals.selectIcon('${i}')">${i}</button>`).join('');
  },

  selectColor(c) { this.selectedColor = c; this._renderPickers(); },
  selectIcon(i)  { this.selectedIcon  = i; this._renderPickers(); },

  async save(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const body = {
      name:          document.getElementById('goal-name').value,
      targetAmount:  document.getElementById('goal-target').value,
      currentAmount: document.getElementById('goal-current').value || 0,
      deadline:      document.getElementById('goal-deadline').value || null,
      color: this.selectedColor,
      icon:  this.selectedIcon
    };
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (this.editingId) {
        await API.updateGoal(this.editingId, body);
        Utils.toast('Meta atualizada!', 'success');
      } else {
        await API.createGoal(body);
        Utils.toast('Meta criada!', 'success');
      }
      Modal.close('modal-goal');
      await this.load();
      this.render();
    } catch (err) {
      Utils.toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  },

  async delete(id) {
    if (!Utils.confirm('Excluir esta meta?')) return;
    try {
      await API.deleteGoal(id);
      Utils.toast('Meta excluída.', 'success');
      await this.load();
      this.render();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }
};
