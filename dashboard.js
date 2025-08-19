document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZACIÓN Y CONSTANTES ---
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        console.error("Firebase o su configuración no están disponibles.");
        alert("Error crítico de configuración. Revisa la consola.");
        return;
    }
    firebase.initializeApp(firebaseConfig);

    const auth = firebase.auth();
    const db = firebase.firestore();
    let servicesChart = null;

    const CLIENT_STATUS = {
        PENDING: 'Ofrecido',
        WON: 'Ganado',
    };
    const PAGE_SIZE = 10;

    const paginationState = {
        [CLIENT_STATUS.PENDING]: { lastDoc: null, pageHistory: [null] },
        [CLIENT_STATUS.WON]: { lastDoc: null, pageHistory: [null] },
    };

    // --- ELEMENTOS DEL DOM ---
    const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
    const menuOptions = document.querySelectorAll('.menu-option');
    const modalOverlay = document.getElementById('client-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    const serviceTypes = {
        "Valor Agregado": ["Plan de Responsabilidad Social", "Auditoría Interna", "Reporte de Criminalidad"],
        "Valor Agregado con Tecnología": ["LiderControl", "SmartPanics", "Integración de plataformas GPS", "Pulsadores de pánico", "Configuración de analítica", "Ciberseguridad", "Reportes de KPI en Power BI", "Estudio de Seguridad con Optimizacion Tecnologica"]
    };

    // --- AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            document.getElementById('user-email').textContent = user.email;
            showSection('inicio');
        } else {
            window.location.replace('index.html');
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    // --- NAVEGACIÓN ---
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
            alert("No se pudieron cargar los datos del resumen.");
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
            const cursorDoc = direction === 'prev' ? state.pageHistory[currentPageIndex - 1] : state.lastDoc;

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
                state.lastDoc = state.pageHistory[state.pageHistory.length - 1] || null;
            } else if (direction === 'initial' && docs.length > 0) {
                state.lastDoc = docs[docs.length - 1];
                state.pageHistory.push(state.lastDoc);
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

            const actionsCell = `
                <td class="action-icons">
                    <i class="fas fa-eye action-icon view-btn" data-path="${docPath}" title="Ver Detalles"></i>
                    <i class="fas fa-pencil-alt action-icon edit-btn" data-path="${docPath}" title="Editar"></i>
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

       // --- INICIO DE LA MEJORA ---
        // Se buscan todos los iconos recién creados en la tabla y se les añade un escuchador individualmente.
        tbody.querySelectorAll('.action-icon').forEach(icon => {
            icon.addEventListener('click', (event) => {
                event.stopPropagation(); // Previene que el evento se propague más allá del icono.
                
                const target = event.currentTarget;
                const docPath = target.dataset.path; // Obtenemos la ruta del documento desde el atributo data-path
                const mode = target.classList.contains('view-btn') ? 'view' : 'edit'; // Determinamos si es 'ver' o 'editar'
                
                // Llamamos a la función que abre el modal
                handleClientAction(docPath, mode);
            });
        });
        // --- FIN DE LA MEJORA ---
    }

    function updatePaginationButtons(status, fetchedCount) {
        const prefix = status === CLIENT_STATUS.PENDING ? 'pending' : 'won';
        const prevBtn = document.getElementById(`${prefix}-prev`);
        const nextBtn = document.getElementById(`${prefix}-next`);
        
        const currentPageIndex = paginationState[status].pageHistory.length - 1;
        prevBtn.disabled = currentPageIndex <= 1;
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
                    if (serviceTypes["Valor Agregado"].includes(offer.name)) vaCount++;
                    else if (serviceTypes["Valor Agregado con Tecnología"].includes(offer.name)) vatCount++;
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
            data: {
                labels: labels,
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
                        color: '#ffffff', anchor: 'end', align: 'start', offset: -20,
                        font: { weight: 'bold' }, formatter: (value) => value > 0 ? value : ''
                    }
                },
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
            }
        });
    }

    // --- LÓGICA DEL MODAL ---
    
    function openModal() { modalOverlay.classList.add('visible'); }
    function closeModal() { modalOverlay.classList.remove('visible'); }

    async function handleClientAction(docPath, mode) {
        openModal();
        modalBody.innerHTML = '<div class="dashboard-spinner" style="margin: 2rem auto;"></div>';
        modalFooter.innerHTML = '';
        
        try {
            const docRef = db.doc(docPath);
            const docSnap = await docRef.get();
            
            if (!docSnap.exists) throw new Error("Documento no encontrado.");
            
            const client = docSnap.data();
            modalTitle.textContent = mode === 'view' ? 'Detalles del Cliente' : 'Editar Cliente';
            
            populateModalBody(client, mode);
            populateModalFooter(docPath, mode);

        } catch (error) {
            console.error("Error al cargar datos del cliente:", error);
            modalBody.innerHTML = '<p style="color: red; text-align: center;">No se pudieron cargar los datos del cliente.</p>';
        }
    }

    function populateModalBody(client, mode) {
        const servicesText = (client.offerings || []).map(o => o.name).join(', ');

        const fields = [
            { label: 'Nombre del Cliente', value: client.name, id: 'clientName', type: 'text' },
            { label: 'RUC', value: client.ruc, id: 'clientRuc', type: 'text' },
            { label: 'Fecha de Creación', value: client.createdAt ? dayjs(client.createdAt.toDate()).format('DD/MM/YYYY') : 'N/A', id: 'createdAt', type: 'text', readonly: true },
            { label: 'Registrado Por', value: client.creadoPor, id: 'creadoPor', type: 'text', readonly: true },
        ];
        if (client.clientStatus === CLIENT_STATUS.WON) {
            fields.push({ label: 'Fecha de Implementación', value: client.implementationDate, id: 'implementationDate', type: 'date' });
        }
        fields.push({ label: 'Servicios', value: servicesText, id: 'services', type: 'textarea', fullWidth: true });

        modalBody.innerHTML = fields.map(field => {
            const isReadonly = mode === 'view' || field.readonly;
            const fieldClass = field.fullWidth ? 'modal-field-full' : 'modal-field';
            
            if (isReadonly) {
                return `<div class="${fieldClass}"><label>${field.label}</label><span>${field.value || 'N/A'}</span></div>`;
            } else {
                if (field.type === 'textarea') {
                    return `<div class="${fieldClass}"><label>${field.label}</label><span>${field.value || 'N/A'}</span></div>`;
                }
                return `<div class="${fieldClass}"><label for="${field.id}">${field.label}</label><input type="${field.type}" id="${field.id}" value="${field.value || ''}"></div>`;
            }
        }).join('');
    }

    function populateModalFooter(docPath, mode) {
        if (mode === 'view') {
            modalFooter.innerHTML = '<button id="modal-generic-close" class="modal-button btn-modal-secondary">Cerrar</button>';
            document.getElementById('modal-generic-close').addEventListener('click', closeModal);
        } else {
            modalFooter.innerHTML = `
                <button id="modal-generic-cancel" class="modal-button btn-modal-secondary">Cancelar</button>
                <button id="modal-save-btn" class="modal-button btn-modal-primary">Guardar Cambios</button>
            `;
            document.getElementById('modal-generic-cancel').addEventListener('click', closeModal);
            document.getElementById('modal-save-btn').addEventListener('click', () => handleSave(docPath));
        }
    }

    async function handleSave(docPath) {
        const updatedData = {};
        const clientNameInput = document.getElementById('clientName');
        const clientRucInput = document.getElementById('clientRuc');
        const implementationDateInput = document.getElementById('implementationDate');

        if (clientNameInput) updatedData.name = clientNameInput.value;
        if (clientRucInput) updatedData.ruc = clientRucInput.value;
        if (implementationDateInput) updatedData.implementationDate = implementationDateInput.value;
        
        try {
            loadingOverlay.style.display = 'flex';
            await db.doc(docPath).update(updatedData);
            closeModal();
            
            const activeSection = document.querySelector('.menu-option.active').dataset.section;
            if (activeSection === 'pendientes') loadTableData(CLIENT_STATUS.PENDING, 'initial');
            if (activeSection === 'ganados') loadTableData(CLIENT_STATUS.WON, 'initial');
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("No se pudieron guardar los cambios.");
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    // --- EVENT LISTENERS (ESCUCHADORES DE EVENTOS) ---
    // Se eliminan los escuchadores de las tablas, ya que ahora se añaden directamente a los iconos en renderTable
    
    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    document.getElementById('pending-next').addEventListener('click', () => loadTableData(CLIENT_STATUS.PENDING, 'next'));
    document.getElementById('pending-prev').addEventListener('click', () => loadTableData(CLIENT_STATUS.PENDING, 'prev'));
    document.getElementById('won-next').addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'next'));
    document.getElementById('won-prev').addEventListener('click', () => loadTableData(CLIENT_STATUS.WON, 'prev'));

    const pendingCard = document.getElementById('pending-card');
    const wonCard = document.getElementById('won-card');
    const expiringCard = document.getElementById('expiring-card');

    if (pendingCard) { pendingCard.addEventListener('click', () => showSection('pendientes')); }
    if (wonCard) { wonCard.addEventListener('click', () => showSection('ganados')); }
    if (expiringCard) { expiringCard.addEventListener('click', () => showSection('ganados')); }
});