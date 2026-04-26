(function () {
  const EXERCISE_TITLE = "Ordenar Frases - Simple Present";
  let saved = false;

  async function applyLoggedUser() {
    if (!window.Auth || !window.QuizCore) return;
    if (!Auth.isConfigured || !Auth.isConfigured()) return;

    const user = await Auth.requireAuth();
    if (!user) return;

    const profile = await Auth.getProfile();
    QuizCore.setCurrentStudent({
      name: profile && profile.name ? profile.name : "Aluno",
      email: profile && profile.email ? profile.email : user.email
    });

    const gate = document.getElementById("student-gate");
    if (gate) gate.remove();
  }

  function findScore() {
    const scoreParagraph = Array.from(document.querySelectorAll("p")).find(function (p) {
      return /Você acertou \d+ de \d+ frases\./.test(p.textContent.trim());
    });

    if (!scoreParagraph) return null;

    const match = scoreParagraph.textContent.match(/Você acertou (\d+) de (\d+) frases\./);
    if (!match) return null;

    return {
      score: Number(match[1]),
      total: Number(match[2]),
      anchor: scoreParagraph
    };
  }

  async function saveWhenFinished() {
    if (saved || !window.Auth || !Auth.saveActivityResult) return;

    const heading = Array.from(document.querySelectorAll("h2")).find(function (h2) {
      return h2.textContent.trim() === "Exercício concluído!";
    });
    if (!heading) return;

    const found = findScore();
    if (!found) return;

    saved = true;

    const result = await Auth.saveActivityResult({
      activity_type: "word_order",
      activity_title: EXERCISE_TITLE,
      score: found.score,
      total: found.total
    });

    const message = document.createElement("p");
    message.id = "supabase-profile-save-message";
    message.style.color = result ? "#6ee7b7" : "#fca5a5";
    message.style.fontSize = "13px";
    message.style.marginBottom = "18px";
    message.textContent = result
      ? "Resultado salvo no seu perfil."
      : "Não foi possível salvar no perfil. Verifique se você está logado.";

    if (!document.getElementById("supabase-profile-save-message")) {
      found.anchor.insertAdjacentElement("afterend", message);
    }
  }

  function start() {
    applyLoggedUser();
    const observer = new MutationObserver(function () {
      applyLoggedUser();
      saveWhenFinished();
    });
    observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
    saveWhenFinished();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
