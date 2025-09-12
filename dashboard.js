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
    const CLIENT_STATUS = { PENDING: 'Ofrecido', WON: 'Ganado' };
    const PAGE_SIZE = 10;
    const paginationState = {
        [CLIENT_STATUS.PENDING]: { lastDoc: null, pageHistory: [null] },
        [CLIENT_STATUS.WON]: { lastDoc: null, pageHistory: [null] },
    };

    const userNameCache = {}; // Caché para nombres de usuario

    // --- FUNCIÓN PARA OBTENER NOMBRES DE USUARIO CON CACHÉ ---
    async function getUserName(email) {
        if (!email) return 'Desconocido';
        if (userNameCache[email]) return userNameCache[email];
        try {
            const username = email.split('@')[0].toUpperCase();
            const userDoc = await db.collection('usuarios').doc(username).get();
            if (userDoc.exists && userDoc.data().NOMBRE) {
                const fullName = userDoc.data().NOMBRE;
                userNameCache[email] = fullName;
                return fullName;
            } else {
                userNameCache[email] = email;
                return email;
            }
        } catch (error) {
            console.error("Error al obtener nombre de usuario:", error);
            return email;
        }
    }

    // --- CONSTANTES PARA EL EDITOR DE SERVICIOS ---
    const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
    const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';
    const availableOfferings = [
        { name: 'Plan de Responsabilidad Social', category: VIGILANCIA_CATEGORY },
        { name: 'Capacitaciones', category: VIGILANCIA_CATEGORY },
        { name: 'Capacitaciones Hermético', category: VIGILANCIA_CATEGORY },
        { name: 'Charlas de seguridad del personal', category: VIGILANCIA_CATEGORY },
        { name: 'Charlas de seguridad dirigida a EL CLIENTE (presencial)', category: VIGILANCIA_CATEGORY },
        { name: 'Charlas de seguridad dirigida a EL CLIENTE (virtual)', category: VIGILANCIA_CATEGORY },
        { name: 'Correo de cierre de informe semanal', category: VIGILANCIA_CATEGORY },
        { name: 'Informe mensual', category: VIGILANCIA_CATEGORY },
        { name: 'Informe semanal', category: VIGILANCIA_CATEGORY },
        { name: 'Levantamiento de Kardex', category: VIGILANCIA_CATEGORY },
        { name: 'Muestreo de conteos', category: VIGILANCIA_CATEGORY },
        { name: 'Plan tecnológico del servicio', category: VIGILANCIA_CATEGORY },
        { name: 'Presentación de staff', category: VIGILANCIA_CATEGORY },
        { name: 'Proceso de auditoría', category: VIGILANCIA_CATEGORY },
        { name: 'Proyecto de mejora continua', category: VIGILANCIA_CATEGORY },
        { name: 'Propuesta de eficiencia con Tecnología', category: VIGILANCIA_CATEGORY },
        { name: 'Requerimiento de mejoras', category: VIGILANCIA_CATEGORY },
        { name: 'Reporte de novedades', category: VIGILANCIA_CATEGORY },
        { name: 'Reporte de TMO', category: VIGILANCIA_CATEGORY },
        { name: 'Reporte de tiempo de atención', category: VIGILANCIA_CATEGORY },
        { name: 'Reporte de tickets', category: VIGILANCIA_CATEGORY },
        { name: 'Reuniones de avance', category: VIGILANCIA_CATEGORY },
        { name: 'Revisión de procedimientos', category: VIGILANCIA_CATEGORY },
        { name: 'Soporte técnico remoto', category: VIGILANCIA_CATEGORY },
        { name: 'Visitas técnicas', category: VIGILANCIA_CATEGORY },
        { name: 'Propuesta de ahorro con tecnología', category: VIGILANCIA_CATEGORY },
        { name: 'Reportes con Power BI', category: VIGILANCIA_CATEGORY },
        { name: 'Auditor de riesgos', category: VIGILANCIA_CATEGORY },
        { name: 'Análisis de riesgo', category: VIGILANCIA_CATEGORY },
        { name: 'Análisis delictivo', category: VIGILANCIA_CATEGORY },
        { name: 'Patrullaje motorizado', category: VIGILANCIA_CATEGORY },
        { name: 'Patrullaje canino', category: VIGILANCIA_CATEGORY },
        { name: 'Asistente Administrativo', category: VIGILANCIA_CATEGORY },
        { name: 'Supervisor área con dron', category: VIGILANCIA_CATEGORY },
        { name: 'Administrador de contrato', category: VIGILANCIA_CATEGORY },
        { name: 'Backup de personal', category: VIGILANCIA_CATEGORY },
        { name: 'Campañas de primescia', category: VIGILANCIA_CATEGORY },
        { name: 'Charlas de seguridad', category: VIGILANCIA_CATEGORY },
        { name: 'Celebración de festividades', category: VIGILANCIA_CATEGORY },
        { name: 'Equipos de computo', category: VIGILANCIA_CATEGORY },
        { name: 'Herramientas', category: VIGILANCIA_CATEGORY },
        { name: 'Linternas', category: VIGILANCIA_CATEGORY },
        { name: 'Radios', category: VIGILANCIA_CATEGORY },
        { name: 'Reportes', category: VIGILANCIA_CATEGORY },
        { name: 'Responsabilidad Social', category: VIGILANCIA_CATEGORY },
        { name: 'Señaléticas', category: VIGILANCIA_CATEGORY },
        { name: 'Uniformes', category: VIGILANCIA_CATEGORY },
        { name: 'Implementación de cámaras de seguridad', category: VIGILANCIA_CATEGORY },
        { name: 'Implementación de sensores y alarmas', category: VIGILANCIA_CATEGORY },
        { name: 'Plan de mejora continua', category: VIGILANCIA_CATEGORY },
        { name: 'Charlas de seguridad para el personal', category: VIGILANCIA_CATEGORY },
        { name: 'Capacitación de STT', category: VIGILANCIA_CATEGORY },
        { name: 'Capacitación de Sistema detección contra incendios', category: VIGILANCIA_CATEGORY },
        { name: 'Baño químico', category: VIGILANCIA_CATEGORY },
        { name: 'Sombrilla mas módulos', category: VIGILANCIA_CATEGORY },
        { name: 'Determinación de cargas', category: VIGILANCIA_CATEGORY },
        { name: 'Análisis de riegos', category: VIGILANCIA_CATEGORY },
        { name: 'Estudio de rutas de patrullaje', category: VIGILANCIA_CATEGORY },
        { name: 'Controles proactivos', category: VIGILANCIA_CATEGORY },
        { name: 'Información de inteligencia', category: VIGILANCIA_CATEGORY },
        { name: 'Software Geo crimen', category: VIGILANCIA_CATEGORY },
        { name: 'Auditoría Interna', category: VIGILANCIA_CATEGORY },
        { name: 'Reporte de Criminalidad', category: VIGILANCIA_CATEGORY },
        { name: 'SmartPanics', category: TECNOLOGIA_CATEGORY },
        { name: 'Integración de plataformas GPS', category: TECNOLOGIA_CATEGORY },
        { name: 'Botón de pánico', category: TECNOLOGIA_CATEGORY },
        { name: 'Pulsadores de pánico', category: TECNOLOGIA_CATEGORY },
        { name: 'Configuración de analítica', category: TECNOLOGIA_CATEGORY },
        { name: 'Analitycs', category: TECNOLOGIA_CATEGORY },
        { name: 'Ciberseguridad', category: TECNOLOGIA_CATEGORY }
    ];

    // --- ELEMENTOS DEL DOM ---
    const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
    const menuOptions = document.querySelectorAll('.menu-option');

    // Modal Detalles cliente
    const modalOverlay = document.getElementById('client-modal-overlay');
    const modalTitle   = document.getElementById('modal-title');
    const modalBody    = document.getElementById('modal-body');
    const modalFooter  = document.getElementById('modal-footer');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // Modal Editor de servicios
    const servicesEditorModal     = document.getElementById('services-editor-modal');
    const servicesEditorCloseBtn  = document.getElementById('services-editor-close-btn');
    const servicesEditorCancelBtn = document.getElementById('services-editor-cancel-btn');
    const servicesEditorSaveBtn   = document.getElementById('services-editor-save-btn');
    const editVigilanciaContainer = document.getElementById('edit-vigilancia-offerings-container');
    const editTecnologiaContainer = document.getElementById('edit-tecnologia-offerings-container');

    // --- AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            const userName = sessionStorage.getItem('userName');
            document.getElementById('user-fullname').textContent = userName || user.email;

            // Por defecto cargamos la sección Inicio
            showSection('inicio');

            // Eventos de menú
            menuOptions.forEach(btn => {
                btn.addEventListener('click', () => showSection(btn.dataset.section));
            });

            // Cerrar modal principal
            modalCloseBtn.addEventListener('click', () => closeModal(modalOverlay));

            // Eventos del editor de servicios
            servicesEditorCloseBtn.addEventListener('click', () => closeModal(servicesEditorModal));
            servicesEditorCancelBtn.addEventListener('click', () => closeModal(servicesEditorModal));
            servicesEditorSaveBtn.addEventListener('click', () => saveServicesChanges());

            // Botones añadir fila en el editor
            document.getElementById('edit-add-vigilancia-btn').addEventListener('click', () => {
                editVigilanciaContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
            });
            document.getElementById('edit-add-tecnologia-btn').addEventListener('click', () => {
                editTecnologiaContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));
            });

            // Logout
            document.getElementById('logout-btn').addEventListener('click', async () => {
                await auth.signOut();
                window.location.href = 'index.html';
            });

        } else {
            window.location.href = 'index.html';
        }
    });

    function showSection(sectionId) {
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('is-visible');
        });
        document.getElementById(`${sectionId}-section`).classList.add('is-visible');

        menuOptions.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });

        if (sectionId === 'inicio')      loadDashboardData();
        if (sectionId === 'pendientes')  loadTableData(CLIENT_STATUS.PENDING, 'initial');
        if (sectionId === 'ganados')     loadTableData(CLIENT_STATUS.WON, 'initial');
        if (sectionId === 'registrar')   ensureRegistrarIframe();
    }

    // -- Ajuste robusto de ruta para el iframe de "Registrar nueva solicitud"
    async function ensureRegistrarIframe() {
        const frame = document.getElementById('registrar-iframe');
        if (!frame) return;
        if (frame.dataset.srcChecked === '1') return; // ya configurado
        try {
            const testUrl = 'nueva/nueva.html';
            const r = await fetch(testUrl, { method: 'HEAD' });
            frame.src = (r.ok ? testUrl : 'nueva.html') + '?embedded=true';
        } catch (e) {
            frame.src = 'nueva.html?embedded=true';
        }
        frame.dataset.srcChecked = '1';
    }

    // --- LÓGICA DE CARGA DE DATOS ---
    async function loadDashboardData() {
        loadingOverlay.style.display = 'flex';
        try {
            const clientsSnapshot = await db.collectionGroup('clients').get();
            const clients = clientsSnapshot.docs.map(doc => doc.data());

            // tarjetas superiores
            document.getElementById('pending-count').textContent = clients
                .filter(c => c.clientStatus === CLIENT_STATUS.PENDING).length;
            document.getElementById('won-count').textContent = clients
                .filter(c => c.clientStatus === CLIENT_STATUS.WON).length;

            const expiringCount = clients.filter(c => {
                const isWon = c.clientStatus === CLIENT_STATUS.WON;
                const duration = c.offerings?.[0]?.frequency || 0;
                if (isWon && c.implementationDate && duration > 0) {
                    const expirationDate = dayjs(c.implementationDate).add(duration, 'month');
                    return expirationDate.diff(dayjs(), 'month') <= 6;
                }
                return false;
            }).length;
            document.getElementById('expiring-count').textContent = expiringCount;

            // ✅ ahora esperamos a que el ranking y contadores terminen antes de ocultar el loading
            await updateIndicatorsAndChart(clients);

        } catch (error) {
            console.error("Error cargando datos del dashboard:", error);
        } finally {
            loadingOverlay.style.display = 'none';
        }
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

            pagination.lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
            if (direction === 'initial') pagination.pageHistory = [docs[0] || null];
            else if (direction === 'next' && docs.length > 0) pagination.pageHistory.push(docs[0]);

            updatePaginationButtons(status, docs.length);

            const colspan = status === CLIENT_STATUS.WON ? 8 : 6;
            if (docs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="${colspan}">No se encontraron registros.</td></tr>`;
                return;
            }

            // Construimos filas (resolviendo nombres de usuario en paralelo)
            const rowsHtml = await Promise.all(docs.map(async (doc) => {
                const client = doc.data();
                const docPath = doc.ref.path;
                const createdByFullName = await getUserName(client.creadoPor);

                const creationDate = client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A';
                const servicesCount = client.offerings ? client.offerings.length : 0;
                const servicesHTML = `
                    <div class="service-summary">
                        <span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span>
                        <a class="view-details-link" data-path="${docPath}"><i class="fas fa-list-ul"></i> Ver Detalles</a>
                    </div>`;

                let actionsCellHTML = `
                    <div class="action-icons-wrapper">
                        <i class="fas fa-pencil-alt action-icon edit-details-btn" data-path="${docPath}" title="Editar Detalles"></i>
                        <i class="fas fa-cogs action-icon edit-services-btn" data-path="${docPath}" title="Editar Servicios"></i>
                        <i class="fas fa-trash-alt action-icon delete-btn" data-path="${docPath}" title="Eliminar Registro"></i>
                    </div>`;

                if (status === CLIENT_STATUS.PENDING) {
                    actionsCellHTML += `<button class="btn-action btn-action-won mark-won-btn" data-path="${docPath}"><i class="fas fa-check"></i> GANADO</button>`;
                    return `
                        <tr>
                            <td><span class="code-text">${creationDate}</span></td>
                            <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
                            <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
                            <td>${servicesHTML}</td>
                            <td>${createdByFullName}</td>
                            <td>${actionsCellHTML}</td>
                        </tr>`;
                } else { // WON
                    actionsCellHTML += `<button class="btn-action btn-action-manage exec-pending-btn" data-path="${docPath}"><i class="fas fa-tasks"></i> Gestionar</button>`;
                    const implementationDate = client.implementationDate ? dayjs(client.implementationDate).format('DD/MM/YYYY') : 'Pendiente';
                    let remainingMonthsText = 'N/A', textColorClass = '';
                    const duration = client.offerings?.[0]?.frequency || 0;
                    if (client.implementationDate && duration > 0) {
                        const expirationDate = dayjs(client.implementationDate).add(duration, 'month');
                        const remainingMonths = expirationDate.diff(dayjs(), 'month');
                        remainingMonthsText = remainingMonths < 0 ? 0 : remainingMonths;
                        if (remainingMonths <= 6) textColorClass = 'text-danger';
                    }
                    return `
                        <tr>
                            <td><span class="code-text">${creationDate}</span></td>
                            <td><span class="code-text">${implementationDate}</span></td>
                            <td><span class="client-name-highlight">${client.name || 'N/A'}</span></td>
                            <td><span class="code-text">${client.ruc || 'N/A'}</span></td>
                            <td>${servicesHTML}</td>
                            <td>${createdByFullName}</td>
                            <td class="${textColorClass}">${remainingMonthsText}</td>
                            <td>${actionsCellHTML}</td>
                        </tr>`;
                }
            }));

            tbody.innerHTML = rowsHtml.join('');

            // Eventos sobre filas recién pintadas
            tbody.querySelectorAll('.action-icon, .view-details-link').forEach(element => {
                element.addEventListener('click', (event) => {
                    const target = event.currentTarget;
                    const docPath = target.dataset.path;
                    let mode = 'view';
                    if (target.classList.contains('edit-details-btn')) mode = 'edit';
                    if (target.classList.contains('edit-services-btn')) mode = 'edit-services';

                    if (target.classList.contains('delete-btn')) {
                        if (confirm('¿Estás seguro? Esta acción no se puede deshacer.')) handleDelete(docPath);
                    } else {
                        handleClientAction(docPath, mode);
                    }
                });
            });
        } catch (error) {
            console.error("Error cargando tabla:", error);
            tbody.innerHTML = `<tr><td colspan="${status === CLIENT_STATUS.WON ? 8 : 6}">Error al cargar los datos.</td></tr>`;
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    function updatePaginationButtons(status, fetchedCount) {
        const prefix = status === CLIENT_STATUS.PENDING ? 'pending' : 'won';
        document.getElementById(`${prefix}-prev`).disabled = paginationState[status].pageHistory.length <= 1;
        document.getElementById(`${prefix}-next`).disabled = fetchedCount < PAGE_SIZE;
    }

    // === INDICADORES + GRÁFICO (ROBUSTO) ===
    async function updateIndicatorsAndChart(clients) {
        // mapa nombre->categoría para inferir cuando falte en registros antiguos
        const nameToCategory = {};
        (availableOfferings || []).forEach(o => { nameToCategory[o.name] = o.category; });

        const userRanking = {};
        let vaCount = 0, vatCount = 0;
        const serviceCounts = { pending: {}, won: {} };
        const allServiceNames = new Set();

        for (const client of clients) {
            const userKey = client.creadoPor || 'Desconocido';
            userRanking[userKey] = (userRanking[userKey] || 0) + 1;

            if (Array.isArray(client.offerings)) {
                for (const offer of client.offerings) {
                    const name = offer.name || 'Sin nombre';
                    allServiceNames.add(name);

                    const statusKey = client.clientStatus === CLIENT_STATUS.PENDING ? 'pending' : 'won';
                    serviceCounts[statusKey][name] = (serviceCounts[statusKey][name] || 0) + 1;

                    const cat = offer.category || nameToCategory[name];
                    if (cat === VIGILANCIA_CATEGORY) vaCount++;
                    else if (cat === TECNOLOGIA_CATEGORY) vatCount++;
                }
            }
        }

        // Ranking: convertir emails a nombres si existen en 'usuarios'
        const top3 = Object.entries(userRanking).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const top3WithNames = await Promise.all(top3.map(async ([emailOrName, count]) => {
            const display = await getUserName(emailOrName);
            return { display, count };
        }));

        const rankingList = document.getElementById('user-ranking-list');
        rankingList.innerHTML = top3WithNames.length
            ? top3WithNames.map(i => `<li><span>${i.display}</span><strong>${i.count}</strong></li>`).join('')
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
            console.error('Error al renderizar el gráfico:', err);
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
                    { label: 'Solicitudes Pendientes', data: pendingData, backgroundColor: 'rgba(255, 167, 38, 0.7)' },
                    { label: 'Clientes Ganados', data: wonData, backgroundColor: 'rgba(102, 187, 106, 0.7)' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: {
                        color: '#ffffff',
                        anchor: 'end',
                        align: 'start',
                        offset: -20,
                        font: { weight: 'bold' },
                        formatter: (v) => v || ''
                    }
                },
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
            }
        });
    }

    // --- MODALES GENÉRICOS ---
    function openModal(modalElement) { modalElement.classList.add('visible'); }
    function closeModal(modalElement) { modalElement.classList.remove('visible'); }

    async function handleClientAction(docPath, mode) {
        if (mode === 'view' || mode === 'edit') {
            openModal(modalOverlay);
            modalBody.innerHTML = '<div class="dashboard-spinner"></div>';
            modalFooter.innerHTML = '';
            try {
                const docRef = db.doc(docPath);
                const docSnap = await docRef.get();
                if (!docSnap.exists) throw new Error("Documento no encontrado.");
                const client = docSnap.data();
                modalTitle.textContent = mode === 'view' ? 'Detalles del Cliente' : 'Editar Detalles del Cliente';
                await populateModalBody(client, mode);
                populateModalFooter(docPath, mode);
            } catch (error) {
                console.error("Error al cargar datos del cliente:", error);
                modalBody.innerHTML = '<p style="color: red;">No se pudieron cargar los datos.</p>';
            }
        } else if (mode === 'edit-services') {
            await openServicesEditor(docPath);
        }
    }

    async function populateModalBody(client, mode) {
        const isEditMode = mode === 'edit';
        const createdByFullName = await getUserName(client.creadoPor);

        const fields = [
            { id: 'clientName', label: 'Nombre del Cliente', value: client.name, type: 'text', editable: true },
            { id: 'clientRuc',  label: 'RUC',                value: client.ruc,  type: 'text', editable: true },
            { id: 'contractType', label: 'Tipo de Contrato', value: client.contractType, type: 'select', editable: true, options: ['NUEVO', 'RENOVACION'] },
            { id: 'zone', label: 'Zona', value: client.zone, type: 'select', editable: true, options: ['SUR', 'NORTE', 'CENTRO', 'MINAS'] },
            { id: 'createdAt', label: 'Fecha de Creación', value: client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY HH:mm') : 'N/A', editable: false },
            { id: 'creadoPor', label: 'Registrado Por', value: createdByFullName, editable: false },
        ];
        if (client.clientStatus === 'Ganado') {
            fields.push({ id: 'implementationDate', label: 'Fecha de Implementación', value: client.implementationDate ? dayjs(client.implementationDate).format('YYYY-MM-DD') : '', type: 'date', editable: true, optional: true });
        }

        const fieldsHTML = fields.map(field => {
            const editable = isEditMode && field.editable;
            let inputHTML = `<span>${field.value || 'N/A'}</span>`;
            if (editable) {
            if (field.type === 'select') {
                const opts = field.options.map(opt => `<option value="${opt}" ${field.value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                inputHTML = `<select id="modal-${field.id}" class="modal-input">${opts}</select>`;
            } else {
                inputHTML = `<input type="${field.type}" id="modal-${field.id}" value="${field.value || ''}" class="modal-input">`;
            }
            }
            return `<div class="modal-field"><label>${field.label}</label>${inputHTML}</div>`;
        }).join('');

        let servicesTableHTML = `
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

        if (client.offerings && client.offerings.length > 0) {
            client.offerings.forEach(offer => {
            const tipo  = offer.category?.includes('Vigilancia') ? 'Vigilancia' : 'Tecnología';
            const cost  = offer.cost  || 0;
            const total = offer.total || 0;
            servicesTableHTML += `<tr>
                <td>${offer.name}</td>
                <td>${tipo}</td>
                <td>${offer.provisionMode || '-'}</td>
                <td>${offer.frequency || '-'}</td>
                <td>${offer.quantity || '-'}</td>
                <td>${offer.months || '-'}</td>
                <td>S/ ${cost.toFixed(2)}</td>
                <td>S/ ${total.toFixed(2)}</td>
            </tr>`;
            });
        } else {
            servicesTableHTML += `<tr><td colspan="8">No hay servicios registrados.</td></tr>`;
        }
        servicesTableHTML += `</tbody></table></div></div>`;

        // ⬇️ Inyecta directamente en el grid de #modal-body (sin wrapper extra)
        modalBody.innerHTML = `${fieldsHTML}${servicesTableHTML}`;
        }


    function populateModalFooter(docPath, mode) {
        modalFooter.innerHTML = '';
        if (mode === 'edit') {
            const saveButton = document.createElement('button');
            saveButton.textContent = 'Guardar Cambios';
            saveButton.className = 'modal-button btn-modal-primary';
            saveButton.addEventListener('click', () => saveClientChanges(docPath, saveButton));
            modalFooter.appendChild(saveButton);
        }
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cerrar';
        cancelButton.className = 'modal-button btn-modal-secondary';
        cancelButton.addEventListener('click', () => closeModal(modalOverlay));
        modalFooter.appendChild(cancelButton);
    }

    async function saveClientChanges(docPath, saveButton) {
        saveButton.disabled = true; saveButton.textContent = 'Guardando...';
        try {
            const docRef = db.doc(docPath);
            const originalDoc = await docRef.get();
            if (!originalDoc.exists) throw new Error("El cliente ya no existe.");
            const originalData = originalDoc.data();

            const updatedData = {}; const changes = {};
            const fieldsToUpdate = [
                { id: 'clientName', key: 'name' },
                { id: 'clientRuc', key: 'ruc' },
                { id: 'contractType', key: 'contractType' },
                { id: 'zone', key: 'zone' },
                { id: 'implementationDate', key: 'implementationDate', optional: true }
            ];
            fieldsToUpdate.forEach(field => {
                const input = document.getElementById(`modal-${field.id}`);
                if (input) {
                    const newValue = input.value; const oldValue = originalData[field.key] || '';
                    if (newValue !== oldValue) { updatedData[field.key] = newValue; changes[field.key] = { from: oldValue, to: newValue }; }
                }
            });

            if (Object.keys(updatedData).length > 0) {
                const logEntry = {
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    user: auth.currentUser.email,
                    action: 'update_details',
                    changes
                };
                const batch = db.batch();
                const clientRef = db.doc(docPath);
                const logRef = clientRef.collection('logs').doc();
                batch.update(clientRef, updatedData);
                batch.set(logRef, logEntry);
                await batch.commit();
                alert("Cambios guardados y registrados con éxito.");
            } else {
                alert("No se detectaron cambios para guardar.");
            }
            closeModal(modalOverlay);
            const activeSection = document.querySelector('.menu-option.active').dataset.section;
            if (activeSection !== 'inicio') loadTableData(CLIENT_STATUS[activeSection.toUpperCase()], 'initial');
            loadDashboardData();
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("No se pudieron guardar los cambios.");
        } finally {
            saveButton.disabled = false; saveButton.textContent = 'Guardar Cambios';
        }
    }

    async function openServicesEditor(docPath) {
        editVigilanciaContainer.innerHTML = '';
        editTecnologiaContainer.innerHTML = '';
        document.getElementById('services-editor-doc-path').value = docPath;
        openModal(servicesEditorModal);

        try {
            const snap = await db.doc(docPath).get();
            if (!snap.exists) throw new Error('Documento no encontrado');

            const data = snap.data() || {};
            const currentOfferings = Array.isArray(data.offerings) ? data.offerings : [];

            currentOfferings.forEach(o => {
                const category = o.category || (o.name && availableOfferings.find(x => x.name === o.name)?.category) || VIGILANCIA_CATEGORY;
                const container = category === VIGILANCIA_CATEGORY ? editVigilanciaContainer : editTecnologiaContainer;
                container.appendChild(createOfferingRow(category, o));
            });

            if (!editVigilanciaContainer.children.length) {
                editVigilanciaContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
            }
            if (!editTecnologiaContainer.children.length) {
                editTecnologiaContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));
            }
        } catch (error) {
            console.error("Error al abrir editor de servicios:", error);
            alert("No se pudieron cargar los servicios.");
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
            });
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

            // refrescar vistas
            const activeSection = document.querySelector('.menu-option.active').dataset.section;
            if (activeSection === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
            if (activeSection === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
            loadDashboardData();
        } catch (error) {
            console.error("Error al guardar servicios:", error);
            alert("No se pudieron guardar los cambios en los servicios.");
        } finally {
            servicesEditorSaveBtn.disabled = false;
            servicesEditorSaveBtn.textContent = 'Guardar Cambios';
        }
    }

    function createOfferingRow(category, offeringData = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = 'offering-row';
        const optionsForCategory = availableOfferings.filter(o => o.category === category);
        const selectOptions = optionsForCategory.map(o => `<option value="${o.name}" ${offeringData.name === o.name ? 'selected' : ''}>${o.name}</option>`).join('');
        wrapper.innerHTML = `
            <div class="offering-row-header">
                <select class="offering-name">
                    <option value="">Seleccionar...</option>
                    ${selectOptions}
                </select>
                <div class="offering-row-actions">
                    <button type="button" class="remove-offering-row-btn" title="Quitar fila">&times;</button>
                </div>
                <input type="hidden" class="offering-category" value="${category}">
            </div>
            <div class="offering-row-body">
                <label>Modalidad
                    <select class="offering-provision-mode">
                        <option>Por todo el contrato</option>
                        <option>Por cada mes</option>
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
                    <input type="text" class="offering-total" value="S/ ${(offeringData.total || 0).toFixed(2)}" readonly>
                </label>
            </div>
        `;
        const calculateTotal = () => {
            const quantity = parseFloat(wrapper.querySelector('.offering-quantity').value) || 1;
            const cost = parseFloat(wrapper.querySelector('.offering-cost').value) || 0;
            const provisionMode = wrapper.querySelector('.offering-provision-mode').value;
            let total = 0;
            if (provisionMode === 'Por todo el contrato') {
                total = cost * quantity;
            } else {
                const frequency = parseFloat(wrapper.querySelector('.offering-frequency').value) || 6;
                total = (cost * quantity) * frequency;
            }
            wrapper.querySelector('.offering-total').value = `S/ ${total.toFixed(2)}`;
        };
        wrapper.addEventListener('input', calculateTotal);
        wrapper.addEventListener('change', calculateTotal);
        wrapper.querySelector('.remove-offering-row-btn').addEventListener('click', () => wrapper.remove());
        if (offeringData.name) calculateTotal();
        return wrapper;
    }

    // --- EVENTOS GLOBALES ---
    document.getElementById('pending-next').addEventListener('click', () => loadTableData(CLIENT_STATUS.PENDING, 'next'));
    document.getElementById('pending-prev').addEventListener('click', () => loadTableData(CLIENT_STATUS.PENDING, 'prev'));
    document.getElementById('won-next').addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'next'));
    document.getElementById('won-prev').addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'prev'));
    document.getElementById('pending-card').addEventListener('click', () => showSection('pendientes'));
    document.getElementById('won-card').addEventListener('click', () => showSection('ganados'));
    document.getElementById('expiring-card').addEventListener('click', () => showSection('ganados'));

    // cross-window update (desde nueva.html)
    window.addEventListener('message', (event) => {
        if (event.data === 'clientUpdated' || event.data === 'clientAdded') {
            loadDashboardData();
            const activeSection = document.querySelector('.menu-option.active').dataset.section;
            if (activeSection === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
            if (activeSection === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
        }
    });

    async function handleDelete(docPath) {
        loadingOverlay.style.display = 'flex';
        try {
            await db.doc(docPath).delete();
            alert("Registro eliminado con éxito.");
            loadDashboardData();
            const activeSection = document.querySelector('.menu-option.active').dataset.section;
            if (activeSection === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
            if (activeSection === 'ganados')    loadTableData(CLIENT_STATUS.WON, 'initial');
        } catch (error) {
            console.error("Error al eliminar el registro:", error);
            alert("No se pudo eliminar el registro.");
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    // --- MÓDULO DE EJECUCIÓN ---
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
                const isExecuted = currentStatus === 'executed';
                const statusLabels = { pending: 'Pendiente', in_process: 'En Proceso', executed: 'Ejecutado' };
                let buttonHTML = '';
                if (isExecuted) {
                    buttonHTML = `<button class="modal-button btn-modal-secondary btn-xs" disabled>Ejecutado</button>`;
                } else {
                    const nextStatus = mode === 'executed' ? 'executed' : 'in_process';
                    const buttonText = mode === 'executed' ? 'Ejecutado' : 'En Proceso';
                    buttonHTML = `<button class="modal-button btn-modal-primary btn-xs mark-exec-item" data-next-status="${nextStatus}">${buttonText}</button>`;
                }
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${o.name}</td>
                    <td><span class="badge ${isExecuted ? 'badge-success' : (currentStatus === 'in_process' ? 'badge-warning' : 'badge-default')}">${statusLabels[currentStatus]}</span></td>
                    <td>${buttonHTML}</td>
                `;
                row.dataset.name = o.name;
                body.appendChild(row);
            });
        });
    }

    async function saveExecutionModal() {
        const saveBtn = document.getElementById('execution-modal-save');
        saveBtn.disabled = true;
        loadingOverlay.style.display = 'flex';
        try {
            const clientRef = db.doc(currentExecPath);
            const snap = await clientRef.get();
            const data = snap.data() || {};
            const rows = Array.from(document.querySelectorAll('#execution-items-body tr'));
            let hasChanges = false, allExecuted = true, becameInProcess = false;
            const statusMap = new Map(
                (data.execution && Array.isArray(data.execution.offerings) ? data.execution.offerings : [])
                .map(x => [x.name, { name: x.name, status: x.status }])
            );
            rows.forEach(tr => {
                const { name } = tr.dataset;
                const nextBtn = tr.querySelector('.mark-exec-item');
                if (nextBtn) {
                    hasChanges = true;
                    const newStatus = nextBtn.dataset.nextStatus;
                    const offering = statusMap.get(name) || { name, status: 'pending' };
                    if (offering.status !== newStatus) {
                        offering.status = newStatus;
                        offering.statusChangedAt = firebase.firestore.Timestamp.now();
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
                'execution.status': overallStatus,
                'execution.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
            };
            if (becameInProcess && !data.stateDates?.inProcessAt)
                updates['stateDates.inProcessAt'] = firebase.firestore.FieldValue.serverTimestamp();
            if (allExecuted && !data.stateDates?.executedAt)
                updates['stateDates.executedAt'] = firebase.firestore.FieldValue.serverTimestamp();

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

    async function loadExecList() {
        const tbody = document.getElementById('exec-table-body');
        tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
        try {
            const snapshot = await db.collectionGroup('clients')
                .where('clientStatus', '==', CLIENT_STATUS.WON)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();

            const rowsHtml = await Promise.all(snapshot.docs.map(async d => {
                const c = d.data();
                const createdByFullName = await getUserName(c.creadoPor);
                const servicesCount = c.offerings ? c.offerings.length : 0;
                const servicesHTML = `<div class="service-summary"><span class="service-count">${servicesCount} Servicio${servicesCount !== 1 ? 's' : ''}</span> <a class="view-details-link" data-path="${d.ref.path}"><i class="fas fa-list-ul"></i> Ver Detalles</a></div>`;
                return `<tr>
                    <td><span class="code-text">${c.createdAt ? dayjs(c.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A'}</span></td>
                    <td><span class="client-name-highlight">${c.name || 'N/A'}</span></td>
                    <td><span class="code-text">${c.ruc || 'N/A'}</span></td>
                    <td>${servicesHTML}</td>
                    <td>${createdByFullName}</td>
                    <td><span class="badge ${c.execution?.status === 'executed' ? 'badge-success' : (c.execution?.status === 'in_process' ? 'badge-warning' : 'badge-default')}">${c.execution?.status || 'pending'}</span></td>
                    <td><button class="btn-action btn-action-manage exec-pending-btn" data-path="${d.ref.path}"><i class="fas fa-tasks"></i> Gestionar</button></td>
                </tr>`;
            }));
            tbody.innerHTML = rowsHtml.join('');
        } catch (error) {
            console.error("Error cargando lista de ejecución:", error);
            tbody.innerHTML = '<tr><td colspan="7">Error al cargar los datos.</td></tr>';
        }
    }

    // Delegado global: engrane / gestionar / ejecución / cierres
    document.addEventListener('click', (e) => {
        const editSrvBtn = e.target.closest('.edit-services-btn');
        if (editSrvBtn) { e.preventDefault(); handleClientAction(editSrvBtn.dataset.path, 'edit-services'); return; }

        const wonBtn = e.target.closest('.mark-won-btn');
        if (wonBtn) { e.preventDefault(); openWonDatePickerModal(wonBtn.dataset.path); }

        const execPendingBtn = e.target.closest('.exec-pending-btn');
        if (execPendingBtn) { e.preventDefault(); openExecutionModal(execPendingBtn.dataset.path, 'in_process'); }

        const execOpenBtn = e.target.closest('.exec-open');
        if (execOpenBtn) { e.preventDefault(); openExecutionModal(execOpenBtn.dataset.path, 'executed'); }

        if (e.target.id === 'execution-modal-close' || e.target.closest('#execution-modal-close')) { closeModal(document.getElementById('execution-modal-overlay')); }
        if (e.target.id === 'execution-modal-save') { saveExecutionModal(); }
        if (e.target.id === 'date-picker-close-btn' || e.target.closest('#date-picker-close-btn')) { closeModal(document.getElementById('date-picker-modal')); }
        if (e.target.id === 'date-picker-confirm-btn') { handleConfirmWon(); }

        if (e.target.id === 'services-editor-close-btn' || e.target.closest('#services-editor-close-btn') ||
            e.target.id === 'services-editor-cancel-btn' || e.target.closest('#services-editor-cancel-btn')) {
            closeModal(servicesEditorModal);
        }
        if (e.target.id === 'modal-close-btn' || e.target.closest('#modal-close-btn')) {
            closeModal(modalOverlay);
        }
    });

    // Hook para cargar la lista de ejecución al entrar en esa sección
    const origShowSection = showSection;
    showSection = function(sectionId) {
        origShowSection(sectionId);
        if (sectionId === 'ejecucion') loadExecList();
    };

    // === "GANADO" (selector de fecha) ===
    function openWonDatePickerModal(docPath) {
        document.getElementById('won-doc-path').value = docPath;
        openModal(document.getElementById('date-picker-modal'));
    }

    async function handleConfirmWon() {
        const docPath = document.getElementById('won-doc-path').value;
        const dateValue = document.getElementById('won-date-input').value; // YYYY-MM-DD
        if (!dateValue) { alert('Selecciona una fecha.'); return; }
        try {
            const clientRef = db.doc(docPath);
            const updates = {
                clientStatus: CLIENT_STATUS.WON,
                implementationDate: dateValue,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await clientRef.update(updates);
            alert('Marcado como GANADO.');
            closeModal(document.getElementById('date-picker-modal'));
            loadDashboardData();
            loadTableData(CLIENT_STATUS.PENDING, 'initial');
            loadTableData(CLIENT_STATUS.WON, 'initial');
        } catch (err) {
            console.error(err);
            alert('No se pudo marcar como GANADO.');
        }
    }
});
