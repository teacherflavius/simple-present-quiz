async function shouldHideEnrollmentCard() {
  if (!window.Auth || !Auth.isConfigured()) return false;

  const session = await Auth.getSession();
  const user = session && session.user ? session.user : await Auth.getUser();
  if (!user) return false;

  const metadata = user.user_metadata || {};
  if (metadata.enrolled === true || metadata.enrolled === "true" || metadata.enrollment_code) return true;

  const profile = await Auth.getProfile();
  return !!(profile && (profile.enrolled === true || profile.enrolled === "true" || profile.enrollment_code));
}

async function updateEnrollmentCardVisibility() {
  const enrollmentCard = document.getElementById("enrollmentCard");
  if (!enrollmentCard) return;

  try {
    const hideCard = await shouldHideEnrollmentCard();
    enrollmentCard.classList.toggle("hidden", hideCard);
  } catch (error) {
    console.warn("Não foi possível verificar a matrícula do usuário:", error);
    enrollmentCard.classList.remove("hidden");
  }
}

document.addEventListener("DOMContentLoaded", updateEnrollmentCardVisibility);

if (window.Auth && Auth.isConfigured()) {
  const client = Auth.getClient();
  if (client && client.auth && client.auth.onAuthStateChange) {
    client.auth.onAuthStateChange(function () {
      updateEnrollmentCardVisibility();
    });
  }
}
