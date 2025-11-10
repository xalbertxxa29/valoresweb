/**
 * shared-utils.js
 * ================
 * Funciones compartidas entre dashboard.js, comercial.js y operativo.js
 * Centraliza: loadOfferingsFromFirestore, watchDesplegablesRealtime, parseDesplegableDoc, getUserName
 */

// ============================================
// CATEGORÍAS COMPARTIDAS
// ============================================
const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';

// ============================================
// CACHE DE NOMBRES DE USUARIOS
// ============================================
const userNameCache = {};

/**
 * obtenerNombreUsuario
 * Obtiene el nombre completo de un usuario desde Firestore
 * @param {string} email - Email del usuario
 * @returns {Promise<string>} Nombre del usuario o email si no existe
 */
async function getUserName(email) {
  if (userNameCache[email]) return userNameCache[email];
  
  try {
    const userDoc = await db.collection('USUARIOS').doc(email).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      const fullName = `${data.NOMBRE || ''} ${data.APELLIDO || ''}`.trim();
      userNameCache[email] = fullName || email;
      return userNameCache[email];
    }
  } catch (error) {
    console.warn(`⚠️ Error obteniendo nombre para ${email}:`, error.message);
  }
  
  userNameCache[email] = email;
  return email;
}

/**
 * parseDesplegableDoc
 * Parsea un documento de la colección DESPEGABLES
 * Soporta tanto formato array como propiedades numeradas
 * @param {DocumentSnapshot} docSnap - Snapshot del documento
 * @returns {Array<string>} Array de opciones
 */
function parseDesplegableDoc(docSnap) {
  if (!docSnap.exists) return [];
  
  const data = docSnap.data() || {};
  
  // Soportar formato array: { offerings: [...] }
  if (Array.isArray(data.offerings) || Array.isArray(data.items)) {
    return [...new Set((data.offerings || data.items || [])
      .filter(v => typeof v === 'string' && v.trim()))];
  }
  
  // Soportar formato propiedades numeradas: { "1": "opción", "2": "opción" }
  return Object.entries(data)
    .filter(([k, v]) => !k.startsWith('_') && typeof v === 'string' && v.trim())
    .sort((a, b) => {
      const ak = Number(a[0]), bk = Number(b[0]);
      return (Number.isFinite(ak) && Number.isFinite(bk)) ? ak - bk : a[0].localeCompare(b[0]);
    })
    .map(([, v]) => v.trim());
}

/**
 * cargarDesplegablesDesdeFirestore
 * Carga ofrecimientos desde la colección DESPEGABLES
 * Actualiza los arrays vigNames y tecNames
 * @param {Object} config - Configuración
 * @param {Object} config.state - Objeto de estado (vigNames, tecNames)
 * @param {Function} config.onSuccess - Callback de éxito
 * @returns {Promise<void>}
 */
async function loadOfferingsFromFirestore(config = {}) {
  const { state = {}, onSuccess } = config;
  
  console.log('🔄 Cargando desplegables desde Firestore...');
  
  try {
    const coll = db.collection('DESPEGABLES');
    const [vig, tec] = await Promise.all([
      coll.doc('VIGILANCIA').get(),
      coll.doc('TECNOLOGIA').get(),
    ]);
    
    // Actualizar estado
    if (state.vigNames !== undefined) {
      state.vigNames = parseDesplegableDoc(vig);
      console.log('✅ Vigilancia cargada:', state.vigNames.length, 'items');
    }
    
    if (state.tecNames !== undefined) {
      state.tecNames = parseDesplegableDoc(tec);
      console.log('✅ Tecnología cargada:', state.tecNames.length, 'items');
    }
    
    // Ejecutar callback si se proporciona
    if (onSuccess) {
      onSuccess(state);
    }
  } catch (err) {
    console.error('❌ Error cargando DESPEGABLES:', err);
    throw err;
  }
}

