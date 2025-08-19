document.addEventListener("DOMContentLoaded", () => {
    // PWA Service Worker Registration
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/service-worker.js")
                .then((reg) => console.log("Service Worker: Registrado"))
                .catch((err) => console.log(`Service Worker: Error: ${err}`));
        });
    }

    // Firebase Initialization
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        alert("Error crítico: La configuración de Firebase no está disponible.");
        return;
    }
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- GLOBAL APP STATE ---
    let currentUserId = null;
    let clientsListener = null;

    const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
    const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';
    
    const availableOfferings = [
        { name: 'Plan de Responsabilidad Social', category: VIGILANCIA_CATEGORY },
        { name: 'Estudio de seguridad con optimización de tecnología', category: VIGILANCIA_CATEGORY },
        { name: 'Reportes con Power BI', category: VIGILANCIA_CATEGORY },
        { name: 'Software de control de Riegos (Total Risik)', category: VIGILANCIA_CATEGORY },
        { name: 'Asistente Administrativo', category: VIGILANCIA_CATEGORY },
        { name: 'Supervisión área con dron', category: VIGILANCIA_CATEGORY },
        { name: 'Administrador de contrato', category: VIGILANCIA_CATEGORY },
        { name: 'Celebración de festividades', category: VIGILANCIA_CATEGORY },
        { name: 'Equipos de computo', category: VIGILANCIA_CATEGORY },
        { name: 'Detector de metales', category: VIGILANCIA_CATEGORY },
        { name: 'Linternas', category: VIGILANCIA_CATEGORY },
        { name: 'Radios', category: VIGILANCIA_CATEGORY },
        { name: 'Capacitación en hostigamiento sexual y manejo de crisis', category: VIGILANCIA_CATEGORY },
        { name: 'Capacitación de STT', category: VIGILANCIA_CATEGORY },
        { name: 'Capacitación de Sistema detección contra incendio', category: VIGILANCIA_CATEGORY },
        { name: 'Poligrafía', category: VIGILANCIA_CATEGORY },
        { name: 'Baño químico', category: VIGILANCIA_CATEGORY },
        { name: 'Sombrilla mas módulos', category: VIGILANCIA_CATEGORY },
        { name: 'Equipo Dron', category: VIGILANCIA_CATEGORY },
        { name: 'Análisis de riegos', category: VIGILANCIA_CATEGORY },
        { name: 'Estudio de rutas de patrullaje', category: VIGILANCIA_CATEGORY },
        { name: 'Información de inteligencia', category: VIGILANCIA_CATEGORY },
        { name: 'Software Geo crimen', category: VIGILANCIA_CATEGORY },
        { name: 'Cliente incognito', category: VIGILANCIA_CATEGORY },
        { name: 'Auditoría Interna', category: VIGILANCIA_CATEGORY },
        { name: 'Reporte de Criminalidad', category: VIGILANCIA_CATEGORY },
        { name: 'LiderControl', category: TECNOLOGIA_CATEGORY },
        { name: 'SmartPanics', category: TECNOLOGIA_CATEGORY },
        { name: 'Integración de plataformas GPS', category: TECNOLOGIA_CATEGORY },
        { name: 'Pulsadores de pánico', category: TECNOLOGIA_CATEGORY },
        { name: 'Configuración de analítica', category: TECNOLOGIA_CATEGORY },
        { name: 'Ciberseguridad', category: TECNOLOGIA_CATEGORY }
    ];
    
    // =================================================================================
    // --- MODULE: UI (Manejo de la Interfaz de Usuario) ---
    // =================================================================================
    const UI = (() => {
    const elements = {
        authView: document.getElementById("auth-view"),
        loginContainer: document.getElementById("login-container"),
        registerContainer: document.getElementById("register-container"),
        loginForm: document.getElementById("login-form"),
        registerForm: document.getElementById("register-form"),
        goToRegisterBtn: document.getElementById("go-to-register"),
        goToLoginBtn: document.getElementById("go-to-login"),
        appView: document.getElementById("app-view"),
        userInfo: document.getElementById("user-info"),
        logoutButton: document.getElementById("logout-button"),
        viewContainer: document.getElementById("view-container"),
        homeView: document.getElementById("home-view"),
        listView: document.getElementById("list-view"),
        addClientForm: document.getElementById("add-client-form"),
        clientNameInput: document.getElementById("client-name-input"),
        clientRucInput: document.getElementById("client-ruc-input"),
        vigilanciaOfferingsContainer: document.getElementById("vigilancia-offerings-container"),
        tecnologiaOfferingsContainer: document.getElementById("tecnologia-offerings-container"),
        addVigilanciaRowBtn: document.getElementById("add-vigilancia-row-btn"),
        addTecnologiaRowBtn: document.getElementById("add-tecnologia-row-btn"),
        goToPendingBtn: document.getElementById("go-to-pending-btn"),
        goToWonBtn: document.getElementById("go-to-won-btn"),
        listTitle: document.getElementById("list-title"),
        backToHomeBtn: document.getElementById("back-to-home-btn"),
        clientsContainer: document.getElementById("clients-container"),
        noClientsMessage: document.getElementById("no-clients-message"),
        loadingOverlay: document.getElementById("loading-overlay"),
        successModal: document.getElementById("success-modal"),
        successMessage: document.getElementById("success-message"),
        successOkBtn: document.getElementById("success-ok-btn"),
        confirmationModal: document.getElementById("confirmation-modal"),
        modalTitle: document.getElementById("modal-title"),
        modalMessage: document.getElementById("modal-message"),
        modalConfirmBtn: document.getElementById("modal-confirm-btn"),
        modalCancelBtn: document.getElementById("modal-cancel-btn"),
        datePickerModal: document.getElementById("date-picker-modal"),
        dateModalTitle: document.getElementById("date-modal-title"),
        dateModalMessage: document.getElementById("date-modal-message"),
        implementationDateInput: document.getElementById("implementation-date-input"),
        dateModalConfirmBtn: document.getElementById("date-modal-confirm-btn"),
        dateModalCancelBtn: document.getElementById("date-modal-cancel-btn"),
        editClientModal: document.getElementById("edit-client-modal"),
        editClientForm: document.getElementById("edit-client-form"),
        editClientId: document.getElementById("edit-client-id"),
        editClientNameInput: document.getElementById("edit-client-name-input"),
        editClientRucInput: document.getElementById("edit-client-ruc-input"),
        editVigilanciaOfferingsContainer: document.getElementById("edit-vigilancia-offerings-container"),
        editTecnologiaOfferingsContainer: document.getElementById("edit-tecnologia-offerings-container"),
        editAddVigilanciaRowBtn: document.getElementById("edit-add-vigilancia-row-btn"),
        editAddTecnologiaRowBtn: document.getElementById("edit-add-tecnologia-row-btn"),
        closeEditModalBtn: document.getElementById("close-edit-modal-btn"),
        cancelEditBtn: document.getElementById("cancel-edit-btn"),
    };

    let resolveConfirmation, resolveDateConfirmation;

    const showLoading = (show) => elements.loadingOverlay.classList.toggle("hidden", !show);
    const showSuccessModal = (message) => {
        elements.successMessage.textContent = message;
        elements.successModal.classList.remove("hidden");
    };
    const showConfirmationModal = (title, message) => {
        elements.modalTitle.textContent = title;
        elements.modalMessage.textContent = message;
        elements.confirmationModal.classList.remove("hidden");
        return new Promise((resolve) => { resolveConfirmation = resolve; });
    };
    const showDatePickerModal = (title, message) => {
        elements.dateModalTitle.textContent = title;
        elements.dateModalMessage.textContent = message;
        elements.implementationDateInput.value = new Date().toISOString().split('T')[0];
        elements.datePickerModal.classList.remove("hidden");
        return new Promise((resolve) => { resolveDateConfirmation = resolve; });
    };

    const toggleButtonLoading = (button, isLoading) => {
        if (!button) return;
        button.disabled = isLoading;
        button.classList.toggle('btn-loading', isLoading);
    };

    elements.successOkBtn.addEventListener("click", () => elements.successModal.classList.add("hidden"));
    elements.modalConfirmBtn.addEventListener("click", () => {
        elements.confirmationModal.classList.add("hidden");
        if (resolveConfirmation) resolveConfirmation(true);
    });
    elements.modalCancelBtn.addEventListener("click", () => {
        elements.confirmationModal.classList.add("hidden");
        if (resolveConfirmation) resolveConfirmation(false);
    });
    elements.dateModalConfirmBtn.addEventListener("click", () => {
        const selectedDate = elements.implementationDateInput.value;
        if (!selectedDate) { alert('Por favor, selecciona una fecha.'); return; }
        elements.datePickerModal.classList.add("hidden");
        if (resolveDateConfirmation) resolveDateConfirmation(selectedDate);
    });
    elements.dateModalCancelBtn.addEventListener("click", () => {
        elements.datePickerModal.classList.add("hidden");
        if (resolveDateConfirmation) resolveDateConfirmation(null);
    });

    const getAuthErrorMessage = (errorCode) => {
        switch (errorCode) {
            case 'auth/wrong-password': return 'La contraseña es incorrecta.';
            case 'auth/user-not-found': return 'No se encontró ningún usuario con este correo.';
            case 'auth/invalid-email': return 'El formato del correo no es válido.';
            case 'auth/email-already-in-use': return 'Este correo ya está registrado.';
            case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
            default: return 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.';
        }
    };

    const createOfferingRow = (category, offeringData = {}) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'offering-row p-3 bg-slate-800/50 rounded-lg space-y-3';
        
        const optionsForCategory = availableOfferings.filter(o => o.category === category);
        
        const selectOptions = optionsForCategory.map(o => 
            `<option value="${o.name}" ${o.name === offeringData.name ? 'selected' : ''}>${o.name}</option>`
        ).join('');

        // --- INICIO CAMBIO: HTML con nuevo desplegable de Modalidad ---
        wrapper.innerHTML = `
            <div class="flex justify-between items-center gap-3">
                <select class="form-select-sm offering-name flex-grow"><option value="">Seleccionar...</option>${selectOptions}</select>
                <button type="button" class="remove-offering-row-btn flex-shrink-0"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                <input type="number" placeholder="Cantidad" class="form-input-sm offering-quantity" min="1" step="1" value="${offeringData.quantity || 1}">
                <select class="form-select-sm offering-modality">
                    <option value="Cobro mensual" ${offeringData.modality === 'Cobro mensual' ? 'selected' : ''}>Cobro mensual</option>
                    <option value="Por todo el contrato" ${offeringData.modality === 'Por todo el contrato' ? 'selected' : ''}>Por todo el contrato</option>
                </select>
                <select class="form-select-sm offering-frequency">
                    <option value="6" ${offeringData.frequency == 6 ? 'selected' : ''}>6 meses</option>
                    <option value="12" ${offeringData.frequency == 12 ? 'selected' : ''}>12 meses</option>
                    <option value="18" ${offeringData.frequency == 18 ? 'selected' : ''}>18 meses</option>
                    <option value="24" ${offeringData.frequency == 24 ? 'selected' : ''}>24 meses</option>
                    <option value="36" ${offeringData.frequency == 36 ? 'selected' : ''}>36 meses</option>
                </select>
                <input type="number" placeholder="Provision Mensual S/." class="form-input-sm offering-cost" min="0" step="0.01" value="${offeringData.cost || ''}">
                <input type="text" placeholder="Total" class="form-input-sm bg-slate-700/80 offering-total" readonly value="S/ ${offeringData.total?.toFixed(2) || '0.00'}">
            </div>
            <input type="hidden" class="offering-category" value="${category}">
        `;
        // --- FIN CAMBIO ---
        
        const calculateTotal = (container) => {
            const quantity = parseFloat(container.querySelector('.offering-quantity').value) || 0;
            const cost = parseFloat(container.querySelector('.offering-cost').value) || 0;
            // --- INICIO CAMBIO: Lógica de cálculo según modalidad ---
            const modality = container.querySelector('.offering-modality').value;
            let total = 0;
            if (modality === 'Por todo el contrato') {
                total = cost * quantity; // Ignora la frecuencia en el cálculo
            } else { // "Cobro mensual"
                const frequency = parseFloat(container.querySelector('.offering-frequency').value) || 0;
                total = (cost * quantity) * frequency;
            }
            container.querySelector('.offering-total').value = `S/ ${total.toFixed(2)}`;
            // --- FIN CAMBIO ---
        };

        wrapper.addEventListener('input', e => {
            // Se añade 'offering-modality' a los disparadores del recálculo
            if (e.target.matches('.offering-quantity, .offering-frequency, .offering-cost, .offering-modality')) {
                calculateTotal(wrapper);
            }
        });
        wrapper.querySelector('.remove-offering-row-btn').addEventListener('click', () => wrapper.remove());
        
        return wrapper;
    };

    return { elements, showLoading, showSuccessModal, showConfirmationModal, showDatePickerModal, getAuthErrorMessage, createOfferingRow, toggleButtonLoading };
})();

    // =================================================================================
    // --- MODULE: FIRESTORE (Interacciones con la Base de Datos) ---
    // =================================================================================
    const FirestoreService = (() => {
        // --- INICIO CAMBIO: Función para obtener perfil de usuario ---
        const getUserProfile = async (username) => {
            if (!username) return null;
            try {
                // Asume que el ID del documento es el nombre de usuario en minúsculas
                const userDoc = await db.collection("usuarios").doc(username.toLowerCase()).get();
                if (userDoc.exists) {
                    return userDoc.data();
                } else {
                    // Fallback por si el ID no coincide, busca en un campo (menos eficiente)
                    const snapshot = await db.collection("usuarios").where("usuario", "==", username).limit(1).get();
                    if (!snapshot.empty) {
                        return snapshot.docs[0].data();
                    }
                }
                return null;
            } catch (error) {
                console.error("Error al obtener el perfil del usuario:", error);
                return null;
            }
        };
        // --- FIN CAMBIO ---

        const getClients = (userId, statusFilter, callback) => {
            const query = db.collection("users").doc(userId).collection("clients").where("clientStatus", "==", statusFilter).orderBy("createdAt", "desc");
            return query.onSnapshot(callback, error => {
                console.error("Error al cargar clientes:", error);
                const noClientsText = UI.elements.noClientsMessage.querySelector('p');
                noClientsText.textContent = "Error al cargar datos. Verifica tu conexión y los permisos de Firestore.";
                UI.elements.noClientsMessage.classList.remove("hidden");
            });
        };
        const addClient = (userId, clientData) => db.collection("users").doc(userId).collection("clients").add(clientData);
        const getClient = (userId, clientId) => db.collection("users").doc(userId).collection("clients").doc(clientId).get();
        const updateClient = (userId, clientId, clientData) => db.collection("users").doc(userId).collection("clients").doc(clientId).update(clientData);
        const deleteClient = (userId, clientId) => db.collection("users").doc(userId).collection("clients").doc(clientId).delete();
        const markClientAsWon = (userId, clientId, implementationDate) => {
            const clientRef = db.collection("users").doc(userId).collection("clients").doc(clientId);
            return clientRef.update({ clientStatus: "Ganado", implementationDate: implementationDate });
        };
        return { getClients, addClient, getClient, updateClient, deleteClient, markClientAsWon, getUserProfile };
    })();

    // =================================================================================
    // --- MODULE: AUTH (Manejo de Autenticación) ---
    // =================================================================================
    const AuthService = (() => {
        const { elements, showConfirmationModal, getAuthErrorMessage, toggleButtonLoading } = UI;
        const handleLogin = (e) => {
            e.preventDefault();
            const button = e.submitter;
            toggleButtonLoading(button, true);
            const email = elements.loginForm['login-email'].value;
            const password = elements.loginForm['login-password'].value;
            auth.signInWithEmailAndPassword(email, password)
                .catch(error => showConfirmationModal("Error de Inicio de Sesión", getAuthErrorMessage(error.code)))
                .finally(() => toggleButtonLoading(button, false));
        };
        const handleRegister = (e) => {
            e.preventDefault();
            const button = e.submitter;
            const email = elements.registerForm['register-email'].value;
            const password = elements.registerForm['register-password'].value;
            if (!email.endsWith('@liderman.com.pe')) {
                showConfirmationModal("Registro No Permitido", "Solo se permite el registro con un correo corporativo (@liderman.com.pe).");
                return;
            }
            toggleButtonLoading(button, true);
            auth.createUserWithEmailAndPassword(email, password)
                .then(() => {
                    UI.showSuccessModal("¡Usuario registrado con éxito! Ahora puedes iniciar sesión.");
                    elements.registerForm.reset();
                    elements.goToLoginBtn.click();
                })
                .catch(error => showConfirmationModal("Error de Registro", getAuthErrorMessage(error.code)))
                .finally(() => toggleButtonLoading(button, false));
        };
        
        // --- INICIO CAMBIO: Lógica para mostrar nombre de usuario ---
        const handleAuthStateChange = async (user) => {
            if (user) {
                currentUserId = user.uid;
                elements.authView.classList.add("hidden");
                elements.appView.classList.remove("hidden");
                
                // Por defecto, muestra el email
                elements.userInfo.textContent = user.email;
                
                // Intenta obtener y mostrar el nombre completo
                const username = user.email.split('@')[0];
                const userProfile = await FirestoreService.getUserProfile(username);
                if (userProfile && userProfile.NOMBRE) {
                    elements.userInfo.textContent = userProfile.NOMBRE;
                }

                App.showView('home');
                App.initializeForms();
            } else {
                currentUserId = null;
                elements.authView.classList.remove("hidden");
                elements.appView.classList.add("hidden");
                if (clientsListener) clientsListener();
            }
        };
        // --- FIN CAMBIO ---

        const init = () => {
            elements.goToRegisterBtn.addEventListener('click', () => {
                elements.loginContainer.classList.add('hidden');
                elements.registerContainer.classList.remove('hidden');
            });
            elements.goToLoginBtn.addEventListener('click', () => {
                elements.registerContainer.classList.add('hidden');
                elements.loginContainer.classList.remove('hidden');
            });
            elements.loginForm.addEventListener('submit', handleLogin);
            elements.registerForm.addEventListener('submit', handleRegister);
            elements.logoutButton.addEventListener("click", () => auth.signOut());
            auth.onAuthStateChanged(handleAuthStateChange);
        };
        return { init };
    })();

    // =================================================================================
    // --- MAIN APP LOGIC ---
    // =================================================================================
    const App = (() => {
        const { elements, showLoading, showSuccessModal, showConfirmationModal, showDatePickerModal, createOfferingRow, toggleButtonLoading } = UI;
        let currentListType = "pending";

        const showView = (viewName) => {
            const currentView = elements.viewContainer.querySelector('.app-view-item:not(.hidden)');
            const nextView = elements[viewName + 'View'];
            if (currentView === nextView) return;
            if (currentView) {
                currentView.classList.add('view-is-exiting');
                currentView.addEventListener('animationend', () => {
                    currentView.classList.add('hidden');
                    currentView.classList.remove('view-is-exiting');
                }, { once: true });
            }
            setTimeout(() => {
                nextView.classList.remove('hidden');
                nextView.classList.add('view-is-entering');
                nextView.addEventListener('animationend', () => {
                    nextView.classList.remove('view-is-entering');
                }, { once: true });
            }, currentView ? 200 : 0);
        };

        const getOfferingsFromForm = (container) => {
            return Array.from(container.querySelectorAll('.offering-row')).map(row => {
                const quantity = parseInt(row.querySelector('.offering-quantity').value) || 0;
                const frequency = parseInt(row.querySelector('.offering-frequency').value) || 0;
                const cost = parseFloat(row.querySelector('.offering-cost').value) || 0;
                // --- INICIO CAMBIO: Se añade 'modality' al objeto guardado ---
                const modality = row.querySelector('.offering-modality').value;
                let total = 0;
                if (modality === 'Por todo el contrato') {
                    total = cost * quantity;
                } else {
                    total = (cost * quantity) * frequency;
                }
                return { name: row.querySelector('.offering-name').value, category: row.querySelector('.offering-category').value, status: 'Ofrecido', progress: 0, quantity, frequency, cost, modality, total };
                // --- FIN CAMBIO ---
            }).filter(offer => offer.name);
        };

        const animateCardRemoval = (card) => {
            if (!card) return;
            card.classList.add('card-is-leaving');
            card.addEventListener('animationend', () => card.remove(), { once: true });
        };

        const handleAddClient = async (e) => {
            e.preventDefault();
            const button = e.submitter;
            const clientName = elements.clientNameInput.value.trim();
            const clientRuc = elements.clientRucInput.value.trim();
            if (!clientName || !clientRuc) {
                showConfirmationModal("Datos Incompletos", "Por favor, complete el nombre y RUC del cliente.");
                return;
            }
            toggleButtonLoading(button, true);
            const allOfferings = [...getOfferingsFromForm(elements.vigilanciaOfferingsContainer), ...getOfferingsFromForm(elements.tecnologiaOfferingsContainer)];
            try {
                await FirestoreService.addClient(currentUserId, { name: clientName, ruc: clientRuc, clientStatus: "Ofrecido", offerings: allOfferings, createdAt: firebase.firestore.FieldValue.serverTimestamp(), creadoPor: auth.currentUser.email });
                elements.addClientForm.reset();
                initializeForms();
                showSuccessModal("Cliente agregado a Solicitudes Pendientes.");
            } catch (error) {
                console.error("Error al añadir cliente:", error);
                showConfirmationModal("Error", "No se pudo agregar el cliente.");
            } finally {
                toggleButtonLoading(button, false);
            }
        };

        const handleClientCardActions = (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const card = e.target.closest('.client-card');
            if (!card) return;
            const clientId = card.dataset.clientId;

            if (button.classList.contains('delete-client-btn')) {
                const clientName = card.querySelector('h3').textContent;
                handleDeleteClient(clientId, clientName, card);
            } else if (button.classList.contains('mark-as-won-btn')) {
                handleMarkAsWon(clientId, card, button);
            } else if (button.classList.contains('edit-client-btn')) {
                handleOpenEditModal(clientId);
            }
        };

        const handleDeleteClient = async (clientId, clientName, card) => {
            const confirmed = await showConfirmationModal("Eliminar Cliente", `¿Seguro que quieres eliminar a "${clientName}"? Esta acción es irreversible.`);
            if (confirmed) {
                showLoading(true);
                try {
                    await FirestoreService.deleteClient(currentUserId, clientId);
                    animateCardRemoval(card);
                    setTimeout(() => showSuccessModal(`Cliente "${clientName}" eliminado.`), 500);
                } catch (error) {
                    console.error("Error al eliminar:", error);
                    showConfirmationModal("Error", "No se pudo eliminar el cliente.");
                } finally {
                    showLoading(false);
                }
            }
        };

        const handleMarkAsWon = async (clientId, card, button) => {
            const selectedDate = await showDatePickerModal("Confirmar Cliente Ganado", "Selecciona la fecha de implementación.");
            if (selectedDate) {
                toggleButtonLoading(button, true);
                try {
                    await FirestoreService.markClientAsWon(currentUserId, clientId, selectedDate);
                    animateCardRemoval(card);
                    setTimeout(() => showSuccessModal("¡Cliente marcado como Ganado!"), 500);
                } catch (error) {
                    console.error("Error al marcar como ganado:", error);
                    showConfirmationModal("Error", "No se pudo actualizar el estado.");
                } finally {
                    toggleButtonLoading(button, false);
                }
            }
        };

        const handleOpenEditModal = async (clientId) => {
            showLoading(true);
            try {
                const doc = await FirestoreService.getClient(currentUserId, clientId);
                if (!doc.exists) throw new Error("Client not found");
                const clientData = doc.data();
                elements.editClientId.value = clientId;
                elements.editClientNameInput.value = clientData.name;
                elements.editClientRucInput.value = clientData.ruc;
                
                // Resetear estado del modal antes de poblarlo
                const formElements = elements.editClientForm.elements;
                for (const element of formElements) { element.disabled = false; }
                elements.editAddVigilanciaRowBtn.style.display = 'flex';
                elements.editAddTecnologiaRowBtn.style.display = 'flex';
                elements.editClientForm.querySelector('button[type="submit"]').style.display = 'inline-flex';


                initializeForms();
                if(clientData.offerings?.length > 0) {
                    clientData.offerings.forEach(offer => {
                        const container = offer.category === VIGILANCIA_CATEGORY ? elements.editVigilanciaOfferingsContainer : elements.editTecnologiaOfferingsContainer;
                        container.appendChild(createOfferingRow(offer.category, offer));
                    });
                }
                
                // --- INICIO CAMBIO: Lógica de solo lectura para clientes ganados ---
                if (clientData.clientStatus === 'Ganado') {
                    elements.editClientForm.querySelector('h2').textContent = 'Detalles del Cliente Ganado';
                    // Deshabilitar todos los inputs, selects y textareas
                    const inputs = elements.editClientForm.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => input.disabled = true);
                    
                    // Ocultar botones de añadir y guardar
                    elements.editAddVigilanciaRowBtn.style.display = 'none';
                    elements.editAddTecnologiaRowBtn.style.display = 'none';
                    elements.editClientForm.querySelector('button[type="submit"]').style.display = 'none';
                    
                    // Habilitar los botones de eliminar fila para que no se vean deshabilitados pero sin funcionalidad real
                    const removeButtons = elements.editClientForm.querySelectorAll('.remove-offering-row-btn');
                    removeButtons.forEach(btn => btn.disabled = true);
                } else {
                     elements.editClientForm.querySelector('h2').textContent = 'Editar Cliente';
                }
                // --- FIN CAMBIO ---

                elements.editClientModal.classList.remove('hidden');
            } catch (error) {
                console.error("Error opening edit modal:", error);
                showConfirmationModal("Error", "No se pudieron cargar los datos del cliente.");
            } finally {
                showLoading(false);
            }
        };
        
        const handleUpdateClient = async (e) => {
            e.preventDefault();
            const button = e.submitter;
            toggleButtonLoading(button, true);
            const clientId = elements.editClientId.value;
            const updatedData = {
                name: elements.editClientNameInput.value.trim(),
                ruc: elements.editClientRucInput.value.trim(),
                offerings: [...getOfferingsFromForm(elements.editVigilanciaOfferingsContainer), ...getOfferingsFromForm(elements.editTecnologiaOfferingsContainer)]
            };
            if(!updatedData.name || !updatedData.ruc){
                showConfirmationModal("Datos Incompletos", "El nombre y RUC no pueden estar vacíos.");
                toggleButtonLoading(button, false);
                return;
            }
            try {
                await FirestoreService.updateClient(currentUserId, clientId, updatedData);
                closeEditModal();
                showSuccessModal("Cliente actualizado correctamente.");
            } catch (error) {
                console.error("Error al actualizar cliente:", error);
                showConfirmationModal("Error", "No se pudo guardar los cambios.");
            } finally {
                toggleButtonLoading(button, false);
            }
        };

        const closeEditModal = () => {
            elements.editClientModal.classList.add('hidden');
            elements.editClientForm.reset();
        };

        const navigateToList = (type) => {
            currentListType = type;
            elements.listTitle.textContent = type === "pending" ? "Solicitudes Pendientes" : "Clientes Ganados";
            showView('list');
            loadClients();
        };

        const navigateToHome = () => {
            if (clientsListener) {
                clientsListener();
                clientsListener = null;
            }
            showView('home');
        };

        const loadClients = () => {
            if (!currentUserId) return;
            if (clientsListener) clientsListener();
            const statusFilter = currentListType === "pending" ? "Ofrecido" : "Ganado";
            clientsListener = FirestoreService.getClients(currentUserId, statusFilter, (snapshot) => {
                elements.clientsContainer.innerHTML = "";
                const noClientsText = elements.noClientsMessage.querySelector('p');
                elements.noClientsMessage.classList.toggle('hidden', !snapshot.empty);
                if (snapshot.empty) {
                    noClientsText.textContent = currentListType === 'pending' ? 'No hay solicitudes pendientes.' : 'Aún no hay clientes ganados.';
                }
                snapshot.forEach((doc, index) => {
                    const client = { id: doc.id, ...doc.data() };
                    const clientCard = createClientCard(client);
                    clientCard.style.animationDelay = `${index * 100}ms`;
                    elements.clientsContainer.appendChild(clientCard);
                });
            });
        };

        const createClientCard = (client) => {
            const card = document.createElement("div");
            card.className = "glass-card p-4 sm:p-6 flex flex-col gap-4 card-enter-animation client-card";
            card.dataset.clientId = client.id;
            const isPending = client.clientStatus === 'Ofrecido';
            
            // --- INICIO CAMBIO: Texto del botón condicional ---
            const actionButtonsHTML = isPending 
                ? `<div class="flex flex-col sm:flex-row gap-2 mt-4"><button class="btn-primary mark-as-won-btn flex-1"><span class="btn-text">Marcar como Ganado</span></button><button class="btn-secondary edit-client-btn flex-1">Editar</button></div>` 
                : `<div class="flex gap-2 mt-4"><button class="btn-secondary edit-client-btn w-full">Ver Detalles</button></div>`;
            // --- FIN CAMBIO ---

            const offeringsByCat = (client.offerings || []).reduce((acc, offer) => {
                (acc[offer.category] = acc[offer.category] || []).push(offer);
                return acc;
            }, {});
            const offeringsHTML = Object.keys(offeringsByCat).length > 0 ? Object.entries(offeringsByCat).map(([category, offers]) => `<div class="mt-2"><h5 class="text-sm font-semibold text-slate-300 mb-2">${category}</h5><div class="space-y-2">${offers.map(createOfferingDisplayItem).join('')}</div></div>`).join('') : '<p class="text-xs text-slate-500">Sin ofrecimientos registrados.</p>';
            const implementationDateHTML = !isPending && client.implementationDate ? `<p class="text-xs text-cyan-300 mt-1"><i class="fas fa-calendar-check mr-1"></i>Implementación: <strong>${new Date(client.implementationDate + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></p>` : '';
            card.innerHTML = `<div class="flex justify-between items-start"><div class="flex-grow pr-4"><h3 class="text-lg font-bold text-white break-words">${client.name}</h3><p class="text-sm text-slate-400">RUC: ${client.ruc || "N/A"}</p>${implementationDateHTML}</div><button class="delete-client-btn text-slate-400 hover:text-red-500 transition"><i class="fas fa-trash-alt"></i></button></div><div class="border-t border-slate-700 pt-3"><h4 class="font-semibold mb-1 text-white">Ofrecimientos</h4>${offeringsHTML}</div>${actionButtonsHTML}`;
            return card;
        };

        const createOfferingDisplayItem = (offering) => {
            // --- INICIO CAMBIO: Se añade la modalidad a la tarjeta de visualización ---
            const modalityText = offering.modality ? `<span>Modalidad: <strong>${offering.modality}</strong></span>` : '';
            return `<div class="offering-display-item"><div class="flex justify-between items-center mb-2"><p class="font-bold break-words">${offering.name}</p><span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-300 text-slate-800">${offering.status}</span></div><div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"><span>Cantidad: <strong>${offering.quantity} und.</strong></span><span>Frecuencia: <strong>${offering.frequency} meses</strong></span>${modalityText}<span>Costo Unitario: <strong>S/ ${Number(offering.cost || 0).toFixed(2)}</strong></span><span>Total: <strong class="total-amount">S/ ${Number(offering.total || 0).toFixed(2)}</strong></span></div></div>`;
            // --- FIN CAMBIO ---
        };
        
        const initializeForms = () => {
            elements.vigilanciaOfferingsContainer.innerHTML = '';
            elements.tecnologiaOfferingsContainer.innerHTML = '';
            elements.editVigilanciaOfferingsContainer.innerHTML = '';
            elements.editTecnologiaOfferingsContainer.innerHTML = '';
        };

        const init = () => {
            AuthService.init();
            elements.goToPendingBtn.addEventListener('click', () => navigateToList('pending'));
            elements.goToWonBtn.addEventListener('click', () => navigateToList('won'));
            elements.backToHomeBtn.addEventListener('click', navigateToHome);
            elements.addClientForm.addEventListener('submit', handleAddClient);
            elements.addVigilanciaRowBtn.addEventListener('click', () => elements.vigilanciaOfferingsContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY)));
            elements.addTecnologiaRowBtn.addEventListener('click', () => elements.tecnologiaOfferingsContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY)));
            elements.clientsContainer.addEventListener('click', handleClientCardActions);
            elements.editClientForm.addEventListener('submit', handleUpdateClient);
            elements.editAddVigilanciaRowBtn.addEventListener('click', () => elements.editVigilanciaOfferingsContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY)));
            elements.editAddTecnologiaRowBtn.addEventListener('click', () => elements.editTecnologiaOfferingsContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY)));
            elements.closeEditModalBtn.addEventListener('click', closeEditModal);
            elements.cancelEditBtn.addEventListener('click', closeEditModal);
        };

        return { init, showView, initializeForms };
    })();

    App.init();
});