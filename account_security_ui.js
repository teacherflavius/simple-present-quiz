(function (root) {
  "use strict";

  const CARD_ID = "accountSecurityCard";
  const BUTTON_ID = "signOutEverywhereButton";
  const MESSAGE_ID = "accountSecurityMessage";

  function createElement(documentRef, tagName, className, text) {
    const element = documentRef.createElement(tagName);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function buildCard(documentRef) {
    const card = createElement(documentRef, "section", "card");
    card.id = CARD_ID;
    card.setAttribute("aria-labelledby", "accountSecurityTitle");

    const title = createElement(documentRef, "h2", "", "Segurança da conta");
    title.id = "accountSecurityTitle";
    const description = createElement(
      documentRef,
      "p",
      "privacy-copy",
      "O botão SAIR encerra apenas esta sessão. Use a opção abaixo se quiser encerrar as sessões em todos os dispositivos vinculados à sua conta."
    );
    const button = createElement(documentRef, "button", "privacy-danger", "SAIR DE TODOS OS DISPOSITIVOS");
    button.id = BUTTON_ID;
    button.type = "button";
    const message = createElement(documentRef, "div", "message", "");
    message.id = MESSAGE_ID;
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(button);
    card.appendChild(message);
    return card;
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.textContent = busy ? "ENCERRANDO SESSÕES..." : "SAIR DE TODOS OS DISPOSITIVOS";
  }

  async function signOutEverywhere(windowRef, documentRef) {
    const button = documentRef.getElementById(BUTTON_ID);
    const message = documentRef.getElementById(MESSAGE_ID);
    if (!button || !windowRef.Auth || typeof windowRef.Auth.getClient !== "function") return;

    const confirmed = windowRef.confirm(
      "Encerrar sua sessão neste navegador e também as sessões abertas nos outros dispositivos?"
    );
    if (!confirmed) return;

    setBusy(button, true);
    if (message) message.textContent = "";
    try {
      const client = windowRef.Auth.getClient();
      if (!client) throw new Error("Sessão de autenticação indisponível.");
      const response = await client.auth.signOut({ scope: "global" });
      if (response.error) throw response.error;
      windowRef.location.replace("/login/?logged_out=1&all_sessions=1");
    } catch (error) {
      if (message) {
        message.className = "message error";
        message.textContent = error && error.message
          ? error.message
          : "Não foi possível encerrar as sessões. Tente novamente.";
      }
      setBusy(button, false);
    }
  }

  function initialize(options) {
    const settings = options || {};
    const windowRef = settings.windowRef || root;
    const documentRef = settings.documentRef || (windowRef && windowRef.document);
    if (!windowRef || !documentRef || windowRef.location.pathname !== "/perfil/") return false;
    if (documentRef.getElementById(CARD_ID)) return true;

    const container = documentRef.querySelector(".container");
    if (!container) return false;
    const card = buildCard(documentRef);
    const privacyCard = documentRef.getElementById("privacyTitle");
    const privacySection = privacyCard && privacyCard.closest ? privacyCard.closest("section") : null;
    if (privacySection && privacySection.parentNode === container) container.insertBefore(card, privacySection);
    else container.appendChild(card);

    const button = documentRef.getElementById(BUTTON_ID);
    button.addEventListener("click", function () {
      signOutEverywhere(windowRef, documentRef);
    });
    return true;
  }

  const api = Object.freeze({ initialize: initialize, signOutEverywhere: signOutEverywhere });
  if (root) root.AccountSecurityUi = api;

  if (root && root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", function () { initialize(); }, { once: true });
    } else {
      initialize();
    }
  }
})(typeof window !== "undefined" ? window : null);
