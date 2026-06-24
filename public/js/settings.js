const Settings = {
  _data: {},
  load(data) { this._data = data||{}; },
  render() {
    const s=this._data, user=Store.get('user');
    const el=id=>document.getElementById(id);
    if(el('settings-username'))  el('settings-username').textContent  = user?.name||'—';
    if(el('settings-useremail')) el('settings-useremail').textContent = user?.email||'—';
    if(el('settings-avatar'))    el('settings-avatar').textContent    = Utils.initials(user?.name||'?');
    this._updateThemeToggle();
    const active = !!s.cltMode;
    this._setCltUI(active);
    if (active) {
      if(el('clt-salary-day'))    el('clt-salary-day').value    = s.salaryDay||5;
      if(el('clt-vale-day'))      el('clt-vale-day').value      = s.valeDay||20;
      if(el('clt-salary-type'))   el('clt-salary-type').value   = s.salaryDayType||'fixed';
      if(el('clt-vale-type'))     el('clt-vale-type').value     = s.valeDayType||'fixed';
      this._updateDayTypeUI('salary', s.salaryDayType||'fixed');
      this._updateDayTypeUI('vale',   s.valeDayType||'fixed');
    }
  },
  _setCltUI(active) {
    const el=id=>document.getElementById(id);
    el('clt-master-toggle')?.classList.toggle('on', active);
    el('clt-days-section')?.classList.toggle('show', active);
    if(el('clt-inactive-msg')) el('clt-inactive-msg').style.display = active?'none':'block';
    this._updateSidebarBadge(active);
  },
  _updateSidebarBadge(active) {
    document.getElementById('clt-sidebar-badge')?.classList.toggle('hidden', !active);
  },
  _updateThemeToggle() {
    // Sincroniza AMBOS os toggles de tema
    const isDark = Theme.current === 'dark';
    document.getElementById('theme-toggle-settings')?.classList.toggle('on', isDark);
    document.getElementById('btn-theme').textContent = isDark ? '☀️' : '🌙';
  },
  _updateDayTypeUI(which, type) {
    const hint = document.getElementById(`clt-${which}-day-hint`);
    if (!hint) return;
    if (type === 'workday') {
      hint.textContent = `Ex: "5" = 5º dia útil do mês`;
    } else {
      hint.textContent = `Dia fixo do mês (entre 1 e 28)`;
    }
  },
  toggleTheme() {
    Theme.toggle();
    this._updateThemeToggle();
  },
  async toggleClt(forceOff=false) {
    const next = forceOff ? false : !this._data.cltMode;
    const salDay = parseInt(document.getElementById('clt-salary-day')?.value)||5;
    const valDay = parseInt(document.getElementById('clt-vale-day')?.value)||20;
    const salType = document.getElementById('clt-salary-type')?.value||'fixed';
    const valType = document.getElementById('clt-vale-type')?.value||'fixed';
    try {
      const saved = await API.saveSettings({ cltMode:next, salaryDay:salDay, valeDay:valDay, salaryDayType:salType, valeDayType:valType });
      this._data = { ...this._data, ...saved };
      Store.set('settings', this._data);
      this._setCltUI(next);
      Utils.toast(next?'👔 Modo CLT Premium ativado!':'Modo CLT desativado.', next?'success':'info');
    } catch(err) { Utils.toast(err.message,'error'); }
  },
  onDayTypeChange(which, type) {
    this._updateDayTypeUI(which, type);
  },
  async saveCltDays() {
    const salDay  = parseInt(document.getElementById('clt-salary-day')?.value);
    const valDay  = parseInt(document.getElementById('clt-vale-day')?.value);
    const salType = document.getElementById('clt-salary-type')?.value||'fixed';
    const valType = document.getElementById('clt-vale-type')?.value||'fixed';
    if (!salDay||salDay<1||salDay>28) { Utils.toast('Dia do salário deve ser entre 1 e 28.','error'); return; }
    if (!valDay||valDay<1||valDay>28) { Utils.toast('Dia do vale deve ser entre 1 e 28.','error'); return; }
    if (salDay===valDay&&salType===valType) { Utils.toast('Os dias do salário e vale não podem ser iguais.','error'); return; }
    try {
      const saved = await API.saveSettings({ salaryDay:salDay, valeDay:valDay, salaryDayType:salType, valeDayType:valType });
      this._data = { ...this._data, ...saved };
      Store.set('settings', this._data);
      const salLabel = salType==='workday' ? `${salDay}º dia útil` : `dia ${salDay}`;
      const valLabel = valType==='workday' ? `${valDay}º dia útil` : `dia ${valDay}`;
      Utils.toast(`Salário: ${salLabel} · Vale: ${valLabel} ✓`,'success');
    } catch(err) { Utils.toast(err.message,'error'); }
  }
};
