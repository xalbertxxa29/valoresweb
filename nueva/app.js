document.addEventListener("DOMContentLoaded", () => {
    // Detectar si está en modo embedded (iframe)
    const urlParams = new URLSearchParams(window.location.search);
    const isEmbedded = urlParams.get('embedded') === 'true';
    
    if (isEmbedded) {
        console.log('🔗 Aplicación cargada en modo embedded (iframe)');
        // Opcional: Ajustar estilos para modo iframe
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        
        // IMPORTANTE: En modo embedded, ocultar la vista de auth inmediatamente
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
    }

    // PWA Service Worker Registration
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/service-worker.js")
                .then((reg) => console.log("Service Worker: Registrado"))
                .catch((err) => console.log(`Service Worker: Error: ${err}`));
        });
    }

    // Firebase Initialization
    // Firebase ya está inicializado en firebase-config.js
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- GLOBAL APP STATE ---
    let currentUserId = null;
    let clientsListener = null;

    const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
    const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';
    
    // Catálogo dinámico desde Firestore
    const CATALOG = { vigilancia: [], tecnologia: [] };
    let catalogLoaded = false;

    // Función para cargar desplegables desde Firestore (igual que en dashboard.js)
    async function loadOfferingsFromFirestore() {
        console.log('🔄 Cargando desplegables desde Firestore...');
        try {
            // Intentar ruta 1: DESPEGABLES/VIGILANCIA y DESPEGABLES/TECNOLOGIA
            const vigilanciaSnap = await db.collection('DESPEGABLES').doc('VIGILANCIA').get();
            const tecnologiaSnap = await db.collection('DESPEGABLES').doc('TECNOLOGIA').get();
            
            // Procesar datos de Vigilancia
            if (vigilanciaSnap.exists) {
                const vigData = vigilanciaSnap.data();
                console.log('📍 Datos VIGILANCIA:', vigData);
                
                // Si tiene propiedad offerings como array
                if (Array.isArray(vigData.offerings)) {
                    CATALOG.vigilancia = vigData.offerings.map(o => ({ 
                        name: typeof o === 'string' ? o : o.name || o, 
                        category: VIGILANCIA_CATEGORY 
                    }));
                } 
                // Si es un objeto con propiedades numeradas (1:, 2:, etc.)
                else {
                    const items = [];
                    for (let key in vigData) {
                        if (key !== 'offerings' && !key.startsWith('_')) {
                            items.push(vigData[key]);
                        }
                    }
                    CATALOG.vigilancia = items.map(o => ({ 
                        name: typeof o === 'string' ? o : o.name || o, 
                        category: VIGILANCIA_CATEGORY 
                    }));
                }
                console.log('✅ Vigilancia cargada:', CATALOG.vigilancia.length, 'items');
            }
            
            // Procesar datos de Tecnología
            if (tecnologiaSnap.exists) {
                const tecData = tecnologiaSnap.data();
                console.log('📍 Datos TECNOLOGIA:', tecData);
                
                // Si tiene propiedad offerings como array
                if (Array.isArray(tecData.offerings)) {
                    CATALOG.tecnologia = tecData.offerings.map(o => ({ 
                        name: typeof o === 'string' ? o : o.name || o, 
                        category: TECNOLOGIA_CATEGORY 
                    }));
                }
                // Si es un objeto con propiedades numeradas (1:, 2:, etc.)
                else {
                    const items = [];
                    for (let key in tecData) {
                        if (key !== 'offerings' && !key.startsWith('_')) {
                            items.push(tecData[key]);
                        }
                    }
                    CATALOG.tecnologia = items.map(o => ({ 
                        name: typeof o === 'string' ? o : o.name || o, 
                        category: TECNOLOGIA_CATEGORY 
                    }));
                }
                console.log('✅ Tecnología cargada:', CATALOG.tecnologia.length, 'items');
            }
            
            catalogLoaded = true;
            return true;
        } catch (error) {
            console.error('❌ Error cargando desplegables:', error);
            return false;
        }
    }

    // Función para refrescar los selects cuando hay cambios
    function watchDesplegablesRealtime() {
        console.log('👁️ Monitoreando cambios en desplegables...');
        db.collection('DESPEGABLES').doc('VIGILANCIA').onSnapshot(doc => {
            if (doc.exists) {
                const vigData = doc.data();
                if (Array.isArray(vigData.offerings)) {
                    CATALOG.vigilancia = vigData.offerings.map(o => ({ name: o, category: VIGILANCIA_CATEGORY }));
                } else {
                    const items = [];
                    for (let key in vigData) {
                        if (key !== 'offerings' && !key.startsWith('_')) {
                            items.push(vigData[key]);
                        }
                    }
                    CATALOG.vigilancia = items.map(o => ({ name: o, category: VIGILANCIA_CATEGORY }));
                }
                updateAvailableOfferings();
                console.log('🔄 Vigilancia actualizada en tiempo real:', CATALOG.vigilancia.length);
            }
        });
        
        db.collection('DESPEGABLES').doc('TECNOLOGIA').onSnapshot(doc => {
            if (doc.exists) {
                const tecData = doc.data();
                if (Array.isArray(tecData.offerings)) {
                    CATALOG.tecnologia = tecData.offerings.map(o => ({ name: o, category: TECNOLOGIA_CATEGORY }));
                } else {
                    const items = [];
                    for (let key in tecData) {
                        if (key !== 'offerings' && !key.startsWith('_')) {
                            items.push(tecData[key]);
                        }
                    }
                    CATALOG.tecnologia = items.map(o => ({ name: o, category: TECNOLOGIA_CATEGORY }));
                }
                updateAvailableOfferings();
                console.log('🔄 Tecnología actualizada en tiempo real:', CATALOG.tecnologia.length);
            }
        });
    }

    // Función para actualizar availableOfferings desde CATALOG
    function updateAvailableOfferings() {
        availableOfferings = [...CATALOG.vigilancia, ...CATALOG.tecnologia];
        console.log('📊 availableOfferings actualizado:', availableOfferings.length, 'items');
        refreshAllOfferingSelects();
    }

    // Función para refrescar todos los selects de ofrecimientos
    function refreshAllOfferingSelects() {
        console.log('🔄 Refrescando todos los selects...');
        const selects = document.querySelectorAll('.offering-name');
        selects.forEach(select => {
            const category = select.closest('.offering-row')?.querySelector('.offering-category')?.value;
            if (!category) return;
            
            const currentValue = select.value;
            const optionsForCategory = availableOfferings.filter(o => o.category === category);
            
            // Limpiar opciones existentes (excepto la primera que dice "Seleccionar...")
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            // Agregar nuevas opciones
            optionsForCategory.forEach(o => {
                const option = document.createElement('option');
                option.value = o.name;
                option.textContent = o.name;
                if (o.name === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            console.log(`  ✅ Select actualizado para ${category}: ${optionsForCategory.length} opciones`);
        });
    }
    
    // =================================================================================
    // --- MODULE: UI (Manejo de la Interfaz de Usuario) ---puebas

    // Variable global para showAddOfferingModal (será asignada por el módulo UI)
    let showAddOfferingModal = null;

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
            clientContractType: document.getElementById("client-contract-type"),
            clientZone: document.getElementById("client-zone"),
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
            editClientContractType: document.getElementById("edit-client-contract-type"),
            editClientZone: document.getElementById("edit-client-zone"),
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
            console.log('🔧 createOfferingRow llamada con:', category, 'availableOfferings:', availableOfferings.length);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'offering-row p-3 bg-slate-800/50 rounded-lg space-y-3';
            
            const optionsForCategory = availableOfferings.filter(o => o.category === category);
            console.log('📊 Opciones para', category + ':', optionsForCategory.length);
            
            const selectOptions = optionsForCategory.map(o => 
                `<option value="${o.name}" ${o.name === offeringData.name ? 'selected' : ''}>${o.name}</option>`
            ).join('');

            wrapper.innerHTML = `
                <div class="flex justify-between items-center gap-3">
                    <select class="form-select-sm offering-name flex-grow"><option value="">Seleccionar...</option>${selectOptions}</select>
                    <button type="button" class="add-offering-option-btn flex-shrink-0 text-cyan-400 hover:text-cyan-300" title="Agregar nueva opción"><i class="fas fa-plus"></i></button>
                    <button type="button" class="remove-offering-row-btn flex-shrink-0 text-red-400 hover:text-red-300" title="Eliminar fila"><i class="fas fa-trash-alt"></i></button>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input type="number" placeholder="Cantidad" class="form-input-sm offering-quantity" min="1" step="1" value="${offeringData.quantity || 1}">
                    
                    <select class="form-select-sm offering-provision-mode">
                        <option value="mensual" ${offeringData.provisionMode === 'mensual' ? 'selected' : ''}>Cobro Mensual</option>
                        <option value="contrato" ${offeringData.provisionMode === 'contrato' ? 'selected' : ''}>Por todo el contrato</option>
                    </select>
                    
                    <select class="form-select-sm offering-frequency">
                        <option value="6" ${offeringData.frequency == 6 ? 'selected' : ''}>6 meses</option>
                        <option value="12" ${offeringData.frequency == 12 ? 'selected' : ''}>12 meses</option>
                        <option value="18" ${offeringData.frequency == 18 ? 'selected' : ''}>18 meses</option>
                        <option value="24" ${offeringData.frequency == 24 ? 'selected' : ''}>24 meses</option>
                        <option value="36" ${offeringData.frequency == 36 ? 'selected' : ''}>36 meses</option>
                    </select>

                    <input type="number" placeholder="Costo de provision S/." class="form-input-sm offering-cost" min="0" step="0.01" value="${offeringData.cost || ''}">
                    <input type="text" placeholder="Total" class="form-input-sm bg-slate-700/80 offering-total" readonly value="S/ ${offeringData.total?.toFixed(2) || '0.00'}">
                </div>
                <input type="hidden" class="offering-category" value="${category}">
            `;
            
            const calculateTotal = (container) => {
                const quantity = parseFloat(container.querySelector('.offering-quantity').value) || 0;
                const frequency = parseFloat(container.querySelector('.offering-frequency').value) || 0;
                const cost = parseFloat(container.querySelector('.offering-cost').value) || 0;
                const provisionMode = container.querySelector('.offering-provision-mode').value;
                let total = 0;

                if (provisionMode === 'contrato') {
                    total = cost * quantity;
                } else { // 'mensual'
                    total = (cost * quantity) * frequency;
                }
                container.querySelector('.offering-total').value = `S/ ${total.toFixed(2)}`;
            };

            wrapper.addEventListener('input', () => calculateTotal(wrapper));
            wrapper.addEventListener('change', () => calculateTotal(wrapper));
            wrapper.querySelector('.remove-offering-row-btn').addEventListener('click', () => wrapper.remove());
            
            // Event listener para el botón "+" agregar opción
            wrapper.querySelector('.add-offering-option-btn')?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🟢 Click en botón + agregar opción');
                const selectEl = wrapper.querySelector('.offering-name');
                showAddOfferingModal(category, selectEl);
            });
            
            return wrapper;
        };

        // Función para mostrar modal de agregar opción
        const showAddOfferingModal = (category, selectEl) => {
            console.log('🔴 showAddOfferingModal llamada para:', category);
            const title = category === VIGILANCIA_CATEGORY ? 'Vigilancia' : 'Tecnología';
            
            // Crear modal elegante
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm';
            
            modal.innerHTML = `
                <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl max-w-md w-full mx-4 border border-slate-700">
                    <!-- Header -->
                    <div class="px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-cyan-600 to-cyan-700">
                        <h3 class="text-xl font-bold text-white">Nueva opción de ${title}</h3>
                        <p class="text-cyan-100 text-sm mt-1">Ingresa el nombre de la nueva opción</p>
                    </div>
                    
                    <!-- Body -->
                    <div class="p-6 space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">
                                Nombre de la opción
                            </label>
                            <input 
                                type="text" 
                                class="add-offering-input w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                                placeholder="Mínimo 3 caracteres"
                                autofocus
                            >
                            <p class="add-offering-error text-red-400 text-sm mt-2 hidden"></p>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="px-6 py-4 border-t border-slate-700 flex gap-3 justify-end">
                        <button class="add-offering-cancel px-4 py-2 text-slate-400 hover:text-slate-300 rounded-lg hover:bg-slate-700/50 transition font-medium">
                            Cancelar
                        </button>
                        <button class="add-offering-save px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-lg transition font-medium shadow-lg hover:shadow-cyan-500/50">
                            Guardar
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            const input = modal.querySelector('.add-offering-input');
            const errorMsg = modal.querySelector('.add-offering-error');
            const saveBtn = modal.querySelector('.add-offering-save');
            const cancelBtn = modal.querySelector('.add-offering-cancel');
            
            const closeModal = () => {
                modal.remove();
            };
            
            const handleSave = () => {
                const newOption = (input.value || '').trim();
                
                if (newOption.length < 3) {
                    errorMsg.textContent = 'Mínimo 3 caracteres requeridos';
                    errorMsg.classList.remove('hidden');
                    input.focus();
                    return;
                }
                
                // Agregar a CATALOG
                if (category === VIGILANCIA_CATEGORY) {
                    CATALOG.vigilancia.push({ name: newOption, category });
                } else {
                    CATALOG.tecnologia.push({ name: newOption, category });
                }
                
                // Actualizar availableOfferings
                updateAvailableOfferings();
                
                // Agregar a Firestore
                FirestoreService.addOfferingToFirestore(category, newOption).catch(e => {
                    console.error('❌ Error al guardar en Firestore:', e);
                    alert('Opción agregada localmente pero hubo error al sincronizar con Firestore');
                });
                
                // Actualizar select
                const option = document.createElement('option');
                option.value = newOption;
                option.textContent = newOption;
                selectEl.appendChild(option);
                selectEl.value = newOption;
                
                console.log('✅ Opción agregada:', newOption);
                closeModal();
            };
            
            // Event listeners
            saveBtn.addEventListener('click', handleSave);
            cancelBtn.addEventListener('click', closeModal);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSave();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeModal();
            });
            
            // Cerrar al hacer click fuera del modal
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
            
            input.focus();
        };

        // Asignar a variable global
        window.showAddOfferingModal = showAddOfferingModal;

        return { elements, showLoading, showSuccessModal, showConfirmationModal, showDatePickerModal, getAuthErrorMessage, createOfferingRow, toggleButtonLoading, showAddOfferingModal };
    })();

    // =================================================================================
    // --- MODULE: FIRESTORE (Interacciones con la Base de Datos) ---
    // =================================================================================
    const FirestoreService = (() => {
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
        
        // Agregar nueva opción a despegables en Firestore
        const addOfferingToFirestore = async (category, offeringName) => {
            console.log('💾 Guardando opción en Firestore:', category, offeringName);
            try {
                const docId = category === VIGILANCIA_CATEGORY ? 'VIGILANCIA' : 'TECNOLOGIA';
                const docRef = db.collection('DESPEGABLES').doc(docId);
                
                // Obtener documento actual
                const docSnap = await docRef.get();
                let docData = docSnap.exists ? docSnap.data() : {};
                
                // Verificar si ya existe la opción
                let exists = false;
                
                // Si existe como propiedad offerings (array)
                if (Array.isArray(docData.offerings)) {
                    if (docData.offerings.includes(offeringName)) {
                        exists = true;
                    } else {
                        docData.offerings.push(offeringName);
                    }
                } else {
                    // Buscar en propiedades numeradas
                    for (let key in docData) {
                        if (docData[key] === offeringName) {
                            exists = true;
                            break;
                        }
                    }
                    
                    if (!exists) {
                        // Encontrar el siguiente número disponible
                        let maxNum = 0;
                        for (let key in docData) {
                            if (!isNaN(key)) {
                                maxNum = Math.max(maxNum, parseInt(key));
                            }
                        }
                        const nextNum = maxNum + 1;
                        docData[nextNum] = offeringName;
                    }
                }
                
                if (!exists) {
                    await docRef.set(docData, { merge: true });
                    console.log('✅ Opción guardada en Firestore');
                } else {
                    console.log('⚠️ La opción ya existe');
                }
            } catch (error) {
                console.error('❌ Error guardando opción:', error);
                throw error;
            }
        };
        
        return { getClients, addClient, getClient, updateClient, deleteClient, markClientAsWon, addOfferingToFirestore };
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

        const displayUserName = async (user) => {
            elements.userInfo.textContent = user.email;
            try {
                const username = user.email.split('@')[0];
                const userDocId = username.toUpperCase();
                const userDocRef = db.collection("usuarios").doc(userDocId);
                const docSnap = await userDocRef.get();
        
                if (docSnap.exists && docSnap.data().NOMBRE) {
                    elements.userInfo.textContent = docSnap.data().NOMBRE;
                } else {
                    console.warn(`No se encontró un documento o el campo NOMBRE para el usuario: ${userDocId}`);
                    elements.userInfo.textContent = user.email;
                }
            } catch (error) {
                console.error("Error al obtener nombre de usuario:", error);
                elements.userInfo.textContent = user.email;
            }
        };

        const handleAuthStateChange = (user) => {
            if (user) {
                currentUserId = user.uid;
                
                // Cargar desplegables cuando el usuario inicia sesión
                console.log('🔄 Cargando desplegables al iniciar sesión...');
                loadOfferingsFromFirestore().then(() => {
                    updateAvailableOfferings();
                    watchDesplegablesRealtime();
                    console.log('✅ Desplegables cargados correctamente');
                }).catch(e => {
                    console.error('❌ Error cargando desplegables:', e);
                });
                
                elements.authView.classList.add("hidden");
                elements.appView.classList.remove("hidden");
                displayUserName(user);
                
                // Esperar a que App esté listo
                setTimeout(() => {
                    if (typeof App !== 'undefined' && App.showView) {
                        App.showView('home');
                        App.initializeForms();
                    }
                }, 100);
            } else {
                currentUserId = null;
                // Si está en embedded, NO mostrar la pantalla de login
                if (!isEmbedded) {
                    elements.authView.classList.remove("hidden");
                    elements.appView.classList.add("hidden");
                }
                if (clientsListener) clientsListener();
            }
        };
        
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
                const provisionMode = row.querySelector('.offering-provision-mode').value;
                let total = 0;
                if (provisionMode === 'contrato') {
                    total = cost * quantity;
                } else {
                    total = (cost * quantity) * frequency;
                }
                return { 
                    name: row.querySelector('.offering-name').value, 
                    category: row.querySelector('.offering-category').value, 
                    status: 'Ofrecido', 
                    quantity, 
                    frequency, 
                    cost,
                    provisionMode,
                    total
                };
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
            const contractType = elements.clientContractType.value;
            const zone = elements.clientZone.value;
        
            if (!clientName || !clientRuc || !contractType || !zone) {
                showConfirmationModal("Datos Incompletos", "Por favor, complete todos los campos del cliente (Nombre, RUC, Tipo y Zona).");
                return;
            }
            toggleButtonLoading(button, true);
            const allOfferings = [...getOfferingsFromForm(elements.vigilanciaOfferingsContainer), ...getOfferingsFromForm(elements.tecnologiaOfferingsContainer)];
            try {
                await FirestoreService.addClient(currentUserId, {
                    name: clientName,
                    ruc: clientRuc,
                    contractType: contractType,
                    zone: zone,
                    clientStatus: "Ofrecido",
                    offerings: allOfferings,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    creadoPor: auth.currentUser.email
                });
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
                const isWon = clientData.clientStatus === 'Ganado';
        
                elements.editClientId.value = clientId;
                elements.editClientNameInput.value = clientData.name;
                elements.editClientRucInput.value = clientData.ruc;
                elements.editClientContractType.value = clientData.contractType || '';
                elements.editClientZone.value = clientData.zone || '';
                
                elements.editVigilanciaOfferingsContainer.innerHTML = '';
                elements.editTecnologiaOfferingsContainer.innerHTML = '';
        
                if(clientData.offerings?.length > 0) {
                    clientData.offerings.forEach(offer => {
                        const container = offer.category === VIGILANCIA_CATEGORY 
                            ? elements.editVigilanciaOfferingsContainer 
                            : elements.editTecnologiaOfferingsContainer;
                        container.appendChild(createOfferingRow(offer.category, offer));
                    });
                }
                
                const formElements = elements.editClientForm.querySelectorAll('input, select, button');
                formElements.forEach(el => {
                    const isCancelButton = el.id === 'close-edit-modal-btn' || el.id === 'cancel-edit-btn';
                    if (!isCancelButton) {
                        el.disabled = isWon;
                    }
                });
        
                elements.editAddVigilanciaRowBtn.classList.toggle('hidden', isWon);
                elements.editAddTecnologiaRowBtn.classList.toggle('hidden', isWon);
                elements.editClientForm.querySelector('button[type="submit"]').classList.toggle('hidden', isWon);
                
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
                contractType: elements.editClientContractType.value,
                zone: elements.editClientZone.value,
                offerings: [...getOfferingsFromForm(elements.editVigilanciaOfferingsContainer), ...getOfferingsFromForm(elements.editTecnologiaOfferingsContainer)]
            };
        
            if(!updatedData.name || !updatedData.ruc || !updatedData.contractType || !updatedData.zone){
                showConfirmationModal("Datos Incompletos", "Todos los campos del cliente (Nombre, RUC, Tipo y Zona) son obligatorios.");
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
            
            const actionButtonsHTML = isPending 
                ? `<div class="flex flex-col sm:flex-row gap-2 mt-4"><button class="btn-primary mark-as-won-btn flex-1"><span class="btn-text">Marcar como Ganado</span></button><button class="btn-secondary edit-client-btn flex-1">Editar</button></div>` 
                : `<div class="flex gap-2 mt-4"><button class="btn-secondary edit-client-btn w-full">Ver Detalles</button></div>`;
    
            const extraInfoHTML = `
                <div class="flex text-xs text-slate-400 mt-2 gap-4 border-t border-slate-700/50 pt-2">
                    <span><i class="fas fa-file-signature mr-1 text-cyan-400"></i>${client.contractType || 'N/A'}</span>
                    <span><i class="fas fa-map-marker-alt mr-1 text-cyan-400"></i>${client.zone || 'N/A'}</span>
                </div>
            `;
    
            const offeringsByCat = (client.offerings || []).reduce((acc, offer) => {
                (acc[offer.category] = acc[offer.category] || []).push(offer);
                return acc;
            }, {});
            const offeringsHTML = Object.keys(offeringsByCat).length > 0 ? Object.entries(offeringsByCat).map(([category, offers]) => `<div class="mt-2"><h5 class="text-sm font-semibold text-slate-300 mb-2">${category}</h5><div class="space-y-2">${offers.map(createOfferingDisplayItem).join('')}</div></div>`).join('') : '<p class="text-xs text-slate-500">Sin ofrecimientos registrados.</p>';
            const implementationDateHTML = !isPending && client.implementationDate ? `<p class="text-xs text-cyan-300 mt-1"><i class="fas fa-calendar-check mr-1"></i>Implementación: <strong>${new Date(client.implementationDate + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></p>` : '';
            
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-grow pr-4">
                        <h3 class="text-lg font-bold text-white break-words">${client.name}</h3>
                        <p class="text-sm text-slate-400">RUC: ${client.ruc || "N/A"}</p>
                        ${implementationDateHTML}
                    </div>
                    <button class="delete-client-btn text-slate-400 hover:text-red-500 transition"><i class="fas fa-trash-alt"></i></button>
                </div>
                ${extraInfoHTML}
                <div class="border-t border-slate-700 pt-3">
                    <h4 class="font-semibold mb-1 text-white">Ofrecimientos</h4>
                    ${offeringsHTML}
                </div>
                ${actionButtonsHTML}
            `;
            return card;
        };

        const createOfferingDisplayItem = (offering) => {
            return `<div class="offering-display-item"><div class="flex justify-between items-center mb-2"><p class="font-bold break-words">${offering.name}</p><span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-300 text-slate-800">${offering.status || 'Ofrecido'}</span></div><div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"><span>Cantidad: <strong>${offering.quantity} und.</strong></span><span>Frecuencia: <strong>${offering.frequency} meses</strong></span><span>Costo Mensual: <strong>S/ ${Number(offering.cost || 0).toFixed(2)}</strong></span><span>Total: <strong class="total-amount">S/ ${Number(offering.total || 0).toFixed(2)}</strong></span></div></div>`;
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
    
    // Si está en modo embedded, inicializar la app directamente sin esperar auth
    if (isEmbedded) {
        setTimeout(() => {
            console.log('✅ Inicializando modo embedded...');
            
            // Cargar desplegables
            loadOfferingsFromFirestore().then(() => {
                updateAvailableOfferings();
                watchDesplegablesRealtime();
                console.log('✅ Desplegables cargados en modo embedded');
            }).catch(e => {
                console.error('❌ Error cargando desplegables en embedded:', e);
            });
            
            // Mostrar la app
            App.showView('home');
            App.initializeForms();
            
            // Obtener nombre del usuario del localStorage o mostrar genérico
            const userEmail = localStorage.getItem('userEmail') || 'Usuario';
            document.getElementById('user-info').textContent = userEmail;
            
            console.log('✅ Aplicación lista en modo embedded');
        }, 200);
    }
});

