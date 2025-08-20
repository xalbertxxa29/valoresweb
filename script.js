document.addEventListener("DOMContentLoaded", () => {
  // --- ELEMENTOS DEL DOM ---
  const loginForm = document.getElementById("login-form");
  const loginBtn = document.getElementById("login-btn");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessageDiv = document.getElementById("error-message");
  const errorModal = document.getElementById("error-modal"); // Asumiendo que el modal tiene este ID
  const errorCloseBtn = document.getElementById("error-close-btn"); // Asumiendo que el botón de cierre tiene este ID

  if (!loginForm) return;

  // --- INICIALIZACIÓN DE FIREBASE ---
  if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
  } else {
    console.error("Firebase o su configuración no están disponibles.");
    showError("Error crítico de configuración. Contacte al administrador.");
    return;
  }
  const auth = firebase.auth();

  // --- FUNCIONES DEL MODAL (MÉTODO UNIFICADO) ---
  function showError(message) {
      if (errorMessageDiv && errorModal) {
          errorMessageDiv.textContent = message;
          errorModal.classList.add('visible'); // Muestra el modal añadiendo la clase
      }
  }

  function closeModal() {
      if (errorModal) {
          errorModal.classList.remove('visible'); // Oculta el modal quitando la clase
      }
  }

  // --- LÓGICA DEL FORMULARIO DE LOGIN ---
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    closeModal(); // Ocultar mensaje de error anterior

    if (!email || !password) {
      showError("Por favor, completa todos los campos.");
      return;
    }

    loginBtn.disabled = true;
    loadingOverlay.hidden = false;

    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = "dashboard.html";
    } catch (error) {
      let friendlyMessage = "Error de inicio de sesión. Inténtalo de nuevo.";
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': // Código más reciente de Firebase
          friendlyMessage = "Correo electrónico o contraseña incorrectos.";
          break;
        case 'auth/invalid-email':
          friendlyMessage = "El formato del correo electrónico no es válido.";
          break;
      }
      showError(friendlyMessage);
    } finally {
      loginBtn.disabled = false;
      loadingOverlay.hidden = true;
    }
  });

  // --- EVENT LISTENERS ADICIONALES ---
  // Para cerrar el modal
  if (errorCloseBtn) {
    errorCloseBtn.addEventListener('click', closeModal);
  }
  if (errorModal) {
    errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            closeModal();
        }
    });
  }

  // Para mostrar/ocultar contraseña
  const togglePassword = document.getElementById("togglePassword");
  if (togglePassword) {
    togglePassword.addEventListener("click", function() {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
      // Cambiar el ícono (opcional, pero mejora la UX)
      this.querySelector('svg').style.stroke = type === "password" ? "currentColor" : "var(--color-primary)";
    });
  }
});