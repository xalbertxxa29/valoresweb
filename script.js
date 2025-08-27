document.addEventListener("DOMContentLoaded", () => {
  // Prefill Remember Me
  try {
    const savedEmail = localStorage.getItem('rememberEmail');
    const rememberCb = document.getElementById("remember");
    if (savedEmail && usernameInput) {
      usernameInput.value = savedEmail;
      if (rememberCb) rememberCb.checked = true;
    }
  } catch(_) {}

  // A11y live region for spinner
  const live = document.getElementById("live-status");
  function announce(msg){
    if (live){ live.textContent = ""; setTimeout(()=> live.textContent = msg, 10); }
  }

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

  async function writeAudit(event, details){ try{ await db.collection('logs').add({ event, details, at: firebase.firestore.FieldValue.serverTimestamp() }); }catch(e){ console.warn('No se pudo registrar auditoría', e);} }

  // --- LÓGICA DEL FORMULARIO DE LOGIN ---
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    errorMessageDiv.style.display = 'none';

    if (!email || !password) {
      if (!email) { usernameInput.setAttribute('aria-invalid','true'); usernameInput.focus(); }
      if (!password && email){ passwordInput.setAttribute('aria-invalid','true'); passwordInput.focus(); }
      errorMessageDiv.textContent = "Por favor, completa todos los campos.";
      errorMessageDiv.style.display = 'block';
      return;
    }

    loginBtn.disabled = true;
    loadingOverlay.hidden = false; try{announce('Procesando inicio de sesión');}catch(_){}

    try {
      // 1. Autenticación inicial con Firebase Auth
      await firebase.auth().signInWithEmailAndPassword(email, password);
      try{ const rememberCb = document.getElementById('remember'); if(rememberCb && rememberCb.checked){ localStorage.setItem('rememberEmail', email); } else { localStorage.removeItem('rememberEmail'); } }catch(_){}
      
      // --- VERIFICACIÓN DE ROL ACTUALIZADA ---
      
      // 2. Extraer nombre de usuario y buscar en la colección 'usuarios'
      const username = email.split('@')[0];
      const userDocId = username.toUpperCase();
      const userDocRef = db.collection("usuarios").doc(userDocId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const userRole = userData.TIPO;
        const fullName = userData.NOMBRE;

        // 3. Verificar el rol y redirigir a la página correspondiente
        if (userRole === 'SUPERVISOR GENERAL') {
          sessionStorage.setItem('userName', fullName);
          await writeAudit('login_success', { email });
          window.location.href = "dashboard.html";
        } else if (userRole === 'COMERCIAL') { // <-- ESTE ES EL CAMBIO IMPORTANTE
          sessionStorage.setItem('userName', fullName);
          await writeAudit('login_success_comercial', { email });
          window.location.href = "comercial.html";
        } else {
          // Si el rol no es ninguno de los permitidos, se niega el acceso
          await writeAudit('login_denied_role', { email, role: userRole });
          await firebase.auth().signOut();
          errorMessageDiv.textContent = "No tienes permisos para acceder a esta plataforma.";
          errorMessageDiv.style.display = 'block';
        }
      } else {
        // Si el usuario no existe en la colección 'usuarios'
        await writeAudit('login_user_not_found_in_usuarios', { email });
        await firebase.auth().signOut();
        errorMessageDiv.textContent = "No tienes permisos para acceder a esta plataforma.";
        errorMessageDiv.style.display = 'block';
      }
      // --- FIN DE LA VERIFICACIÓN DE ROL ---

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
      loadingOverlay.hidden = true; try{announce('Listo');}catch(_){}
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