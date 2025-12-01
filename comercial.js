// operativo.js — Operativo con Editor de Servicios y desplegables (mismo flujo que Comercial)

// SISTEMA DE MENSAJES MODAL (definido ANTES de DOMContentLoaded)
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

document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // 1) FIREBASE & CONSTANTES
  // =========================
  if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
    showMessage("Error crítico de configuración. Revisa la consola.", "error");
    return;
  }
  if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  // Usar db global de firebase-config.js en lugar de redeclararla
  // const db   = firebase.firestore();
  window.auth = auth; 
  // window.db ya está definida en firebase-config.js

  let servicesChart = null;

  const CLIENT_STATUS = { WON: 'Ganado' };
  const PAGE_SIZE = 10;
  const paginationState = {
    'Ofrecido': { lastDoc: null, pageHistory: [null] },
    [CLIENT_STATUS.WON]: { lastDoc: null, pageHistory: [null] },
  };

  const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
  const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';

  // === Catálogo dinámico desde DESPEGABLES (sincronizado con Nueva App) ===
  let vigNames = [];
  let tecNames = [];

  // =========================
  // 2) HELPERS
  // =========================
  const userNameCache = {};
  async function getUserName(email) {
    if (!email) return 'Desconocido';
    if (userNameCache[email]) return userNameCache[email];
    try {
      const username = email.split('@')[0].toUpperCase();
      const snap = await db.collection('usuarios').doc(username).get();
      userNameCache[email] = (snap.exists && snap.data().NOMBRE) ? snap.data().NOMBRE : email;
    } catch {
      userNameCache[email] = email;
    }
    return userNameCache[email];
  }

  function normDateToDayjs(val) {
    try {
      if (!val) return null;
      if (typeof val === 'string') return dayjs(val);
      if (val?.toDate) return dayjs(val.toDate());
      return dayjs(val);
    } catch { return null; }
  }

  // === Funciones compartidas desde shared-utils.js ===
  // - parseDesplegableDoc()
  // - loadOfferingsFromFirestore()
  // - watchDesplegablesRealtime()
  // - getUserName()
  // - addOptionToFirestore()

  // =========================
  // 3) ELEMENTOS DEL DOM
  // =========================
  const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
  const menuOptions = document.querySelectorAll('.menu-option');

  const modalOverlay = document.getElementById('client-modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  // Editor de Servicios
  const servicesEditorModal     = document.getElementById('services-editor-modal');
  const servicesEditorCloseBtn  = document.getElementById('services-editor-close-btn');
  const servicesEditorCancelBtn = document.getElementById('services-editor-cancel-btn');
  const servicesEditorSaveBtn   = document.getElementById('services-editor-save-btn');
  const editVigilanciaContainer = document.getElementById('edit-vigilancia-offerings-container');
  const editTecnologiaContainer = document.getElementById('edit-tecnologia-offerings-container');
  const addVigilanciaBtn        = document.getElementById('edit-add-vigilancia-btn');
  const addTecnologiaBtn        = document.getElementById('edit-add-tecnologia-btn');

  // =========================
  // 4) AUTENTICACIÓN
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
  
  auth.onAuthStateChanged(async user => {
    if (user) {
      // Guardar el UID del usuario para consultas posteriores
      window.currentUserId = user.uid;
      console.log('👤 Usuario autenticado con UID:', user.uid);
      
      const userName = sessionStorage.getItem('userName');
      document.getElementById('user-fullname').textContent = userName || user.email;
      
      // Esperar a que shared-utils esté disponible
      await waitForSharedUtils();
      
      // Cargar desplegables usando shared-utils.js
      const comercialState = { vigNames, tecNames };
      
      try {
        await loadOfferingsFromFirestore({
          state: comercialState,
          onSuccess: () => {
            vigNames = comercialState.vigNames;
            tecNames = comercialState.tecNames;
            console.log('✅ Desplegables cargados en comercial.js');
          }
        });
      } catch (error) {
        console.error('❌ Error cargando desplegables:', error);
      }
      
      watchDesplegablesRealtime({
        state: comercialState,
        onUpdate: () => {
          vigNames = comercialState.vigNames;
          tecNames = comercialState.tecNames;
          console.log('🔄 Desplegables actualizados en tiempo real');
        }
      });
      
      showSection('inicio');
    } else {
      window.location.replace('index.html');
    }
  });

  // Función para esperar a que los catálogos estén cargados
  async function ensureCatalogLoaded() {
    return new Promise(resolve => {
      if (vigNames.length > 0 && tecNames.length > 0) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (vigNames.length > 0 && tecNames.length > 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        // Timeout después de 10 segundos
        setTimeout(() => {
          clearInterval(checkInterval);
          console.warn('⚠️ Los catálogos tardaron demasiado en cargar');
          resolve();
        }, 10000);
      }
    });
  }

  // =========================
  // 5) NAVEGACIÓN
  // =========================
  document.getElementById('logout-btn')?.addEventListener('click', () => auth.signOut());
  menuOptions.forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));

  document.getElementById('pending-card')?.addEventListener('click', () => showSection('pendientes'));
  document.getElementById('won-card')?.addEventListener('click',   () => showSection('ganados'));
  document.getElementById('expiring-card')?.addEventListener('click', () => showSection('ganados'));
  document.getElementById('in-process-card')?.addEventListener('click', () => showSection('ejecucion'));

  function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('is-visible'));
    const sectionToShow = document.getElementById(`${sectionId}-section`);
    if (!sectionToShow) return;
    sectionToShow.classList.add('is-visible');

    menuOptions.forEach(btn => btn.classList.toggle('active', btn.dataset.section === sectionId));

    if (sectionId === 'inicio')     loadDashboardData();
    if (sectionId === 'pendientes') loadTableData('Ofrecido', 'initial');
    if (sectionId === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
    if (sectionId === 'ejecucion')  loadExecList();
  }

  // =========================
  // 6) DASHBOARD
  // =========================
  async function loadDashboardData() {
    const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    const startTime = Date.now();
    try {
      const userId = auth.currentUser?.uid;
      const userEmail = auth.currentUser?.email;
      console.log('🔍 Dashboard - Usuario autenticado:', { userId, userEmail });
      
      if (!userId) {
        console.error('❌ No hay usuario autenticado');
        throw new Error('Usuario no autenticado');
      }
      
      // Leer directamente de users/{userId}/clients (sin filtros adicionales)
      const clientsSnapshot = await db.collection('users').doc(userId).collection('clients').get();
      console.log(`✅ Clientes encontrados en users/${userId}/clients: ${clientsSnapshot.docs.length}`);
      
      const clients = clientsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📄 Cliente:', {
          id: doc.id,
          name: data.name,
          clientStatus: data.clientStatus,
          creadoPor: data.creadoPor,
          zone: data.zone
        });
        return data;
      });
      
      // Separar clientes por estado
      const pendingClients = clients.filter(c => c.clientStatus === 'Ofrecido');
      const wonClients = clients.filter(c => c.clientStatus === CLIENT_STATUS.WON);

      // Actualizar contadores
      const pendingCountEl = document.getElementById('pending-count');
      const wonCountEl = document.getElementById('won-count');
      const expiringEl = document.getElementById('expiring-count');
      
      if (pendingCountEl) pendingCountEl.textContent = pendingClients.length;
      if (wonCountEl) wonCountEl.textContent = wonClients.length;
      
      const expiringCount = wonClients.filter(c => {
        const duration = c.offerings?.[0]?.frequency || 0;
        if (c.implementationDate && duration > 0) {
          return dayjs(c.implementationDate).add(duration, 'month').diff(dayjs(), 'month') <= 6;
        }
        return false;
      }).length;
      
      if (expiringEl) expiringEl.textContent = expiringCount;

      // Pasar TODOS los clientes para actualizar widgets (no solo wonClients)
      updateDashboardWidgets(clients);
      console.log(`✅ Dashboard cargado en ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error("❌ Error cargando datos del dashboard:", error);
      // Mostrar valores por defecto con validación de nulos
      const pendingCountEl = document.getElementById('pending-count');
      const wonCountEl = document.getElementById('won-count');
      const expiringEl = document.getElementById('expiring-count');
      
      if (pendingCountEl) pendingCountEl.textContent = '0';
      if (wonCountEl) wonCountEl.textContent = '0';
      if (expiringEl) expiringEl.textContent = '0';
    } finally {
      const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
  }

  function updateDashboardWidgets(clients) {
    console.log('📊 updateDashboardWidgets - Clientes recibidos:', clients);
    let vaCount = 0, vatCount = 0;
    let pendingExecCount = 0, inProcessExecCount = 0, executedCount = 0;
    const userRanking = {};

    clients.forEach(client => {
      console.log('📋 Procesando cliente:', { 
        name: client.name, 
        offerings: client.offerings,
        execution: client.execution
      });
      
      const userEmail = client.creadoPor || 'Desconocido';
      userRanking[userEmail] = (userRanking[userEmail] || 0) + 1;

      if (Array.isArray(client.offerings)) {
        client.offerings.forEach(offer => {
          console.log('🎁 Oferta:', { name: offer.name, category: offer.category });
          if ((offer.category || '').includes('Vigilancia')) vaCount++;
          else if ((offer.category || '').includes('Tecnología') || (offer.category || '').includes('Tecnologia')) vatCount++;
        });
      }

      if (client.execution && Array.isArray(client.execution.offerings)) {
        client.execution.offerings.forEach(execOffer => {
          switch (execOffer.status) {
            case 'in_process': inProcessExecCount++; break;
            case 'executed':   executedCount++; break;
            default:           pendingExecCount++; break;
          }
        });
      } else if (Array.isArray(client.offerings)) {
        pendingExecCount += client.offerings.length;
      }
    });

    console.log('📊 Conteos:', { vaCount, vatCount, pendingExecCount, inProcessExecCount, executedCount, userRanking });

    const sortedUsers = Object.entries(userRanking).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const userRankingList = document.getElementById('user-ranking-list');
    if (userRankingList) {
      userRankingList.innerHTML =
        sortedUsers.map(([email, count]) => `<li><span class="user-info">${email.split('@')[0]}</span><strong class="user-rank">${count}</strong></li>`).join('')
        || '<li>No hay datos en esta zona.</li>';
    }

    const vaCountEl = document.getElementById('va-count');
    const vatCountEl = document.getElementById('vat-count');
    
    if (vaCountEl) vaCountEl.textContent = vaCount;
    if (vatCountEl) vatCountEl.textContent = vatCount;

    renderExecutionChart(pendingExecCount, inProcessExecCount, executedCount);
  }

  function renderExecutionChart(pending, inProcess, executed) {
    const chartEl = document.getElementById('services-chart');
    if (!chartEl) {
      console.warn('⚠️ Elemento services-chart no encontrado');
      return;
    }
    
    const ctx = chartEl.getContext('2d');
    if (servicesChart) servicesChart.destroy();
    Chart.register(ChartDataLabels);
    servicesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Pendiente de Ejecución', 'En Proceso', 'Ejecutado'],
        datasets: [{ label: 'Cantidad de Servicios', data: [pending, inProcess, executed] }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { color: '#ffffff', anchor: 'end', align: 'start', offset: -20,
            font: { weight: 'bold' }, formatter: (v) => v > 0 ? v : '' }
        },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  // =========================
  // 7) TABLAS
  async function loadTableData(status, direction = 'next') {
    loadingOverlay.style.display = 'flex';
    const state = paginationState[status];
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("Usuario no autenticado");
      
      // Usar direct path access en lugar de collectionGroup
      // Esto evita problemas de índices de Firestore
      let allDocs = [];
      const clientsRef = db.collection('users').doc(userId).collection('clients');
      const snapshot = await clientsRef.get();
      
      // Filtrar por status localmente
      allDocs = snapshot.docs.filter(doc => doc.data().clientStatus === status);
      
      // Ordenar por createdAt descendente
      allDocs.sort((a, b) => {
        const aDate = a.data().createdAt?.toDate() || new Date(0);
        const bDate = b.data().createdAt?.toDate() || new Date(0);
        return bDate - aDate;
      });
      
      // Aplicar paginación
      const PAGE_SIZE = 10;
      if (direction === 'initial') { state.lastDoc = null; state.pageHistory = [null]; }
      
      const startIdx = state.pageHistory.length > 0 ? (state.pageHistory.length - 1) * PAGE_SIZE : 0;
      const docs = allDocs.slice(startIdx, startIdx + PAGE_SIZE);
      
      if (direction === 'next' && docs.length > 0) { 
        state.lastDoc = docs[docs.length - 1]; 
        state.pageHistory.push(state.lastDoc); 
      } else if (direction === 'prev') { 
        state.pageHistory.pop(); 
        state.lastDoc = state.pageHistory[state.pageHistory.length - 1]; 
      } else if (direction === 'initial' && docs.length > 0) { 
        state.lastDoc = docs[docs.length - 1]; 
        state.pageHistory = [null, state.lastDoc]; 
      }
      
      await renderTable(docs, status);
      updatePaginationButtons(status, docs.length);
    } catch (error) {
      console.error(`Error cargando tabla de ${status}:`, error);
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  async function renderTable(docs, status) {
    // Determinar qué tabla usar según el status
    const tableBodyId = status === 'Ofrecido' ? 'pending-table-body' : 'won-table-body';
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) {
      console.error(`❌ Tabla con ID ${tableBodyId} no encontrada`);
      return;
    }
    
    tbody.innerHTML = '';
    const colSpan = status === 'Ofrecido' ? 6 : 7;
    if (docs.length === 0) { 
      tbody.innerHTML = `<tr><td colspan="${colSpan}">No se encontraron registros.</td></tr>`; 
      return; 
    }

    const rowsHtml = await Promise.all(docs.map(async (doc) => {
      const client = doc.data();
      const docPath = doc.ref.path;
      const createdByFullName = await getUserName(client.creadoPor);

      const creationDate = client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A';
      const implementationDate = client.implementationDate ? dayjs(client.implementationDate).format('DD/MM/YYYY') : 'Pendiente';
      const servicesCount = client.offerings ? client.offerings.length : 0;
      const servicesHTML = `<div class="service-summary">
          <span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span>
          <a class="view-details-link" data-path="${docPath}"><i class="fas fa-list-ul"></i> Ver Detalles</a>
        </div>`;
      let remainingMonthsText = 'N/A', textColorClass = '';
      const duration = client.offerings?.[0]?.frequency || 0;
      
      // Debug logs
      if (status === 'Ganado') {
        console.log(`🔍 Cliente: ${client.name}, implementationDate:`, client.implementationDate, 'duration:', duration);
      }
      
      if (client.implementationDate && duration > 0) {
        const expirationDate = dayjs(client.implementationDate).add(duration, 'month');
        const remainingMonths = expirationDate.diff(dayjs(), 'month');
        remainingMonthsText = remainingMonths < 0 ? 0 : remainingMonths;
        if (remainingMonths <= 6) textColorClass = 'text-danger';
      }

      const actionsHTML = `
        <div class="action-icons-wrapper">
          <i class="fas fa-cogs action-icon edit-services-btn" data-path="${docPath}" title="Editar Servicios"></i>
        </div>
        <button class="btn-action btn-action-manage exec-pending-btn" data-path="${docPath}">
          <i class="fas fa-tasks"></i> Gestionar
        </button>`;

      // Renderizar diferentes columnas según el status
      if (status === 'Ofrecido') {
        return `<tr>
          <td><span class="code-text">${creationDate}</span></td>
          <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
          <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
          <td>${servicesHTML}</td>
          <td>${createdByFullName}</td>
          <td>${actionsHTML}</td>
        </tr>`;
      } else {
        return `<tr>
          <td><span class="code-text">${creationDate}</span></td>
          <td><span class="code-text">${implementationDate}</span></td>
          <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
          <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
          <td>${servicesHTML}</td>
          <td>${createdByFullName}</td>
          <td class="${textColorClass}">${remainingMonthsText}</td>
        </tr>`;
      }
    }));
    tbody.innerHTML = rowsHtml.join('');

    tbody.querySelectorAll('.exec-pending-btn, .view-details-link, .edit-services-btn').forEach(el => {
      el.addEventListener('click', (ev) => {
        const target = ev.currentTarget;
        const path = target.dataset.path;
        if (target.classList.contains('exec-pending-btn')) openExecutionModal(path, 'in_process');
        else if (target.classList.contains('view-details-link')) handleClientAction(path, 'view');
        else if (target.classList.contains('edit-services-btn')) openServicesEditor(path);
      });
    });
  }

  function updatePaginationButtons(status, fetchedCount) {
    // Determinar el prefijo según el status
    const prefix = status === 'Ofrecido' ? 'pending' : 'won';
    const prevBtn = document.getElementById(`${prefix}-prev`);
    const nextBtn = document.getElementById(`${prefix}-next`);
    
    if (prevBtn) prevBtn.disabled = paginationState[status].pageHistory.length <= 2;
    if (nextBtn) nextBtn.disabled = fetchedCount < PAGE_SIZE;
  }

  // =========================
  // 8) LISTA DE EJECUCIÓN
  // =========================
  async function loadExecList() {
    const tbody = document.getElementById('exec-table-body');
    tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
    try {
      const userId = window.currentUserId;
      if (!userId) throw new Error("Usuario no autenticado.");
      
      // Usar direct path access en lugar de collectionGroup
      const snap = await db.collection('users').doc(userId).collection('clients')
        .where('clientStatus', '==', 'Ganado')
        .where('execution.overallStatus', 'in', ['in_process', 'executed'])
        .orderBy('execution.updatedAt', 'desc')
        .get();

      if (snap.empty) { 
        tbody.innerHTML = '<tr><td colspan="7">No hay clientes en proceso de ejecución.</td></tr>'; 
        return; 
      }

      const rowsHtml = await Promise.all(snap.docs.map(async (doc) => {
        const d = doc.data();
        const createdByFullName = await getUserName(d.creadoPor);
        const status = (d.execution?.overallStatus || 'pending');
        const statusLabels = { in_process: 'En Proceso', executed: 'Ejecutado' };
        const servicesCount = (d.offerings || []).length;
        const servicesHTML = `<div class="service-summary">
            <span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span>
            <a class="view-details-link" data-path="${doc.ref.path}"><i class="fas fa-list-ul"></i> Ver Detalles</a>
          </div>`;
        // En Proceso de Ejecución es solo lectura - sin botones de editar/gestionar
        const actionsHTML = `<i class="fas fa-eye action-icon view-only-icon" title="Visualización"></i>`;
        return `<tr>
          <td><span class="code-text">${d.createdAt ? dayjs(d.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A'}</span></td>
          <td><span class="client-name-highlight">${d.name || 'N/A'}</span></td>
          <td><span class="code-text">${d.ruc || 'N/A'}</span></td>
          <td>${servicesHTML}</td>
          <td>${createdByFullName}</td>
          <td>${statusLabels[status] || status}</td>
          <td>${actionsHTML}</td>
        </tr>`;
      }));
      tbody.innerHTML = rowsHtml.join('');

      tbody.querySelectorAll('.view-details-link').forEach(el => {
        el.addEventListener('click', (ev) => {
          const target = ev.currentTarget;
          const path = target.dataset.path;
          handleClientAction(path, 'view');
        });
      });
    } catch (error) {
      console.error("Error cargando lista de ejecución:", error);
      tbody.innerHTML = '<tr><td colspan="7">Error al cargar los datos.</td></tr>';
    }
  }

  // =========================
  // 9) MODAL DETALLES
  // =========================
  function openModal(el) { el.classList.add('visible'); }
  function closeModal(el) { el.classList.remove('visible'); }

  async function handleClientAction(docPath, mode) {
    if (mode !== 'view') return;
    openModal(modalOverlay);
    modalBody.innerHTML = '<div class="dashboard-spinner"></div>';
    modalFooter.innerHTML = '';
    try {
      const docSnap = await db.doc(docPath).get();
      if (!docSnap.exists) throw new Error("Documento no encontrado.");
      const client = docSnap.data();
      modalTitle.textContent = 'Detalles del Cliente';
      await populateModalBody(client);
      modalFooter.innerHTML = '<button class="modal-button btn-modal-secondary">Cerrar</button>';
      modalFooter.querySelector('button').addEventListener('click', () => closeModal(modalOverlay));
    } catch (e) {
      console.error("Error al cargar datos del cliente:", e);
      modalBody.innerHTML = `<p style="color: red;">No se pudieron cargar los datos.</p>`;
    }
  }

  async function populateModalBody(client) {
    const createdByFullName = await getUserName(client.creadoPor);
    const fields = [
      { label: 'Nombre del Cliente', value: client.name },
      { label: 'RUC', value: client.ruc },
      { label: 'Tipo de Contrato', value: client.contractType },
      { label: 'Zona', value: client.zone },
      { label: 'Fecha de Creación', value: client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY HH:mm') : 'N/A' },
      { label: 'Registrado Por', value: createdByFullName },
      { label: 'Fecha de Implementación', value: client.implementationDate || 'N/A' }
    ];
    const fieldsHTML = fields.map(f => `<div class="modal-field"><label>${f.label}</label><span>${f.value || 'N/A'}</span></div>`).join('');

    let servicesTableHTML = `
      <div class="modal-field-full">
        <label>Servicios Contratados</label>
        <div class="table-responsive-modal">
          <table class="modal-services-table">
            <thead><tr><th>Valor Agregado</th><th>Tipo</th><th>Cant.</th><th>Meses</th><th>Costo Prov.</th><th>Total</th></tr></thead>
            <tbody>`;
    if (Array.isArray(client.offerings) && client.offerings.length) {
      client.offerings.forEach(o => {
        const tipo = (o.category || '').includes('Vigilancia') ? 'Vigilancia' : 'Tecnología';
        const cost  = Number(o.cost || 0);
        const total = Number(o.total || 0);
        servicesTableHTML += `<tr>
          <td>${o.name}</td><td>${tipo}</td>
          <td>${o.quantity || 1}</td><td>${o.frequency || 'N/A'}</td>
          <td>S/ ${cost.toFixed(2)}</td><td>S/ ${total.toFixed(2)}</td>
        </tr>`;
      });
    } else {
      servicesTableHTML += `<tr><td colspan="6">No hay servicios registrados.</td></tr>`;
    }
    servicesTableHTML += `</tbody></table></div></div>`;

    modalBody.innerHTML = fieldsHTML + servicesTableHTML;
  }

  // =========================
  // 10) MODAL EJECUCIÓN
  // =========================
  let currentExecPath = null;
  let currentExecMode = null;
  const executionModalOverlay = document.getElementById('execution-modal-overlay');

  function openExecutionModal(docPath, mode) {
    currentExecPath = docPath;
    currentExecMode = mode; // Guardar el modo actual
    const body = document.getElementById('execution-items-body');
    const title = document.getElementById('execution-modal-title');
    const datePickerWrapper = document.getElementById('execution-date-picker-wrapper');
    const dateInput = document.getElementById('execution-date-input');
    
    // Para modo "in_process" (desde Solicitudes Pendientes), mostrar "Ganado"
    // Para modo "executed" (desde otro lugar), mostrar "Marcar Servicios como Ejecutados"
    title.textContent = mode === 'executed' ? 'Marcar Servicios como Ejecutados' : 'Marcar Cliente como Ganado';
    
    // Mostrar/ocultar selector de fecha según el modo
    if (mode === 'in_process') {
      datePickerWrapper.style.display = 'block';
      dateInput.value = dayjs().format('YYYY-MM-DD');
    } else {
      datePickerWrapper.style.display = 'none';
    }
    
    body.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
    openModal(executionModalOverlay);

    db.doc(docPath).get().then(snap => {
      const data = snap.data() || {};
      const items = Array.isArray(data.offerings) ? data.offerings : [];
      const execOfferings = (data.execution && Array.isArray(data.execution.offerings))
        ? data.execution.offerings
        : items.map(o => ({ name: o.name, status: 'pending' }));
      const statusMap = new Map(execOfferings.map(x => [x.name, x.status]));
      body.innerHTML = '';
      items.forEach(o => {
        const currentStatus = statusMap.get(o.name) || 'pending';
        const statusLabels = { pending: 'Pendiente', in_process: 'En Proceso', executed: 'Ejecutado' };
        let buttonHTML = '';
        if (currentStatus === 'executed') {
          buttonHTML = `<button class="modal-button btn-modal-secondary btn-xs" disabled>Ejecutado</button>`;
        } else {
          const nextStatus = mode === 'executed' ? 'executed' : 'in_process';
          const buttonText = mode === 'in_process' ? 'Ganado' : 'Ejecutado';
          buttonHTML = `<button class="modal-button btn-modal-primary btn-xs exec-mark-item" data-next-status="${nextStatus}">${buttonText}</button>`;
        }
        const tr = document.createElement('tr');
        tr.dataset.name = o.name;
        tr.innerHTML = `<td>${o.name}</td> <td class="current-status">${statusLabels[currentStatus]}</td> <td>${buttonHTML}</td>`;
        body.appendChild(tr);
      });
    });
  }

  document.getElementById('execution-items-body').addEventListener('click', e => {
    if (e.target.classList.contains('exec-mark-item')) {
      const btn = e.target;
      const tr  = btn.closest('tr');
      const nextStatus = btn.dataset.nextStatus;
      tr.dataset.newStatus = nextStatus;
      btn.disabled = true;
      btn.textContent = nextStatus === 'executed' ? 'Marcado Ejec.' : 'Marcado en Proc.';
      tr.querySelector('.current-status').textContent = nextStatus === 'executed' ? 'Ejecutado' : 'En Proceso';
    }
  });

  async function saveExecutionModal() {
    if (!currentExecPath) return;
    loadingOverlay.style.display = 'flex';
    const saveBtn = document.getElementById('execution-modal-save');
    saveBtn.disabled = true;
    try {
      const clientRef = db.doc(currentExecPath);
      const snap = await clientRef.get();
      const data = snap.data() || {};
      let currentExecutionOfferings = (data.execution && data.execution.offerings) || [];
      const statusMap = new Map(currentExecutionOfferings.map(o => [o.name, o]));
      let hasChanges = false, becameInProcess = false, allExecuted = true;

      document.querySelectorAll('#execution-items-body tr').forEach(tr => {
        const { name, newStatus } = tr.dataset;
        if (newStatus) {
          hasChanges = true;
          const offering = statusMap.get(name) || { name, status: 'pending' };
          if (offering.status !== newStatus) {
            offering.status = newStatus;
            offering.statusChangedAt = new Date();
            if (newStatus === 'in_process') becameInProcess = true;
            statusMap.set(name, offering);
          }
        }
      });

      if (!hasChanges) { 
        showMessage("No se realizaron cambios.", "warning"); 
        loadingOverlay.style.display = 'none';
        saveBtn.disabled = false;
        return; 
      }

      const updatedOfferings = Array.from(statusMap.values());
      updatedOfferings.forEach(o => { if (o.status !== 'executed') allExecuted = false; });
      const overallStatus = allExecuted
        ? 'executed'
        : (updatedOfferings.some(o => o.status === 'in_process' || o.status === 'executed') ? 'in_process' : 'pending');

      const updates = {
        'execution.offerings': updatedOfferings,
        'execution.overallStatus': overallStatus,
        'execution.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
      };
      if (becameInProcess && !data.stateDates?.inProcessAt) updates['stateDates.inProcessAt'] = firebase.firestore.FieldValue.serverTimestamp();
      if (allExecuted && !data.stateDates?.executedAt)      updates['stateDates.executedAt'] = firebase.firestore.FieldValue.serverTimestamp();

      // Si estamos en modo "in_process" (marcar como Ganado), cambiar clientStatus y agregar executedAt como implementationDate
      if (currentExecMode === 'in_process') {
        const dateInput = document.getElementById('execution-date-input');
        const dateString = dateInput.value;
        // Convertir la fecha de string (YYYY-MM-DD) a timestamp de Firestore
        const executionDate = firebase.firestore.Timestamp.fromDate(new Date(dateString + 'T00:00:00Z'));
        updates['clientStatus'] = 'Ganado';
        updates['executedAt'] = executionDate;
        updates['implementationDate'] = executionDate; // Usar la misma fecha como implementationDate
        console.log('✅ Marcando cliente como Ganado con fecha:', dayjs(dateString).format('DD/MM/YYYY'));
      }

      try {
        // Intentar guardar con batch
        await clientRef.update(updates);
      } catch (updateError) {
        // Si falla, reintentar sin batch
        console.warn('⚠️ Actualización inicial fallida, reintentando:', updateError);
        await clientRef.update(updates);
        console.log('✅ Actualización de ejecución exitosa');
      }

      showMessage('Estados de ejecución actualizados con éxito.', 'success');
      closeModal(executionModalOverlay);
      loadDashboardData(); // Recargar dashboard para actualizar contadores
      loadTableData('Ofrecido', 'initial'); // Recargar tabla de pendientes
      loadTableData(CLIENT_STATUS.WON, 'initial');
    } catch (error) {
      console.error("❌ Error al guardar ejecución:", error);
      
      // Proporcionar mensajes más específicos según el error
      let errorMsg = 'No se pudieron guardar los cambios.';
      if (error.code === 'permission-denied') {
        errorMsg = 'Permiso denegado. Contacta al administrador para verificar permisos de Firestore.';
      } else if (error.message.includes('clientStatus')) {
        errorMsg = 'Error al cambiar el estado del cliente. Verifica los permisos.';
      }
      
      showMessage(errorMsg, 'error');
    } finally {
      loadingOverlay.style.display = 'none';
      saveBtn.disabled = false;
    }
  }

  // =========================
  // 11) EDITOR DE SERVICIOS
  // =========================
  async function openServicesEditor(docPath) {
    editVigilanciaContainer.innerHTML = '';
    editTecnologiaContainer.innerHTML = '';
    document.getElementById('services-editor-doc-path').value = docPath;
    await ensureCatalogLoaded();
    openModal(servicesEditorModal);

    // (Re)bind de botones "Añadir"
    addVigilanciaBtn.onclick = async () => {
      await ensureCatalogLoaded();
      editVigilanciaContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
    };
    addTecnologiaBtn.onclick = async () => {
      await ensureCatalogLoaded();
      editTecnologiaContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));
    };

    try {
      const snap = await db.doc(docPath).get();
      if (!snap.exists) throw new Error('Documento no encontrado');
      const data = snap.data() || {};
      const currentOfferings = Array.isArray(data.offerings) ? data.offerings : [];

      currentOfferings.forEach(o => {
        // Si el item no está en el catálogo, igual se muestra
        const container = (o.category === VIGILANCIA_CATEGORY) ? editVigilanciaContainer : editTecnologiaContainer;
        container.appendChild(createOfferingRow(o.category, o));
      });

      if (!editVigilanciaContainer.children.length) editVigilanciaContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
      if (!editTecnologiaContainer.children.length) editTecnologiaContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));
    } catch (e) {
      console.error('Error al abrir editor de servicios:', e);
      showMessage('No se pudieron cargar los servicios.', 'error');
      closeModal(servicesEditorModal);
    }
  }

  function createOfferingRow(category, offeringData = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'offering-row';

    const options = category === VIGILANCIA_CATEGORY ? vigNames : tecNames;
    const names = [...new Set([...(options || []), offeringData.name].filter(Boolean))];
    const selectOptions =
      ['<option value="">Seleccionar...</option>']
        .concat(names.map(n => `<option value="${n}" ${n === offeringData.name ? 'selected' : ''}>${n}</option>`))
        .join('');

    const totalVal = Number(offeringData.total ?? 0); // evita toFixed en undefined

    wrapper.innerHTML = `
      <div class="offering-row-header">
        <select class="offering-name">${selectOptions}</select>
        <button type="button" class="remove-offering-row-btn" title="Quitar">&times;</button>
      </div>
      <div class="offering-row-body">
        <input type="number" placeholder="Cant." class="offering-quantity" value="${offeringData.quantity || 1}" min="1">
        <select class="offering-provision-mode">
          <option value="Cobro mensual" ${offeringData.provisionMode === 'Cobro mensual' ? 'selected' : ''}>Cobro mensual</option>
          <option value="Por todo el contrato" ${offeringData.provisionMode === 'Por todo el contrato' ? 'selected' : ''}>Por todo el contrato</option>
        </select>
        <select class="offering-frequency">
          ${[6,12,18,24,36].map(m => `<option value="${m}" ${Number(offeringData.frequency)===m?'selected':''}>${m}m</option>`).join('')}
        </select>
        <input type="number" placeholder="Costo S/." class="offering-cost" value="${offeringData.cost || ''}" min="0" step="0.01">
        <input type="text" placeholder="Total" class="offering-total" value="S/ ${totalVal.toFixed(2)}" readonly>
        <input type="hidden" class="offering-category" value="${category}">
      </div>`;

    const calculateTotal = () => {
      const quantity = parseFloat(wrapper.querySelector('.offering-quantity').value) || 1;
      const cost     = parseFloat(wrapper.querySelector('.offering-cost').value) || 0;
      const mode     = wrapper.querySelector('.offering-provision-mode').value;
      let total = 0;
      if (mode === 'Por todo el contrato') total = cost * quantity;
      else {
        const freq = parseFloat(wrapper.querySelector('.offering-frequency').value) || 6;
        total = cost * quantity * freq;
      }
      wrapper.querySelector('.offering-total').value = `S/ ${total.toFixed(2)}`;
    };

    wrapper.addEventListener('input',  calculateTotal);
    wrapper.addEventListener('change', calculateTotal);
    wrapper.querySelector('.remove-offering-row-btn').addEventListener('click', () => wrapper.remove());
    calculateTotal();
    return wrapper;
  }

  function getOfferingsFromEditor() {
    const rows = servicesEditorModal.querySelectorAll('.offering-row');
    const out = [];
    rows.forEach(row => {
      const name  = row.querySelector('.offering-name')?.value?.trim();
      const qty   = Number(row.querySelector('.offering-quantity')?.value || 1);
      const mode  = row.querySelector('.offering-provision-mode')?.value || 'Cobro mensual';
      const freq  = Number(row.querySelector('.offering-frequency')?.value || 6);
      const cost  = Number(row.querySelector('.offering-cost')?.value || 0);
      const cat   = row.querySelector('.offering-category')?.value || VIGILANCIA_CATEGORY;
      if (!name) return; // ignora filas sin selección
      const total = (mode === 'Por todo el contrato') ? (cost * qty) : (cost * qty * freq);
      out.push({
        name, category: cat, quantity: qty,
        provisionMode: mode, frequency: freq,
        cost, total: Number(total.toFixed(2))
      });
    });
    return out;
  }

  async function saveServicesChanges() {
    const docPath = document.getElementById('services-editor-doc-path').value;
    servicesEditorSaveBtn.disabled = true;
    servicesEditorSaveBtn.textContent = 'Guardando...';
    
    try {
      const clientRef = db.doc(docPath);
      const original = await clientRef.get();
      const originalData = original.data() || {};
      const newOfferings = getOfferingsFromEditor();

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

      const updates = {
        offerings: newOfferings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const logEntry = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        user: auth.currentUser.email,
        action: 'update_services',
        changes: { offerings: { from: originalData.offerings, to: newOfferings } }
      };

      try {
        // Intentar guardar con batch
        const batch = db.batch();
        batch.update(clientRef, updates);
        batch.set(clientRef.collection('logs').doc(), logEntry);
        await batch.commit();
      } catch (batchError) {
        // Si falla el batch, intentar directamente
        console.warn('⚠️ Batch fallido, intentando actualización directa:', batchError);
        await clientRef.update(updates);
        console.log('✅ Actualización directa de servicios exitosa');
      }

      showMessage("Servicios actualizados con éxito.", "success");
      closeModal(servicesEditorModal);

      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'ganados')   loadTableData(CLIENT_STATUS.WON, 'initial');
      if (active === 'ejecucion') loadExecList();
      loadDashboardData();
    } catch (e) {
      console.error("❌ Error al guardar servicios:", e);
      
      // Proporcionar mensajes más específicos según el error
      let errorMsg = 'No se pudieron guardar los cambios en los servicios.';
      if (e.code === 'permission-denied') {
        errorMsg = 'Permiso denegado. Contacta al administrador para verificar permisos de Firestore.';
      } else if (e.message.includes('offerings')) {
        errorMsg = 'Error al guardar los servicios. Verifica que todos estén correctamente configurados.';
      }
      
      showMessage(errorMsg, 'error');
    } finally {
      servicesEditorSaveBtn.disabled = false;
      servicesEditorSaveBtn.textContent = 'Guardar Cambios';
    }
  }

  // =========================
  // 12) EVENTOS GLOBALES
  // =========================
  document.getElementById('pending-next')?.addEventListener('click', () => loadTableData('Ofrecido', 'next'));
  document.getElementById('pending-prev')?.addEventListener('click', () => loadTableData('Ofrecido', 'prev'));
  
  document.getElementById('won-next')?.addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'next'));
  document.getElementById('won-prev')?.addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'prev'));

  // Event listeners explícitos para botones de cancelar
  document.getElementById('execution-modal-cancel')?.addEventListener('click', () => closeModal(executionModalOverlay));
  document.getElementById('services-editor-cancel-btn')?.addEventListener('click', () => closeModal(servicesEditorModal));
  document.getElementById('services-editor-close-btn')?.addEventListener('click', () => closeModal(servicesEditorModal));
  document.getElementById('execution-modal-close')?.addEventListener('click', () => closeModal(executionModalOverlay));

  document.addEventListener('click', (e) => {
    // Cerrar modales
    if (e.target.id === 'execution-modal-save') saveExecutionModal();
    if (e.target.id === 'services-editor-save-btn') saveServicesChanges();
    if (e.target.id === 'modal-close-btn' || e.target.closest('#modal-close-btn')) closeModal(modalOverlay);
  });

  // Acceso rápido desde tabla
  window.openServicesEditor = openServicesEditor;
});
