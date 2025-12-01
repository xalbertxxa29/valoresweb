// operativo.js — Operativo con Editor de Servicios y desplegables (Firebase + multipath catálogo)

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

// MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
function showDeleteConfirmationModal(onConfirm) {
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
        <button class="delete-confirm-accept" style="background: #f44336; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;">Sí, eliminar</button>
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
    confirmModal.remove();
    if (typeof onConfirm === 'function') onConfirm();
  });
  
  // Click fuera del modal para cancelar
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      confirmModal.remove();
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
    [CLIENT_STATUS.WON]: { lastDoc: null, pageHistory: [null] },
  };

  const userNameCache = {};
  const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
  const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';

  // === Catálogo dinámico desde DESPEGABLES (sincronizado con Nueva App) ===
  let vigNames = [];
  let tecNames = [];

  // ================ 2) HELPERS ================
  async function getUserName(email) {
    if (!email) return 'Desconocido';
    if (userNameCache[email]) return userNameCache[email];
    try {
      const username = email.split('@')[0].toUpperCase();
      const snap = await db.collection('usuarios').doc(username).get();
      userNameCache[email] = snap.exists && snap.data().NOMBRE ? snap.data().NOMBRE : email;
    } catch { userNameCache[email] = email; }
    return userNameCache[email];
  }

  // --- Funciones compartidas desde shared-utils.js ---
  // - parseDesplegableDoc()
  // - loadOfferingsFromFirestore()
  // - watchDesplegablesRealtime()
  // - getUserName()
  // - addOptionToFirestore()

  // ========================= 3) ELEMENTOS DEL DOM =========================
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

  // ========================= 4) AUTENTICACIÓN =========================
  
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
      const operativoState = { vigNames, tecNames };
      
      try {
        await loadOfferingsFromFirestore({
          state: operativoState,
          onSuccess: () => {
            vigNames = operativoState.vigNames;
            tecNames = operativoState.tecNames;
            console.log('✅ Desplegables cargados en operativo.js');
          }
        });
      } catch (error) {
        console.error('❌ Error cargando desplegables:', error);
      }
      
      watchDesplegablesRealtime({
        state: operativoState,
        onUpdate: () => {
          vigNames = operativoState.vigNames;
          tecNames = operativoState.tecNames;
          console.log('🔄 Desplegables actualizados en tiempo real');
        }
      });
      
      showSection('inicio');
    } else {
      window.location.replace('index.html');
    }
  });

  // ========================= 5) NAVEGACIÓN =========================
  document.getElementById('logout-btn')?.addEventListener('click', () => auth.signOut());
  menuOptions.forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));

  document.getElementById('won-card')?.addEventListener('click',   () => showSection('ganados'));
  document.getElementById('expiring-card')?.addEventListener('click', () => showSection('ganados'));
  document.getElementById('in-process-card')?.addEventListener('click', () => showSection('ejecucion'));

  function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('is-visible'));
    const sectionToShow = document.getElementById(`${sectionId}-section`);
    if (!sectionToShow) return;
    sectionToShow.classList.add('is-visible');

    menuOptions.forEach(btn => btn.classList.toggle('active', btn.dataset.section === sectionId));

    if (sectionId === 'inicio')    loadDashboardData();
    if (sectionId === 'ganados')   loadTableData(CLIENT_STATUS.WON, 'initial');
    if (sectionId === 'ejecucion') loadExecList();
  }

  // ========================= 6) DASHBOARD =========================
  async function loadDashboardData() {
    const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    const startTime = Date.now();
    try {
      const userZone = sessionStorage.getItem('userZone');
      if (!userZone) throw new Error("Zona de usuario no encontrada.");
      
      console.log('🔍 Buscando clientes ganados en zona:', userZone);
      
      // Usar collectionGroup para buscar en TODOS los clientes de TODOS los usuarios
      const clientsSnapshot = await db.collectionGroup('clients')
        .where('zone', '==', userZone)
        .where('clientStatus', '==', 'Ganado')
        .get();
      
      console.log(`✅ Total de clientes ganados encontrados en zona: ${clientsSnapshot.docs.length}`);
      
      const clients = clientsSnapshot.docs.map(doc => doc.data());
      const wonClients = clients;

      const wonCountEl = document.getElementById('won-count');
      const inProcessEl = document.getElementById('in-process-count');
      const expiringEl = document.getElementById('expiring-count');
      
      if (wonCountEl) wonCountEl.textContent = wonClients.length;
      if (inProcessEl) inProcessEl.textContent = wonClients.filter(c => c.execution?.overallStatus === 'in_process').length;
      
      const expiringCount = wonClients.filter(c => {
        const duration = c.offerings?.[0]?.frequency || 0;
        if (c.implementationDate && duration > 0) {
          return dayjs(c.implementationDate).add(duration, 'month').diff(dayjs(), 'month') <= 6;
        }
        return false;
      }).length;
      
      if (expiringEl) expiringEl.textContent = expiringCount;

      updateDashboardWidgets(wonClients);
      console.log(`✅ Dashboard cargado en ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error("❌ Error cargando datos del dashboard:", error);
      // Mostrar valores por defecto con validación
      const wonCountEl = document.getElementById('won-count');
      const inProcessEl = document.getElementById('in-process-count');
      const expiringEl = document.getElementById('expiring-count');
      
      if (wonCountEl) wonCountEl.textContent = '0';
      if (inProcessEl) inProcessEl.textContent = '0';
      if (expiringEl) expiringEl.textContent = '0';
    } finally {
      const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
  }

  function updateDashboardWidgets(clients) {
    let vaCount = 0, vatCount = 0;
    let pendingExecCount = 0, inProcessExecCount = 0, executedCount = 0;
    const userRanking = {};

    clients.forEach(client => {
      const userEmail = client.creadoPor || 'Desconocido';
      userRanking[userEmail] = (userRanking[userEmail] || 0) + 1;

      if (Array.isArray(client.offerings)) {
        client.offerings.forEach(offer => {
          if ((offer.category || '').includes('Vigilancia')) vaCount++;
          else if ((offer.category || '').includes('Tecnolog')) vatCount++; // tecnologia/tecnología
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
          datalabels: {
            color: '#ffffff', anchor: 'end', align: 'start', offset: -20,
            font: { weight: 'bold' }, formatter: (v) => v > 0 ? v : ''
          }
        },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  // ========================= 7) TABLAS =========================
  async function loadTableData(status, direction = 'next') {
    loadingOverlay.style.display = 'flex';
    const state = paginationState[status];
    try {
      const userZone = sessionStorage.getItem('userZone');
      if (!userZone) throw new Error("Zona de usuario no encontrada.");
      
      // Usar collectionGroup solo con zona, después filtrar por status y ordenar en cliente
      let query = db.collectionGroup('clients')
        .where('zone', '==', userZone);
      
      const snapshot = await query.get();
      
      // Filtrar por status y ordenar en cliente (sin índice compuesto)
      let docs = snapshot.docs
        .filter(doc => doc.data().clientStatus === status)
        .sort((a, b) => {
          const aDate = a.data().createdAt?.toDate?.() || new Date(0);
          const bDate = b.data().createdAt?.toDate?.() || new Date(0);
          return bDate - aDate;
        });
      
      // Aplicar paginación
      if (direction === 'initial') { 
        state.lastDoc = null; 
        state.pageHistory = [null]; 
      }
      
      const startIndex = 0;
      const endIndex = direction === 'initial' ? PAGE_SIZE : 
                       direction === 'next' ? docs.length : 
                       Math.max(0, docs.length - PAGE_SIZE);
      
      docs = docs.slice(startIndex, direction === 'initial' || direction === 'next' ? PAGE_SIZE : docs.length);
      
      if (docs.length > 0) { 
        state.lastDoc = docs[docs.length - 1]; 
        if (direction === 'initial') state.pageHistory = [null, state.lastDoc];
      }
      
      await renderWonTable(docs);
      updatePaginationButtons(status, docs.length);
    } catch (error) {
      console.error(`Error cargando tabla de ${status}:`, error);
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  async function renderWonTable(docs) {
    const tbody = document.getElementById('won-table-body');
    tbody.innerHTML = '';
    if (docs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8">No se encontraron registros en su zona.</td></tr>`; return;
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
      if (client.implementationDate && duration > 0) {
        const expirationDate = dayjs(client.implementationDate).add(duration, 'month');
        const remainingMonths = expirationDate.diff(dayjs(), 'month');
        remainingMonthsText = remainingMonths < 0 ? 0 : remainingMonths;
        if (remainingMonths <= 6) textColorClass = 'text-danger';
      }

      const actionsHTML = `
        <button class="btn-action btn-action-manage exec-pending-btn" data-path="${docPath}">
          <i class="fas fa-tasks"></i> Gestionar
        </button>`;

      return `<tr>
        <td><span class="code-text">${creationDate}</span></td>
        <td><span class="code-text">${implementationDate}</span></td>
        <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
        <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
        <td>${servicesHTML}</td>
        <td>${createdByFullName}</td>
        <td class="${textColorClass}">${remainingMonthsText}</td>
        <td>${actionsHTML}</td>
      </tr>`;
    }));
    tbody.innerHTML = rowsHtml.join('');

      tbody.querySelectorAll('.exec-pending-btn, .view-details-link').forEach(el => {
        el.addEventListener('click', (ev) => {
          const target = ev.currentTarget;
          const path = target.dataset.path;
          if (target.classList.contains('exec-pending-btn')) openExecutionModal(path, 'in_process');
          else if (target.classList.contains('view-details-link')) handleClientAction(path, 'view');
          // NO permitir editar servicios en operativo
        });
      });
  }

  function updatePaginationButtons(status, fetchedCount) {
    const prefix = 'won';
    document.getElementById(`${prefix}-prev`).disabled = paginationState[status].pageHistory.length <= 2;
    document.getElementById(`${prefix}-next`).disabled = fetchedCount < PAGE_SIZE;
  }

  // ========================= 8) LISTA DE EJECUCIÓN =========================
  async function loadExecList() {
    const tbody = document.getElementById('exec-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
    try {
      const userZone = sessionStorage.getItem('userZone');
      if (!userZone) throw new Error("Zona de usuario no encontrada.");
      
      console.log('🔍 Buscando clientes en ejecución de zona:', userZone);
      
      // Usar collectionGroup y filtrar por zona en cliente
      const snap = await db.collectionGroup('clients')
        .where('zone', '==', userZone)
        .get();

      // Filtrar clientes que estén en ejecución
      const execClients = snap.docs
        .map(doc => ({ ...doc.data(), docPath: doc.ref.path }))
        .filter(c => c.clientStatus === 'Ganado' && (c.execution?.overallStatus === 'in_process' || c.execution?.overallStatus === 'executed'))
        .sort((a, b) => {
          const aTime = a.execution?.updatedAt?.toDate?.() || new Date(0);
          const bTime = b.execution?.updatedAt?.toDate?.() || new Date(0);
          return bTime - aTime;
        });

      if (execClients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay clientes en proceso de ejecución en su zona.</td></tr>';
        return;
      }

      const rowsHtml = await Promise.all(execClients.map(async (d) => {
        const createdByFullName = await getUserName(d.creadoPor);
        const status = (d.execution?.overallStatus || 'pending');
        const statusLabels = { in_process: 'En Proceso', executed: 'Ejecutado' };
        const servicesCount = (d.offerings || []).length;
        const servicesHTML = `<div class="service-summary">
            <span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span>
            <a class="view-details-link" data-path="${d.docPath}"><i class="fas fa-list-ul"></i> Ver Detalles</a>
          </div>`;
        const actionsHTML = `
          <button class="btn-action btn-action-manage exec-open" data-path="${d.docPath}">
            <i class="fas fa-tasks"></i> Gestionar
          </button>`;
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

      tbody.querySelectorAll('.exec-open, .view-details-link').forEach(el => {
        el.addEventListener('click', (ev) => {
          const target = ev.currentTarget;
          const path = target.dataset.path;
          if (target.classList.contains('exec-open')) openExecutionModal(path, 'executed');
          else if (target.classList.contains('view-details-link')) handleClientAction(path, 'view');
          // NO permitir editar servicios en operativo
        });
      });
    } catch (error) {
      console.error("Error cargando lista de ejecución:", error);
      tbody.innerHTML = '<tr><td colspan="7">Error al cargar los datos.</td></tr>';
    }
  }

  // ========================= 9) MODAL DETALLES =========================
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
            <thead><tr><th>Valor Agregado</th><th>Tipo</th><th>Cant.</th><th>Meses</th></tr></thead>
            <tbody>`;
    if (Array.isArray(client.offerings) && client.offerings.length) {
      client.offerings.forEach(o => {
        const tipo = (o.category || '').includes('Vigilancia') ? 'Vigilancia' : 'Tecnología';
        servicesTableHTML += `<tr><td>${o.name}</td><td>${tipo}</td><td>${o.quantity || 1}</td><td>${o.frequency || 'N/A'}</td></tr>`;
      });
    } else {
      servicesTableHTML += `<tr><td colspan="4">No hay servicios registrados.</td></tr>`;
    }
    servicesTableHTML += `</tbody></table></div></div>`;

    modalBody.innerHTML = fieldsHTML + servicesTableHTML;
  }

  // ========================= 10) MODAL EJECUCIÓN =========================
  let currentExecPath = null;
  const executionModalOverlay = document.getElementById('execution-modal-overlay');

  function openExecutionModal(docPath, mode) {
    currentExecPath = docPath;
    const body = document.getElementById('execution-items-body');
    const title = document.getElementById('execution-modal-title');
    title.textContent = mode === 'executed' ? 'Marcar Servicios como Ejecutados' : 'Marcar Servicios en Proceso';
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
          const buttonText = mode === 'executed' ? 'Ejecutado' : 'En Proceso';
          buttonHTML = `<button class="modal-button btn-modal-primary btn-xs exec-mark-item" data-next-status="${nextStatus}">${zhtml(buttonText)}</button>`;
        }
        const tr = document.createElement('tr');
        tr.dataset.name = o.name;
        tr.innerHTML = `<td>${zhtml(o.name)}</td> <td class="current-status">${statusLabels[currentStatus]}</td> <td>${buttonHTML}</td>`;
        body.appendChild(tr);
      });
    });
  }

  function zhtml(s){return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));}

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

      try {
        await clientRef.update(updates);
      } catch (updateError) {
        console.warn('⚠️ Actualización inicial fallida, reintentando:', updateError);
        await clientRef.update(updates);
        console.log('✅ Actualización de ejecución exitosa');
      }

      showMessage('Estados de ejecución actualizados con éxito.', 'success');
      closeModal(executionModalOverlay);
      loadExecList();
      loadTableData(CLIENT_STATUS.WON, 'initial');
    } catch (error) {
      console.error("❌ Error al guardar ejecución:", error);
      
      let errorMsg = 'No se pudieron guardar los cambios.';
      if (error.code === 'permission-denied') {
        errorMsg = 'Permiso denegado. Contacta al administrador para verificar permisos de Firestore.';
      } else if (error.message.includes('execution')) {
        errorMsg = 'Error al actualizar estados de ejecución. Verifica los permisos.';
      }
      
      showMessage(errorMsg, 'error');
    } finally {
      loadingOverlay.style.display = 'none';
      saveBtn.disabled = false;
    }
  }

  // ========================= 11) EDITOR DE SERVICIOS =========================
  async function openServicesEditor(docPath) {
    editVigilanciaContainer.innerHTML = '';
    editTecnologiaContainer.innerHTML = '';
    document.getElementById('services-editor-doc-path').value = docPath;
    openModal(servicesEditorModal);

    // Botones "Añadir"
    document.getElementById('edit-add-vigilancia-btn').onclick = () => {
      editVigilanciaContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
    };
    document.getElementById('edit-add-tecnologia-btn').onclick = () => {
      editTecnologiaContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));
    };

    try {
      await ensureCatalogLoaded(); // importante

      const snap = await db.doc(docPath).get();
      if (!snap.exists) throw new Error('Documento no encontrado');
      const data = snap.data() || {};
      const currentOfferings = Array.isArray(data.offerings) ? data.offerings : [];

      const setV = new Set(vigNames);
      const setT = new Set(tecNames);

      currentOfferings.forEach(o => {
        let category = o.category || (setV.has(o.name) ? VIGILANCIA_CATEGORY : (setT.has(o.name) ? TECNOLOGIA_CATEGORY : VIGILANCIA_CATEGORY));
        const container = category === VIGILANCIA_CATEGORY ? editVigilanciaContainer : editTecnologiaContainer;
        container.appendChild(createOfferingRow(category, o));
      });

      if (!editVigilanciaContainer.children.length) editVigilanciaContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
      if (!editTecnologiaContainer.children.length) editTecnologiaContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));
    } catch (e) {
      console.error('Error al abrir editor de servicios:', e);
      showMessage('No se pudieron cargar los servicios.', 'error');
      closeModal(servicesEditorModal);
    }
  }

  async function saveServicesChanges() {
    const docPath = document.getElementById('services-editor-doc-path').value;

    const collectOfferings = (container) => {
      return Array.from(container.querySelectorAll('.offering-row')).map(row => {
        const name = row.querySelector('.offering-name').value || '';
        const category = row.querySelector('.offering-category').value || VIGILANCIA_CATEGORY;
        const provisionMode = row.querySelector('.offering-provision-mode').value || 'Por todo el contrato';
        const frequency = parseFloat(row.querySelector('.offering-frequency').value) || 6;
        const quantity = parseFloat(row.querySelector('.offering-quantity').value) || 1;
        const months = parseFloat(row.querySelector('.offering-months').value) || frequency;
        const cost = parseFloat(row.querySelector('.offering-cost').value) || 0;
        const total = parseFloat((row.querySelector('.offering-total').value || '0').replace(/[^\d.]/g, '')) || 0;
        return { name, category, provisionMode, frequency, quantity, months, cost, total };
      }).filter(o => o.name);
    };

    const newOfferings = [
      ...collectOfferings(editVigilanciaContainer),
      ...collectOfferings(editTecnologiaContainer)
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
    servicesEditorSaveBtn.textContent = 'Guardando...';

    try {
      const clientRef = db.doc(docPath);
      const original = await clientRef.get();
      const originalData = original.data() || {};
      
      const updates = {
        offerings: newOfferings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const logEntry = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        user: auth.currentUser.email,
        action: 'update_services',
        from: originalData.offerings || [],
        to: newOfferings
      };
      
      try {
        const batch = db.batch();
        batch.update(clientRef, updates);
        batch.set(clientRef.collection('logs').doc(), logEntry);
        await batch.commit();
      } catch (batchError) {
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

  function createOfferingRow(category, offeringData = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'offering-row';

    const options = category === VIGILANCIA_CATEGORY ? vigNames : tecNames;
    // Si el doc trae un name que no está en el catálogo, igual se muestra
    const names = [...new Set([...(options || []), offeringData.name].filter(Boolean))];

    const selectOptions =
      ['<option value="">Seleccionar...</option>']
        .concat(names.map(n => `<option value="${n}" ${n === offeringData.name ? 'selected' : ''}>${n}</option>`))
        .join('');

    const totalVal = Number(offeringData.total ?? 0);

    wrapper.innerHTML = `
      <div class="offering-row-header">
        <select class="offering-name">${selectOptions}</select>
        <div class="offering-row-actions">
          <button type="button" class="remove-offering-row-btn" title="Quitar fila">&times;</button>
        </div>
        <input type="hidden" class="offering-category" value="${category}">
      </div>
      <div class="offering-row-body">
        <label>Modalidad
          <select class="offering-provision-mode">
            <option value="Por todo el contrato" ${offeringData.provisionMode === 'Por todo el contrato' ? 'selected' : ''}>Por todo el contrato</option>
            <option value="Por cada mes" ${offeringData.provisionMode === 'Por cada mes' ? 'selected' : ''}>Por cada mes</option>
          </select>
        </label>
        <label>Frecuencia (meses)
          <input type="number" class="offering-frequency" min="1" value="${offeringData.frequency || 6}">
        </label>
        <label>Unidades
          <input type="number" class="offering-quantity" min="1" value="${offeringData.quantity || 1}">
        </label>
        <label>Meses
          <input type="number" class="offering-months" min="1" value="${offeringData.months || (offeringData.frequency || 6)}">
        </label>
        <label>Costo proveedor (S/)
          <input type="number" class="offering-cost" min="0" step="0.01" value="${offeringData.cost || 0}">
        </label>
        <label>Total
          <input type="text" class="offering-total" value="S/ ${totalVal.toFixed(2)}" readonly>
        </label>
      </div>
    `;

    const recalc = () => {
      const quantity = parseFloat(wrapper.querySelector('.offering-quantity').value) || 1;
      const cost = parseFloat(wrapper.querySelector('.offering-cost').value) || 0;
      const pm   = wrapper.querySelector('.offering-provision-mode').value;
      let total  = 0;
      if (pm === 'Por todo el contrato') total = cost * quantity;
      else {
        const freq = parseFloat(wrapper.querySelector('.offering-frequency').value) || 6;
        total = (cost * quantity) * freq;
      }
      wrapper.querySelector('.offering-total').value = `S/ ${total.toFixed(2)}`;
    };
    wrapper.addEventListener('input', recalc);
    wrapper.addEventListener('change', recalc);
    wrapper.querySelector('.remove-offering-row-btn').addEventListener('click', () => wrapper.remove());
    recalc();

    return wrapper;
  }

  // ========================= 12) EVENTOS GLOBALES =========================
  document.getElementById('won-next')?.addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'next'));
  document.getElementById('won-prev')?.addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'prev'));

  document.addEventListener('click', (e) => {
    // Cerrar modales
    if (e.target.id === 'execution-modal-close' || e.target.closest('#execution-modal-close')) closeModal(executionModalOverlay);
    if (e.target.id === 'execution-modal-save') saveExecutionModal();
    if (e.target.id === 'modal-close-btn' || e.target.closest('#modal-close-btn')) closeModal(modalOverlay);

    if (e.target.id === 'services-editor-close-btn' || e.target.closest('#services-editor-close-btn') ||
        e.target.id === 'services-editor-cancel-btn' || e.target.closest('#services-editor-cancel-btn')) {
      closeModal(servicesEditorModal);
    }
    if (e.target.id === 'services-editor-save-btn') {
      saveServicesChanges();
    }
  });
});
