// ===== PAYDAY MODULE =====
// Dia 5 = Salário | Dia 20 = Vale
const Payday = {
  type: null,       // 'salary' | 'vale'
  settings: null,

  SALARY_CAT_NAME: 'Salário',
  VALE_CAT_NAME:   'Freelance', // fallback, usa a categoria de receita mais adequada

  async check(settings) {
    this.settings = settings;
    const today = new Date();
    const day   = today.getDate();
    const monthKey = `${today.getFullYear()}-${today.getMonth() + 1}`; // ex: "2026-6"
    const todayKey = `${monthKey}-${day}`;                             // ex: "2026-6-5"

    if (day === 5) {
      this.type = 'salary';
      // Já registrou este mês?
      if (settings.salaryRegisteredMonth === monthKey) return;
      // Já dispensou hoje?
      if (settings.salaryDismissedAt === todayKey) return;
      this._show('salary', settings.lastSalary);

    } else if (day === 20) {
      this.type = 'vale';
      if (settings.valeRegisteredMonth === monthKey) return;
      if (settings.valeDismissedAt === todayKey) return;
      this._show('vale', settings.lastVale);
    }
  },

  _show(type, lastValue) {
    const isSalary = type === 'salary';

    document.getElementById('payday-emoji').textContent  = isSalary ? '💰' : '💵';
    document.getElementById('payday-title').textContent  = isSalary
      ? 'O Salário já caiu, chefe?' : 'O Vale já caiu, chefe?';
    document.getElementById('payday-sub').textContent    = isSalary
      ? 'Registre o valor do seu salário para manter o controle em dia.'
      : 'Registre o valor do seu vale agora e deixe as contas certinhas.';
    document.getElementById('payday-hint').textContent   =
      'O valor será lançado como receita automaticamente.';

    if (lastValue) {
      document.getElementById('payday-amount').value = lastValue;
    }

    document.getElementById('payday-overlay').classList.add('open');

    document.getElementById('payday-btn-register').onclick = () => this._register();
    document.getElementById('payday-btn-skip').onclick     = () => this._dismiss();
  },

  async _register() {
    const amountEl = document.getElementById('payday-amount');
    const amount   = parseFloat(amountEl.value);
    if (!amount || amount <= 0) {
      amountEl.focus();
      amountEl.style.borderColor = 'var(--red)';
      setTimeout(() => amountEl.style.borderColor = '', 1200);
      return;
    }

    const btn = document.getElementById('payday-btn-register');
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
      const isSalary = this.type === 'salary';
      const today    = new Date();
      const monthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;

      // Achar categoria de receita adequada
      const cats   = Store.get('categories');
      const catName = isSalary ? 'Salário' : 'Freelance';
      const cat    = cats.find(c => c.type === 'income' && c.name.toLowerCase().includes(isSalary ? 'sal' : 'free'))
                  || cats.find(c => c.type === 'income');

      // Criar transação
      await API.createTransaction({
        description: isSalary ? 'Salário' : 'Vale',
        amount,
        type: 'income',
        categoryId: cat?._id || null,
        date: today.toISOString().slice(0, 10),
        note: `Registrado automaticamente via painel ${isSalary ? 'Salário' : 'Vale'}`
      });

      // Salvar no banco: último valor + mês registrado
      const settingsUpdate = isSalary
        ? { lastSalary: amount, salaryRegisteredMonth: monthKey }
        : { lastVale:   amount, valeRegisteredMonth:   monthKey };
      await API.saveSettings(settingsUpdate);

      // Recarregar transações e dashboard
      await Transactions.load();
      Dashboard.refresh();

      Utils.toast(`${isSalary ? 'Salário' : 'Vale'} de ${Utils.formatCurrency(amount)} registrado! 🎉`, 'success');
      this._close();

    } catch (err) {
      Utils.toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '✓ Registrar receita';
    }
  },

  async _dismiss() {
    const today    = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const isSalary = this.type === 'salary';

    // Marca "dispensado hoje" — reaparece amanhã
    const update = isSalary
      ? { salaryDismissedAt: todayKey }
      : { valeDismissedAt:   todayKey };
    API.saveSettings(update).catch(() => {});

    this._close();
  },

  _close() {
    document.getElementById('payday-overlay').classList.remove('open');
  }
};
