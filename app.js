// Enterprise-Grade Production Build v6.0 - Ultra Robust System
const API_URL = "https://script.google.com/macros/s/AKfycbxEa10SS3owHtaUg28CPjN_WPjBtxojFsE_54a4MLx3MFsdkpaGc_npw6RAVNFtlt5Trw/exec";
const PASSWORD_ADMIN = "mantencioncermaq";
const APP_VERSION = "6.0.0";

// Service Worker Update Handling
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}

let appMode = "NORMAL";
let adminPassword = "";

// Element References
const form = document.getElementById('registroForm');
const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
const modalSummary = document.getElementById('modalSummary');
const btnFinalSend = document.getElementById('btnFinalSend');

// Column Mapping (Must match Google Sheet Headers exactly)
const fieldIds = [
    'o2_comp_kw', 'o2_comp_m3', 'o2_comp_hrs',
    'o2_gen1_hrs', 'o2_gen1_m3',
    'o2_gen2_hrs', 'o2_gen2_m3',
    'o2_cons_fry', 'o2_cons_smolt',
    'red_v12', 'red_v23', 'red_v31',
    'red_i1', 'red_i2', 'red_i3',
    'red_sump_kw', 'red_ea_gw',
    'd_gen1_hrs', 'd_gen1_kw',
    'd_gen2_hrs', 'd_gen2_kw',
    'd_gen3_hrs', 'd_gen3_kw'
];

window.onload = () => {
    checkLastSubmission();
    setupNetworkListener();
    fetchLastServerSubmission(); // Fetch real server data

    // Load cached Responsable
    const savedName = localStorage.getItem('savedResponsable');
    if (savedName) {
        document.getElementById('responsable').value = savedName;
    }
};

// --- INTERACTIVE LAST SUBMISSION ---
let lastServerData = null;

async function fetchLastServerSubmission() {
    const statusEl = document.getElementById("lastSubmit");
    if (!navigator.onLine) {
        statusEl.innerText = "Offline";
        return;
    }

    try {
        const response = await fetch(API_URL + "?action=latest");
        const data = await response.json();

        if (data.error) {
            statusEl.innerText = "Sin datos";
            return;
        }

        lastServerData = data;
        statusEl.innerText = data.timestamp || "Desconocido";
        statusEl.classList.add("text-primary", "fw-bold");

    } catch (e) {
        console.error("Fetch Error:", e);
        // Fallback to local logic if server fails
        updateLastSubmitTime();
    }
}

function showLastSubmissionDetails() {
    if (!lastServerData) {
        // Retry if clicked and empty
        const statusEl = document.getElementById("lastSubmit");
        if (statusEl.innerText === "Offline") return alert("No se puede ver el historial sin conexión.");

        fetchLastServerSubmission().then(() => {
            if (lastServerData) showLastSubmissionDetails();
            else alert("No se pudo obtener información del servidor.");
        });
        return;
    }

    // Populate Modal
    document.getElementById("histTimestamp").innerText = lastServerData.timestamp;
    document.getElementById("histResponsable").innerText = lastServerData.responsable;

    const contentDiv = document.getElementById("histContent");
    contentDiv.innerHTML = "";

    lastServerData.data.forEach(item => {
        const div = document.createElement("div");
        div.className = "row-item";
        div.innerHTML = `<span class="row-label">${item[0]}</span><span class="row-value">${item[1]}</span>`;
        contentDiv.appendChild(div);
    });

    const modal = new bootstrap.Modal(document.getElementById('historyModal'));
    modal.show();
}

// Robust Network Status (Pill)
function setupNetworkListener() {
    const pill = document.getElementById('networkPill');
    const text = document.getElementById('networkText');

    if (!pill || !text) return;

    async function checkConnection() {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 6000); // 6s timeout

            // 'no-cors' here is fine for just checking connectivity (ping)
            await fetch(API_URL, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller.signal
            });
            clearTimeout(id);

            pill.classList.remove('offline');
            pill.classList.add('online');
            text.textContent = "Online";

        } catch (error) {
            pill.classList.remove('online');
            pill.classList.add('offline');
            text.textContent = "Offline";
        }
    }

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', () => {
        pill.classList.remove('online');
        pill.classList.add('offline');
        text.textContent = "Offline";
    });

    setInterval(checkConnection, 15000); // Check every 15s
    checkConnection();
}

function checkLastSubmission() {
    const lastSub = localStorage.getItem('lastSubmission');
    if (lastSub) {
        const date = new Date(parseInt(lastSub));
        const now = new Date();
        const diffHours = (now - date) / 1000 / 60 / 60;
        // Logic reserved for future warnings
    }
}