/**
 * monitorearDesplegablesEnTiempoReal
 * Establece listeners realtime para cambios en DESPEGABLES
 * @param {Object} config - Configuración
 * @param {Object} config.state - Objeto de estado (vigNames, tecNames)
 * @param {Function} config.onUpdate - Callback cuando hay cambios
 * @returns {Array<Function>} Array de funciones para desuscribirse
 */
function watchDesplegablesRealtime(config = {}) {
  const { state = {}, onUpdate } = config;
  
  console.log('👁️ Monitoreando cambios en desplegables...');
  
  const coll = db.collection('DESPEGABLES');
  const unsubscribers = [];
  
  // Listener para VIGILANCIA
  const unsubVig = coll.doc('VIGILANCIA').onSnapshot(() => {
    loadOfferingsFromFirestore({
      state,
      onSuccess: () => {
        console.log('🔄 Vigilancia actualizada en tiempo real');
        if (onUpdate) onUpdate('vigilancia');
      }
    });
  }, (error) => {
    console.error('❌ Error escuchando VIGILANCIA:', error);
  });
  
  // Listener para TECNOLOGIA
  const unsubTec = coll.doc('TECNOLOGIA').onSnapshot(() => {
    loadOfferingsFromFirestore({
      state,
      onSuccess: () => {
        console.log('🔄 Tecnología actualizada en tiempo real');
        if (onUpdate) onUpdate('tecnologia');
      }
    });
  }, (error) => {
    console.error('❌ Error escuchando TECNOLOGIA:', error);
  });
  
  unsubscribers.push(unsubVig, unsubTec);
  return unsubscribers;
}

/**
 * construirHTMLOpciones
 * Construye las opciones de un select basado en categoría
 * @param {string} category - Categoría (VIGILANCIA o TECNOLOGIA)
 * @param {Array<string>} vigNames - Array de opciones de vigilancia
 * @param {Array<string>} tecNames - Array de opciones de tecnología
 * @param {string} selectedName - Nombre seleccionado (opcional)
 * @returns {string} HTML de opciones
 */
function buildOptionsHTML(category, vigNames, tecNames, selectedName = '') {
  const items = category === VIGILANCIA_CATEGORY ? vigNames : tecNames;
  
  const options = items
    .map(name => {
      const selected = name === selectedName ? 'selected' : '';
      const escaped = (name || '').replace(/"/g, '&quot;');
      return `<option value="${escaped}" ${selected}>${escaped}</option>`;
    })
    .join('');
  
  return `<option value="">-- Selecciona --</option>${options}`;
}

/**
 * agregarOpcionAlFirestore
 * Agrega una nueva opción a los desplegables en Firestore
 * @param {string} category - Categoría (VIGILANCIA o TECNOLOGIA)
 * @param {string} optionName - Nombre de la opción a agregar
 * @returns {Promise<void>}
 */
async function addOptionToFirestore(category, optionName) {
  const docId = category === VIGILANCIA_CATEGORY ? 'VIGILANCIA' : 'TECNOLOGIA';
  const ref = db.collection('DESPEGABLES').doc(docId);
  const clean = (optionName || '').trim();
  
  if (!clean) throw new Error('El nombre de la opción no puede estar vacío');
  
  try {
    await ref.set(
      { items: firebase.firestore.FieldValue.arrayUnion(clean) },
      { merge: true }
    );
    console.log(`✅ Opción "${clean}" agregada a ${docId}`);
  } catch (err) {
    console.error(`❌ Error agregando opción a ${docId}:`, err);
    throw err;
  }
}

// Exportar funciones (compatibles con módulos y scripts globales)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VIGILANCIA_CATEGORY,
    TECNOLOGIA_CATEGORY,
    userNameCache,
    getUserName,
    parseDesplegableDoc,
    loadOfferingsFromFirestore,
    watchDesplegablesRealtime,
    buildOptionsHTML,
    addOptionToFirestore,
  };
}
