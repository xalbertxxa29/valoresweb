document.addEventListener("DOMContentLoaded", () => {
  // --- ELEMENTOS DEL DOM ---
  const loginForm = document.getElementById("login-form");
  const loginBtn = document.getElementById("login-btn");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessageDiv = document.getElementById("error-message");

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
  const auth = firebase.auth();
  const db = firebase.firestore();

  // --- LÓGICA DEL FORMULARIO DE LOGIN ---
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    errorMessageDiv.style.display = 'none';

    if (!email || !password) {
      errorMessageDiv.textContent = "Por favor, completa todos los campos.";
      errorMessageDiv.style.display = 'block';
      return;
    }

    loginBtn.disabled = true;
    loadingOverlay.hidden = false;

    try {
      // 1. Autenticación inicial con Firebase Auth
      await firebase.auth().signInWithEmailAndPassword(email, password);
      
      // --- INICIO DE LA NUEVA VERIFICACIÓN DE ROL ---
      
      // 2. Extraer nombre de usuario y buscar en la colección 'usuarios' (case-insensitive)
      const username = email.split('@')[0];
      const userDocId = username.toUpperCase();
      const userDocRef = db.collection("usuarios").doc(userDocId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const userRole = userData.TIPO;
        const fullName = userData.NOMBRE;

        // 3. Verificar si el rol es 'SUPERVISOR GENERAL'
        if (userRole === 'SUPERVISOR GENERAL') {
          // Si es correcto, guardamos el nombre para usarlo en el dashboard y redirigimos
          sessionStorage.setItem('userName', fullName);
          window.location.href = "dashboard.html";
        } else {
          // Si el rol no es el correcto, cerramos sesión y mostramos el mensaje de mantenimiento
          await firebase.auth().signOut();
          errorMessageDiv.textContent = "La plataforma está en mantenimiento para su acceso.";
          errorMessageDiv.style.display = 'block';
        }
      } else {
        // Si el usuario no existe en la colección 'usuarios', no tiene rol asignado
        await firebase.auth().signOut();
        errorMessageDiv.textContent = "No tienes permisos para acceder a esta plataforma.";
        errorMessageDiv.style.display = 'block';
      }
      // --- FIN DE LA NUEVA VERIFICACIÓN DE ROL ---

    } catch (error) {
      let friendlyMessage = "Error de inicio de sesión. Inténtalo de nuevo.";
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
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
    this.querySelector('svg').style.stroke = type === "password" ? "currentColor" : "var(--color-primary)";
  });
});