// ===== ONBOARDING MODULE =====
const Onboarding = {
  show() {
    document.getElementById('onboarding-overlay')?.classList.add('open');
  },

  hide() {
    document.getElementById('onboarding-overlay')?.classList.remove('open');
  },

  async activate() {
    try {
      const saved = await API.saveSettings({
        cltMode:           true,
        salaryDay:         5,
        valeDay:           20,
        cltOnboardingDone: true
      });
      Settings._data = { ...Settings._data, ...saved };
      Store.set('settings', Settings._data);
      Settings._setCltUI(true);

      this.hide();

      // Mostra confirmação e abre settings para o usuário personalizar os dias
      Utils.toast('👔 Modo CLT Premium ativado! Configure seus dias em Configurações.', 'success');

      // Abre settings após 600ms para o usuário ver o resultado
      setTimeout(() => App.navigate('settings'), 600);

    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  },

  async skip() {
    try {
      await API.saveSettings({ cltOnboardingDone: true, cltMode: false });
      Settings._data = { ...Settings._data, cltOnboardingDone: true, cltMode: false };
      Store.set('settings', Settings._data);
    } catch { /* silencioso */ }

    this.hide();
    // Toast sutil mostrando onde ativar depois
    setTimeout(() => {
      Utils.toast('Modo CLT disponível em ⚙️ Configurações quando quiser.', 'info');
    }, 400);
  }
};
