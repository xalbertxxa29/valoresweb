/**
 * firebase-config.js
 * ==================
 * CONFIGURACIÓN DE FIREBASE
 * 
 * Los valores están hardcodeados aquí para que funcionen en navegador sin Node.js
 * En .env.local están documentados los valores (para referencia)
 * Para producción, reemplazar estos valores con los de tu proyecto
 */

const firebaseConfig = {
  apiKey: 'AIzaSyAKftMqxrVneWDc0_tmCzOEaVJ3IC6PsxQ',
  authDomain: 'valores-a5953.firebaseapp.com',
  projectId: 'valores-a5953',
  storageBucket: 'valores-a5953.appspot.com',
  messagingSenderId: '621868787730',
  appId: '1:621868787730:web:880bc9c9f4bac701fcd0cb'
};

// Initialize Firebase
if (!firebase.apps || firebase.apps.length === 0) {
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
  }
} else {
  console.log('✅ Firebase ya estaba inicializado');
}

// Obtener referencias a los servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Validar que Auth está disponible
if (!auth) {
  console.error('❌ Firebase Authentication no está disponible');
}

// Validar que Firestore está disponible
if (!db) {
  console.error('❌ Firebase Firestore no está disponible');
}

// Habilitar offline persistence de forma segura
try {
  db.enablePersistence({ synchronizeTabs: true })
    .then(() => {
      console.log('✅ Offline persistence habilitado');
    })
    .catch((err) => {
      // Ignorar todos los errores de persistence - puede ya estar habilitado
      if (err.code === 'failed-precondition') {
        console.warn('⚠️ Persistence: Multiple tabs abiertos');
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Persistence: No soportado en este navegador');
      } else {
        // Ignorar silenciosamente otros errores
        console.log('ℹ️ Persistence: ' + err.message);
      }
    });
} catch (error) {
  console.log('ℹ️ Persistence: Configuración salteada');
}


// ✅ SEGURIDAD: Configurar auth persistence
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    console.warn('⚠️ No se pudo configurar persistence:', error);
  });

console.log('✅ Firebase y variables de entorno configuradas correctamente');