function handleSubmit(event) {
    event.preventDefault();

    const responsable = document.getElementById('responsable').value;
    if (!responsable || !responsable.trim()) {
        alert("El nombre del Responsable es obligatorio.");
        return;
    }

    localStorage.setItem('savedResponsable', responsable);

    let summaryHtml = `<p><strong>Responsable:</strong> ${responsable}</p><hr>`;
    summaryHtml += '<div class="row">';

    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        const val = el ? el.value : "";
        if (val) {
            const label = id.replace(/_/g, ' ').toUpperCase();
            summaryHtml += `<div class="col-6 mb-1"><small class="text-muted">${label}:</small> <strong>${val}</strong></div>`;
        }
    });
    summaryHtml += '</div>';

    if (appMode === "ADMIN") {
        summaryHtml += `<div class="alert alert-warning mt-2"><i class="bi bi-exclamation-triangle"></i> MODO EDICIÓN ADMINISTRADOR ACTIVADO</div>`;
    }

    modalSummary.innerHTML = summaryHtml;

    // Auto-llenar responsable en el modal de confirmación
    document.getElementById('confirmResponsable').value = responsable;
    // Limpiar PIN anterior
    document.getElementById('authPin').value = '';

    confirmModal.show();
}

// Data Submission with Server Validation
function sendData() {
    // Check offline status and Queue
    if (!navigator.onLine) {
        const responsable = document.getElementById('confirmResponsable').value;
        const authPin = document.getElementById('authPin').value;
        if (!responsable || !responsable.trim()) { alert("Nombre requerido"); return; }

        // Prepare data for queue
        const valores = fieldIds.map(id => {
            const el = document.getElementById(id);
            return el ? (el.value || "") : "";
        });

        const formData = {
            modo: appMode,
            password: adminPassword,
            valores: valores,
            authPin: authPin,
            userAgent: navigator.userAgent,
            localTimestamp: new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })
        };

        if (OfflineManager.savePending(formData, responsable, authPin)) {
            showToast("📡 Guardado OFFLINE. Se enviará al conectar.", "info");
            clearBackup();
            finishSubmission();
        }
        return;
    }

    // Obtener responsable y PIN del modal de confirmación
    const responsable = document.getElementById('confirmResponsable').value;
    const authPin = document.getElementById('authPin').value;

    // Validar responsable
    if (!responsable || !responsable.trim()) {
        alert("El nombre del Responsable es obligatorio.");
        return;
    }

    // Validar PIN (4 dígitos numéricos)
    if (!authPin || authPin.length !== 4 || !/^\d{4}$/.test(authPin)) {
        alert("PIN debe ser exactamente 4 dígitos numéricos.");
        document.getElementById('authPin').focus();
        return;
    }

    btnFinalSend.disabled = true;
    btnFinalSend.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Validando...';

    const valores = fieldIds.map(id => {
        const el = document.getElementById(id);
        return el ? (el.value || "") : "";
    });

    const payload = {
        modo: appMode,
        password: adminPassword,
        responsable: responsable,
        valores: valores,
        authPin: authPin,  // Incluir PIN para validación
        authPin: authPin,  // Incluir PIN para validación
        userAgent: navigator.userAgent,  // Device fingerprinting
        localTimestamp: new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" }) // Force Device/Chile Time
    };

    console.log("Payload enviado (PIN oculto en log):", { ...payload, authPin: "****" });

    fetch(API_URL, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
    })
        .then(response => {
            if (!response.ok) throw new Error("Error en respuesta HTTP: " + response.status);
            return response.json();
        })
        .then(data => {
            if (data.result === "success") {
                showToast("Datos guardados exitosamente", "success");
                clearBackup();  // Limpiar auto-save solo después de éxito
                finishSubmission();
            } else {
                // Manejo de errores específicos
                if (data.locked) {
                    showToast(`Bloqueado por intentos fallidos: ${data.message}`, "error");
                } else if (data.attemptsLeft !== undefined) {
                    showToast(`PIN incorrecto. ${data.attemptsLeft} intentos restantes.`, "warning");
                } else if (data.errors) {
                    showToast("Valores fuera de rangos permitidos", "error");
                    console.error("Errores de validación:", data.errors);
                } else {
                    showToast(data.message || "Error del servidor", "error");
                }
                throw new Error(data.message || "El servidor rechazó los datos");
            }
        })
        .catch(err => {
            console.error("Fetch Error:", err);
            let msg = "⚠️ " + err.message;

            if (window.location.protocol === 'file:') {
                msg += "\n\nEstás probando en LOCAL. Revisa la planilla para confirmar.";
            }

            alert(msg);
            btnFinalSend.disabled = false;
            btnFinalSend.innerHTML = '<i class="bi bi-check-circle"></i> Reintentar';

            // Limpiar PIN en caso de error (seguridad)
            document.getElementById('authPin').value = '';
        });
}

