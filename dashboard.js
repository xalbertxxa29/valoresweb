// dashboard.js — PWA Gestión (v2) • DESPEGABLES dinámicos desde Firestore + fixes de modal "Ganado"
document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // Firebase & Persistencia
  // =========================
  // Firebase ya está inicializado en firebase-config.js
  const auth = firebase.auth();
  // Usar db global de firebase-config.js en lugar de redeclararla
  // const db   = firebase.firestore();
  window.auth = auth; 
  // window.db ya está definida en firebase-config.js

  // Persistencia offline ya fue habilitada en firebase-config.js

  // =========================
  // Constantes & Estado
  // =========================
  const CLIENT_STATUS = { PENDING: 'Ofrecido', WON: 'Ganado' };
  const PAGE_SIZE = 10;

  const paginationState = {
    [CLIENT_STATUS.PENDING]: { lastDoc: null, pageHistory: [null] },
    [CLIENT_STATUS.WON]:     { lastDoc: null, pageHistory: [null] },
  };

  // Categorías
  const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
  const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';

  // Ofrecimientos (se rellenan desde Firestore)
  let availableOfferings = []; // [{name, category}]
  let vigNames = [];           // para mapear nombre->categoría
  let tecNames = [];

  // Caché de nombres para “Registrado por”
  const userNameCache = {};

  // Chart
  let servicesChart = null;

  // =========================
  // Utilidades DESPEGABLES
  // =========================
  // Funciones compartidas desde shared-utils.js:
  // - parseDesplegableDoc()
  // - loadOfferingsFromFirestore()
  // - watchDesplegablesRealtime()
  // - addOptionToFirestore()
  // - buildOptionsHTML() personalizado para dashboard

  function buildOptionsHTML(category, selectedName) {
    let options = [];
    if (category === VIGILANCIA_CATEGORY) options = vigNames;
    else if (category === TECNOLOGIA_CATEGORY) options = tecNames;

    if (!options.length) {
      const keep = selectedName ? `<option value="${selectedName}" selected>${selectedName}</option>` : '';
      return `<option value="">Cargando…</option>${keep}`;
    }
    return options
      .map(n => `<option value="${n}" ${n === selectedName ? 'selected' : ''}>${n}</option>`)
      .join('');
  }

  // Función para refrescar todos los selects con las opciones actualizadas
  function refreshAllOfferingSelects() {
    document.querySelectorAll('.offering-name').forEach(select => {
      const row = select.closest('.offering-row');
      if (!row) return;
      
      const category = row.querySelector('.offering-category')?.value;
      if (!category) return;
      
      const currentValue = select.value;
      const newOptions = buildOptionsHTML(category, currentValue);
      
      // Preservar la opción "Seleccionar..." inicial
      select.innerHTML = `<option value="">Seleccionar...</option>${newOptions}`;
      if (currentValue) {
        select.value = currentValue;
      }
    });
  }

  // =========================
  // UI Elements
  // =========================
  const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
  const menuOptions    = document.querySelectorAll('.menu-option');

  // Tarjetas inicio
  const pendingCard = document.getElementById('pending-card');
  const wonCard     = document.getElementById('won-card');
  const expCard     = document.getElementById('expiring-card');

  // Tablas y paginación
  const pendingNext = document.getElementById('pending-next');
  const pendingPrev = document.getElementById('pending-prev');
  const wonNext     = document.getElementById('won-next');
  const wonPrev     = document.getElementById('won-prev');

  // Modal Cliente (ver/editar)
  const modalOverlay = document.getElementById('client-modal-overlay');
  const modalTitle   = document.getElementById('modal-title');
  const modalBody    = document.getElementById('modal-body');
  const modalFooter  = document.getElementById('modal-footer');
  const modalCloseBtn= document.getElementById('modal-close-btn');

  // Modal Editor Servicios
  const servicesEditorModal     = document.getElementById('services-editor-modal');
  const servicesEditorCloseBtn  = document.getElementById('services-editor-close-btn');
  const servicesEditorCancelBtn = document.getElementById('services-editor-cancel-btn');
  const servicesEditorSaveBtn   = document.getElementById('services-editor-save-btn');
  const editVigilanciaContainer = document.getElementById('edit-vigilancia-offerings-container');
  const editTecnologiaContainer = document.getElementById('edit-tecnologia-offerings-container');
  const editAddVigBtn           = document.getElementById('edit-add-vigilancia-btn');
  const editAddTecBtn           = document.getElementById('edit-add-tecnologia-btn');

  // Modal fecha “Ganado”
  const datePickerModal     = document.getElementById('date-picker-modal');
  const datePickerDocPathEl = document.getElementById('date-picker-doc-path');
  const datePickerInput     = document.getElementById('implementation-date-input');

  // Modal “Agregar opción”
  const addOptionOverlay  = document.getElementById('add-option-modal');
  const addOptionTitle    = document.getElementById('add-option-title');
  const addOptionInput    = document.getElementById('new-option-input');
  const addOptionError    = document.getElementById('add-option-error');
  const addOptionSaveBtn  = document.getElementById('add-option-save-btn');
  const addOptionCancelXs = document.getElementById('add-option-cancel-btn');
  const addOptionCancel2  = document.getElementById('add-option-cancel-btn-2');

  let addOptionContext = null; // { category, selectEl }

  // Verificación inicial de elementos del modal
  console.log('🔧 Verificando elementos del modal de agregar opción:');
  console.log('📍 addOptionOverlay:', !!addOptionOverlay);
  console.log('📍 addOptionTitle:', !!addOptionTitle);
  console.log('📍 addOptionInput:', !!addOptionInput);
  console.log('📍 addOptionError:', !!addOptionError);
  console.log('📍 addOptionSaveBtn:', !!addOptionSaveBtn);
  console.log('📍 addOptionCancelXs:', !!addOptionCancelXs);
  console.log('📍 addOptionCancel2:', !!addOptionCancel2);

  function showAddOptionModal(category, selectEl) {
    console.log('🔴 showAddOptionModal llamada:', category, !!selectEl);
    console.log('📍 addOptionOverlay encontrado:', !!addOptionOverlay);
    console.log('📍 addOptionTitle encontrado:', !!addOptionTitle);
    console.log('📍 addOptionInput encontrado:', !!addOptionInput);
    
    addOptionContext = { category, selectEl };
    if (addOptionTitle) {
      addOptionTitle.textContent = `Nueva opción para ${category === VIGILANCIA_CATEGORY ? 'Vigilancia' : 'Tecnología'}`;
    }
    if (addOptionInput) {
      addOptionInput.value = '';
    }
    if (addOptionError) {
      addOptionError.textContent = '';
    }
    if (addOptionOverlay) {
      addOptionOverlay.classList.add('visible');
      console.log('✅ Modal de agregar opción abierto');
    } else {
      console.error('❌ No se pudo abrir modal: addOptionOverlay no encontrado');
    }
    if (addOptionInput) {
      addOptionInput.focus();
    }
  }
  function hideAddOptionModal() {
    if (addOptionOverlay) {
      addOptionOverlay.classList.remove('visible');
      console.log('✅ Modal de agregar opción cerrado');
    }
    addOptionContext = null;
  }
  addOptionCancelXs?.addEventListener('click', () => {
    console.log('🔴 Click en cancelar modal (X)');
    hideAddOptionModal();
  });
  addOptionCancel2?.addEventListener('click', () => {
    console.log('🔴 Click en cancelar modal (botón)');
    hideAddOptionModal();
  });

  addOptionSaveBtn?.addEventListener('click', async () => {
    console.log('🔴 Click en guardar opción');
    const value = (addOptionInput.value || '').trim();
    if (value.length < 3) { 
      if (addOptionError) addOptionError.textContent = 'Mínimo 3 caracteres.'; 
      return; 
    }
    try {
      loadingOverlay.style.display = 'flex';
      await addOptionToFirestore(addOptionContext.category, value);
      console.log('✅ Opción guardada exitosamente');
      hideAddOptionModal();
      // Refrescar selects y seleccionar inmediatamente
      setTimeout(() => {
        refreshAllOfferingSelects();
        if (addOptionContext?.selectEl) {
          const sel = addOptionContext.selectEl;
          // si aún no está en DOM, agrégalo
          if (![...sel.options].some(o => o.value === value)) {
            const opt = document.createElement('option');
            opt.value = value; opt.textContent = value;
            sel.appendChild(opt);
          }
          sel.value = value;
        }
        showMessage('Opción agregada correctamente (se sincroniza offline).', 'success');
      }, 200);
    } catch (e) {
      console.error(e);
      addOptionError.textContent = 'No se pudo guardar. Verifica reglas/permisos.';
    } finally {
      loadingOverlay.style.display = 'none';
    }
  });

  // =========================
  // Helpers
  // =========================
  function openModal(m) { m.classList.add('visible'); }
  function closeModal(m) { m.classList.remove('visible'); }

  // Función para mostrar mensajes en modal
  function showMessage(message, type = 'info') {
    const messageModal = document.createElement('div');
    messageModal.className = 'modal-overlay visible';
    messageModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 3000;';
    
    const colors = {
      'success': '#4caf50',
      'error': '#f44336',
      'warning': '#ff9800',
      'info': '#2196f3'
    };
    
    const color = colors[type] || colors['info'];
    
    messageModal.innerHTML = `
      <div style="background: white; border-radius: 8px; padding: 24px; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); text-align: center;">
        <div style="font-size: 24px; color: ${color}; margin-bottom: 12px;">
          ${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}
        </div>
        <p style="color: #333; font-size: 16px; margin: 16px 0; line-height: 1.5;">${message}</p>
        <button style="background: ${color}; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 600;">Aceptar</button>
      </div>
    `;
    
    document.body.appendChild(messageModal);
    
    const closeBtn = messageModal.querySelector('button');
    closeBtn.addEventListener('click', () => {
      messageModal.remove();
    });
    
    messageModal.addEventListener('click', (e) => {
      if (e.target === messageModal) {
        messageModal.remove();
      }
    });
  }

  async function getUserName(email) {
    if (!email) return 'Desconocido';
    if (userNameCache[email]) return userNameCache[email];
    try {
      const username = email.split('@')[0].toUpperCase();
      const snap = await db.collection('usuarios').doc(username).get();
      if (snap.exists && snap.data().NOMBRE) {
        userNameCache[email] = snap.data().NOMBRE;
      } else {
        userNameCache[email] = email;
      }
      return userNameCache[email];
    } catch {
      return email;
    }
  }

  // =========================
  // Auth
  // =========================
  
  // Esperar a que shared-utils.js esté disponible
  function waitForSharedUtils() {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (typeof loadOfferingsFromFirestore !== 'undefined' && typeof watchDesplegablesRealtime !== 'undefined') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      // Timeout después de 5 segundos
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('⚠️ shared-utils.js tardó demasiado en cargar');
        resolve();
      }, 5000);
    });
  }
  
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    // Guardar el UID del usuario para consultas posteriores
    window.currentUserId = user.uid;
    console.log('👤 Usuario autenticado con UID:', user.uid);

    // Nombre en sidebar
    const uiName = sessionStorage.getItem('userName');
    document.getElementById('user-fullname').textContent = uiName || user.email;

    // Esperar a que shared-utils esté disponible
    await waitForSharedUtils();

    // Cargar desplegables desde Firestore y activar realtime
    // Usando shared-utils.js con callbacks personalizados para dashboard
    const dashboardState = { vigNames, tecNames };
    
    try {
      await loadOfferingsFromFirestore({
        state: dashboardState,
        onSuccess: () => {
          vigNames = dashboardState.vigNames;
          tecNames = dashboardState.tecNames;
          availableOfferings = [
            ...vigNames.map(name => ({ name, category: VIGILANCIA_CATEGORY })),
            ...tecNames.map(name => ({ name, category: TECNOLOGIA_CATEGORY })),
          ];
          refreshAllOfferingSelects();
        }
      });
    } catch (error) {
      console.error('❌ Error cargando desplegables:', error);
    }
    
    watchDesplegablesRealtime({
      state: dashboardState,
      onUpdate: () => {
        vigNames = dashboardState.vigNames;
        tecNames = dashboardState.tecNames;
        availableOfferings = [
          ...vigNames.map(name => ({ name, category: VIGILANCIA_CATEGORY })),
          ...tecNames.map(name => ({ name, category: TECNOLOGIA_CATEGORY })),
        ];
        refreshAllOfferingSelects();
      }
    });

    // Menú y navegación
    menuOptions.forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
    document.getElementById('logout-btn').addEventListener('click', async () => { await auth.signOut(); window.location.href = 'index.html'; });    // Botones editor servicios
    console.log('🔧 Configurando event listeners para botones agregar');
    console.log('📍 editAddVigBtn encontrado:', !!editAddVigBtn);
    console.log('📍 editAddTecBtn encontrado:', !!editAddTecBtn);
    console.log('📍 editVigilanciaContainer encontrado:', !!editVigilanciaContainer);
    console.log('📍 editTecnologiaContainer encontrado:', !!editTecnologiaContainer);
    
    editAddVigBtn?.addEventListener('click', (e) => {
      console.log('🟢 Click en botón agregar vigilancia');
      e.preventDefault();
      e.stopPropagation();
      try {
        const newRow = createOfferingRow(VIGILANCIA_CATEGORY);
        editVigilanciaContainer.appendChild(newRow);
        console.log('✅ Fila de vigilancia agregada exitosamente');
      } catch (error) {
        console.error('❌ Error al agregar fila de vigilancia:', error);
      }
    });
    
    editAddTecBtn?.addEventListener('click', (e) => {
      console.log('🟢 Click en botón agregar tecnología');
      e.preventDefault();
      e.stopPropagation();
      try {
        const newRow = createOfferingRow(TECNOLOGIA_CATEGORY);
        editTecnologiaContainer.appendChild(newRow);
        console.log('✅ Fila de tecnología agregada exitosamente');
      } catch (error) {
        console.error('❌ Error al agregar fila de tecnología:', error);
      }
    });
    servicesEditorCloseBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal(servicesEditorModal);
    });
    servicesEditorCancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal(servicesEditorModal);
    });
    servicesEditorSaveBtn?.addEventListener('click', saveServicesChanges);

    // Botones de tarjetas / paginación
    pendingCard?.addEventListener('click', () => showSection('pendientes'));
    wonCard?.addEventListener('click', () => showSection('ganados'));
    expCard?.addEventListener('click', () => showSection('ganados'));

    pendingNext?.addEventListener('click', () => loadTableData(CLIENT_STATUS.PENDING, 'next'));
    pendingPrev?.addEventListener('click', () => loadTableData(CLIENT_STATUS.PENDING, 'prev'));
    wonNext?.addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'next'));
    wonPrev?.addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'prev'));

    // Modal cliente
    modalCloseBtn?.addEventListener('click', () => closeModal(modalOverlay));

    // Arranque en “Inicio”
    showSection('inicio');
  });

  // =========================
  // Secciones
  // =========================
  function showSection(sectionId) {
    console.log('🔄 Cambiando a sección:', sectionId);
    
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('is-visible'));
    const targetSection = document.getElementById(`${sectionId}-section`);
    
    if (targetSection) {
      targetSection.classList.add('is-visible');
      console.log('✅ Sección activada:', sectionId);
    } else {
      console.error('❌ No se encontró la sección:', `${sectionId}-section`);
    }

    menuOptions.forEach(btn => btn.classList.toggle('active', btn.dataset.section === sectionId));

    if (sectionId === 'inicio')      loadDashboardData();
    if (sectionId === 'pendientes')  loadTableData(CLIENT_STATUS.PENDING, 'initial');
    if (sectionId === 'ganados')     loadTableData(CLIENT_STATUS.WON, 'initial');
    if (sectionId === 'ejecucion')   loadExecList();
    if (sectionId === 'registrar')   ensureRegistrarIframe();
  }

  async function ensureRegistrarIframe() {
    const frame = document.getElementById('registrar-iframe');
    if (!frame || frame.dataset.srcChecked === '1') return;
    
    try {
      const testUrl = 'nueva/nueva.html';
      const r = await fetch(testUrl, { method: 'HEAD' });
      if (r.ok) {
        frame.src = testUrl + '?embedded=true';
        console.log('✅ Cargando iframe desde: nueva/nueva.html');
      } else {
        console.error('❌ No se pudo acceder a nueva/nueva.html, status:', r.status);
        frame.src = 'nueva/nueva.html?embedded=true'; // Forzar la ruta correcta
      }
    } catch (error) {
      console.error('❌ Error al verificar iframe:', error);
      frame.src = 'nueva/nueva.html?embedded=true'; // Usar la ruta correcta
    }
    frame.dataset.srcChecked = '1';
  }

  // =========================
  // Inicio: métricas + gráfico
  // =========================
  async function loadDashboardData() {
    const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    const startTime = Date.now();
    try {
      console.log('🔍 Buscando TODOS los clientes usando collectionGroup...');
      
      // Usar collectionGroup para buscar en TODOS los clientes de TODOS los usuarios
      const clientsSnapshot = await db.collectionGroup('clients').get();
      console.log(`✅ Total de clientes encontrados: ${clientsSnapshot.docs.length}`);
      
      const clients = clientsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📄 Cliente:', {
          id: doc.id,
          name: data.name,
          clientStatus: data.clientStatus,
          path: doc.ref.path
        });
        return data;
      });
      
      console.log('✅ Total de clientes obtenidos:', clients.length);

      // Tarjetas
      const pendingCountEl = document.getElementById('pending-count');
      if (pendingCountEl) {
        pendingCountEl.textContent = clients.filter(c => c.clientStatus === CLIENT_STATUS.PENDING).length;
      }

      const wonCountEl = document.getElementById('won-count');
      if (wonCountEl) {
        wonCountEl.textContent = clients.filter(c => c.clientStatus === CLIENT_STATUS.WON).length;
      }

      const expiringCount = clients.filter(c => {
        const isWon = c.clientStatus === CLIENT_STATUS.WON;
        const duration = c.offerings?.[0]?.frequency || 0;
        if (isWon && c.implementationDate && duration > 0) {
          const expiration = dayjs(c.implementationDate).add(duration, 'month');
          return expiration.diff(dayjs(), 'month') <= 6;
        }
        return false;
      }).length;
      
      const expiringCountEl = document.getElementById('expiring-count');
      if (expiringCountEl) {
        expiringCountEl.textContent = expiringCount;
      }

      // Indicadores + gráfico (usa mapeo nombre->categoría derivado de DESPEGABLES)
      await updateIndicatorsAndChart(clients);
    } catch (e) {
      console.error('❌ Error dashboard:', e);
      // Mostrar valores por defecto con validación
      const pendingCountEl = document.getElementById('pending-count');
      const wonCountEl = document.getElementById('won-count');
      const expiringCountEl = document.getElementById('expiring-count');
      
      if (pendingCountEl) pendingCountEl.textContent = '0';
      if (wonCountEl) wonCountEl.textContent = '0';
      if (expiringCountEl) expiringCountEl.textContent = '0';
    } finally {
      const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
  }

  async function updateIndicatorsAndChart(clients) {
    const nameToCategory = {};
    vigNames.forEach(n => { nameToCategory[n] = VIGILANCIA_CATEGORY; });
    tecNames.forEach(n => { nameToCategory[n] = TECNOLOGIA_CATEGORY; });

    const userRanking = {};
    let vaCount = 0, vatCount = 0;
    const serviceCounts = { pending: {}, won: {} };
    const allServiceNames = new Set();

    for (const c of clients) {
      const userKey = c.creadoPor || 'Desconocido';
      userRanking[userKey] = (userRanking[userKey] || 0) + 1;

      if (Array.isArray(c.offerings)) {
        for (const o of c.offerings) {
          const name = o.name || 'Sin nombre';
          allServiceNames.add(name);
          const bucket = c.clientStatus === CLIENT_STATUS.PENDING ? 'pending' : 'won';
          serviceCounts[bucket][name] = (serviceCounts[bucket][name] || 0) + 1;

          const cat = o.category || nameToCategory[name];
          if (cat === VIGILANCIA_CATEGORY) vaCount++;
          else if (cat === TECNOLOGIA_CATEGORY) vatCount++;
        }
      }
    }

    // 1. Ranking de Registros (Top 3 con barras)
    const top3 = Object.entries(userRanking).sort((a,b) => b[1]-a[1]).slice(0,3);
    const maxRankingCount = top3.length > 0 ? top3[0][1] : 1;
    
    const top3Resolved = await Promise.all(top3.map(async ([emailOrName, count], idx) => {
      const display = await getUserName(emailOrName);
      const percent = (count / maxRankingCount) * 100;
      return `
        <div class="ranking-item">
          <span class="rank-number">#${idx + 1}</span>
          <span class="rank-name" title="${display}">${display}</span>
          <div class="rank-bar-container">
            <div class="rank-bar-fill" style="width: ${percent}%"></div>
          </div>
          <span class="rank-count">${count}</span>
        </div>`;
    }));

    const rankingContainer = document.getElementById('user-ranking-list');
    if (rankingContainer) {
      rankingContainer.innerHTML = top3Resolved.length ? top3Resolved.join('') : '<p>Sin datos.</p>';
    }

    // 2. Contadores y Barra de Distribución (VA / VAT)
    const totalV = vaCount + vatCount;
    const vaPercent = totalV > 0 ? Math.round((vaCount / totalV) * 100) : 50;
    const vatPercent = totalV > 0 ? (100 - vaPercent) : 50;

    const vaCountEl = document.getElementById('va-count');
    const vatCountEl = document.getElementById('vat-count');
    if (vaCountEl) vaCountEl.textContent = vaCount;
    if (vatCountEl) vatCountEl.textContent = vatCount;

    const vaBar = document.getElementById('va-percent-bar');
    const vatBar = document.getElementById('vat-percent-bar');
    if (vaBar) vaBar.style.width = `${vaPercent}%`;
    if (vatBar) vatBar.style.width = `${vatPercent}%`;

    const vaText = document.getElementById('va-percent-text');
    const vatText = document.getElementById('vat-percent-text');
    if (vaText) vaText.textContent = `${vaPercent}% VA`;
    if (vatText) vatText.textContent = `${vatPercent}% VAT`;

    // 3. Gráfico de Servicios (Ordenado y Horizontal)
    try {
      const allLabels = Array.from(allServiceNames);
      // Combinar para ordenar
      const combined = allLabels.map(name => ({
        name,
        pending: serviceCounts.pending[name] || 0,
        won: serviceCounts.won[name] || 0,
        total: (serviceCounts.pending[name] || 0) + (serviceCounts.won[name] || 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15); // Top 15 para legibilidad

      const sortedLabels  = combined.map(i => i.name);
      const pendingData = combined.map(i => i.pending);
      const wonData     = combined.map(i => i.won);

      renderServicesChart(sortedLabels, pendingData, wonData);
    } catch (err) {
      console.error('Error chart:', err);
    }
  }

  function renderServicesChart(labels, pendingData, wonData) {
    const chartEl = document.getElementById('services-chart');
    if (!chartEl) return;

    const ctx = chartEl.getContext('2d');
    if (servicesChart) servicesChart.destroy();

    const hasData = labels.length > 0 && (pendingData.some(v => v > 0) || wonData.some(v => v > 0));
    const container = chartEl.closest('.chart-container-full');
    const existingEmpty = container ? container.querySelector('.chart-empty-state') : null;
    if (existingEmpty) existingEmpty.remove();

    if (!hasData) {
      chartEl.style.display = 'none';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'chart-empty-state';
      emptyDiv.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:320px;color:#94a3b8;gap:1rem;">
          <svg width="56" height="56" fill="none" viewBox="0 0 24 24" stroke="currentColor" opacity="0.4"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          <p style="font-size:1rem;font-weight:600;color:#64748b;margin:0;">Aún no hay servicios registrados</p>
          <p style="font-size:0.85rem;color:#94a3b8;margin:0;">Los datos aparecerán aquí cuando se registren clientes.</p>
        </div>`;
      if (container) container.appendChild(emptyDiv);
      return;
    }

    chartEl.style.display = '';
    Chart.register(ChartDataLabels);

    const truncateLabel = (label, max) => {
      max = max || 18;
      return label.length > max ? label.substring(0, max) + '...' : label;
    };
    const shortLabels = labels.map(l => truncateLabel(l));

    servicesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: shortLabels,
        datasets: [
          {
            label: 'Solicitudes Pendientes',
            backgroundColor: 'rgba(251, 146, 60, 0.85)',
            borderColor: '#ea580c',
            borderWidth: 1,
            borderRadius: 6,
            data: pendingData,
            maxBarThickness: 35
          },
          {
            label: 'Clientes Ganados',
            backgroundColor: 'rgba(20, 184, 166, 0.85)',
            borderColor: '#0d9488',
            borderWidth: 1,
            borderRadius: 6,
            data: wonData,
            maxBarThickness: 35
          }
        ]
      },
      options: {
        indexAxis: 'y', // HACE EL GRÁFICO HORIZONTAL
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeOutElastic' },
        plugins: {
          datalabels: {
            display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
            color: '#fff',
            anchor: 'center',
            align: 'center',
            font: { weight: '800', size: 11 },
            formatter: (v) => v
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 12,
            titleFont: { size: 14, weight: '700' },
            callbacks: {
              title: (items) => labels[items[0].dataIndex]
            }
          },
          legend: {
            position: 'top',
            labels: { padding: 20, usePointStyle: true, pointStyle: 'circle', font: { size: 12, weight: '500' } }
          }
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
            ticks: { font: { size: 11 }, color: '#64748b', precision: 0 }
          },
          y: {
            stacked: true,
            grid: { display: false, drawBorder: false },
            ticks: { font: { size: 12, weight: '500' }, color: '#1e293b' }
          }
        }
      }
    });
  }


  // =========================
  // Tablas (Pendientes / Ganados)
  // =========================
  function updatePaginationButtons(status, fetchedCount) {
    const prefix = status === CLIENT_STATUS.PENDING ? 'pending' : 'won';
    document.getElementById(`${prefix}-prev`).disabled = paginationState[status].pageHistory.length <= 1;
    document.getElementById(`${prefix}-next`).disabled = fetchedCount < PAGE_SIZE;
  }

  async function loadTableData(status, direction = 'initial') {
    const tableId = status === CLIENT_STATUS.PENDING ? 'pending-table-body' : 'won-table-body';
    const tbody = document.getElementById(tableId);
    const pagination = paginationState[status];

    loadingOverlay.style.display = 'flex';
    try {
      let query = db.collectionGroup('clients')
        .where('clientStatus', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(PAGE_SIZE);

      if (direction === 'next' && pagination.lastDoc) {
        query = query.startAfter(pagination.lastDoc);
      } else if (direction === 'prev') {
        if (pagination.pageHistory.length > 1) {
          pagination.pageHistory.pop();
          const prevStartAt = pagination.pageHistory[pagination.pageHistory.length - 1];
          if (prevStartAt) query = query.startAt(prevStartAt);
        }
      }

      const snapshot = await query.get();
      const docs = snapshot.docs;

      pagination.lastDoc = docs.length ? docs[docs.length - 1] : null;
      if (direction === 'initial') pagination.pageHistory = [docs[0] || null];
      else if (direction === 'next' && docs.length) pagination.pageHistory.push(docs[0]);

      updatePaginationButtons(status, docs.length);

      const colspan = status === CLIENT_STATUS.WON ? 8 : 6;
      if (!docs.length) {
        tbody.innerHTML = `<tr><td colspan="${colspan}">No se encontraron registros.</td></tr>`;
        return;
      }

      const rowsHtml = await Promise.all(docs.map(async (doc) => {
        const client = doc.data();
        const path   = doc.ref.path;
        const createdByFullName = await getUserName(client.creadoPor);
        const creationDate = client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A';
        const servicesCount = client.offerings ? client.offerings.length : 0;
        const servicesHTML = `
          <div class="service-summary">
            <span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span>
            <a class="view-details-link" data-path="${path}"><i class="fas fa-list-ul"></i> Ver Detalles</a>
          </div>`;

        let actions = `
          <div class="action-icons-wrapper">
            <i class="fas fa-pencil-alt action-icon edit-details-btn" data-path="${path}" title="Editar Detalles"></i>
            <i class="fas fa-cogs action-icon edit-services-btn" data-path="${path}" title="Editar Servicios"></i>
            <i class="fas fa-trash-alt action-icon delete-btn" data-path="${path}" title="Eliminar Registro"></i>
          </div>`;

        if (status === CLIENT_STATUS.PENDING) {
          actions += `<button class="btn-action btn-action-won mark-won-btn" data-path="${path}">
                        <i class="fas fa-check"></i> GANADO
                      </button>`;
          return `
            <tr data-doc-path="${path}">
              <td><span class="code-text">${creationDate}</span></td>
              <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
              <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
              <td>${servicesHTML}</td>
              <td>${createdByFullName}</td>
              <td>${actions}</td>
            </tr>`;
        } else {
          const implementationDate = client.implementationDate
            ? dayjs(client.implementationDate).format('DD/MM/YYYY')
            : 'Pendiente';
          let remainingMonthsText = 'N/A', textColorClass = '';
          const duration = client.offerings?.[0]?.frequency || 0;
          if (client.implementationDate && duration > 0) {
            const expirationDate = dayjs(client.implementationDate).add(duration, 'month');
            const remaining = expirationDate.diff(dayjs(), 'month');
            remainingMonthsText = remaining < 0 ? 0 : remaining;
            if (remaining <= 6) textColorClass = 'text-danger';
          }
          actions += `<button class="btn-action btn-action-manage exec-pending-btn" data-path="${path}">
                        <i class="fas fa-tasks"></i> Gestionar
                      </button>`;
          return `
            <tr data-doc-path="${path}">
              <td><span class="code-text">${creationDate}</span></td>
              <td><span class="code-text">${implementationDate}</span></td>
              <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
              <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
              <td>${servicesHTML}</td>
              <td>${createdByFullName}</td>
              <td class="${textColorClass}">${remainingMonthsText}</td>
              <td>${actions}</td>
            </tr>`;
        }
      }));

      tbody.innerHTML = rowsHtml.join('');

      // Delegados de fila
      tbody.querySelectorAll('.action-icon, .view-details-link').forEach(el => {
        el.addEventListener('click', (ev) => {
          const target = ev.currentTarget;
          const path = target.dataset.path;
          let mode = 'view';
          if (target.classList.contains('edit-details-btn'))   mode = 'edit';
          if (target.classList.contains('edit-services-btn'))  mode = 'edit-services';

          if (target.classList.contains('delete-btn')) {
            showDeleteConfirmationModal(path);
          } else {
            handleClientAction(path, mode);
          }
        });
      });

      tbody.querySelectorAll('.mark-won-btn').forEach(btn => {
        btn.addEventListener('click', () => openWonDatePickerModal(btn.dataset.path));
      });

      tbody.querySelectorAll('.exec-pending-btn').forEach(btn => {
        btn.addEventListener('click', () => openExecutionModal(btn.dataset.path, 'in_process'));
      });

    } catch (e) {
      console.error('Error cargando tabla:', e);
      tbody.innerHTML = `<tr><td colspan="${status === CLIENT_STATUS.WON ? 8 : 6}">Error al cargar los datos.</td></tr>`;
    } finally {
      loadingOverlay.style.display = 'none';
    }

    // Inicializar filtro predictivo después de cargar la tabla
    initializeSearchFilter(status);
  }

  // =========================
  // FILTRO PREDICTIVO
  // =========================
  // Cache global para almacenar todos los clientes sin paginar
  const allClientsCache = {
    [CLIENT_STATUS.PENDING]: [],
    [CLIENT_STATUS.WON]: []
  };

  async function loadAllClientsForSearch(status) {
    if (allClientsCache[status].length > 0) {
      return allClientsCache[status];
    }

    try {
      let query = db.collectionGroup('clients')
        .where('clientStatus', '==', status)
        .orderBy('createdAt', 'desc');

      const snapshot = await query.get();
      const docs = snapshot.docs;

      allClientsCache[status] = docs.map(doc => {
        const client = doc.data();
        return {
          name: client.name || 'N/A',
          ruc: client.ruc || 'N/A',
          path: doc.ref.path
        };
      });

      return allClientsCache[status];
    } catch (error) {
      console.error('Error cargando todos los clientes:', error);
      return [];
    }
  }

  function initializeSearchFilter(status) {
    const isWon = status === CLIENT_STATUS.WON;
    const searchInputId = isWon ? 'won-search-input' : 'pending-search-input';
    const suggestionsId = isWon ? 'won-suggestions' : 'pending-suggestions';
    const tableBodyId = isWon ? 'won-table-body' : 'pending-table-body';
    
    const searchInput = document.getElementById(searchInputId);
    const suggestionsDropdown = document.getElementById(suggestionsId);
    const tableBody = document.getElementById(tableBodyId);
    
    if (!searchInput || !suggestionsDropdown) return;
    
    // Event listener para el input de búsqueda
    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.trim().toLowerCase();
      
      if (query.length === 0) {
        suggestionsDropdown.classList.remove('active');
        // Mostrar todos los clientes de la página actual
        tableBody.querySelectorAll('tr').forEach(row => row.style.display = '');
        return;
      }

      // Cargar todos los clientes de Firestore
      const allClients = await loadAllClientsForSearch(status);
      
      // Filtrar clientes que coincidan con la búsqueda
      const matches = allClients.filter(client => 
        client.name.toLowerCase().includes(query) || 
        client.ruc.toLowerCase().includes(query)
      );
      
      if (matches.length === 0) {
        suggestionsDropdown.innerHTML = `
          <div class="no-suggestions">
            <i class="fas fa-search"></i>
            <p>No se encontraron clientes</p>
          </div>
        `;
        suggestionsDropdown.classList.add('active');
        tableBody.querySelectorAll('tr').forEach(row => row.style.display = 'none');
        return;
      }
      
      // Mostrar sugerencias (máximo 8)
      suggestionsDropdown.innerHTML = matches.slice(0, 8).map((client, index) => `
        <div class="suggestion-item" data-path="${client.path}">
          <i class="fas fa-building"></i>
          <div>
            <div class="suggestion-item-name">${highlightMatch(client.name, query)}</div>
            <div class="suggestion-item-ruc">${client.ruc}</div>
          </div>
        </div>
      `).join('');
      
      suggestionsDropdown.classList.add('active');
      
      // Event listeners para sugerencias
      suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', async () => {
          const selectedPath = item.dataset.path;
          const selectedClient = matches.find(c => c.path === selectedPath);
          searchInput.value = selectedClient.name;
          suggestionsDropdown.classList.remove('active');
          
          loadingOverlay.style.display = 'flex';
          try {
            // Cargar el documento específico
            const docRef = db.doc(selectedPath);
            const docSnapshot = await docRef.get();
            
            if (!docSnapshot.exists) {
              showMessage('Cliente no encontrado', 'error');
              loadingOverlay.style.display = 'none';
              return;
            }

            // Renderizar solo ese cliente en la tabla
            const client = docSnapshot.data();
            const path = docSnapshot.ref.path;
            const createdByFullName = await getUserName(client.creadoPor);
            const creationDate = client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A';
            const servicesCount = client.offerings ? client.offerings.length : 0;
            const servicesHTML = `
              <div class="service-summary">
                <span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span>
                <a class="view-details-link" data-path="${path}"><i class="fas fa-list-ul"></i> Ver Detalles</a>
              </div>`;

            let actions = `
              <div class="action-icons-wrapper">
                <i class="fas fa-pencil-alt action-icon edit-details-btn" data-path="${path}" title="Editar Detalles"></i>
                <i class="fas fa-cogs action-icon edit-services-btn" data-path="${path}" title="Editar Servicios"></i>
                <i class="fas fa-trash-alt action-icon delete-btn" data-path="${path}" title="Eliminar Registro"></i>
              </div>`;

            let rowHtml = '';
            if (status === CLIENT_STATUS.PENDING) {
              actions += `<button class="btn-action btn-action-won mark-won-btn" data-path="${path}">
                            <i class="fas fa-check"></i> GANADO
                          </button>`;
              rowHtml = `
                <tr data-doc-path="${path}">
                  <td><span class="code-text">${creationDate}</span></td>
                  <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
                  <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
                  <td>${servicesHTML}</td>
                  <td>${createdByFullName}</td>
                  <td>${actions}</td>
                </tr>`;
            } else {
              const implementationDate = client.implementationDate
                ? dayjs(client.implementationDate).format('DD/MM/YYYY')
                : 'Pendiente';
              let remainingMonthsText = 'N/A', textColorClass = '';
              const duration = client.offerings?.[0]?.frequency || 0;
              if (client.implementationDate && duration > 0) {
                const expirationDate = dayjs(client.implementationDate).add(duration, 'month');
                const remaining = expirationDate.diff(dayjs(), 'month');
                remainingMonthsText = remaining < 0 ? 0 : remaining;
                if (remaining <= 6) textColorClass = 'text-danger';
              }
              actions += `<button class="btn-action btn-action-manage exec-pending-btn" data-path="${path}">
                            <i class="fas fa-tasks"></i> Gestionar
                          </button>`;
              rowHtml = `
                <tr data-doc-path="${path}">
                  <td><span class="code-text">${creationDate}</span></td>
                  <td><span class="code-text">${implementationDate}</span></td>
                  <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
                  <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
                  <td>${servicesHTML}</td>
                  <td>${createdByFullName}</td>
                  <td class="${textColorClass}">${remainingMonthsText}</td>
                  <td>${actions}</td>
                </tr>`;
            }

            // Limpiar tabla y mostrar solo este cliente
            tableBody.innerHTML = rowHtml;

            // Rehabilitar event listeners para esta fila
            const row = tableBody.querySelector('tr');
            row.querySelectorAll('.action-icon, .view-details-link').forEach(el => {
              el.addEventListener('click', (ev) => {
                const target = ev.currentTarget;
                const path = target.dataset.path;
                let mode = 'view';
                if (target.classList.contains('edit-details-btn'))   mode = 'edit';
                if (target.classList.contains('edit-services-btn'))  mode = 'edit-services';

                if (target.classList.contains('delete-btn')) {
                  showDeleteConfirmationModal(path);
                } else {
                  handleClientAction(path, mode);
                }
              });
            });

            row.querySelector('.mark-won-btn')?.addEventListener('click', (btn) => {
              openWonDatePickerModal(btn.target.dataset.path);
            });

            row.querySelector('.exec-pending-btn')?.addEventListener('click', (btn) => {
              openExecutionModal(btn.target.dataset.path, 'in_process');
            });

          } catch (error) {
            console.error('Error cargando cliente:', error);
            showMessage('Error al cargar el cliente', 'error');
          } finally {
            loadingOverlay.style.display = 'none';
          }
        });
        
        item.addEventListener('mouseenter', () => {
          suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(s => s.classList.remove('selected'));
          item.classList.add('selected');
        });
      });
      
      // Filtrar tabla mientras se busca (mostrar solo coincidencias en la página actual)
      const matchPaths = new Set(matches.map(m => m.path));
      tableBody.querySelectorAll('tr').forEach(row => {
        const rowPath = row.dataset.docPath;
        row.style.display = matchPaths.has(rowPath) ? '' : 'none';
      });
    });
    
    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest(`#${searchInputId}`) && !e.target.closest(`#${suggestionsId}`)) {
        suggestionsDropdown.classList.remove('active');
      }
    });
  }
  
  function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong style="color: var(--accent-color); font-weight: 600;">$1</strong>');
  }

  // =========================
  // Modal de confirmación de eliminación
  // =========================
  function showDeleteConfirmationModal(docPath) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal-overlay visible';
    confirmModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 3000;';
    
    confirmModal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 32px; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); text-align: center; animation: slideUp 0.3s ease-out;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h2 style="color: #333; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">¿Eliminar registro?</h2>
        <p style="color: #666; margin: 0 0 24px 0; line-height: 1.6; font-size: 14px;">Esta acción no se puede deshacer. El registro será eliminado de forma permanente.</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button class="delete-confirm-cancel" style="background: #e0e0e0; color: #333; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;">Cancelar</button>
          <button class="delete-confirm-accept" style="background: #f44336; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;" data-path="${docPath}">Sí, eliminar</button>
        </div>
      </div>
      <style>
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .delete-confirm-cancel:hover {
          background: #d0d0d0;
        }
        .delete-confirm-accept:hover {
          background: #e53935;
        }
      </style>
    `;
    
    document.body.appendChild(confirmModal);
    
    // Botón Cancelar
    confirmModal.querySelector('.delete-confirm-cancel').addEventListener('click', () => {
      confirmModal.remove();
    });
    
    // Botón Eliminar
    confirmModal.querySelector('.delete-confirm-accept').addEventListener('click', () => {
      const path = confirmModal.querySelector('.delete-confirm-accept').dataset.path;
      confirmModal.remove();
      handleDelete(path);
    });
    
    // Click fuera del modal para cancelar
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        confirmModal.remove();
      }
    });
  }

  async function handleDelete(docPath) {
    loadingOverlay.style.display = 'flex';
    try {
      // Validar que la ruta sea correcta
      if (!docPath || docPath.includes('undefined')) {
        console.error('Ruta inválida:', docPath);
        showMessage('Error: ruta de documento inválida.', 'error');
        loadingOverlay.style.display = 'none';
        return;
      }
      
      console.log('Eliminando documento:', docPath);
      await db.doc(docPath).delete();
      showMessage('Registro eliminado con éxito.', 'success');
      loadDashboardData();
      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
      if (active === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
    } catch (e) {
      console.error('Error al eliminar:', e);
      showMessage('No se pudo eliminar el registro.', 'error');
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  // =========================
  // Modal cliente (ver/editar)
  // =========================
  async function handleClientAction(docPath, mode) {
    if (mode === 'edit-services') {
      await openServicesEditor(docPath);
      return;
    }

    openModal(modalOverlay);
    modalBody.innerHTML = '<div class="dashboard-spinner"></div>';
    modalFooter.innerHTML = '';
    try {
      const snap = await db.doc(docPath).get();
      if (!snap.exists) throw new Error('Documento no encontrado.');
      const c = snap.data();
      modalTitle.textContent = mode === 'view' ? 'Detalles del Cliente' : 'Editar Detalles del Cliente';
      await populateModalBody(c, mode);
      populateModalFooter(docPath, mode);
    } catch (e) {
      console.error('Error cargar cliente:', e);
      modalBody.innerHTML = '<p style="color:red;">No se pudieron cargar los datos.</p>';
    }
  }

  async function populateModalBody(client, mode) {
    const isEdit = mode === 'edit';
    const createdByFullName = await getUserName(client.creadoPor);

    const fields = [
      { id: 'clientName', label: 'Nombre del Cliente', value: client.name, type: 'text',  editable: true },
      { id: 'clientRuc',  label: 'RUC',                value: client.ruc,  type: 'text',  editable: true },
      { id: 'contractType', label: 'Tipo de Contrato', value: client.contractType, type: 'select', editable: true, options: ['NUEVO','RENOVACION'] },
      { id: 'zone', label: 'Zona', value: client.zone, type: 'select', editable: true, options: ['SUR','NORTE','CENTRO','MINAS'] },
      { id: 'createdAt', label: 'Fecha de Creación', value: client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY HH:mm') : 'N/A', editable: false },
      { id: 'creadoPor', label: 'Registrado Por', value: createdByFullName, editable: false },
    ];
    if (client.clientStatus === CLIENT_STATUS.WON) {
      fields.push({ id: 'implementationDate', label: 'Fecha de Implementación', value: client.implementationDate ? dayjs(client.implementationDate).format('YYYY-MM-DD') : '', type: 'date', editable: true });
    }

    const fieldsHTML = fields.map(f => {
      const editable = isEdit && f.editable;
      let inner = `<span>${f.value || 'N/A'}</span>`;
      if (editable) {
        if (f.type === 'select') {
          const opts = (f.options||[]).map(opt => `<option value="${opt}" ${f.value===opt?'selected':''}>${opt}</option>`).join('');
          inner = `<select id="modal-${f.id}" class="modal-input">${opts}</select>`;
        } else {
          inner = `<input id="modal-${f.id}" type="${f.type}" value="${f.value || ''}" class="modal-input">`;
        }
      }
      return `<div class="modal-field"><label>${f.label}</label>${inner}</div>`;
    }).join('');

    let servicesHTML = `
      <div class="modal-field-full">
        <label>Servicios Contratados</label>
        <div class="table-responsive-modal">
          <table class="modal-services-table">
            <thead>
              <tr>
                <th>Valor Agregado</th><th>Tipo</th><th>Modalidad</th><th>Frecuencia (meses)</th>
                <th>Unidades</th><th>Meses</th><th>Costo Prov.</th><th>Total</th>
              </tr>
            </thead>
            <tbody>`;

    if (Array.isArray(client.offerings) && client.offerings.length) {
      client.offerings.forEach(o => {
        const tipo = (o.category?.includes('Vigilancia') || vigNames.includes(o.name)) ? 'Vigilancia' : 'Tecnología';
        const cost  = Number(o.cost || 0);
        const total = Number(o.total || 0);
        servicesHTML += `
          <tr>
            <td>${o.name || '-'}</td>
            <td>${tipo}</td>
            <td>${o.provisionMode || '-'}</td>
            <td>${o.frequency || '-'}</td>
            <td>${o.quantity || '-'}</td>
            <td>${o.months || '-'}</td>
            <td>S/ ${cost.toFixed(2)}</td>
            <td>S/ ${total.toFixed(2)}</td>
          </tr>`;
      });
    } else {
      servicesHTML += `<tr><td colspan="8">No hay servicios registrados.</td></tr>`;
    }
    servicesHTML += `</tbody></table></div></div>`;

    modalBody.innerHTML = `${fieldsHTML}${servicesHTML}`;
  }

  function populateModalFooter(docPath, mode) {
    modalFooter.innerHTML = '';
    if (mode === 'edit') {
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Guardar Cambios';
      saveBtn.className = 'modal-button btn-modal-primary';
      saveBtn.addEventListener('click', () => saveClientChanges(docPath, saveBtn));
      modalFooter.appendChild(saveBtn);
    }
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.className = 'modal-button btn-modal-secondary';
    closeBtn.addEventListener('click', () => closeModal(modalOverlay));
    modalFooter.appendChild(closeBtn);
    
    // Nota si no hay conexión
    if (!navigator.onLine) {
      const warning = document.createElement('p');
      warning.style.cssText = 'color: #ff9800; font-size: 12px; margin-top: 1rem;';
      warning.textContent = '⚠️ Sin conexión: Los cambios se guardarán cuando recuperes conexión.';
      modalFooter.appendChild(warning);
    }
  }

  async function saveClientChanges(docPath, btn) {
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const ref = db.doc(docPath);
      const snap = await ref.get();
      if (!snap.exists) throw new Error('El cliente ya no existe.');
      const original = snap.data();

      const updates = {};
      const changes = {};
      const map = [
        { id: 'clientName', key:'name' },
        { id: 'clientRuc',  key:'ruc' },
        { id: 'contractType', key:'contractType' },
        { id: 'zone', key:'zone' },
        { id: 'implementationDate', key:'implementationDate' }
      ];
      map.forEach(f => {
        const el = document.getElementById(`modal-${f.id}`);
        if (el) {
          const val = el.value;
          const old = original[f.key] || '';
          if (val !== old) { updates[f.key] = val; changes[f.key] = { from: old, to: val }; }
        }
      });

      if (Object.keys(updates).length) {
        // Agregar timestamp de actualización
        updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        try {
          // Intentar guardar con batch
          const batch = db.batch();
          batch.update(ref, updates);
          batch.set(ref.collection('logs').doc(), {
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user: auth.currentUser.email,
            action: 'update_details',
            changes
          });
          await batch.commit();
        } catch (batchError) {
          // Si falla el batch, intentar directamente
          console.warn('⚠️ Batch fallido, intentando actualización directa:', batchError);
          await ref.update(updates);
          console.log('✅ Actualización directa exitosa');
        }
        
        showMessage('Cambios guardados con éxito.', 'success');
      } else {
        showMessage('No se detectaron cambios.', 'warning');
      }
      closeModal(modalOverlay);
      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
      if (active === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
      loadDashboardData();
    } catch (e) {
      console.error('❌ Error guardando:', e);
      
      // Proporcionar mensajes más específicos según el error
      let errorMsg = 'No se pudieron guardar los cambios.';
      if (e.code === 'permission-denied') {
        errorMsg = 'Permiso denegado. Contacta al administrador para verificar permisos de Firestore.';
      } else if (e.message.includes('clientStatus')) {
        errorMsg = 'No puedes cambiar el estado del cliente desde aquí.';
      }
      
      showMessage(errorMsg, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar Cambios';
    }
  }

  // =========================
  // Editor de Servicios
  // =========================
  async function openServicesEditor(docPath) {
    editVigilanciaContainer.innerHTML = '';
    editTecnologiaContainer.innerHTML = '';
    document.getElementById('services-editor-doc-path').value = docPath;
    openModal(servicesEditorModal);

    try {
      const snap = await db.doc(docPath).get();
      if (!snap.exists) throw new Error('Documento no encontrado');
      const data = snap.data() || {};
      const curr = Array.isArray(data.offerings) ? data.offerings : [];

      curr.forEach(o => {
        const cat = o.category || (vigNames.includes(o.name) ? VIGILANCIA_CATEGORY : TECNOLOGIA_CATEGORY);
        const container = cat === VIGILANCIA_CATEGORY ? editVigilanciaContainer : editTecnologiaContainer;
        container.appendChild(createOfferingRow(cat, o));
      });

      if (!editVigilanciaContainer.children.length) editVigilanciaContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
      if (!editTecnologiaContainer.children.length) editTecnologiaContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));

      // Asegura que los selects muestren lo último de Firestore
      refreshAllOfferingSelects();

    } catch (e) {
      console.error('Error abriendo editor:', e);
      showMessage('No se pudieron cargar los servicios.', 'error');
      closeModal(servicesEditorModal);
    }
  }

  async function saveServicesChanges() {
    const docPath = document.getElementById('services-editor-doc-path').value;

    const collect = (container) => {
      return Array.from(container.querySelectorAll('.offering-row')).map(row => {
        const name = row.querySelector('.offering-name').value || '';
        const category = row.querySelector('.offering-category').value || VIGILANCIA_CATEGORY;
        const provisionMode = row.querySelector('.offering-provision-mode').value || 'Por todo el contrato';
        const frequency = parseFloat(row.querySelector('.offering-frequency').value) || 6;
        const quantity  = parseFloat(row.querySelector('.offering-quantity').value)  || 1;
        const months    = parseFloat(row.querySelector('.offering-months').value)    || frequency;
        const cost      = parseFloat(row.querySelector('.offering-cost').value)      || 0;
        const total     = parseFloat((row.querySelector('.offering-total').value || '0').replace(/[^\d.]/g,'')) || 0;
        return { name, category, provisionMode, frequency, quantity, months, cost, total };
      });
    };

    const newOfferings = [
      ...collect(editVigilanciaContainer),
      ...collect(editTecnologiaContainer),
    ];

    // Validar que haya al menos un servicio
    if (newOfferings.length === 0) {
      showMessage('Debes agregar al menos un servicio.', 'warning');
      return;
    }

    // Validar que todos los servicios tengan nombre
    if (newOfferings.some(o => !o.name || o.name.trim() === '')) {
      showMessage('Todos los servicios deben tener un nombre seleccionado.', 'warning');
      return;
    }

    servicesEditorSaveBtn.disabled = true;
    servicesEditorSaveBtn.textContent = 'Guardando…';
    loadingOverlay.style.display = 'flex';
    try {
      const ref = db.doc(docPath);
      const orig = await ref.get();
      const origData = orig.data() || {};
      
      const updates = {
        offerings: newOfferings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        // Intentar guardar con batch
        const batch = db.batch();
        batch.update(ref, updates);
        batch.set(ref.collection('logs').doc(), {
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          user: auth.currentUser.email,
          action: 'update_services',
          from: origData.offerings || [],
          to: newOfferings
        });
        await batch.commit();
      } catch (batchError) {
        // Si falla el batch, intentar directamente
        console.warn('⚠️ Batch fallido, intentando actualización directa:', batchError);
        await ref.update(updates);
        console.log('✅ Actualización directa de servicios exitosa');
      }

      showMessage('Servicios actualizados con éxito.', 'success');
      closeModal(servicesEditorModal);

      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
      if (active === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
      loadDashboardData();
    } catch (e) {
      console.error('❌ Error guardando servicios:', e);
      
      // Proporcionar mensajes más específicos según el error
      let errorMsg = 'No se pudieron guardar los cambios.';
      if (e.code === 'permission-denied') {
        errorMsg = 'Permiso denegado. Contacta al administrador para verificar permisos de Firestore.';
      } else if (e.message.includes('No se pudo guardar. Verifica')) {
        errorMsg = e.message;
      }
      
      showMessage(errorMsg, 'error');
    } finally {
      servicesEditorSaveBtn.disabled = false;
      servicesEditorSaveBtn.textContent = 'Guardar Cambios';
      loadingOverlay.style.display = 'none';
    }
  }

  function createOfferingRow(category, offeringData = {}) {
    const row = document.createElement('div');
    row.className = 'offering-row premium-light-row';

    const options = buildOptionsHTML(category, offeringData.name);
    const totalVal = Number(offeringData.total || 0).toFixed(2);

    row.innerHTML = `
      <div class="offering-row-grid">
        <!-- Fila Superior: Nombre y Acciones -->
        <div class="offering-grid-header">
          <div class="offering-name-wrapper">
            <select class="offering-name">
              <option value="">Seleccionar servicio...</option>
              ${options}
            </select>
            <button type="button" class="btn-add-option-mini" title="Nueva opción"><i class="fas fa-plus"></i></button>
          </div>
          <button type="button" class="remove-offering-row-btn-mini" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
          <input type="hidden" class="offering-category" value="${category}">
        </div>

        <!-- Fila Inferior: Detalles -->
        <div class="offering-grid-details">
          <div class="detail-field">
            <span class="detail-label">Unidades</span>
            <input type="number" class="offering-quantity" min="1" value="${offeringData.quantity ?? 1}" placeholder="Cant.">
          </div>
          <div class="detail-field">
            <span class="detail-label">Modalidad</span>
            <select class="offering-provision-mode">
              <option value="Por todo el contrato" ${offeringData.provisionMode === 'Por todo el contrato' ? 'selected' : ''}>Por Contrato</option>
              <option value="Por cada mes" ${offeringData.provisionMode === 'Por cada mes' ? 'selected' : ''}>Mensual</option>
            </select>
          </div>
          <div class="detail-field">
            <span class="detail-label">Frecuencia</span>
            <select class="offering-frequency">
              <option value="1" ${offeringData.frequency == 1 ? 'selected' : ''}>1 mes</option>
              <option value="6" ${offeringData.frequency == 6 ? 'selected' : ''}>6 meses</option>
              <option value="12" ${offeringData.frequency == 12 ? 'selected' : ''}>12 meses</option>
              <option value="24" ${offeringData.frequency == 24 ? 'selected' : ''}>24 meses</option>
              <option value="36" ${offeringData.frequency == 36 ? 'selected' : ''}>36 meses</option>
            </select>
          </div>
          <div class="detail-field">
            <span class="detail-label">Meses</span>
            <input type="number" class="offering-months" min="1" value="${offeringData.months ?? (offeringData.frequency ?? 6)}" placeholder="Meses">
          </div>
          <div class="detail-field">
            <span class="detail-label">Costo Prov.</span>
            <input type="number" class="offering-cost" min="0" step="0.01" value="${offeringData.cost ?? 0}" placeholder="Costo">
          </div>
          <div class="detail-field total-field">
            <span class="detail-label">Total</span>
            <input type="text" class="offering-total" value="S/ ${totalVal}" readonly>
          </div>
        </div>
      </div>
    `;

    // Lógica de totales
    const compute = () => {
      const q = parseFloat(row.querySelector('.offering-quantity').value) || 0;
      const c = parseFloat(row.querySelector('.offering-cost').value) || 0;
      const pm = row.querySelector('.offering-provision-mode').value;
      const f = parseFloat(row.querySelector('.offering-frequency').value) || 6;
      const mos = parseFloat(row.querySelector('.offering-months').value) || f;
      
      const total = (pm === 'Por todo el contrato') ? (c * q) : ((c * q) * mos);
      row.querySelector('.offering-total').value = `S/ ${total.toFixed(2)}`;
    };

    row.addEventListener('input', compute);
    row.addEventListener('change', compute);
    row.querySelector('.remove-offering-row-btn-mini')?.addEventListener('click', () => row.remove());
    
    // Event listener para el botón "+"
    const addOptionBtn = row.querySelector('.btn-add-option-mini');
    addOptionBtn?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const sel = row.querySelector('.offering-name');
      showAddOptionModal(category, sel);
    });

    if (offeringData.name) compute();
    return row;
  }

  // =========================
  // Ejecución (gestión)
  // =========================
  let currentExecPath = null;
  const execOverlay = document.getElementById('execution-modal-overlay');

  function openExecutionModal(docPath, mode) {
    currentExecPath = docPath;
    const container = document.getElementById('execution-items-list');
    const title = document.getElementById('execution-modal-title');
    title.textContent = mode === 'executed' ? 'Marcar Servicios como Ejecutados' : 'Marcar Servicios en Proceso';
    container.innerHTML = `
      <div class="execution-loading">
        <div class="mini-spinner"></div>
        <p>Cargando servicios...</p>
      </div>
    `;
    
    openModal(execOverlay);

    db.doc(docPath).get().then(snap => {
      const data = snap.data() || {};
      const items = Array.isArray(data.offerings) ? data.offerings : [];
      const execOfferings = (data.execution && Array.isArray(data.execution.offerings))
        ? data.execution.offerings
        : items.map(o => ({ name:o.name, status:'pending' }));

      const statusMap = new Map(execOfferings.map(x => [x.name, x.status]));
      
      if (items.length === 0) {
        container.innerHTML = `
          <div class="no-services-message">
            <i class="fas fa-inbox"></i>
            <p>No hay servicios contratados</p>
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      items.forEach((o, index) => {
        const cur = statusMap.get(o.name) || 'pending';
        const isExecuted = cur === 'executed';
        const statusLabels = { 
          pending: 'Pendiente',
          in_process: 'En Proceso',
          executed: 'Ejecutado'
        };
        
        const itemEl = document.createElement('div');
        itemEl.className = 'execution-item';
        itemEl.dataset.name = o.name;
        itemEl.dataset.status = cur;
        itemEl.style.animation = `slideInUp 0.3s ease-out ${index * 50}ms forwards`;
        itemEl.style.opacity = '0';
        
        let statusColor = 'var(--text-secondary)';
        let statusBgColor = '#f0f0f0';
        let statusIcon = 'fas fa-clock';
        
        if (cur === 'executed') {
          statusColor = '#4caf50';
          statusBgColor = 'rgba(76, 175, 80, 0.1)';
          statusIcon = 'fas fa-check-circle';
        } else if (cur === 'in_process') {
          statusColor = '#ff9800';
          statusBgColor = 'rgba(255, 152, 0, 0.1)';
          statusIcon = 'fas fa-spinner';
        }

        if (isExecuted) {
          itemEl.innerHTML = `
            <div class="execution-item-content">
              <div class="execution-service-info">
                <div class="execution-service-name">${o.name}</div>
                <div class="execution-service-category">${o.category || 'Sin categoría'}</div>
              </div>
              <div class="execution-status-badge" style="background-color: ${statusBgColor}; color: ${statusColor};">
                <i class="${statusIcon}"></i>
                <span>${statusLabels[cur]}</span>
              </div>
              <div class="execution-item-action">
                <button class="execution-item-disabled" disabled title="Este servicio ya está ejecutado">
                  <i class="fas fa-check"></i>
                </button>
              </div>
            </div>
          `;
          itemEl.classList.add('execution-item-disabled-state');
        } else {
          const next = mode === 'executed' ? 'executed' : 'in_process';
          const btnText = mode === 'executed' ? 'Ejecutado' : 'En Proceso';
          const btnIcon = mode === 'executed' ? 'fa-check-double' : 'fa-arrow-right';
          
          itemEl.innerHTML = `
            <div class="execution-item-content">
              <div class="execution-service-info">
                <div class="execution-service-name">${o.name}</div>
                <div class="execution-service-category">${o.category || 'Sin categoría'}</div>
              </div>
              <div class="execution-status-badge" style="background-color: ${statusBgColor}; color: ${statusColor};">
                <i class="${statusIcon}"></i>
                <span>${statusLabels[cur]}</span>
              </div>
              <div class="execution-item-action">
                <button class="execution-item-btn mark-exec-item" data-next-status="${next}" data-service="${o.name}">
                  <i class="fas ${btnIcon}"></i>
                  <span>${btnText}</span>
                </button>
              </div>
            </div>
          `;
        }
        
        container.appendChild(itemEl);
        
        // Event listener para cambio de estado
        const btn = itemEl.querySelector('.mark-exec-item');
        if (btn) {
          btn.addEventListener('click', () => {
            handleExecutionItemChange(itemEl, btn.dataset.nextStatus, statusLabels);
          });
        }
      });

      // Agregar event listeners a los botones del modal
      const cancelBtn = document.getElementById('execution-modal-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModal(execOverlay));
      }
    }).catch(err => {
      console.error('Error cargando servicios:', err);
      container.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Error al cargar los servicios</p>
        </div>
      `;
    });
  }

  function handleExecutionItemChange(itemEl, newStatus, statusLabels) {
    const serviceName = itemEl.dataset.name;
    
    // Animar el cambio
    itemEl.classList.add('execution-item-updating');
    
    const statusColors = {
      pending: { color: '#6c757d', bgColor: '#f0f0f0', icon: 'fas fa-clock' },
      in_process: { color: '#ff9800', bgColor: 'rgba(255, 152, 0, 0.1)', icon: 'fas fa-spinner' },
      executed: { color: '#4caf50', bgColor: 'rgba(76, 175, 80, 0.1)', icon: 'fas fa-check-circle' }
    };
    
    const newStatusInfo = statusColors[newStatus];
    
    // Esperar a que termine la animación
    setTimeout(() => {
      // Actualizar el badge de estado
      const badge = itemEl.querySelector('.execution-status-badge');
      if (badge) {
        badge.style.backgroundColor = newStatusInfo.bgColor;
        badge.style.color = newStatusInfo.color;
        badge.innerHTML = `
          <i class="${newStatusInfo.icon}"></i>
          <span>${statusLabels[newStatus]}</span>
        `;
      }
      
      // Reemplazar el botón con uno deshabilitado
      const actionDiv = itemEl.querySelector('.execution-item-action');
      if (actionDiv) {
        actionDiv.innerHTML = `
          <button class="execution-item-btn-success" disabled>
            <i class="fas fa-check"></i>
            <span>Marcado</span>
          </button>
        `;
      }
      
      // Actualizar el dataset del estado
      itemEl.dataset.status = newStatus;
      itemEl.classList.remove('execution-item-updating');
      itemEl.classList.add('execution-item-changed');
      
      // Mostrar feedback
      showStatusChangeNotification(serviceName, newStatus, statusLabels);
    }, 300);
  }

  function showStatusChangeNotification(serviceName, status, statusLabels) {
    const notification = document.createElement('div');
    notification.className = 'execution-notification';
    notification.innerHTML = `
      <div class="execution-notification-content">
        <i class="fas fa-check-circle"></i>
        <div>
          <strong>${serviceName}</strong>
          <p>Marcado como ${statusLabels[status].toLowerCase()}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  async function saveExecutionModal() {
    const saveBtn = document.getElementById('execution-modal-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    loadingOverlay.style.display = 'flex';
    try {
      const ref = db.doc(currentExecPath);
      const snap = await ref.get();
      const data = snap.data() || {};
      const items = Array.from(document.querySelectorAll('#execution-items-list .execution-item'));
      let hasChanges = false, allExecuted = true, becameInProcess = false;

      const statusMap = new Map((data.execution?.offerings || []).map(x => [x.name, { ...x }]));

      items.forEach(itemEl => {
        const name = itemEl.dataset.name;
        const currentStatus = itemEl.dataset.status;
        const oldStatus = statusMap.get(name)?.status || 'pending';
        
        if (currentStatus !== oldStatus) {
          hasChanges = true;
          const o = statusMap.get(name) || { name, status: 'pending' };
          o.status = currentStatus;
          o.statusChangedAt = firebase.firestore.Timestamp.now();
          if (currentStatus === 'in_process') becameInProcess = true;
          statusMap.set(name, o);
        }
      });

      if (!hasChanges) { 
        showMessage('No se realizaron cambios.', 'warning');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Guardar Cambios';
        loadingOverlay.style.display = 'none';
        return; 
      }

      const updated = Array.from(statusMap.values());
      updated.forEach(o => { if (o.status !== 'executed') allExecuted = false; });
      const overall = allExecuted
        ? 'executed'
        : (becameInProcess || updated.some(o => o.status === 'in_process') ? 'in_process' : 'pending');

      console.log('📝 Guardando ejecución:', {
        path: currentExecPath,
        updated: updated,
        overall: overall
      });

      await ref.update({
        'execution.offerings': updated,
        'execution.overallStatus': overall,
        'execution.lastUpdated': firebase.firestore.Timestamp.now()
      });

      console.log('✅ Datos guardados correctamente');
      showMessage(`Cambios guardados exitosamente. Estado general: ${overall}.`, 'success');
      closeModal(document.getElementById('execution-modal-overlay'));
      loadExecList();
    } catch (e) {
      console.error('❌ Error guardando cambios:', e);
      console.error('Código de error:', e.code);
      console.error('Mensaje:', e.message);
      showMessage(`Error: ${e.message || 'No se pudieron guardar los cambios.'}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-check"></i> Guardar Cambios';
      loadingOverlay.style.display = 'none';
    }
  }

  async function loadExecList() {
    const tbody = document.getElementById('exec-table-body');
    tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
    try {
      const snap = await db.collectionGroup('clients')
        .where('clientStatus', '==', CLIENT_STATUS.WON)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const rows = await Promise.all(snap.docs.map(async d => {
        const c = d.data();
        const createdBy = await getUserName(c.creadoPor);
        const count = c.offerings ? c.offerings.length : 0;
        const servicesHTML = `<div class="service-summary"><span class="service-count">${count} Servicio${count!==1?'s':''}</span> <a class="view-details-link" data-path="${d.ref.path}"><i class="fas fa-list-ul"></i> Ver Detalles</a></div>`;
        return `
          <tr>
            <td><span class="code-text">${c.createdAt ? dayjs(c.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A'}</span></td>
            <td><span class="client-name-highlight">${c.name || 'N/A'}</span></td>
            <td><span class="code-text">${c.ruc || 'N/A'}</span></td>
            <td>${servicesHTML}</td>
            <td>${createdBy}</td>
            <td><span class="badge ${c.execution?.status==='executed'?'badge-success':(c.execution?.status==='in_process'?'badge-warning':'badge-default')}">${c.execution?.status || 'pending'}</span></td>
            <td><button class="btn-action btn-action-manage exec-pending-btn" data-path="${d.ref.path}"><i class="fas fa-tasks"></i> Gestionar</button></td>
          </tr>`;
      }));
      tbody.innerHTML = rows.join('');

      tbody.querySelectorAll('.exec-pending-btn').forEach(btn => {
        btn.addEventListener('click', () => openExecutionModal(btn.dataset.path, 'in_process'));
      });
      tbody.querySelectorAll('.view-details-link').forEach(a => {
        a.addEventListener('click', () => handleClientAction(a.dataset.path, 'view'));
      });
    } catch (e) {
      console.error('Error exec list:', e);
      tbody.innerHTML = '<tr><td colspan="7">Error al cargar los datos.</td></tr>';
    }
  }

  // Delegado global (cerrar/guardar modales de ejecución/fecha)
  document.addEventListener('click', (e) => {
    if (e.target.id === 'execution-modal-close' || e.target.closest('#execution-modal-close')) closeModal(execOverlay);
    if (e.target.id === 'execution-modal-save') saveExecutionModal();

    if (e.target.id === 'date-picker-close-btn' || e.target.closest('#date-picker-close-btn')) closeModal(datePickerModal);
    if (e.target.id === 'date-picker-cancel-btn' || e.target.closest('#date-picker-cancel-btn')) closeModal(datePickerModal);
    if (e.target.id === 'date-picker-confirm-btn') handleConfirmWon();
  });

  // =========================
  // “Marcar como GANADO”
  // =========================
  function openWonDatePickerModal(docPath) {
    datePickerDocPathEl.value = docPath;
    datePickerInput.value = new Date().toISOString().split('T')[0];
    openModal(datePickerModal);
  }

  async function handleConfirmWon() {
    const docPath = datePickerDocPathEl.value;
    const dateVal = datePickerInput.value; // YYYY-MM-DD
    if (!dateVal) { showMessage('Selecciona una fecha.', 'warning'); return; }
    try {
      const ref = db.doc(docPath);
      await ref.update({
        clientStatus: CLIENT_STATUS.WON,
        implementationDate: dateVal,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showMessage('Marcado como GANADO.', 'success');
      closeModal(datePickerModal);
      loadDashboardData();
      loadTableData(CLIENT_STATUS.PENDING, 'initial');
      loadTableData(CLIENT_STATUS.WON, 'initial');
    } catch (e) {
      console.error(e);
      showMessage('No se pudo marcar como GANADO.', 'error');
    }
  }

  // =========================
  // Mensajería entre ventanas
  // =========================
  window.addEventListener('message', (event) => {
    if (event.data === 'clientUpdated' || event.data === 'clientAdded') {
      loadDashboardData();
      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
      if (active === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
    }
  });
});
