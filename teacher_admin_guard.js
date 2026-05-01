(function () {
  async function waitForAuthResources() {
    for (let i = 0; i < 10; i++) {
      if (window.Auth && window.SUPABASE_CONFIG && Auth.isConfigured()) return true;
      await new Promise(function (resolve) { setTimeout(resolve, 150); });
    }
    return !!(window.Auth && window.SUPABASE_CONFIG && Auth.isConfigured());
  }

  async function guardTeacherAdminPage() {
    const status = document.getElementById("adminStatus");
    const resourcesReady = await waitForAuthResources();

    if (!resourcesReady) {
      if (status) status.textContent = "Não foi possível carregar a autenticação. Atualize a página ou limpe o cache do navegador.";
      document.body.classList.remove("auth-checking");
      return null;
    }

    if (!window.Auth || !Auth.requireTeacherAdmin) {
      if (status) status.textContent = "Não foi possível verificar as credenciais de professor.";
      document.body.classList.remove("auth-checking");
      return null;
    }

    const user = await Auth.requireTeacherAdmin(window.location.pathname + window.location.search);
    if (!user) return null;

    window.currentTeacherAdminUser = user;
    document.dispatchEvent(new CustomEvent("teacher-admin-ready", { detail: { user: user } }));
    return user;
  }

  window.TeacherAdminGuard = {
    waitForAuthResources: waitForAuthResources,
    guardTeacherAdminPage: guardTeacherAdminPage
  };
})();
