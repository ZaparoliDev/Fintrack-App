// ===== THEME MODULE =====
const Theme = {
  current: 'dark',

  // Aplica antes do login, usando settings do banco quando disponível
  applyFromSettings(settings) {
    const saved = settings?.theme || localStorage.getItem('ft_theme') || 'dark';
    this.apply(saved, false);
  },

  apply(mode, save = true) {
    this.current = mode;
    if (mode === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = mode === 'light' ? '🌙' : '☀️';

    // Salva localmente imediato para próximo carregamento
    localStorage.setItem('ft_theme', mode);

    // Salva no banco se já estiver logado
    if (save && API.token()) {
      API.saveSettings({ theme: mode }).catch(() => {});
    }
  },

  toggle() {
    this.apply(this.current === 'dark' ? 'light' : 'dark');
  },

  init() {
    // Aplica antes mesmo do login usando localStorage
    const saved = localStorage.getItem('ft_theme') || 'dark';
    this.apply(saved, false);

    document.getElementById('btn-theme')?.addEventListener('click', () => this.toggle());
  }
};
