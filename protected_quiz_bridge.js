(function () {
  async function getLoggedStudent() {
    if (!window.Auth || !Auth.requireAuth) return null;
    const user = await Auth.requireAuth();
    if (!user) return null;
    const profile = await Auth.getProfile();
    return {
      name: profile && profile.name ? profile.name : "Aluno",
      email: profile && profile.email ? profile.email : user.email
    };
  }

  function install() {
    if (!window.QuizCore || !QuizCore.renderQuiz || QuizCore.__protectedBridgeInstalled) return;
    const originalRenderQuiz = QuizCore.renderQuiz;
    QuizCore.__protectedBridgeInstalled = true;

    QuizCore.renderQuiz = async function (config) {
      const student = await getLoggedStudent();
      if (!student) return;
      if (QuizCore.setCurrentStudent) QuizCore.setCurrentStudent(student);
      originalRenderQuiz(config);
    };
  }

  install();
})();