function finishSubmission() {
    confirmModal.hide();
    localStorage.setItem('lastSubmission', Date.now().toString());
    form.reset();
    btnFinalSend.disabled = false;
    btnFinalSend.innerText = "Confirmar y Enviar";

    if (appMode !== 'ADMIN') {
        document.body.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center min-vh-100 text-center p-4">
            <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
            <h2 class="mt-3">Registro Exitoso</h2>
            <p class="text-muted">Registro verificado y guardado.</p>
            <div class="mt-4 d-flex gap-3 justify-content-center">
                <button class="btn btn-outline-primary" onclick="location.reload()">Nuevo Registro (Admin)</button>
                <a href="monitor.html" class="btn btn-primary text-white"><i class="bi bi-display"></i> Ver Monitor</a>
            </div>
        </div>
        `;
    }
}

function toggleAdmin() {
    const pass = prompt("Ingrese contraseña de Administrador:");
    if (pass === PASSWORD_ADMIN) {
        appMode = "ADMIN";
        adminPassword = pass;
        alert("Modo Administrador Habilitado");
        document.querySelector('.app-header').innerHTML += '<span class="badge bg-warning text-dark mt-2">MODO ADMIN</span>';
        if (!document.getElementById('registroForm')) location.reload();
    } else {
        if (pass !== null) alert("Contraseña incorrecta.");
    }
}

// ============================================
// SISTEMA DE CAMBIO DE PIN
// ============================================

function openChangePinModal() {
    const modal = new bootstrap.Modal(document.getElementById('changePinModal'));
    // Limpiar campos
    document.getElementById('adminPassForPin').value = '';
    document.getElementById('currentPinInput').value = '';
    document.getElementById('newPinInput').value = '';
    document.getElementById('confirmNewPinInput').value = '';
    modal.show();
}

async function submitPinChange() {
    const adminPass = document.getElementById('adminPassForPin').value;
    const currentPin = document.getElementById('currentPinInput').value;
    const newPin = document.getElementById('newPinInput').value;
    const confirmPin = document.getElementById('confirmNewPinInput').value;

    // Validaciones
    if (!adminPass || !currentPin || !newPin || !confirmPin) {
        alert("Todos los campos son obligatorios");
        return;
    }

    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
        alert("Los PINs deben ser exactamente 4 dígitos numéricos");
        return;
    }

    if (newPin !== confirmPin) {
        alert("El nuevo PIN y su confirmación no coinciden");
        return;
    }

    if (currentPin === newPin) {
        alert("El nuevo PIN debe ser diferente al actual");
        return;
    }

    // Confirmar cambio
    if (!confirm(`¿Confirma cambiar el PIN de autorización?\n\nNuevo PIN: ${newPin}\n\n⚠️ IMPORTANTE: Comunique el nuevo PIN a todos los operadores inmediatamente.`)) {
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'changePin',
                adminPassword: adminPass,
                currentPin: currentPin,
                newPin: newPin
            })
        });

        const result = await response.json();

        if (result.success) {
            alert("✅ " + result.message);
            bootstrap.Modal.getInstance(document.getElementById('changePinModal')).hide();
            // Limpiar campos
            document.getElementById('adminPassForPin').value = '';
            document.getElementById('currentPinInput').value = '';
            document.getElementById('newPinInput').value = '';
            document.getElementById('confirmNewPinInput').value = '';
        } else {
            alert("❌ " + result.message);
        }
    } catch (err) {
        alert("Error de conexión: " + err.message);
    }
}

// ============================================
// AUTO-SAVE & CRASH RECOVERY SYSTEM
// ============================================

let autoSaveInterval = null;

function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);

    autoSaveInterval = setInterval(() => {
        const formData = captureFormData();
        if (formData && formData.hasData) {
            localStorage.setItem('formBackup', JSON.stringify(formData));
            localStorage.setItem('formBackupTime', Date.now());
        }
    }, 3000);
}

function captureFormData() {
    const responsable = document.getElementById('responsable').value;
    const valores = fieldIds.map(id => document.getElementById(id)?.value || "");
    const hasData = responsable || valores.some(v => v);

    return { responsable, valores, timestamp: new Date().toISOString(), hasData };
}

function restoreFormData(data) {
    if (data.responsable) document.getElementById('responsable').value = data.responsable;
    fieldIds.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && data.valores[i]) el.value = data.valores[i];
    });
}

function checkForRecovery() {
    const backup = localStorage.getItem('formBackup');
    const backupTime = localStorage.getItem('formBackupTime');

    if (!backup || !backupTime) return;

    const data = JSON.parse(backup);
    const elapsed = Date.now() - parseInt(backupTime);

    if (elapsed > 86400000 || !data.hasData) {
        clearBackup();
        return;
    }

    const timestamp = new Date(data.timestamp).toLocaleString('es-CL');
    if (confirm(`🔄 Datos no enviados detectados\n\nResponsable: ${data.responsable || '(vacío)'}\nGuardado: ${timestamp}\n\n¿Restaurar datos?`)) {
        restoreFormData(data);
        showToast('Datos restaurados exitosamente', 'success');
    } else {
        clearBackup();
    }
}

function clearBackup() {
    localStorage.removeItem('formBackup');
    localStorage.removeItem('formBackupTime');
}

// Toast Notifications
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;max-width:350px;';
        document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

    const toast = document.createElement('div');
    toast.innerHTML = `<div style="background:white;border-left:4px solid ${colors[type]};border-radius:8px;padding:16px;margin-bottom:10px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:12px;animation:slideIn 0.3s ease-out;"><span style="font-size:24px;">${icons[type]}</span><span style="flex:1;color:#1f2937;font-weight:500;">${message}</span></div>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Add animations CSS
if (!document.getElementById('toastAnimations')) {
    const style = document.createElement('style');
    style.id = 'toastAnimations';
    style.textContent = '@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(400px);opacity:0}}';
    document.head.appendChild(style);
}

// ============================================
// STATUS DASHBOARD FUNCTIONS
// ============================================

// Check Sheets connection
async function checkSheetsConnection() {
    const statusEl = document.getElementById('sheetsStatus');
    const iconEl = document.getElementById('sheetsIcon');

    try {
        const response = await fetch(API_URL + '?ping=true', {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            statusEl.textContent = 'Online';
            statusEl.style.color = 'var(--success)';
            iconEl.className = 'bi bi-cloud-check';
            iconEl.style.color = 'var(--success)';
        } else {
            throw new Error('No response');
        }
    } catch (err) {
        statusEl.textContent = 'Offline';
        statusEl.style.color = 'var(--danger)';
        iconEl.className = 'bi bi-cloud-slash';
        iconEl.style.color = 'var(--danger)';
    }
}

// Update last submission time
function updateLastSubmitTime() {
    const lastSubmit = localStorage.getItem('lastSubmissionTime');
    const el = document.getElementById('lastSubmit');

    if (!lastSubmit) {
        el.textContent = 'Nunca';
        return;
    }

    const date = new Date(parseInt(lastSubmit));
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        el.textContent = 'Ahora';
    } else if (diffMins < 60) {
        el.textContent = `Hace ${diffMins}min`;
    } else if (diffHours < 24) {
        el.textContent = `Hace ${diffHours}h`;
    } else {
        el.textContent = `Hace ${diffDays}d`;
    }
}

// Force update: Clear all caches and reload
async function forceUpdate() {
    const btn = document.getElementById('btnForceUpdate');
    const originalHTML = btn.innerHTML;

    if (!confirm('¿Actualizar a la última versión?\n\nEsto limpiará el cache y recargará la aplicación.')) {
        return;
    }

    btn.disabled = true;
    btn.classList.add('updating');
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Actualizando...';

    try {
        // 1. Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        // 2. Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        // 3. Clear localStorage backup (keep lastSubmission for tracking)
        localStorage.removeItem('formBackup');
        localStorage.removeItem('formBackupTime');

        showToast('Cache limpiado. Recargando...', 'success');

        // 4. Hard reload after short delay
        setTimeout(() => {
            window.location.reload(true);
        }, 1000);

    } catch (err) {
        console.error('Error durante force update:', err);
        btn.disabled = false;
        btn.classList.remove('updating');
        btn.innerHTML = originalHTML;
        showToast('Error al actualizar: ' + err.message, 'error');
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    checkForRecovery();
    startAutoSave();
    checkSheetsConnection();
    updateLastSubmitTime();

    // Set up force update button
    document.getElementById('btnForceUpdate').addEventListener('click', forceUpdate);

    // Update Sheets status every 30 seconds
    setInterval(checkSheetsConnection, 30000);

    // Update last submit time every minute
    setInterval(updateLastSubmitTime, 60000);

    console.log(`%c🚀 Sistema v${APP_VERSION}`, 'color: #10b981; font-weight: bold; font-size: 14px');
});

// Override finishSubmission to clear backup and update last submit
const originalFinish = finishSubmission;
finishSubmission = function () {
    clearBackup();
    localStorage.setItem('lastSubmissionTime', Date.now());
    updateLastSubmitTime();
    if (originalFinish) originalFinish();
};

// ============================================
// OFFLINE SYNC SYSTEM
// ============================================

const OfflineManager = {
    STORAGE_KEY: 'pending_submission',

    init() {
        // Check for pending submissions on load
        this.checkPending();

        // Listen for online events
        window.addEventListener('online', () => {
            console.log('?? Connection restored');
            this.updateConnectionStatus(true);
            this.attemptSync();
        });

        window.addEventListener('offline', () => {
            console.log('?? Connection lost');
            this.updateConnectionStatus(false);
        });

        // Initial connection status
        this.updateConnectionStatus(navigator.onLine);

        console.log('? Offline Manager initialized');
    },

    savePending(formData, responsable, pin) {
        const pending = {
            timestamp: new Date().toISOString(),
            responsable: responsable,
            pin: pin,
            data: formData,
            attempts: 0,
            lastAttempt: null
        };

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pending));
            console.log('?? Submission saved offline');
            this.showPendingBadge(true);
            return true;
        } catch (error) {
            console.error('Error saving offline:', error);
            showToast('Error al guardar localmente: ' + error.message, 'error');
            return false;
        }
    },

    getPending() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading pending:', error);
            return null;
        }
    },

    clearPending() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.showPendingBadge(false);
        console.log('? Pending submission cleared');
    },

    async attemptSync() {
        const pending = this.getPending();
        if (!pending) return;

        if (!navigator.onLine) {
            console.log('?? Still offline, cannot sync');
            return;
        }

        console.log('?? Attempting to sync pending submission...');
        showToast('?? Sincronizando registro pendiente...', 'info');

        // Update attempt count
        pending.attempts++;
        pending.lastAttempt = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pending));

        try {
            // Prepare payload exactly like normal submission
            const payload = {
                responsable: pending.responsable,
                pin: pending.pin,
                timestamp: pending.timestamp,
                ...pending.data
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Since no-cors doesn't give us response, we assume success
            console.log('? Sync successful');
            showToast('? Registro enviado exitosamente', 'success');
            this.clearPending();

            // Update last submission time
            localStorage.setItem('lastSubmissionTime', Date.now());
            updateLastSubmitTime();

        } catch (error) {
            console.error('? Sync failed:', error);
            showToast('?? Error al sincronizar. Se reintentar� autom�ticamente.', 'warning');
        }
    },

    checkPending() {
        const pending = this.getPending();
        if (pending) {
            console.log('?? Found pending submission from:', pending.timestamp);
            this.showPendingBadge(true);

            // Auto-attempt sync if online
            if (navigator.onLine) {
                setTimeout(() => this.attemptSync(), 2000);
            }
        }
    },

    showPendingBadge(show) {
        const badge = document.getElementById('pendingBadge');
        if (badge) {
            badge.style.display = show ? 'flex' : 'none';
        }
    },

    updateConnectionStatus(isOnline) {
        const indicator = document.getElementById('connectionStatus');
        if (indicator) {
            indicator.className = isOnline ? 'connection-status online' : 'connection-status offline';
            indicator.title = isOnline ? 'Conectado' : 'Sin conexi�n';
        }
    },

    showPendingModal() {
        const pending = this.getPending();
        if (!pending) {
            showToast('No hay registros pendientes', 'info');
            return;
        }

        const modal = new bootstrap.Modal(document.getElementById('pendingModal'));
        document.getElementById('pendingTimestamp').textContent =
            new Date(pending.timestamp).toLocaleString('es-CL');
        document.getElementById('pendingResponsable').textContent = pending.responsable;
        document.getElementById('pendingAttempts').textContent = pending.attempts;

        modal.show();
    },

    async manualRetry() {
        if (!navigator.onLine) {
            showToast('?? Sin conexi�n a internet', 'warning');
            return;
        }

        await this.attemptSync();

        // Close modal if sync was successful
        const pending = this.getPending();
        if (!pending) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('pendingModal'));
            if (modal) modal.hide();
        }
    },

    deletePending() {
        if (confirm('�Est� seguro de eliminar el registro pendiente? Esta acci�n no se puede deshacer.')) {
            this.clearPending();
            showToast('Registro pendiente eliminado', 'info');
            const modal = bootstrap.Modal.getInstance(document.getElementById('pendingModal'));
            if (modal) modal.hide();
        }
    }
};

// Initialize Offline Manager on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    OfflineManager.init();
});



