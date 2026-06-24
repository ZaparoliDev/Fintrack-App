const Payday = {
  type: null,
  async check(settings) {
    if (!settings.cltMode) return;
    const today    = new Date();
    const day      = today.getDate();
    const month    = today.getMonth()+1;
    const year     = today.getFullYear();
    const monthKey = `${year}-${month}`;
    const todayKey = `${monthKey}-${day}`;

    // Resolve o dia real (fixo ou Nº dia útil)
    const salaryDay = settings.salaryDayType === 'workday'
      ? Utils.getNthWorkday(year, month, settings.salaryDay||5)
      : (settings.salaryDay||5);
    const valeDay = settings.valeDayType === 'workday'
      ? Utils.getNthWorkday(year, month, settings.valeDay||20)
      : (settings.valeDay||20);

    if (day === salaryDay) {
      this.type = 'salary';
      if (settings.salaryRegisteredMonth === monthKey) return;
      if (settings.salaryDismissedAt     === todayKey)  return;
      this._show('salary', settings.lastSalary);
    } else if (day === valeDay) {
      this.type = 'vale';
      if (settings.valeRegisteredMonth === monthKey) return;
      if (settings.valeDismissedAt     === todayKey)  return;
      this._show('vale', settings.lastVale);
    }
  },
  _show(type, lastValue) {
    const isSalary = type==='salary';
    document.getElementById('payday-emoji').textContent = isSalary?'💰':'💵';
    document.getElementById('payday-title').textContent = isSalary?'O Salário já caiu, chefe?':'O Vale já caiu, chefe?';
    document.getElementById('payday-sub').textContent   = isSalary
      ? 'Registre o valor do seu salário para manter o controle em dia.'
      : 'Registre o valor do seu vale e deixe as contas certinhas.';
    const input = document.getElementById('payday-amount');
    input.value = lastValue||'';
    document.getElementById('payday-overlay').classList.add('open');
    document.getElementById('payday-btn-register').onclick = () => this._register();
    document.getElementById('payday-btn-skip').onclick     = () => this._dismiss();
    setTimeout(() => input.focus(), 350);
  },
  async _register() {
    const amountEl = document.getElementById('payday-amount');
    const amount   = parseFloat(amountEl.value);
    if (!amount||amount<=0) { amountEl.style.borderColor='var(--red)'; amountEl.focus(); setTimeout(()=>amountEl.style.borderColor='',1200); return; }
    const btn = document.getElementById('payday-btn-register');
    btn.disabled=true; btn.textContent='Registrando...';
    try {
      const isSalary = this.type==='salary';
      const today    = new Date();
      const monthKey = `${today.getFullYear()}-${today.getMonth()+1}`;
      const cats     = Store.get('categories');
      const cat      = cats.find(c=>c.type==='income'&&c.name.toLowerCase().includes(isSalary?'sal':'free'))||cats.find(c=>c.type==='income');
      await API.createTransaction({ description:isSalary?'Salário':'Vale', amount, type:'income', categoryId:cat?._id||null, date:today.toISOString().slice(0,10), note:`CLT Premium — ${isSalary?'Salário':'Vale'}` });
      const upd = isSalary ? { lastSalary:amount, salaryRegisteredMonth:monthKey } : { lastVale:amount, valeRegisteredMonth:monthKey };
      const saved = await API.saveSettings(upd);
      Settings._data = { ...Settings._data, ...saved };
      Store.set('settings', Settings._data);
      await Transactions.load();
      Dashboard.refresh();
      Utils.toast(`${isSalary?'Salário':'Vale'} de ${Utils.formatCurrency(amount)} registrado! 🎉`,'success');
      this._close();
    } catch(err) { Utils.toast(err.message,'error'); btn.disabled=false; btn.textContent='✓ Registrar receita'; }
  },
  async _dismiss() {
    const today    = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
    const isSalary = this.type==='salary';
    API.saveSettings(isSalary?{ salaryDismissedAt:todayKey }:{ valeDismissedAt:todayKey }).catch(()=>{});
    this._close();
  },
  _close() { document.getElementById('payday-overlay').classList.remove('open'); }
};
