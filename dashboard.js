document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZACIÓN Y CONSTANTES ---
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        alert("Error crítico de configuración. Revisa la consola."); return;
    }
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    let servicesChart = null;
    const CLIENT_STATUS = { PENDING: 'Ofrecido', WON: 'Ganado' };
    const PAGE_SIZE = 10;
    const paginationState = {
        [CLIENT_STATUS.PENDING]: { lastDoc: null, pageHistory: [null] },
        [CLIENT_STATUS.WON]: { lastDoc: null, pageHistory: [null] },
    };
    
    // --- CONSTANTES PARA EL EDITOR DE SERVICIOS (TRAÍDAS DE APP.JS) ---
    const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
    const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';
    const availableOfferings = [
        { name: 'Plan de Responsabilidad Social', category: VIGILANCIA_CATEGORY }, { name: 'Estudio de seguridad con optimización de tecnología', category: VIGILANCIA_CATEGORY },
        { name: 'Reportes con Power BI', category: VIGILANCIA_CATEGORY }, { name: 'Software de control de Riegos (Total Risik)', category: VIGILANCIA_CATEGORY },
        { name: 'Asistente Administrativo', category: VIGILANCIA_CATEGORY }, { name: 'Supervisión área con dron', category: VIGILANCIA_CATEGORY },
        { name: 'Administrador de contrato', category: VIGILANCIA_CATEGORY }, { name: 'Celebración de festividades', category: VIGILANCIA_CATEGORY },
        { name: 'Equipos de computo', category: VIGILANCIA_CATEGORY }, { name: 'Detector de metales', category: VIGILANCIA_CATEGORY }, { name: 'Linternas', category: VIGILANCIA_CATEGORY },
        { name: 'Radios', category: VIGILANCIA_CATEGORY }, { name: 'Capacitación en hostigamiento sexual y manejo de crisis', category: VIGILANCIA_CATEGORY }, { name: 'Capacitación de STT', category: VIGILANCIA_CATEGORY },
        { name: 'Capacitación de Sistema detección contra incendio', category: VIGILANCIA_CATEGORY }, { name: 'Poligrafía', category: VIGILANCIA_CATEGORY }, { name: 'Baño químico', category: VIGILANCIA_CATEGORY },
        { name: 'Sombrilla mas módulos', category: VIGILANCIA_CATEGORY }, { name: 'Equipo Dron', category: VIGILANCIA_CATEGORY }, { name: 'Análisis de riegos', category: VIGILANCIA_CATEGORY },
        { name: 'Estudio de rutas de patrullaje', category: VIGILANCIA_CATEGORY }, { name: 'Información de inteligencia', category: VIGILANCIA_CATEGORY },
        { name: 'Software Geo crimen', category: VIGILANCIA_CATEGORY }, { name: 'Cliente incognito', category: VIGILANCIA_CATEGORY }, { name: 'Auditoría Interna', category: VIGILANCIA_CATEGORY },
        { name: 'Reporte de Criminalidad', category: VIGILANCIA_CATEGORY }, { name: 'LiderControl', category: TECNOLOGIA_CATEGORY }, { name: 'SmartPanics', category: TECNOLOGIA_CATEGORY },
        { name: 'Integración de plataformas GPS', category: TECNOLOGIA_CATEGORY }, { name: 'Pulsadores de pánico', category: TECNOLOGIA_CATEGORY },
        { name: 'Configuración de analítica', category: TECNOLOGIA_CATEGORY }, { name: 'Ciberseguridad', category: TECNOLOGIA_CATEGORY }
    ];

    // --- ELEMENTOS DEL DOM ---
    const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
    const menuOptions = document.querySelectorAll('.menu-option');
    const modalOverlay = document.getElementById('client-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // Elementos del nuevo modal de edición de servicios
    const servicesEditorModal = document.getElementById('services-editor-modal');
    const servicesEditorCloseBtn = document.getElementById('services-editor-close-btn');
    const servicesEditorCancelBtn = document.getElementById('services-editor-cancel-btn');
    const servicesEditorSaveBtn = document.getElementById('services-editor-save-btn');
    const editVigilanciaContainer = document.getElementById('edit-vigilancia-offerings-container');
    const editTecnologiaContainer = document.getElementById('edit-tecnologia-offerings-container');


    // --- AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            document.getElementById('user-email').textContent = user.email;
            showSection('inicio');
        } else {
            window.location.replace('index.html');
        }
    });

    // --- NAVEGACIÓN ---
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
    menuOptions.forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    function showSection(sectionId) {
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('is-visible');
        });
        document.getElementById(`${sectionId}-section`).classList.add('is-visible');
        menuOptions.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
        if (sectionId === 'inicio') loadDashboardData();
        if (sectionId === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
        if (sectionId === 'ganados') loadTableData(CLIENT_STATUS.WON, 'initial');
    }
    
    // --- LÓGICA DE CARGA DE DATOS ---
    async function loadDashboardData() {
        loadingOverlay.style.display = 'flex';
        try {
            const clientsSnapshot = await db.collectionGroup('clients').get();
            const clients = clientsSnapshot.docs.map(doc => doc.data());
            
            document.getElementById('pending-count').textContent = clients.filter(c => c.clientStatus === CLIENT_STATUS.PENDING).length;
            document.getElementById('won-count').textContent = clients.filter(c => c.clientStatus === CLIENT_STATUS.WON).length;

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
            updateIndicatorsAndChart(clients);
        } catch (error) {
            console.error("Error cargando datos del dashboard:", error);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    async function loadTableData(status, direction = 'next') {
        loadingOverlay.style.display = 'flex';
        const state = paginationState[status];
        
        try {
            let query = db.collectionGroup('clients')
                .where('clientStatus', '==', status)
                .orderBy('createdAt', 'desc')
                .limit(PAGE_SIZE);

            if (direction === 'initial') {
                state.lastDoc = null;
                state.pageHistory = [null];
            }

            const currentPageIndex = state.pageHistory.length - 1;
            const cursorDoc = direction === 'prev' ? state.pageHistory[currentPageIndex - 2] : state.lastDoc;

            if (cursorDoc) {
                query = query.startAfter(cursorDoc);
            }

            const snapshot = await query.get();
            const docs = snapshot.docs;

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
            
            renderTable(status, docs);
            updatePaginationButtons(status, docs.length);

        } catch (error) {
            console.error(`Error cargando tabla de ${status}:`, error);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }
    
    // --- RENDERIZADO Y UI ---
    function renderTable(status, docs) {
        const tableId = status === CLIENT_STATUS.PENDING ? 'pending-table-body' : 'won-table-body';
        const tbody = document.getElementById(tableId);
        tbody.innerHTML = '';

        const colspan = status === CLIENT_STATUS.WON ? 9 : 6;
        if (docs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${colspan}">No se encontraron registros.</td></tr>`;
            return;
        }

        docs.forEach(doc => {
            const client = doc.data();
            const docPath = doc.ref.path;
            const tr = document.createElement('tr');
            const creationDate = client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A';
            const servicesHTML = `<ul>${(client.offerings || []).map(o => `<li>${o.name}</li>`).join('')}</ul>`;

            // REEMPLAZA ESTA VARIABLE DENTRO DE LA FUNCIÓN renderTable EN dashboard.js
                const actionsCell = `
                    <td>
                        <div class="action-icons-wrapper">
                            <i class="fas fa-eye action-icon view-btn" data-path="${docPath}" title="Ver Detalles"></i>
                            <i class="fas fa-pencil-alt action-icon edit-details-btn" data-path="${docPath}" title="Editar Detalles"></i>
                            <i class="fas fa-cogs action-icon edit-services-btn" data-path="${docPath}" title="Editar Servicios"></i>
                        </div>
                    </td>
                `;

            if (status === CLIENT_STATUS.WON) {
                let remainingMonthsText = 'N/A';
                let textColorClass = '';
                const duration = client.offerings?.[0]?.frequency || 0;

                if (client.implementationDate && duration > 0) {
                    const expirationDate = dayjs(client.implementationDate).add(duration, 'month');
                    const remainingMonths = expirationDate.diff(dayjs(), 'month');
                    remainingMonthsText = remainingMonths < 0 ? 0 : remainingMonths;
                    if (remainingMonths <= 6) textColorClass = 'text-danger';
                }
                //implementationDateDisplay
                const implementationDateDisplay = client.implementationDate 
                    ? dayjs(client.implementationDate).format('DD/MM/YYYY')
                    : 'Pendiente'; 

                tr.innerHTML = `
                    <td>${creationDate}</td>
                    <td>${implementationDateDisplay}</td>
                    <td>${client.name || 'N/A'}</td>
                    <td>${client.ruc || 'N/A'}</td>
                    <td>${servicesHTML}</td>
                    <td>${client.creadoPor || 'Desconocido'}</td>
                    <td>${client.clientStatus || 'N/A'}</td>
                    <td class="${textColorClass}">${remainingMonthsText}</td>
                    ${actionsCell}
                `;
            } else {
                tr.innerHTML = `
                    <td>${creationDate}</td>
                    <td>${client.name || 'N/A'}</td>
                    <td>${client.ruc || 'N/A'}</td>
                    <td>${servicesHTML}</td>
                    <td>${client.creadoPor || 'Desconocido'}</td>
                    ${actionsCell}
                `;
            }
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.action-icon').forEach(icon => {
            icon.addEventListener('click', (event) => {
                const target = event.currentTarget;
                const docPath = target.dataset.path;
                let mode;
                if (target.classList.contains('view-btn')) mode = 'view';
                if (target.classList.contains('edit-details-btn')) mode = 'edit';
                if (target.classList.contains('edit-services-btn')) mode = 'edit-services';
                handleClientAction(docPath, mode);
            });
        });
    }

    function updatePaginationButtons(status, fetchedCount) {
        const prefix = status === CLIENT_STATUS.PENDING ? 'pending' : 'won';
        const prevBtn = document.getElementById(`${prefix}-prev`);
        const nextBtn = document.getElementById(`${prefix}-next`);
        
        const currentPageIndex = paginationState[status].pageHistory.length - 1;
        prevBtn.disabled = currentPageIndex < 2;
        nextBtn.disabled = fetchedCount < PAGE_SIZE;
    }

    function updateIndicatorsAndChart(clients) {
        const userRanking = {};
        let vaCount = 0;
        let vatCount = 0;
        const serviceCounts = { pending: {}, won: {} };
        const allServiceNames = new Set();

        clients.forEach(client => {
            const userEmail = client.creadoPor || 'Desconocido';
            userRanking[userEmail] = (userRanking[userEmail] || 0) + 1;

            if (client.offerings && Array.isArray(client.offerings)) {
                client.offerings.forEach(offer => {
                    allServiceNames.add(offer.name);
                    const statusKey = client.clientStatus === CLIENT_STATUS.PENDING ? 'pending' : 'won';
                    serviceCounts[statusKey][offer.name] = (serviceCounts[statusKey][offer.name] || 0) + 1;
                });
            }
        });

        const sortedUsers = Object.entries(userRanking).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const rankingList = document.getElementById('user-ranking-list');
        rankingList.innerHTML = sortedUsers.map(([email, count]) => `
            <li><span class="user-info">${email.split('@')[0]}</span><strong class="user-rank">${count}</strong></li>
        `).join('') || '<li>No hay datos.</li>';

        document.getElementById('va-count').textContent = vaCount;
        document.getElementById('vat-count').textContent = vatCount;

        const chartLabels = Array.from(allServiceNames);
        const pendingData = chartLabels.map(name => serviceCounts.pending[name] || 0);
        const wonData = chartLabels.map(name => serviceCounts.won[name] || 0);
        renderServicesChart(chartLabels, pendingData, wonData);
    }
    
    function renderServicesChart(labels, pendingData, wonData) {
        const ctx = document.getElementById('services-chart').getContext('2d');
        if (servicesChart) servicesChart.destroy();
        
        Chart.register(ChartDataLabels);

        servicesChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Solicitudes Pendientes', data: pendingData, backgroundColor: 'rgba(255, 167, 38, 0.7)' },
                { label: 'Clientes Ganados', data: wonData, backgroundColor: 'rgba(102, 187, 106, 0.7)' }
            ]},
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { datalabels: {
                    color: '#ffffff', anchor: 'end', align: 'start', offset: -20,
                    font: { weight: 'bold' }, formatter: (value) => value > 0 ? value : ''
                }},
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
            }
        });
    }

    // --- LÓGICA DEL MODAL Y ACCIONES ---
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
                populateModalBody(client, mode);
                populateModalFooter(docPath, mode);
            } catch (error) {
                console.error("Error al cargar datos del cliente:", error);
                modalBody.innerHTML = '<p style="color: red;">No se pudieron cargar los datos.</p>';
            }
        } else if (mode === 'edit-services') {
            await openServicesEditor(docPath);
        }
    }

    function populateModalBody(client, mode) {
        const servicesText = (client.offerings || []).map(o => `<li>${o.name}</li>`).join('');
        const isEditMode = mode === 'edit';
        const fields = [
            { id: 'clientName', label: 'Nombre del Cliente', value: client.name, type: 'text', editable: true },
            { id: 'clientRuc', label: 'RUC', value: client.ruc, type: 'text', editable: true },
            { id: 'contractType', label: 'Tipo de Contrato', value: client.contractType, type: 'select', editable: true, options: ['NUEVO', 'RENOVACION'] },
            { id: 'zone', label: 'Zona', value: client.zone, type: 'select', editable: true, options: ['SUR', 'NORTE', 'CENTRO', 'MINAS'] },
            { id: 'createdAt', label: 'Fecha de Creación', value: client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY HH:mm') : 'N/A', editable: false },
            { id: 'creadoPor', label: 'Registrado Por', value: client.creadoPor, editable: false },
        ];
        if (client.clientStatus === CLIENT_STATUS.WON) {
            fields.push({ id: 'implementationDate', label: 'Fecha de Implementación', value: client.implementationDate, type: 'date', editable: true });
        }
        let fieldsHTML = fields.map(field => {
            const shouldRenderInput = isEditMode && field.editable;
            let inputHTML = `<span>${field.value || 'N/A'}</span>`;
            if (shouldRenderInput) {
                if (field.type === 'select') {
                    const optionsHTML = field.options.map(opt => `<option value="${opt}" ${field.value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                    inputHTML = `<select id="modal-${field.id}" class="modal-input">${optionsHTML}</select>`;
                } else {
                    inputHTML = `<input type="${field.type}" id="modal-${field.id}" value="${field.value || ''}" class="modal-input">`;
                }
            }
            return `<div class="modal-field"><label>${field.label}</label>${inputHTML}</div>`;
        }).join('');
        fieldsHTML += `
            <div class="modal-field-full">
                <label>Servicios Contratados</label>
                <ul class="modal-services-list">${servicesText || '<li>No hay servicios registrados.</li>'}</ul>
            </div>
            <p class="modal-note">Para editar la lista de servicios, use el botón de Acciones (<i class="fas fa-cogs"></i>).</p>
        `;
        modalBody.innerHTML = fieldsHTML;
    }
    
    function populateModalFooter(docPath, mode) {
        if (mode === 'view') {
            modalFooter.innerHTML = '<button class="modal-button btn-modal-secondary">Cerrar</button>';
            modalFooter.querySelector('button').addEventListener('click', () => closeModal(modalOverlay));
        } else {
            modalFooter.innerHTML = `
                <button class="modal-button btn-modal-secondary">Cancelar</button>
                <button class="modal-button btn-modal-primary">Guardar Cambios</button>
            `;
            modalFooter.querySelector('.btn-modal-secondary').addEventListener('click', () => closeModal(modalOverlay));
            modalFooter.querySelector('.btn-modal-primary').addEventListener('click', () => handleSave(docPath));
        }
    }

    async function handleSave(docPath) {
        const saveButton = modalFooter.querySelector('.btn-modal-primary');
        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';
        try {
            const originalDoc = await db.doc(docPath).get();
            if (!originalDoc.exists) throw new Error("El cliente ya no existe.");
            const originalData = originalDoc.data();
            const updatedData = {};
            const changes = {};
            const fieldsToUpdate = [
                { id: 'clientName', key: 'name' }, { id: 'clientRuc', key: 'ruc' },
                { id: 'contractType', key: 'contractType' }, { id: 'zone', key: 'zone' },
                { id: 'implementationDate', key: 'implementationDate', optional: true }
            ];
            fieldsToUpdate.forEach(field => {
                const input = document.getElementById(`modal-${field.id}`);
                if (input) {
                    const newValue = input.value;
                    const oldValue = originalData[field.key] || '';
                    if (newValue !== oldValue) {
                        updatedData[field.key] = newValue;
                        changes[field.key] = { from: oldValue, to: newValue };
                    }
                }
            });
            if (Object.keys(updatedData).length > 0) {
                const logEntry = {
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    user: auth.currentUser.email,
                    action: 'update_details',
                    changes: changes
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
            saveButton.disabled = false;
            saveButton.textContent = 'Guardar Cambios';
        }
    }

    // --- FUNCIONES PARA EL EDITOR DE SERVICIOS ---
    async function openServicesEditor(docPath) {
        editVigilanciaContainer.innerHTML = '';
        editTecnologiaContainer.innerHTML = '';
        document.getElementById('services-editor-doc-path').value = docPath;
        openModal(servicesEditorModal);
        const docSnap = await db.doc(docPath).get();
        if (docSnap.exists) {
            const offerings = docSnap.data().offerings || [];
            offerings.forEach(offer => {
                const container = offer.category === VIGILANCIA_CATEGORY ? editVigilanciaContainer : editTecnologiaContainer;
                container.appendChild(createOfferingRow(offer.category, offer));
            });
        }
    }

    function getOfferingsFromEditor() {
        const containers = [editVigilanciaContainer, editTecnologiaContainer];
        const allOfferings = [];
        containers.forEach(container => {
            container.querySelectorAll('.offering-row').forEach(row => {
                 const quantity = parseInt(row.querySelector('.offering-quantity').value) || 1;
                 const frequency = parseInt(row.querySelector('.offering-frequency').value) || 6;
                 const cost = parseFloat(row.querySelector('.offering-cost').value) || 0;
                 const provisionMode = row.querySelector('.offering-provision-mode').value;
                 let total = 0;
                 if (provisionMode === 'Por todo el contrato') {
                     total = cost * quantity;
                 } else {
                     total = (cost * quantity) * frequency;
                 }
                 allOfferings.push({ 
                     name: row.querySelector('.offering-name').value, 
                     category: row.querySelector('.offering-category').value, 
                     quantity, frequency, cost, provisionMode, total
                 });
            });
        });
        return allOfferings.filter(o => o.name);
    }
    
    async function handleSaveServices() {
        servicesEditorSaveBtn.disabled = true;
        servicesEditorSaveBtn.textContent = 'Guardando...';
        const docPath = document.getElementById('services-editor-doc-path').value;
        try {
            const originalDoc = await db.doc(docPath).get();
            if (!originalDoc.exists) throw new Error("El cliente ya no existe.");
            const newOfferings = getOfferingsFromEditor();
            const logEntry = {
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                user: auth.currentUser.email,
                action: 'update_services',
                changes: { offerings: { from: originalDoc.data().offerings, to: newOfferings } }
            };
            const batch = db.batch();
            const clientRef = db.doc(docPath);
            const logRef = clientRef.collection('logs').doc();
            batch.update(clientRef, { offerings: newOfferings });
            batch.set(logRef, logEntry);
            await batch.commit();
            alert("Servicios actualizados con éxito.");
            closeModal(servicesEditorModal);
            const activeSection = document.querySelector('.menu-option.active').dataset.section;
             if (activeSection !== 'inicio') loadTableData(CLIENT_STATUS[activeSection.toUpperCase()], 'initial');
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
        const selectOptions = optionsForCategory.map(o => `<option value="${o.name}" ${o.name === offeringData.name ? 'selected' : ''}>${o.name}</option>`).join('');
        wrapper.innerHTML = `
            <div class="offering-row-header">
                <select class="offering-name"><option value="">Seleccionar...</option>${selectOptions}</select>
                <button type="button" class="remove-offering-row-btn">&times;</button>
            </div>
            <div class="offering-row-body">
                <input type="number" placeholder="Cant." class="offering-quantity" value="${offeringData.quantity || 1}" min="1">
                <select class="offering-provision-mode">
                    <option value="Cobro mensual" ${offeringData.provisionMode === 'Cobro mensual' ? 'selected' : ''}>Cobro mensual</option>
                    <option value="Por todo el contrato" ${offeringData.provisionMode === 'Por todo el contrato' ? 'selected' : ''}>Por todo el contrato</option>
                </select>
                <select class="offering-frequency">
                    <option value="6" ${offeringData.frequency == 6 ? 'selected' : ''}>6m</option> <option value="12" ${offeringData.frequency == 12 ? 'selected' : ''}>12m</option>
                    <option value="18" ${offeringData.frequency == 18 ? 'selected' : ''}>18m</option> <option value="24" ${offeringData.frequency == 24 ? 'selected' : ''}>24m</option>
                    <option value="36" ${offeringData.frequency == 36 ? 'selected' : ''}>36m</option>
                </select>
                <input type="number" placeholder="Costo S/." class="offering-cost" value="${offeringData.cost || ''}" min="0" step="0.01">
                <input type="text" placeholder="Total" class="offering-total" value="S/ ${offeringData.total?.toFixed(2) || '0.00'}" readonly>
                <input type="hidden" class="offering-category" value="${category}">
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
        if (offeringData.name) { calculateTotal(); } // Calcula el total al cargar
        return wrapper;
    }

    // --- EVENTO DE LISTENERS ---
    modalCloseBtn.addEventListener('click', () => closeModal(modalOverlay));
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(modalOverlay); });
    servicesEditorCloseBtn.addEventListener('click', () => closeModal(servicesEditorModal));
    servicesEditorModal.addEventListener('click', (e) => { if (e.target === servicesEditorModal) closeModal(servicesEditorModal); });
    servicesEditorCancelBtn.addEventListener('click', () => closeModal(servicesEditorModal));
    servicesEditorSaveBtn.addEventListener('click', handleSaveServices);
    document.getElementById('edit-add-vigilancia-btn').addEventListener('click', () => editVigilanciaContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY)));
    document.getElementById('edit-add-tecnologia-btn').addEventListener('click', () => editTecnologiaContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY)));

    document.getElementById('pending-next').addEventListener('click', () => loadTableData(CLIENT_STATUS.PENDING, 'next'));
    document.getElementById('pending-prev').addEventListener('click', () => loadTableData(CLIENT_STATUS.PENDING, 'prev'));
    document.getElementById('won-next').addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'next'));
    document.getElementById('won-prev').addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'prev'));

    document.getElementById('pending-card').addEventListener('click', () => showSection('pendientes'));
    document.getElementById('won-card').addEventListener('click', () => showSection('ganados'));
    document.getElementById('expiring-card').addEventListener('click', () => showSection('ganados'));

    window.addEventListener('message', (event) => {
        if (event.data === 'clientUpdated' || event.data === 'clientAdded') {
            loadDashboardData();
            const activeSection = document.querySelector('.menu-option.active').dataset.section;
            if (activeSection === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
            if (activeSection === 'ganados') loadTableData(CLIENT_STATUS.WON, 'initial');
        }
    });
});