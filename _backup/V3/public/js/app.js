// ===== MODAL =====
const Modal = {
  open(id)  { document.getElementById(id).classList.add('open'); },
  close(id) { document.getElementById(id).classList.remove('open'); }
};

// ===== APP CONTROLLER =====
const App = {
  currentPage: 'dashboard',

  async init() {
    Auth.init();
    if (Auth.restore()) {
      await this.showApp();
    } else {
      this.showAuth();
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
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-avatar').textContent = Utils.initials(user.name);

    // Load base data
    await Categories.load();
    await Transactions.load();
    await Goals.load();

    this.initNav();
    this.initMonthPicker();
    this.initMobileMenu();
    this.navigate('dashboard');
  },

  initNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => {
        this.navigate(el.dataset.page);
        // Close mobile sidebar
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
    const toggle = document.getElementById('menu-toggle');
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

  changeMonth(dir) {
    let m = Store.get('currentMonth') + dir;
    let y = Store.get('currentYear');
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    Store.set('currentMonth', m);
    Store.set('currentYear', y);
    this.updateMonthLabel();
    Transactions.load().then(() => {
      if (this.currentPage === 'transactions') Transactions.render();
      if (this.currentPage === 'dashboard') Dashboard.refresh();
      if (this.currentPage === 'reports')   Reports.load();
    });
  },

  updateMonthLabel() {
    document.getElementById('month-label').textContent =
      Utils.monthName(Store.get('currentMonth'), Store.get('currentYear'));
  },

  navigate(page) {
    this.currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Update topbar title
    const titles = {
      dashboard:    '📊 Dashboard',
      transactions: '💳 Transações',
      categories:   '🏷️ Categorias',
      goals:        '🎯 Metas',
      reports:      '📈 Relatórios'
    };
    document.getElementById('topbar-title').textContent = titles[page] || page;

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + page).classList.remove('hidden');

    // Load page content
    if (page === 'dashboard')    this.loadDashboard();
    if (page === 'transactions') this.loadTransactions();
    if (page === 'categories')   Categories.render();
    if (page === 'goals')        Goals.render();
    if (page === 'reports')      Reports.load();
  },

  async loadDashboard() {
    await Dashboard.refresh();
  },

  loadTransactions() {
    Transactions.initFilters();
    Transactions.populateCategoryFilter();
    Transactions.applyFilter();
  }
};

// ===== GLOBAL MODAL SETUP =====
document.addEventListener('DOMContentLoaded', () => {
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Form submissions
  document.getElementById('form-tx')?.addEventListener('submit', e => Transactions.save(e));
  document.getElementById('form-cat')?.addEventListener('submit', e => Categories.save(e));
  document.getElementById('form-goal')?.addEventListener('submit', e => Goals.save(e));

  // Type toggle buttons
  document.getElementById('btn-income')?.addEventListener('click', () => Transactions.setType('income'));
  document.getElementById('btn-expense')?.addEventListener('click', () => Transactions.setType('expense'));

  App.init();
});
