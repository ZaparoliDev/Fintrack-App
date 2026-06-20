// ===== CATEGORIES MODULE =====
const COLORS = ['#22c55e','#3b82f6','#a855f7','#ef4444','#f97316','#eab308','#ec4899','#06b6d4','#14b8a6','#8b5cf6','#f59e0b','#6b7280'];
const ICONS  = ['🏠','🍽️','🚗','🏥','🎮','📚','👕','✈️','💼','💻','📈','🎯','🎁','🛒','📱','⚡','🐾','🌱','💰','💳'];

const Categories = {
  editingId: null,
  selectedColor: COLORS[0],
  selectedIcon: ICONS[0],
  isSmart: false,

  async load() {
    try {
      const data = await API.getCategories();
      Store.set('categories', data);
    } catch (err) {
      Utils.toast('Erro ao carregar categorias.', 'error');
    }
  },

  render() {
    const container = document.getElementById('categories-list');
    if (!container) return;
    const cats = Store.get('categories');

    const normal = cats.filter(c => !c.smart);
    const smart  = cats.filter(c => c.smart);
    const income  = normal.filter(c => c.type === 'income');
    const expense = normal.filter(c => c.type === 'expense');

    container.innerHTML = `
      <div class="mb-4">
        <div class="section-header"><span class="section-title">💚 Receitas</span></div>
        <div class="categories-grid">${income.map(c => this._catCard(c)).join('') || '<p class="text-muted text-sm">Nenhuma</p>'}</div>
      </div>
      <div class="mb-4">
        <div class="section-header"><span class="section-title">❤️ Despesas</span></div>
        <div class="categories-grid">${expense.map(c => this._catCard(c)).join('') || '<p class="text-muted text-sm">Nenhuma</p>'}</div>
      </div>
      ${smart.length ? `
      <div>
        <div class="section-header">
          <span class="section-title">⚡ Personalizadas <span class="smart-badge">SMART</span></span>
        </div>
        <p class="text-muted text-sm mb-2">Ao selecionar em uma nova transação, os campos são preenchidos automaticamente.</p>
        <div class="categories-grid">${smart.map(c => this._catCard(c)).join('')}</div>
      </div>` : ''}
    `;
  },

  _catCard(c) {
    return `<div class="cat-card">
      <div class="cat-icon" style="background:${c.color}22">${c.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="cat-name">${c.name}${c.smart ? '<span class="smart-badge">SMART</span>' : ''}</div>
        <div class="cat-type">${c.type === 'income' ? 'Receita' : 'Despesa'}</div>
        ${c.smart && c.smartDefaults ? `<div class="text-muted text-sm">${Utils.formatCurrency(c.smartDefaults.amount || 0)}</div>` : ''}
      </div>
      <div class="cat-actions">
        <button class="icon-btn" onclick="Categories.openEdit('${c._id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="Categories.delete('${c._id}')" title="Excluir">🗑️</button>
      </div>
    </div>`;
  },

  openCreate() {
    this.editingId = null;
    this.isSmart = false;
    document.getElementById('modal-cat-title').textContent = 'Nova Categoria';
    document.getElementById('form-cat').reset();
    this.selectedColor = COLORS[0];
    this.selectedIcon  = ICONS[0];
    this._renderColorPicker();
    this._renderIconPicker();
    this._updateSmartUI();
    Modal.open('modal-cat');
  },

  openEdit(id) {
    const cat = Store.get('categories').find(c => c._id === id);
    if (!cat) return;
    this.editingId = id;
    this.isSmart = !!cat.smart;
    document.getElementById('modal-cat-title').textContent = 'Editar Categoria';
    document.getElementById('cat-name').value = cat.name;
    document.getElementById('cat-type').value = cat.type;
    this.selectedColor = cat.color || COLORS[0];
    this.selectedIcon  = cat.icon  || ICONS[0];
    this._renderColorPicker();
    this._renderIconPicker();

    if (cat.smart && cat.smartDefaults) {
      document.getElementById('smart-desc').value    = cat.smartDefaults.description || '';
      document.getElementById('smart-amount').value  = cat.smartDefaults.amount || '';
      document.getElementById('smart-note').value    = cat.smartDefaults.note || '';
    }
    this._updateSmartUI();
    Modal.open('modal-cat');
  },

  toggleSmart() {
    this.isSmart = !this.isSmart;
    this._updateSmartUI();
  },

  _updateSmartUI() {
    const toggle = document.getElementById('smart-toggle-switch');
    const section = document.getElementById('smart-defaults-section');
    if (toggle) toggle.classList.toggle('on', this.isSmart);
    if (section) section.classList.toggle('show', this.isSmart);
  },

  _renderColorPicker() {
    const wrap = document.getElementById('cat-color-picker');
    wrap.innerHTML = COLORS.map(c => `
      <div class="color-dot${c === this.selectedColor ? ' selected' : ''}"
        style="background:${c}"
        onclick="Categories.selectColor('${c}')">
      </div>`).join('');
  },

  _renderIconPicker() {
    const wrap = document.getElementById('cat-icon-picker');
    wrap.innerHTML = ICONS.map(i => `
      <button type="button"
        class="icon-btn${i === this.selectedIcon ? ' active' : ''}"
        style="${i === this.selectedIcon ? 'background:var(--blue-dim);color:var(--blue)' : ''}"
        onclick="Categories.selectIcon('${i}')">${i}</button>`).join('');
  },

  selectColor(c) { this.selectedColor = c; this._renderColorPicker(); },
  selectIcon(i)  { this.selectedIcon  = i; this._renderIconPicker(); },

  async save(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const smartDefaults = this.isSmart ? {
      description: document.getElementById('smart-desc').value.trim(),
      amount:      parseFloat(document.getElementById('smart-amount').value) || null,
      note:        document.getElementById('smart-note').value.trim()
    } : null;

    const body = {
      name:  document.getElementById('cat-name').value,
      type:  document.getElementById('cat-type').value,
      color: this.selectedColor,
      icon:  this.selectedIcon,
      smart: this.isSmart,
      smartDefaults
    };
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (this.editingId) {
        await API.updateCategory(this.editingId, body);
        Utils.toast('Categoria atualizada!', 'success');
      } else {
        await API.createCategory(body);
        Utils.toast('Categoria criada!', 'success');
      }
      Modal.close('modal-cat');
      await this.load();
      this.render();
      Transactions.populateCategoryFilter();
    } catch (err) {
      Utils.toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  },

  async delete(id) {
    if (!Utils.confirm('Excluir esta categoria?')) return;
    try {
      await API.deleteCategory(id);
      Utils.toast('Categoria excluída.', 'success');
      await this.load();
      this.render();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }
};
