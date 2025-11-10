// operativo.js — Operativo con Editor de Servicios y desplegables (Firebase + multipath catálogo)
document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // 1) FIREBASE & CONSTANTES
  // =========================
  if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
    alert("Error crítico de configuración. Revisa la consola."); return;
  }
  if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();
  window.auth = auth; window.db = db;

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
  auth.onAuthStateChanged(async user => {
    if (user) {
      const userName = sessionStorage.getItem('userName');
      document.getElementById('user-fullname').textContent = userName || user.email;
      
      // Cargar desplegables usando shared-utils.js
      const operativoState = { vigNames, tecNames };
      
      await loadOfferingsFromFirestore({
        state: operativoState,
        onSuccess: () => {
          vigNames = operativoState.vigNames;
          tecNames = operativoState.tecNames;
          console.log('✅ Desplegables cargados en operativo.js');
        }
      });
      
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
    loadingOverlay.style.display = 'flex';
    try {
      const userZone = sessionStorage.getItem('userZone');
      if (!userZone) throw new Error("Zona de usuario no encontrada.");

      const clientsSnapshot = await db.collectionGroup('clients').where('zone', '==', userZone).get();
      const clients = clientsSnapshot.docs.map(doc => doc.data());
      const wonClients = clients.filter(c => c.clientStatus === CLIENT_STATUS.WON);

      document.getElementById('won-count').textContent = wonClients.length;
      document.getElementById('in-process-count').textContent =
        wonClients.filter(c => c.execution?.overallStatus === 'in_process').length;

      document.getElementById('expiring-count').textContent = wonClients.filter(c => {
        const duration = c.offerings?.[0]?.frequency || 0;
        if (c.implementationDate && duration > 0) {
          return dayjs(c.implementationDate).add(duration, 'month').diff(dayjs(), 'month') <= 6;
        }
        return false;
      }).length;

      updateDashboardWidgets(wonClients);
    } catch (error) {
      console.error("Error cargando datos del dashboard:", error);
    } finally {
      loadingOverlay.style.display = 'none';
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
    document.getElementById('user-ranking-list').innerHTML =
      sortedUsers.map(([email, count]) => `<li><span class="user-info">${email.split('@')[0]}</span><strong class="user-rank">${count}</strong></li>`).join('')
      || '<li>No hay datos en esta zona.</li>';

    document.getElementById('va-count').textContent  = vaCount;
    document.getElementById('vat-count').textContent = vatCount;

    renderExecutionChart(pendingExecCount, inProcessExecCount, executedCount);
  }

  function renderExecutionChart(pending, inProcess, executed) {
    const ctx = document.getElementById('services-chart').getContext('2d');
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
      let query = db.collectionGroup('clients')
        .where('clientStatus', '==', status)
        .where('zone', '==', userZone)
        .orderBy('createdAt', 'desc')
        .limit(PAGE_SIZE);
      if (direction === 'initial') { state.lastDoc = null; state.pageHistory = [null]; }
      const cursorDoc = direction === 'prev' ? state.pageHistory[state.pageHistory.length - 2] : state.lastDoc;
      if (cursorDoc) query = query.startAfter(cursorDoc);
      const snapshot = await query.get();
      const docs = snapshot.docs;
      if (direction === 'next' && docs.length > 0) { state.lastDoc = docs[docs.length - 1]; state.pageHistory.push(state.lastDoc); }
      else if (direction === 'prev') { state.pageHistory.pop(); state.lastDoc = state.pageHistory[state.pageHistory.length - 1]; }
      else if (direction === 'initial' && docs.length > 0) { state.lastDoc = docs[docs.length - 1]; state.pageHistory = [null, state.lastDoc]; }
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
        <div class="action-icons-wrapper">
          <i class="fas fa-cogs action-icon edit-services-btn" data-path="${docPath}" title="Editar Servicios"></i>
        </div>
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
    const prefix = 'won';
    document.getElementById(`${prefix}-prev`).disabled = paginationState[status].pageHistory.length <= 2;
    document.getElementById(`${prefix}-next`).disabled = fetchedCount < PAGE_SIZE;
  }

  // ========================= 8) LISTA DE EJECUCIÓN =========================
  async function loadExecList() {
    const tbody = document.getElementById('exec-table-body');
    tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
    try {
      const userZone = sessionStorage.getItem('userZone');
      if (!userZone) throw new Error("Zona de usuario no encontrada.");
      const snap = await db.collectionGroup('clients')
        .where('clientStatus', '==', 'Ganado')
        .where('execution.overallStatus', 'in', ['in_process', 'executed'])
        .where('zone', '==', userZone)
        .orderBy('execution.updatedAt', 'desc')
        .get();

      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="7">No hay clientes en proceso de ejecución en su zona.</td></tr>'; return;
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
        const actionsHTML = `
          <div class="action-icons-wrapper">
            <i class="fas fa-cogs action-icon edit-services-btn" data-path="${doc.ref.path}" title="Editar Servicios"></i>
          </div>
          <button class="btn-action btn-action-manage exec-open" data-path="${doc.ref.path}">
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

      tbody.querySelectorAll('.exec-open, .view-details-link, .edit-services-btn').forEach(el => {
        el.addEventListener('click', (ev) => {
          const target = ev.currentTarget;
          const path = target.dataset.path;
          if (target.classList.contains('exec-open')) openExecutionModal(path, 'executed');
          else if (target.classList.contains('view-details-link')) handleClientAction(path, 'view');
          else if (target.classList.contains('edit-services-btn')) openServicesEditor(path);
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

      if (!hasChanges) { alert("No se realizaron cambios."); return; }

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

      await clientRef.update(updates);
      alert('Estados de ejecución actualizados con éxito.');
      closeModal(executionModalOverlay);
      loadExecList();
      loadTableData(CLIENT_STATUS.WON, 'initial');
    } catch (error) {
      console.error("Error al guardar ejecución:", error);
      alert("No se pudieron guardar los cambios.");
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
      alert('No se pudieron cargar los servicios.');
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

    servicesEditorSaveBtn.disabled = true;
    servicesEditorSaveBtn.textContent = 'Guardando...';

    try {
      const clientRef = db.doc(docPath);
      const original = await clientRef.get();
      const originalData = original.data() || {};
      const logEntry = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        user: auth.currentUser.email,
        action: 'update_services',
        from: originalData.offerings || [],
        to: newOfferings
      };
      const batch = db.batch();
      batch.update(clientRef, { offerings: newOfferings, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      batch.set(clientRef.collection('logs').doc(), logEntry);
      await batch.commit();
      alert("Servicios actualizados con éxito.");
      closeModal(servicesEditorModal);

      const active = document.querySelector('.menu-option.active')?.dataset.section;
      if (active === 'ganados')   loadTableData(CLIENT_STATUS.WON, 'initial');
      if (active === 'ejecucion') loadExecList();
      loadDashboardData();
    } catch (e) {
      console.error("Error al guardar servicios:", e);
      alert("No se pudieron guardar los cambios en los servicios.");
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
