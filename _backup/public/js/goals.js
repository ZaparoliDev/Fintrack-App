// ===== GOALS MODULE =====
const GOAL_COLORS = ['#3b82f6','#22c55e','#a855f7','#ef4444','#f97316','#eab308','#ec4899','#06b6d4'];
const GOAL_ICONS  = ['🎯','🏠','✈️','🚗','📱','💍','🎓','💊','📦','🛍️','💰','🌍'];

const Goals = {
  editingId: null,
  selectedColor: GOAL_COLORS[0],
  selectedIcon:  GOAL_ICONS[0],

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
    const pct = Utils.pct(g.currentAmount, g.targetAmount);
    const days = Utils.daysLeft(g.deadline);
    const done = pct >= 100;
    return `<div class="goal-card">
      <div class="goal-header">
        <div>
          <div class="flex gap-2" style="align-items:center;margin-bottom:4px">
            <div class="goal-icon-wrap" style="background:${g.color}22">${g.icon}</div>
            <div>
              <div class="goal-name">${g.name}</div>
              ${g.deadline ? `<div class="goal-deadline">${days !== null ? (days > 0 ? `${days} dias restantes` : 'Prazo encerrado') : ''} · ${Utils.formatDate(g.deadline)}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          ${done ? '<span style="font-size:1.2rem">🏆</span>' : ''}
          <button class="icon-btn" onclick="Goals.openEdit('${g._id}')">✏️</button>
          <button class="icon-btn danger" onclick="Goals.delete('${g._id}')">🗑️</button>
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
      <div class="mt-2">
        <button class="btn btn-secondary btn-sm btn-full" onclick="Goals.openDeposit('${g._id}')">+ Adicionar valor</button>
      </div>
    </div>`;
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

  openDeposit(id) {
    const g = Store.get('goals').find(x => x._id === id);
    if (!g) return;
    const val = prompt(`Quanto deseja adicionar à meta "${g.name}"?\nValor atual: ${Utils.formatCurrency(g.currentAmount)}`);
    if (!val || isNaN(val) || Number(val) <= 0) return;
    API.updateGoal(id, { currentAmount: g.currentAmount + Number(val) })
      .then(() => { Utils.toast('Valor adicionado!', 'success'); this.load().then(() => this.render()); })
      .catch(err => Utils.toast(err.message, 'error'));
  },

  _renderPickers() {
    document.getElementById('goal-color-picker').innerHTML =
      GOAL_COLORS.map(c => `<div class="color-dot${c === this.selectedColor ? ' selected' : ''}" style="background:${c}" onclick="Goals.selectColor('${c}')"></div>`).join('');
    document.getElementById('goal-icon-picker').innerHTML =
      GOAL_ICONS.map(i => `<button type="button" class="icon-btn${i === this.selectedIcon ? ' active' : ''}" style="${i === this.selectedIcon ? 'background:var(--blue-dim);color:var(--blue)' : ''}" onclick="Goals.selectIcon('${i}')">${i}</button>`).join('');
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
