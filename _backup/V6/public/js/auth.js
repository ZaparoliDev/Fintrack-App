// ===== AUTH MODULE =====
const Auth = {
  init() {
    document.getElementById('tab-login').addEventListener('click', () => this.showTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => this.showTab('register'));
    document.getElementById('form-login').addEventListener('submit', e => this.handleLogin(e));
    document.getElementById('form-register').addEventListener('submit', e => this.handleRegister(e));
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());
  },

  showTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  },

  async handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    btn.disabled = true; btn.textContent = 'Entrando...';
    try {
      const data = await API.login({ email, password });
      this.setSession(data);
      App.showApp();
    } catch (err) {
      Utils.toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    if (password.length < 6) return Utils.toast('Senha deve ter ao menos 6 caracteres.', 'error');
    btn.disabled = true; btn.textContent = 'Criando conta...';
    try {
      const data = await API.register({ name, email, password });
      this.setSession(data);
      App.showApp();
    } catch (err) {
      Utils.toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Criar conta';
    }
  },

  setSession({ token, user }) {
    localStorage.setItem('ft_token', token);
    localStorage.setItem('ft_user', JSON.stringify(user));
    Store.set('user', user);
  },

  logout() {
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_user');
    Store.set('user', null);
    App.showAuth();
  },

  restore() {
    const token = localStorage.getItem('ft_token');
    const user = JSON.parse(localStorage.getItem('ft_user') || 'null');
    if (token && user) { Store.set('user', user); return true; }
    return false;
  }
};
