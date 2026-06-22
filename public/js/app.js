// ===== MODAL =====
const Modal = {
  open(id)  { document.getElementById(id)?.classList.add('open'); },
  close(id) { document.getElementById(id)?.classList.remove('open'); }
};

// ===== APP CONTROLLER =====
const App = {
  currentPage: 'dashboard',

  async init() {
    Auth.init();
    if (Auth.restore()) {
      await this.showApp();
    } else {
      this._hideLoader();
      this.showAuth();
    }
  },

  _hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.add('hide');
      setTimeout(() => loader.remove(), 400);
    }
  },

  showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
  },

  async showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    const user = Store.get('user');
    document.getElementById('user-name').textContent   = user.name;
    document.getElementById('user-email').textContent  = user.email;
    document.getElementById('user-avatar').textContent = Utils.initials(user.name);

    // Carrega tudo em paralelo
    const [,,, settings] = await Promise.all([
      Categories.load(),
      Transactions.load(),
      Goals.load(),
      API.getSettings().catch(() => ({}))
    ]);

    // Inicializa módulos que dependem de settings
    Settings.load(settings);
    Store.set('settings', settings);
    Theme.applyFromSettings(settings);
    Settings._updateSidebarBadge(!!settings.cltMode);

    this._hideLoader();
    this.initNav();
    this.initMonthPicker();
    this.initMobileMenu();
    this.navigate('dashboard');

    // Fluxo pós-login:
    // 1. Novo usuário (nunca viu onboarding) → mostra modal CLT após 1.8s
    // 2. Usuário antigo sem onboarding → também mostra o modal
    // 3. Usuário que já decidiu → verifica painel CLT normal
    if (!settings.cltOnboardingDone) {
      setTimeout(() => Onboarding.show(), 1800);
    } else if (settings.cltMode) {
      setTimeout(() => Payday.check(settings), 1500);
    }
  },

  initNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => {
        this.navigate(el.dataset.page);
        document.querySelector('.sidebar').classList.remove('open');
        document.getElementById('overlay-bg').classList.remove('show');
      });
    });
  },

  initMonthPicker() {
    document.getElementById('btn-prev-month').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => this.changeMonth(1));
    this.updateMonthLabel();
  },

  initMobileMenu() {
    const toggle  = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay-bg');
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  },

  async changeMonth(dir) {
    let m = Store.get('currentMonth') + dir;
    let y = Store.get('currentYear');
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    Store.set('currentMonth', m);
    Store.set('currentYear', y);
    this.updateMonthLabel();

    const tbody = document.getElementById('tx-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="loader"><div class="spinner"></div></div></td></tr>`;

    await Transactions.load();
    if (this.currentPage === 'transactions') Transactions.render();
    if (this.currentPage === 'dashboard')    Dashboard.refresh();
    if (this.currentPage === 'reports')      Reports.load();
  },

  updateMonthLabel() {
    document.getElementById('month-label').textContent =
      Utils.monthName(Store.get('currentMonth'), Store.get('currentYear'));
  },

  navigate(page) {
    this.currentPage = page;

    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const titles = {
      dashboard:    '📊 Dashboard',
      transactions: '💳 Transações',
      categories:   '🏷️ Categorias',
      goals:        '🎯 Metas',
      reports:      '📈 Relatórios',
      settings:     '⚙️ Configurações'
    };
    document.getElementById('topbar-title').textContent = titles[page] || page;

    window.scrollTo({ top: 0, behavior: 'instant' });

    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + page)?.classList.remove('hidden');

    if (page === 'dashboard')    Dashboard.refresh();
    if (page === 'transactions') this._loadTransactions();
    if (page === 'categories')   Categories.render();
    if (page === 'goals')        Goals.render();
    if (page === 'reports')      Reports.load();
    if (page === 'settings')     Settings.render();
  },

  _loadTransactions() {
    Transactions.initFilters();
    Transactions.populateCategoryFilter();
    Transactions.applyFilter();
  }
};

// ===== GLOBAL SETUP =====
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  document.getElementById('form-tx')?.addEventListener('submit',   e => Transactions.save(e));
  document.getElementById('form-cat')?.addEventListener('submit',  e => Categories.save(e));
  document.getElementById('form-goal')?.addEventListener('submit', e => Goals.save(e));

  document.getElementById('btn-income')?.addEventListener('click',  () => Transactions.setType('income'));
  document.getElementById('btn-expense')?.addEventListener('click', () => Transactions.setType('expense'));

  App.init();
});
