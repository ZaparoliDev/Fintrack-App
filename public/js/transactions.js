// ===== TRANSACTIONS MODULE =====
const Transactions = {
  page: 1,
  perPage: 15,
  filtered: [],
  editingId: null,

  async load() {
    const q = { month: Store.get('currentMonth'), year: Store.get('currentYear') };
    try {
      const data = await API.getTransactions(q);
      Store.set('transactions', data);
      this.applyFilter();
    } catch (err) {
      Utils.toast('Erro ao carregar transações.', 'error');
    }
  },

  applyFilter() {
    const search = (document.getElementById('tx-search')?.value || '').toLowerCase();
    const typeF  = document.getElementById('tx-filter-type')?.value || '';
    const catF   = document.getElementById('tx-filter-cat')?.value  || '';
    let list = Store.get('transactions');
    if (typeF) list = list.filter(t => t.type === typeF);
    if (catF)  list = list.filter(t => String(t.category_id) === catF); // CORRIGIDO: category_id
    if (search) list = list.filter(t =>
      t.description.toLowerCase().includes(search) ||
      (t.note || '').toLowerCase().includes(search)
    );
    this.filtered = list;
    this.page = 1;
    this.render();
  },

  render() {
    const tbody = document.getElementById('tx-tbody');
    if (!tbody) return;
    const cats  = Store.get('categories');
    const total = this.filtered.length;
    const pages = Math.ceil(total / this.perPage) || 1;
    const slice = this.filtered.slice((this.page - 1) * this.perPage, this.page * this.perPage);

    document.getElementById('tx-page-info').textContent = `${total} transação(ões)`;

    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        <div class="empty-icon">🧾</div>
        <div class="empty-title">Nenhuma transação encontrada</div>
        <div class="empty-sub">Adicione sua primeira transação para começar.</div>
      </div></td></tr>`;
    } else {
      tbody.innerHTML = slice.map(t => {
        const cat = cats.find(c => String(c.id) === String(t.category_id)); // CORRIGIDO: id e category_id
        const icon = cat ? cat.icon : (t.type === 'income' ? '💰' : '💸');
        const bg   = cat ? cat.color + '22' : (t.type === 'income' ? '#22c55e22' : '#ef444422');
        const smartMark = cat?.smart ? '<span class="smart-badge">SMART</span>' : '';
        return `<tr>
          <td>
            <div class="flex gap-2" style="align-items:center">
              <div class="tx-icon" style="background:${bg}">${icon}</div>
              <div>
                <div class="tx-description">${t.description}</div>
                ${t.note ? `<div class="tx-note">${t.note}</div>` : ''}
              </div>
            </div>
          </td>
          <td><span class="badge-type badge-${t.type}">${t.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
          <td class="text-muted text-sm">${cat ? cat.icon + ' ' + cat.name + smartMark : '—'}</td>
          <td class="text-muted text-sm">${Utils.formatDate(t.date)}</td>
          <td><span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'} ${Utils.formatCurrency(t.amount)}</span></td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" onclick="Transactions.openEdit('${t.id}')" title="Editar">✏️</button>
              <button class="icon-btn danger" onclick="Transactions.delete('${t.id}')" title="Excluir">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    const pg = document.getElementById('tx-pagination');
    pg.innerHTML = '';
    for (let i = 1; i <= pages; i++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (i === this.page ? ' active' : '');
      btn.textContent = i;
      btn.onclick = () => { this.page = i; this.render(); };
      pg.appendChild(btn);
    }
  },

  openCreate() {
    this.editingId = null;
    document.getElementById('modal-tx-title').textContent = 'Nova Transação';
    document.getElementById('form-tx').reset();
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    const ind = document.getElementById('smart-cat-indicator');
    if (ind) ind.classList.remove('show');
    this.setType('expense');
    this.populateCategorySelect();
    Modal.open('modal-tx');
  },

  async openEdit(id) {
    const t = Store.get('transactions').find(x => String(x.id) === String(id)); // CORRIGIDO: id
    if (!t) return;
    this.editingId = id;
    document.getElementById('modal-tx-title').textContent = 'Editar Transação';
    this.setType(t.type);
    this.populateCategorySelect(t.type);
    document.getElementById('tx-description').value = t.description;
    document.getElementById('tx-amount').value      = t.amount;
    document.getElementById('tx-category').value    = t.category_id || ''; // CORRIGIDO: category_id
    document.getElementById('tx-date').value        = Utils.formatDateInput(t.date);
    document.getElementById('tx-note').value        = t.note || '';
    Modal.open('modal-tx');
  },

  setType(type) {
    document.getElementById('btn-income').classList.toggle('active', type === 'income');
    document.getElementById('btn-expense').classList.toggle('active', type === 'expense');
    document.getElementById('tx-type-hidden').value = type;
    this.populateCategorySelect(type);
  },

  onCategoryChange(val) {
    const indicator = document.getElementById('smart-cat-indicator');
    if (!val) {
      if (indicator) indicator.classList.remove('show');
      return;
    }
    const cat = Store.get('categories').find(c => String(c.id) === String(val)); // CORRIGIDO: id

    if (!cat?.smart) {
      if (indicator) indicator.classList.remove('show');
      return;
    }

    const sd = cat.smart_defaults || {}; // CORRIGIDO: smart_defaults (snake_case do banco)
    if (sd.description) document.getElementById('tx-description').value = sd.description;
    if (sd.amount)      document.getElementById('tx-amount').value      = sd.amount;
    if (sd.note)        document.getElementById('tx-note').value        = sd.note;
    if (cat.type)       this.setTypeWithoutResetCategory(cat.type);

    if (indicator) {
      indicator.classList.add('show');
      const nameEl = document.getElementById('smart-cat-name');
      if (nameEl) nameEl.textContent = cat.icon + ' ' + cat.name;
    }
  },

  setTypeWithoutResetCategory(type) {
    document.getElementById('btn-income').classList.toggle('active', type === 'income');
    document.getElementById('btn-expense').classList.toggle('active', type === 'expense');
    document.getElementById('tx-type-hidden').value = type;
  },

  populateCategorySelect(type) {
    const sel  = Store.get('categories');
    const t    = type || document.getElementById('tx-type-hidden')?.value || 'expense';
    const normal = sel.filter(c => !c.smart && (c.type === t));
    const smart  = sel.filter(c =>  c.smart && (c.type === t));
    const catSel = document.getElementById('tx-category');
    catSel.innerHTML =
      '<option value="">Sem categoria</option>' +
      normal.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('') + // CORRIGIDO: id
      (smart.length ? `<option disabled class="tx-select-divider">── Personalizadas ──</option>` +
        smart.map(c => `<option value="${c.id}">${c.icon} ${c.name} ⚡</option>`).join('') : ''); // CORRIGIDO: id
  },

  async save(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const body = {
      description: document.getElementById('tx-description').value,
      amount:      document.getElementById('tx-amount').value,
      type:        document.getElementById('tx-type-hidden').value,
      categoryId:  document.getElementById('tx-category').value || null,
      date:        document.getElementById('tx-date').value,
      note:        document.getElementById('tx-note').value
    };
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (this.editingId) {
        await API.updateTransaction(this.editingId, body);
        Utils.toast('Transação atualizada!', 'success');
      } else {
        await API.createTransaction(body);
        Utils.toast('Transação criada!', 'success');
      }
      Modal.close('modal-tx');
      await this.load();
      Dashboard.refresh();
    } catch (err) {
      Utils.toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  },

  async delete(id) {
    if (!Utils.confirm('Excluir esta transação?')) return;
    try {
      await API.deleteTransaction(id);
      Utils.toast('Transação excluída.', 'success');
      await this.load();
      Dashboard.refresh();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  },

  initFilters() {
    const s  = document.getElementById('tx-search');
    const ft = document.getElementById('tx-filter-type');
    const fc = document.getElementById('tx-filter-cat');
    if (s._init) return; s._init = true;
    s.addEventListener('input', () => this.applyFilter());
    ft.addEventListener('change', () => this.applyFilter());
    fc.addEventListener('change', () => this.applyFilter());
  },

  populateCategoryFilter() {
    const sel = document.getElementById('tx-filter-cat');
    const cats = Store.get('categories');
    sel.innerHTML = '<option value="">Todas as categorias</option>' +
      cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}${c.smart ? ' ⚡' : ''}</option>`).join(''); // CORRIGIDO: id
  }
};
