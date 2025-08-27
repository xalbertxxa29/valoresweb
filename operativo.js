// operativo.js (Versión con corrección de serverTimestamp en arreglos)
document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZACIÓN Y CONSTANTES ---
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        alert("Error crítico de configuración. Revisa la consola."); return;
    }
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
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

    // --- FUNCIÓN PARA OBTENER NOMBRES DE USUARIO ---
    async function getUserName(email) {
        if (!email) return 'Desconocido';
        if (userNameCache[email]) return userNameCache[email];
        try {
            const username = email.split('@')[0].toUpperCase();
            const userDoc = await db.collection('usuarios').doc(username).get();
            if (userDoc.exists && userDoc.data().NOMBRE) {
                const fullName = userDoc.data().NOMBRE;
                userNameCache[email] = fullName; return fullName;
            } else {
                userNameCache[email] = email; return email;
            }
        } catch (error) {
            console.error("Error al obtener nombre de usuario:", error); return email;
        }
    }

    // --- ELEMENTOS DEL DOM ---
    const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
    const menuOptions = document.querySelectorAll('.menu-option');
    const modalOverlay = document.getElementById('client-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');

    // --- AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            const userName = sessionStorage.getItem('userName');
            document.getElementById('user-fullname').textContent = userName || user.email;
            showSection('inicio');
        } else { 
            window.location.replace('index.html'); 
        }
    });

    // --- NAVEGACIÓN ---
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
    menuOptions.forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
    
    document.getElementById('won-card').addEventListener('click', () => showSection('ganados'));
    document.getElementById('expiring-card').addEventListener('click', () => showSection('ganados'));
    document.getElementById('in-process-card').addEventListener('click', () => showSection('ejecucion'));

    function showSection(sectionId) {
        document.querySelectorAll('.dashboard-section').forEach(section => section.classList.remove('is-visible'));
        const sectionToShow = document.getElementById(`${sectionId}-section`);
        if (sectionToShow) {
            sectionToShow.classList.add('is-visible');
            menuOptions.forEach(btn => btn.classList.toggle('active', btn.dataset.section === sectionId));
            if (sectionId === 'inicio') loadDashboardData();
            if (sectionId === 'ganados') loadTableData(CLIENT_STATUS.WON, 'initial');
            if (sectionId === 'ejecucion') loadExecList();
        }
    }

    // --- LÓGICA DE CARGA DE DATOS ---
    async function loadDashboardData() {
        loadingOverlay.style.display = 'flex';
        try {
            const userZone = sessionStorage.getItem('userZone');
            if (!userZone) throw new Error("Zona de usuario no encontrada.");

            const clientsSnapshot = await db.collectionGroup('clients').where('zone', '==', userZone).get();
            const clients = clientsSnapshot.docs.map(doc => doc.data());
            
            const wonClients = clients.filter(c => c.clientStatus === CLIENT_STATUS.WON);

            document.getElementById('won-count').textContent = wonClients.length;
            document.getElementById('in-process-count').textContent = wonClients.filter(c => c.execution?.overallStatus === 'in_process').length;
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

            if (client.offerings && Array.isArray(client.offerings)) {
                client.offerings.forEach(offer => {
                    if (offer.category === VIGILANCIA_CATEGORY) vaCount++;
                    else if (offer.category === TECNOLOGIA_CATEGORY) vatCount++;
                });
            }

            if (client.execution && Array.isArray(client.execution.offerings)) {
                client.execution.offerings.forEach(execOffer => {
                    switch (execOffer.status) {
                        case 'in_process': inProcessExecCount++; break;
                        case 'executed': executedCount++; break;
                        default: pendingExecCount++; break;
                    }
                });
            } else if (client.offerings && Array.isArray(client.offerings)) {
                pendingExecCount += client.offerings.length;
            }
        });
        
        const sortedUsers = Object.entries(userRanking).sort((a, b) => b[1] - a[1]).slice(0, 3);
        document.getElementById('user-ranking-list').innerHTML = sortedUsers.map(([email, count]) => `<li><span class="user-info">${email.split('@')[0]}</span><strong class="user-rank">${count}</strong></li>`).join('') || '<li>No hay datos en esta zona.</li>';

        document.getElementById('va-count').textContent = vaCount;
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
                datasets: [{
                    label: 'Cantidad de Servicios', data: [pending, inProcess, executed],
                    backgroundColor: ['rgba(255, 159, 64, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(75, 192, 192, 0.7)'],
                    borderColor: ['rgba(255, 159, 64, 1)', 'rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)'], borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { color: '#ffffff', anchor: 'end', align: 'start', offset: -20, font: { weight: 'bold' }, formatter: (value) => value > 0 ? value : '' }
                },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    async function loadTableData(status, direction = 'next') {
        loadingOverlay.style.display = 'flex';
        const state = paginationState[status];
        try {
            const userZone = sessionStorage.getItem('userZone');
            if (!userZone) throw new Error("Zona de usuario no encontrada.");
            let query = db.collectionGroup('clients').where('clientStatus', '==', status).where('zone', '==', userZone).orderBy('createdAt', 'desc').limit(PAGE_SIZE);
            if (direction === 'initial') { state.lastDoc = null; state.pageHistory = [null]; }
            const cursorDoc = direction === 'prev' ? state.pageHistory[state.pageHistory.length - 2] : state.lastDoc;
            if (cursorDoc) { query = query.startAfter(cursorDoc); }
            const snapshot = await query.get();
            const docs = snapshot.docs;
            if (direction === 'next' && docs.length > 0) { state.lastDoc = docs[docs.length - 1]; state.pageHistory.push(state.lastDoc); }
            else if (direction === 'prev') { state.pageHistory.pop(); state.lastDoc = state.pageHistory[state.pageHistory.length - 1]; }
            else if (direction === 'initial' && docs.length > 0) { state.lastDoc = docs[docs.length - 1]; state.pageHistory = [null, state.lastDoc]; }
            await renderWonTable(docs);
            updatePaginationButtons(status, docs.length);
        } catch (error) { console.error(`Error cargando tabla de ${status}:`, error); }
        finally { loadingOverlay.style.display = 'none'; }
    }

    async function renderWonTable(docs) {
        const tbody = document.getElementById('won-table-body');
        tbody.innerHTML = '';
        if (docs.length === 0) { tbody.innerHTML = `<tr><td colspan="8">No se encontraron registros en su zona.</td></tr>`; return; }
        const rowsHtml = await Promise.all(docs.map(async (doc) => {
            const client = doc.data();
            const docPath = doc.ref.path;
            const createdByFullName = await getUserName(client.creadoPor);
            const actionsCellHTML = `<button class="btn-action btn-action-manage exec-pending-btn" data-path="${docPath}"><i class="fas fa-tasks"></i> Gestionar</button>`;
            const creationDate = client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A';
            const implementationDate = client.implementationDate ? dayjs(client.implementationDate).format('DD/MM/YYYY') : 'Pendiente';
            const servicesCount = client.offerings ? client.offerings.length : 0;
            const servicesHTML = `<div class="service-summary"><span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span><a class="view-details-link" data-path="${docPath}"><i class="fas fa-list-ul"></i> Ver Detalles</a></div>`;
            let remainingMonthsText = 'N/A', textColorClass = '';
            const duration = client.offerings?.[0]?.frequency || 0;
            if (client.implementationDate && duration > 0) {
                const expirationDate = dayjs(client.implementationDate).add(duration, 'month');
                const remainingMonths = expirationDate.diff(dayjs(), 'month');
                remainingMonthsText = remainingMonths < 0 ? 0 : remainingMonths;
                if (remainingMonths <= 6) textColorClass = 'text-danger';
            }
            return `<tr><td><span class="code-text">${creationDate}</span></td><td><span class="code-text">${implementationDate}</span></td><td><span class="client-name-highlight">${client.name || 'N/A'}</span></td><td><span class="code-text">${client.ruc || 'N/A'}</span></td><td>${servicesHTML}</td><td>${createdByFullName}</td><td class="${textColorClass}">${remainingMonthsText}</td><td>${actionsCellHTML}</td></tr>`;
        }));
        tbody.innerHTML = rowsHtml.join('');
        tbody.querySelectorAll('.exec-pending-btn, .view-details-link').forEach(element => {
            element.addEventListener('click', (event) => {
                const target = event.currentTarget;
                if (target.classList.contains('exec-pending-btn')) openExecutionModal(target.dataset.path, 'in_process');
                else if (target.classList.contains('view-details-link')) handleClientAction(target.dataset.path, 'view');
            });
        });
    }

    function updatePaginationButtons(status, fetchedCount) {
        const prefix = 'won';
        const prevBtn = document.getElementById(`${prefix}-prev`);
        const nextBtn = document.getElementById(`${prefix}-next`);
        prevBtn.disabled = paginationState[status].pageHistory.length <= 2;
        nextBtn.disabled = fetchedCount < PAGE_SIZE;
    }
    
    async function loadExecList() {
        const tbody = document.getElementById('exec-table-body');
        tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
        try {
            const userZone = sessionStorage.getItem('userZone');
            if (!userZone) throw new Error("Zona de usuario no encontrada.");
            const snap = await db.collectionGroup('clients').where('clientStatus', '==', 'Ganado').where('execution.overallStatus', 'in', ['in_process', 'executed']).where('zone', '==', userZone).orderBy('execution.updatedAt', 'desc').get();
            if (snap.empty) { tbody.innerHTML = '<tr><td colspan="7">No hay clientes en proceso de ejecución en su zona.</td></tr>'; return; }
            const rowsHtml = await Promise.all(snap.docs.map(async (doc) => {
                const d = doc.data();
                const createdByFullName = await getUserName(d.creadoPor);
                const status = (d.execution?.overallStatus || 'pending');
                const statusLabels = { in_process: 'En Proceso', executed: 'Ejecutado' };
                const servicesCount = (d.offerings || []).length;
                const servicesHTML = `<div class="service-summary"><span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span><a class="view-details-link" data-path="${doc.ref.path}"><i class="fas fa-list-ul"></i> Ver Detalles</a></div>`;
                return `<tr><td><span class="code-text">${d.createdAt ? dayjs(d.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A'}</span></td><td><span class="client-name-highlight">${d.name || 'N/A'}</span></td><td><span class="code-text">${d.ruc || 'N/A'}</span></td><td>${servicesHTML}</td><td>${createdByFullName}</td><td>${statusLabels[status] || status}</td><td><button class="btn-action btn-action-manage exec-open" data-path="${doc.ref.path}"><i class="fas fa-tasks"></i> Gestionar</button></td></tr>`;
            }));
            tbody.innerHTML = rowsHtml.join('');
            tbody.querySelectorAll('.exec-open, .view-details-link').forEach(element => {
                element.addEventListener('click', (event) => {
                    const target = event.currentTarget;
                    if (target.classList.contains('exec-open')) openExecutionModal(target.dataset.path, 'executed');
                    else if (target.classList.contains('view-details-link')) handleClientAction(target.dataset.path, 'view');
                });
            });
        } catch (error) { 
            console.error("Error cargando lista de ejecución:", error); 
            tbody.innerHTML = '<tr><td colspan="7">Error al cargar los datos.</td></tr>'; 
        }
    }
    
    function openModal(modalElement) { modalElement.classList.add('visible'); }
    function closeModal(modalElement) { modalElement.classList.remove('visible'); }

    async function handleClientAction(docPath, mode) {
        if (mode === 'view') {
            openModal(modalOverlay);
            modalBody.innerHTML = '<div class="dashboard-spinner"></div>';
            modalFooter.innerHTML = '';
            try {
                const docSnap = await db.doc(docPath).get();
                if (!docSnap.exists) throw new Error("Documento no encontrado.");
                const client = docSnap.data();
                modalTitle.textContent = 'Detalles del Cliente';
                await populateModalBody(client, 'view');
                modalFooter.innerHTML = '<button class="modal-button btn-modal-secondary">Cerrar</button>';
                modalFooter.querySelector('button').addEventListener('click', () => closeModal(modalOverlay));
            } catch (error) {
                console.error("Error al cargar datos del cliente:", error);
                modalBody.innerHTML = `<p style="color: red;">No se pudieron cargar los datos.</p>`;
            }
        }
    }

    async function populateModalBody(client, mode) {
        const createdByFullName = await getUserName(client.creadoPor);
        const fields = [
            { label: 'Nombre del Cliente', value: client.name },
            { label: 'RUC', value: client.ruc }, { label: 'Tipo de Contrato', value: client.contractType },
            { label: 'Zona', value: client.zone }, { label: 'Fecha de Creación', value: client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY HH:mm') : 'N/A' },
            { label: 'Registrado Por', value: createdByFullName }, { label: 'Fecha de Implementación', value: client.implementationDate || 'N/A' }
        ];
        let fieldsHTML = fields.map(field => `<div class="modal-field"><label>${field.label}</label><span>${field.value || 'N/A'}</span></div>`).join('');
        let servicesTableHTML = `<div class="modal-field-full"><label>Servicios Contratados</label><div class="table-responsive-modal"><table class="modal-services-table"><thead><tr><th>Valor Agregado</th><th>Tipo</th><th>Cant.</th><th>Meses</th></tr></thead><tbody>`;
        if (client.offerings && client.offerings.length > 0) {
            client.offerings.forEach(offer => {
                const tipo = offer.category.includes('Vigilancia') ? 'Vigilancia' : 'Tecnología';
                servicesTableHTML += `<tr><td>${offer.name}</td><td>${tipo}</td><td>${offer.quantity || 1}</td><td>${offer.frequency || 'N/A'}</td></tr>`;
            });
        } else {
            servicesTableHTML += `<tr><td colspan="4">No hay servicios registrados.</td></tr>`;
        }
        servicesTableHTML += `</tbody></table></div></div>`;
        modalBody.innerHTML = fieldsHTML + servicesTableHTML;
    }

    let currentExecPath = null;
    const executionModalOverlay = document.getElementById('execution-modal-overlay');

    function openExecutionModal(docPath, mode) {
        currentExecPath = docPath;
        const body = document.getElementById('execution-items-body');
        const title = document.getElementById('execution-modal-title');
        title.textContent = mode === 'executed' ? 'Marcar Servicios como Ejecutados' : 'Marcar Servicios en Proceso';
        body.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
        openModal(document.getElementById('execution-modal-overlay'));
        db.doc(docPath).get().then(snap => {
            const data = snap.data() || {};
            const items = Array.isArray(data.offerings) ? data.offerings : [];
            const execOfferings = (data.execution && Array.isArray(data.execution.offerings)) ? data.execution.offerings : items.map(o => ({ name: o.name, status: 'pending' }));
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
            const button = e.target;
            const tr = button.closest('tr');
            const nextStatus = button.dataset.nextStatus;
            tr.dataset.newStatus = nextStatus;
            button.disabled = true;
            button.textContent = nextStatus === 'executed' ? 'Marcado Ejec.' : 'Marcado en Proc.';
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
            let statusMap = new Map(currentExecutionOfferings.map(o => [o.name, o]));
            let hasChanges = false; let becameInProcess = false; let allExecuted = true;
            document.querySelectorAll('#execution-items-body tr').forEach(tr => {
                const { name, newStatus } = tr.dataset;
                if (newStatus) {
                    hasChanges = true;
                    const offering = statusMap.get(name) || { name, status: 'pending' };
                    if (offering.status !== newStatus) {
                        offering.status = newStatus;
                        // <-- ESTA ES LA LÍNEA CORREGIDA -->
                        offering.statusChangedAt = new Date(); // Se usa la fecha del cliente en lugar de la del servidor
                        if (newStatus === 'in_process') becameInProcess = true;
                        statusMap.set(name, offering);
                    }
                }
            });
            if (!hasChanges) { alert("No se realizaron cambios."); return; }
            const updatedOfferings = Array.from(statusMap.values());
            updatedOfferings.forEach(o => { if (o.status !== 'executed') allExecuted = false; });
            const overallStatus = allExecuted ? 'executed' : (updatedOfferings.some(o => o.status === 'in_process' || o.status === 'executed') ? 'in_process' : 'pending');
            const updates = { 'execution.offerings': updatedOfferings, 'execution.overallStatus': overallStatus, 'execution.updatedAt': firebase.firestore.FieldValue.serverTimestamp() };
            if (becameInProcess && !data.stateDates?.inProcessAt) { updates['stateDates.inProcessAt'] = firebase.firestore.FieldValue.serverTimestamp(); }
            if (allExecuted && !data.stateDates?.executedAt) { updates['stateDates.executedAt'] = firebase.firestore.FieldValue.serverTimestamp(); }
            await clientRef.update(updates);
            alert('Estados de ejecución actualizados con éxito.');
            closeModal(executionModalOverlay);
            loadExecList();
            loadTableData(CLIENT_STATUS.WON, 'initial');
        } catch (error) { 
            console.error("Error al guardar ejecución:", error); alert("No se pudieron guardar los cambios.");
        } finally { 
            loadingOverlay.style.display = 'none'; saveBtn.disabled = false; 
        }
    }
    
    document.addEventListener('click', (e) => {
        if (e.target.id === 'execution-modal-close' || e.target.closest('#execution-modal-close')) { closeModal(document.getElementById('execution-modal-overlay')); }
        if (e.target.id === 'execution-modal-save') { saveExecutionModal(); }
        if(e.target.id === 'modal-close-btn' || e.target.closest('#modal-close-btn')) {
            closeModal(document.getElementById('client-modal-overlay'));
        }
    });
});