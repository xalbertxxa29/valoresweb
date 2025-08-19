document.addEventListener("DOMContentLoaded", () => {
  // --- ELEMENTOS DEL DOM ---
  const loginForm = document.getElementById("login-form");
  const loginBtn = document.getElementById("login-btn");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessageDiv = document.getElementById("error-message"); // MEJORA: Elemento para mostrar errores

  if (!loginForm) return;

  // --- INICIALIZACIÓN DE FIREBASE ---
  if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
  } else {
    console.error("Firebase o su configuración no están disponibles.");
    errorMessageDiv.textContent = "Error crítico de configuración. Contacte al administrador.";
    errorMessageDiv.style.display = 'block';
    return;
  }

  // --- LÓGICA DEL FORMULARIO DE LOGIN ---
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Ocultar mensaje de error anterior
    errorMessageDiv.style.display = 'none';

    if (!email || !password) {
      errorMessageDiv.textContent = "Por favor, completa todos los campos.";
      errorMessageDiv.style.display = 'block';
      return;
    }

    loginBtn.disabled = true;
    loadingOverlay.hidden = false;

    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      window.location.href = "dashboard.html";
    } catch (error) {
      // MEJORA: Manejo de errores integrado en la UI, sin usar alert()
      let friendlyMessage = "Error de inicio de sesión. Inténtalo de nuevo.";
      // Firebase devuelve códigos de error que podemos traducir a mensajes amigables
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          friendlyMessage = "Correo electrónico o contraseña incorrectos.";
          break;
        case 'auth/invalid-email':
          friendlyMessage = "El formato del correo electrónico no es válido.";
          break;
      }
      errorMessageDiv.textContent = friendlyMessage;
      errorMessageDiv.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loadingOverlay.hidden = true;
    }
  });

  // --- LÓGICA PARA MOSTRAR/OCULTAR CONTRASEÑA ---
  const togglePassword = document.getElementById("togglePassword");
  togglePassword.addEventListener("click", function() {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    // Cambiar el ícono (opcional, pero mejora la UX)
    this.querySelector('svg').style.stroke = type === "password" ? "currentColor" : "var(--color-primary)";
  });
});