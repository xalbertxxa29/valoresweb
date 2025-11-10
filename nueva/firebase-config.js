/**
 * firebase-config.js (nueva/)
 * ===========================
 * CONFIGURACIÓN DE FIREBASE
 * 
 * Los valores están hardcodeados para que funcionen en navegador
 * Para producción, reemplazar con valores de tu proyecto
 */

// Función para obtener variables de entorno de forma segura
function getEnvVar(key, fallback = null) {
  return (window.ENV && window.ENV[key]) || fallback;
}

// Configuración de Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyAKftMqxrVneWDc0_tmCzOEaVJ3IC6PsxQ',
  authDomain: 'valores-a5953.firebaseapp.com',
  projectId: 'valores-a5953',
  storageBucket: 'valores-a5953.appspot.com',
  messagingSenderId: '621868787730',
  appId: '1:621868787730:web:880bc9c9f4bac701fcd0cb'
};

// Initialize Firebase (solo si no está ya inicializado)
if (!firebase.apps?.length) {
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado en nueva/firebase-config.js');
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
  }
}


// Initialize Firebase (solo si no está ya inicializado)
if (!firebase.apps?.length) {
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado en nueva/firebase-config.js');
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
  }
}
