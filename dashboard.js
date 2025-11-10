// dashboard.js — PWA Gestión (v2) • DESPEGABLES dinámicos desde Firestore + fixes de modal "Ganado"
document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // Firebase & Persistencia
  // =========================
  // Firebase ya está inicializado en firebase-config.js
  const auth = firebase.auth();
  const db   = firebase.firestore();
  window.auth = auth; window.db = db;

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
        alert('Opción agregada correctamente (se sincroniza offline).');
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
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    // Nombre en sidebar
    const uiName = sessionStorage.getItem('userName');
    document.getElementById('user-fullname').textContent = uiName || user.email;

    // Cargar desplegables desde Firestore y activar realtime
    // Usando shared-utils.js con callbacks personalizados para dashboard
    const dashboardState = { vigNames, tecNames };
    
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
    servicesEditorCloseBtn?.addEventListener('click', () => closeModal(servicesEditorModal));
    servicesEditorCancelBtn?.addEventListener('click', () => closeModal(servicesEditorModal));
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
    loadingOverlay.style.display = 'flex';
    try {
      const snap = await db.collectionGroup('clients').get();
      const clients = snap.docs.map(d => d.data());

      // Tarjetas
      document.getElementById('pending-count').textContent =
        clients.filter(c => c.clientStatus === CLIENT_STATUS.PENDING).length;

      document.getElementById('won-count').textContent =
        clients.filter(c => c.clientStatus === CLIENT_STATUS.WON).length;

      const expiringCount = clients.filter(c => {
        const isWon = c.clientStatus === CLIENT_STATUS.WON;
        const duration = c.offerings?.[0]?.frequency || 0;
        if (isWon && c.implementationDate && duration > 0) {
          const expiration = dayjs(c.implementationDate).add(duration, 'month');
          return expiration.diff(dayjs(), 'month') <= 6;
        }
        return false;
      }).length;
      document.getElementById('expiring-count').textContent = expiringCount;

      // Indicadores + gráfico (usa mapeo nombre->categoría derivado de DESPEGABLES)
      await updateIndicatorsAndChart(clients);
    } catch (e) {
      console.error('Error dashboard:', e);
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  async function updateIndicatorsAndChart(clients) {
    // Construir mapa nombre->categoría a partir de lo cargado
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

    // Top 3 por registros (resolviendo nombres)
    const top3 = Object.entries(userRanking).sort((a,b) => b[1]-a[1]).slice(0,3);
    const top3Resolved = await Promise.all(top3.map(async ([emailOrName, count]) => {
      const display = await getUserName(emailOrName);
      return { display, count };
    }));
    const ul = document.getElementById('user-ranking-list');
    ul.innerHTML = top3Resolved.length
      ? top3Resolved.map(i => `<li><span class="user-info">${i.display}</span><span class="user-rank">${i.count}</span></li>`).join('')
      : '<li>No hay datos.</li>';

    // Contadores por tipo
    document.getElementById('va-count').textContent  = vaCount;
    document.getElementById('vat-count').textContent = vatCount;

    // Gráfico
    try {
      const labels = Array.from(allServiceNames);
      const pendingData = labels.map(n => serviceCounts.pending[n] || 0);
      const wonData     = labels.map(n => serviceCounts.won[n] || 0);
      renderServicesChart(labels, pendingData, wonData);
    } catch (err) {
      console.error('Error chart:', err);
    }
  }

  function renderServicesChart(labels, pendingData, wonData) {
    const ctx = document.getElementById('services-chart').getContext('2d');
    if (servicesChart) servicesChart.destroy();
    Chart.register(ChartDataLabels);
    servicesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Solicitudes Pendientes', backgroundColor: 'rgba(255, 167, 38, 0.7)', data: pendingData },
          { label: 'Clientes Ganados',       backgroundColor: 'rgba(102, 187, 106, 0.7)', data: wonData }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          datalabels: {
            color: '#fff', anchor: 'end', align: 'start', offset: -20,
            font: { weight: 'bold' },
            formatter: v => v || ''
          }
        },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
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
            <tr>
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
            <tr>
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
            if (confirm('¿Estás seguro? Esta acción no se puede deshacer.')) handleDelete(path);
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
  }

  async function handleDelete(docPath) {
    loadingOverlay.style.display = 'flex';
    try {
      await db.doc(docPath).delete();
      alert('Registro eliminado con éxito.');
      loadDashboardData();
      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
      if (active === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
    } catch (e) {
      console.error('Error al eliminar:', e);
      alert('No se pudo eliminar el registro.');
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
        const batch = db.batch();
        batch.update(ref, updates);
        batch.set(ref.collection('logs').doc(), {
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          user: auth.currentUser.email,
          action: 'update_details',
          changes
        });
        await batch.commit();
        alert('Cambios guardados con éxito.');
      } else {
        alert('No se detectaron cambios.');
      }
      closeModal(modalOverlay);
      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
      if (active === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
      loadDashboardData();
    } catch (e) {
      console.error('Error guardando:', e);
      alert('No se pudieron guardar los cambios.');
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
      alert('No se pudieron cargar los servicios.');
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

    servicesEditorSaveBtn.disabled = true;
    servicesEditorSaveBtn.textContent = 'Guardando…';
    loadingOverlay.style.display = 'flex';
    try {
      const ref = db.doc(docPath);
      const orig = await ref.get();
      const origData = orig.data() || {};
      const batch = db.batch();
      batch.update(ref, { offerings: newOfferings, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      batch.set(ref.collection('logs').doc(), {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        user: auth.currentUser.email,
        action: 'update_services',
        from: origData.offerings || [],
        to: newOfferings
      });
      await batch.commit();
      alert('Servicios actualizados con éxito.');
      closeModal(servicesEditorModal);

      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
      if (active === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
      loadDashboardData();
    } catch (e) {
      console.error('Error guardando servicios:', e);
      alert('No se pudieron guardar los cambios.');
    } finally {
      servicesEditorSaveBtn.disabled = false;
      servicesEditorSaveBtn.textContent = 'Guardar Cambios';
      loadingOverlay.style.display = 'none';
    }
  }

  function createOfferingRow(category, offeringData = {}) {
    const row = document.createElement('div');
    row.className = 'offering-row';

    const options = buildOptionsHTML(category, offeringData.name);

    row.innerHTML = `
      <div class="offering-row-header">
        <div class="offering-row-select">
          <select class="offering-name">
            <option value="">Seleccionar...</option>
            ${options}
          </select>
          <button type="button" class="btn-add-option" title="Agregar opción"><i class="fas fa-plus"></i></button>
        </div>
        <div class="offering-row-actions">
          <button type="button" class="remove-offering-row-btn" title="Quitar fila">&times;</button>
        </div>
        <input type="hidden" class="offering-category" value="${category}">
      </div>
      <div class="offering-row-body">
        <label>Modalidad
          <select class="offering-provision-mode">
            <option ${offeringData.provisionMode === 'Por todo el contrato' ? 'selected' : ''}>Por todo el contrato</option>
            <option ${offeringData.provisionMode === 'Por cada mes' ? 'selected' : ''}>Por cada mes</option>
          </select>
        </label>
        <label>Frecuencia (meses)
          <input type="number" class="offering-frequency" min="1" value="${offeringData.frequency ?? 6}">
        </label>
        <label>Unidades
          <input type="number" class="offering-quantity" min="1" value="${offeringData.quantity ?? 1}">
        </label>
        <label>Meses
          <input type="number" class="offering-months" min="1" value="${offeringData.months ?? (offeringData.frequency ?? 6)}">
        </label>
        <label>Costo proveedor (S/.)
          <input type="number" class="offering-cost" min="0" step="0.01" value="${offeringData.cost ?? 0}">
        </label>
        <label>Total
          <input type="text" class="offering-total" value="S/ ${(Number(offeringData.total || 0)).toFixed(2)}" readonly>
        </label>
      </div>
    `;

    // Lógica de totales
    const compute = () => {
      const q   = parseFloat(row.querySelector('.offering-quantity').value)  || 1;
      const c   = parseFloat(row.querySelector('.offering-cost').value)      || 0;
      const pm  = row.querySelector('.offering-provision-mode').value;
      const mos = parseFloat(row.querySelector('.offering-months').value)    || parseFloat(row.querySelector('.offering-frequency').value) || 6;
      const total = (pm === 'Por todo el contrato') ? (c * q) : ((c * q) * mos);
      row.querySelector('.offering-total').value = `S/ ${total.toFixed(2)}`;
    };

    row.addEventListener('input', compute);
    row.addEventListener('change', compute);
    row.querySelector('.remove-offering-row-btn')?.addEventListener('click', () => row.remove());
    
    // Event listener para el botón "+" de agregar opción dentro de cada fila
    const addOptionBtn = row.querySelector('.btn-add-option');
    console.log('🔧 Configurando botón + en fila:', !!addOptionBtn);
    
    addOptionBtn?.addEventListener('click', (e) => {
      console.log('🟢 Click en botón + de agregar opción');
      e.preventDefault();
      e.stopPropagation();
      try {
        const sel = row.querySelector('.offering-name');
        console.log('📍 Select encontrado:', !!sel, 'Categoría:', category);
        showAddOptionModal(category, sel);
      } catch (error) {
        console.error('❌ Error al abrir modal de agregar opción:', error);
      }
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
    const body = document.getElementById('execution-items-body');
    const title = document.getElementById('execution-modal-title');
    title.textContent = mode === 'executed' ? 'Marcar Servicios como Ejecutados' : 'Marcar Servicios en Proceso';
    body.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
    openModal(execOverlay);

    db.doc(docPath).get().then(snap => {
      const data = snap.data() || {};
      const items = Array.isArray(data.offerings) ? data.offerings : [];
      const execOfferings = (data.execution && Array.isArray(data.execution.offerings))
        ? data.execution.offerings
        : items.map(o => ({ name:o.name, status:'pending' }));

      const statusMap = new Map(execOfferings.map(x => [x.name, x.status]));
      body.innerHTML = '';
      items.forEach(o => {
        const cur = statusMap.get(o.name) || 'pending';
        const isExecuted = cur === 'executed';
        const labels = { pending:'Pendiente', in_process:'En Proceso', executed:'Ejecutado' };
        let btnHTML = '';
        if (isExecuted) {
          btnHTML = `<button class="modal-button btn-modal-secondary btn-xs" disabled>Ejecutado</button>`;
        } else {
          const next = mode === 'executed' ? 'executed' : 'in_process';
          const txt  = mode === 'executed' ? 'Ejecutado' : 'En Proceso';
          btnHTML = `<button class="modal-button btn-modal-primary btn-xs mark-exec-item" data-next-status="${next}">${txt}</button>`;
        }
        const tr = document.createElement('tr');
        tr.dataset.name = o.name;
        tr.innerHTML = `
          <td>${o.name}</td>
          <td><span class="badge ${isExecuted ? 'badge-success' : (cur === 'in_process' ? 'badge-warning' : 'badge-default')}">${labels[cur]}</span></td>
          <td>${btnHTML}</td>`;
        body.appendChild(tr);
      });
    });
  }

  async function saveExecutionModal() {
    const saveBtn = document.getElementById('execution-modal-save');
    saveBtn.disabled = true;
    loadingOverlay.style.display = 'flex';
    try {
      const ref = db.doc(currentExecPath);
      const snap = await ref.get();
      const data = snap.data() || {};
      const rows = Array.from(document.querySelectorAll('#execution-items-body tr'));
      let hasChanges = false, allExecuted = true, becameInProcess = false;

      const statusMap = new Map((data.execution?.offerings || []).map(x => [x.name, { ...x }]));

      rows.forEach(tr => {
        const name = tr.dataset.name;
        const btn = tr.querySelector('.mark-exec-item');
        if (btn) {
          hasChanges = true;
          const newStatus = btn.dataset.nextStatus;
          const o = statusMap.get(name) || { name, status:'pending' };
          if (o.status !== newStatus) {
            o.status = newStatus;
            o.statusChangedAt = firebase.firestore.Timestamp.now();
            if (newStatus === 'in_process') becameInProcess = true;
            statusMap.set(name, o);
          }
        }
      });

      if (!hasChanges) { alert('No se realizaron cambios.'); return; }

      const updated = Array.from(statusMap.values());
      updated.forEach(o => { if (o.status !== 'executed') allExecuted = false; });
      const overall = allExecuted
        ? 'executed'
        : (updated.some(o => o.status === 'in_process' || o.status === 'executed') ? 'in_process' : 'pending');

      const updates = {
        'execution.offerings': updated,
        'execution.status': overall,
        'execution.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
      };
      if (becameInProcess && !data.stateDates?.inProcessAt) updates['stateDates.inProcessAt'] = firebase.firestore.FieldValue.serverTimestamp();
      if (allExecuted    && !data.stateDates?.executedAt)   updates['stateDates.executedAt']  = firebase.firestore.FieldValue.serverTimestamp();

      await ref.update(updates);
      alert('Estados de ejecución actualizados.');
      closeModal(execOverlay);
      loadExecList();
      loadTableData(CLIENT_STATUS.WON, 'initial');
    } catch (e) {
      console.error('Error guardando ejecución:', e);
      alert('No se pudieron guardar los cambios.');
    } finally {
      loadingOverlay.style.display = 'none';
      saveBtn.disabled = false;
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
    if (!dateVal) { alert('Selecciona una fecha.'); return; }
    try {
      const ref = db.doc(docPath);
      await ref.update({
        clientStatus: CLIENT_STATUS.WON,
        implementationDate: dateVal,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('Marcado como GANADO.');
      closeModal(datePickerModal);
      loadDashboardData();
      loadTableData(CLIENT_STATUS.PENDING, 'initial');
      loadTableData(CLIENT_STATUS.WON, 'initial');
    } catch (e) {
      console.error(e);
      alert('No se pudo marcar como GANADO.');
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
