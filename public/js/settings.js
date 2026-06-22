// ===== SETTINGS MODULE =====
const Settings = {
  _data: {},

  load(data) {
    this._data = data || {};
  },

  render() {
    const s    = this._data;
    const user = Store.get('user');

    // Perfil
    const nameEl   = document.getElementById('settings-username');
    const emailEl  = document.getElementById('settings-useremail');
    const avatarEl = document.getElementById('settings-avatar');
    if (nameEl)   nameEl.textContent  = user?.name  || '—';
    if (emailEl)  emailEl.textContent = user?.email || '—';
    if (avatarEl) avatarEl.textContent = Utils.initials(user?.name || '?');

    // Tema
    this._updateThemeToggle();

    // CLT
    const isActive = !!s.cltMode;
    this._setCltUI(isActive);

    if (isActive) {
      const salEl = document.getElementById('clt-salary-day');
      const valEl = document.getElementById('clt-vale-day');
      if (salEl) salEl.value = s.salaryDay || 5;
      if (valEl) valEl.value = s.valeDay   || 20;
    }
  },

  _setCltUI(active) {
    const toggle   = document.getElementById('clt-master-toggle');
    const section  = document.getElementById('clt-days-section');
    const inactive = document.getElementById('clt-inactive-msg');

    if (toggle)   toggle.classList.toggle('on', active);
    if (section)  section.classList.toggle('show', active);
    if (inactive) inactive.style.display = active ? 'none' : 'block';
    this._updateSidebarBadge(active);
  },

  _updateSidebarBadge(active) {
    const badge = document.getElementById('clt-sidebar-badge');
    if (!badge) return;
    badge.classList.toggle('hidden', !active);
  },

  _updateThemeToggle() {
    const toggle = document.getElementById('theme-toggle-settings');
    if (toggle) toggle.classList.toggle('on', Theme.current === 'dark');
  },

  toggleTheme() {
    Theme.toggle();
    this._updateThemeToggle();
  },

  async toggleClt(forceOff = false) {
    const current = !!this._data.cltMode;
    const next    = forceOff ? false : !current;

    const salDay = parseInt(document.getElementById('clt-salary-day')?.value) || 5;
    const valDay = parseInt(document.getElementById('clt-vale-day')?.value)   || 20;

    const update = {
      cltMode:   next,
      salaryDay: next ? salDay : (this._data.salaryDay || 5),
      valeDay:   next ? valDay : (this._data.valeDay   || 20)
    };

    try {
      const saved = await API.saveSettings(update);
      this._data = { ...this._data, ...saved };
      Store.set('settings', this._data);
      this._setCltUI(next);
      Utils.toast(
        next ? '👔 Modo CLT Premium ativado!' : 'Modo CLT desativado.',
        next ? 'success' : 'info'
      );
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  },

  async saveCltDays() {
    const salDay = parseInt(document.getElementById('clt-salary-day')?.value);
    const valDay = parseInt(document.getElementById('clt-vale-day')?.value);

    if (!salDay || salDay < 1 || salDay > 28) {
      Utils.toast('Dia do salário deve ser entre 1 e 28.', 'error'); return;
    }
    if (!valDay || valDay < 1 || valDay > 28) {
      Utils.toast('Dia do vale deve ser entre 1 e 28.', 'error'); return;
    }
    if (salDay === valDay) {
      Utils.toast('Os dias do salário e vale não podem ser iguais.', 'error'); return;
    }

    try {
      const saved = await API.saveSettings({ salaryDay: salDay, valeDay: valDay });
      this._data = { ...this._data, ...saved };
      Store.set('settings', this._data);
      Utils.toast(`Dias salvos: Salário dia ${salDay}, Vale dia ${valDay} ✓`, 'success');
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }
};
