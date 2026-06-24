const DEBT_COLORS = ['#ef4444','#f97316','#eab308','#a855f7','#3b82f6','#06b6d4','#ec4899','#6b7280'];
const DEBT_ICONS  = ['💳','🏦','🚗','🏠','📱','🛍️','💊','📚','✈️','💰'];

const Debts = {
  editingId: null,
  selColor: DEBT_COLORS[0],
  selIcon:  DEBT_ICONS[0],

  async load() {
    try {
      const data = await API.getDebts();
      Store.set('debts', data);
    } catch(err) { Utils.toast('Erro ao carregar dívidas.','error'); }
  },

  render() {
    const container = document.getElementById('debts-list');
    if (!container) return;
    const debts = Store.get('debts');
    if (!debts.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">💳</div>
        <div class="empty-title">Nenhuma dívida cadastrada</div>
        <div class="empty-sub">Adicione seus cartões e parcelamentos para acompanhar no gráfico.</div>
      </div>`;
      return;
    }
    const active   = debts.filter(d=>d.active!==false);
    const inactive = debts.filter(d=>d.active===false);
    const totalMonthly = active.reduce((s,d)=>s+d.installmentAmount,0);
    container.innerHTML = `
      <div class="debt-summary-bar">
        <span>💳 ${active.length} dívida${active.length!==1?'s':''} ativa${active.length!==1?'s':''}</span>
        <span>Total mensal: <strong>${Utils.formatCurrency(totalMonthly)}</strong></span>
      </div>
      <div class="debts-grid">${active.map(d=>this._card(d)).join('')}</div>
      ${inactive.length ? `<div class="section-header mt-3"><span class="section-title text-muted">✓ Quitadas</span></div>
      <div class="debts-grid">${inactive.map(d=>this._card(d)).join('')}</div>` : ''}
    `;
  },

  _card(d) {
    const paid = d.paidInstallments||0;
    const total = d.totalInstallments;
    const pct  = Utils.pct(paid, total);
    const remaining = total - paid;
    const done = pct>=100 || d.active===false;
    return `<div class="debt-card${done?' done':''}">
      <div class="debt-card-header">
        <div class="flex gap-2" style="align-items:center">
          <div class="debt-icon" style="background:${d.color}22">${d.icon}</div>
          <div>
            <div class="debt-name">${d.name}${done?'<span class="smart-badge" style="background:var(--green-dim);color:var(--green)">QUITADA</span>':''}</div>
            <div class="debt-parcela">${Utils.formatCurrency(d.installmentAmount)}/mês · ${remaining} parcela${remaining!==1?'s':''} restante${remaining!==1?'s':''}</div>
          </div>
        </div>
        <div class="flex gap-2">
          ${!done?`<button class="icon-btn" onclick="Debts.payInstallment('${d._id}')" title="Registrar parcela paga">✓</button>`:''}
          <button class="icon-btn" onclick="Debts.openEdit('${d._id}')" title="Editar">✏️</button>
          <button class="icon-btn danger" onclick="Debts.delete('${d._id}')" title="Excluir">🗑️</button>
        </div>
      </div>
      <div class="goal-progress-bar" style="margin:10px 0 6px">
        <div class="goal-progress-fill" style="width:${pct}%;background:${done?'var(--green)':'linear-gradient(90deg,'+d.color+','+d.color+'99)'}"></div>
      </div>
      <div class="goal-amounts">
        <span style="font-size:0.78rem;color:var(--text-muted)">${paid}/${total} parcelas</span>
        <span class="goal-pct" style="color:${d.color}">${pct}%</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted)">${Utils.formatCurrency(d.totalAmount||d.installmentAmount*total)}</span>
      </div>
    </div>`;
  },

  async payInstallment(id) {
    const debt = Store.get('debts').find(d=>d._id===id);
    if (!debt) return;
    const newPaid = (debt.paidInstallments||0)+1;
    const done    = newPaid >= debt.totalInstallments;
    try {
      await API.updateDebt(id, { paidInstallments:newPaid, active:!done });
      // Lança transação automaticamente
      const cats = Store.get('categories');
      const cat  = cats.find(c=>c.type==='expense'&&(c.name.toLowerCase().includes('cart')||c.name.toLowerCase().includes('outros')));
      await API.createTransaction({
        description: `Parcela ${newPaid}/${debt.totalInstallments} — ${debt.name}`,
        amount:      debt.installmentAmount,
        type:        'expense',
        categoryId:  debt.categoryId || cat?._id || null,
        date:        new Date().toISOString().slice(0,10),
        note:        'Registrado automaticamente via Dívidas'
      });
      Utils.toast(done ? `${debt.name} quitada! 🎉` : `Parcela ${newPaid}/${debt.totalInstallments} registrada!`, 'success');
      await this.load();
      this.render();
      await Transactions.load();
      Dashboard.refresh();
    } catch(err) { Utils.toast(err.message,'error'); }
  },

  openCreate() {
    this.editingId=null;
    this.selColor=DEBT_COLORS[0]; this.selIcon=DEBT_ICONS[0];
    document.getElementById('modal-debt-title').textContent='Nova Dívida';
    document.getElementById('form-debt').reset();
    this._renderPickers();
    Modal.open('modal-debt');
  },
  openEdit(id) {
    const d=Store.get('debts').find(x=>x._id===id);
    if(!d) return;
    this.editingId=id;
    this.selColor=d.color||DEBT_COLORS[0]; this.selIcon=d.icon||DEBT_ICONS[0];
    document.getElementById('modal-debt-title').textContent='Editar Dívida';
    document.getElementById('debt-name').value=d.name;
    document.getElementById('debt-installment').value=d.installmentAmount;
    document.getElementById('debt-total-inst').value=d.totalInstallments;
    document.getElementById('debt-paid-inst').value=d.paidInstallments||0;
    document.getElementById('debt-start').value=Utils.formatDateInput(d.startDate);
    this._renderPickers();
    Modal.open('modal-debt');
  },
  _renderPickers() {
    document.getElementById('debt-color-picker').innerHTML =
      DEBT_COLORS.map(c=>`<div class="color-dot${c===this.selColor?' selected':''}" style="background:${c}" onclick="Debts.selColor='${c}';Debts._renderPickers()"></div>`).join('');
    document.getElementById('debt-icon-picker').innerHTML =
      DEBT_ICONS.map(i=>`<button type="button" class="icon-btn${i===this.selIcon?' active':''}" style="${i===this.selIcon?'background:var(--blue-dim);color:var(--blue)':''}" onclick="Debts.selIcon='${i}';Debts._renderPickers()">${i}</button>`).join('');
  },
  async save(e) {
    e.preventDefault();
    const btn=e.target.querySelector('button[type=submit]');
    const body={
      name:         document.getElementById('debt-name').value,
      installmentAmount: parseFloat(document.getElementById('debt-installment').value),
      totalInstallments: parseInt(document.getElementById('debt-total-inst').value),
      paidInstallments:  parseInt(document.getElementById('debt-paid-inst').value)||0,
      startDate:    document.getElementById('debt-start').value||null,
      icon:this.selIcon, color:this.selColor
    };
    body.totalAmount = body.installmentAmount * body.totalInstallments;
    body.active = body.paidInstallments < body.totalInstallments;
    btn.disabled=true; btn.textContent='Salvando...';
    try {
      if (this.editingId) { await API.updateDebt(this.editingId,body); Utils.toast('Dívida atualizada!','success'); }
      else                { await API.createDebt(body);                 Utils.toast('Dívida adicionada!','success'); }
      Modal.close('modal-debt');
      await this.load(); this.render();
    } catch(err) { Utils.toast(err.message,'error');
    } finally { btn.disabled=false; btn.textContent='Salvar'; }
  },
  async delete(id) {
    if (!Utils.confirm('Excluir esta dívida?')) return;
    try { await API.deleteDebt(id); Utils.toast('Dívida excluída.','success'); await this.load(); this.render(); }
    catch(err) { Utils.toast(err.message,'error'); }
  }
};
