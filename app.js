// Final Production Build v5.2 - Secure Authentication System
const API_URL = "https://script.google.com/macros/s/AKfycbzmX1LnuYCYjnOK3WZTcXmdvfs9PtNZj2vmMl6LVVBIrqG1FTIJ-t9JpwiHztCWGCav1A/exec";
const PASSWORD_ADMIN = "mantencioncermaq";

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

    // Load cached Responsable
    const savedName = localStorage.getItem('savedResponsable');
    if (savedName) {
        document.getElementById('responsable').value = savedName;
    }
};

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
    if (!navigator.onLine) {
        alert("Estás offline. Conéctate a internet para enviar los datos.");
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
        authPin: authPin  // Incluir PIN para validación
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
                alert("✅ Confirmado: " + data.message);
                finishSubmission();
            } else {
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
            <button class="btn btn-outline-primary mt-4" onclick="location.reload()">Nuevo Registro (Admin)</button>
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
