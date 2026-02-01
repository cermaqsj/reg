// ============================================
// SISTEMA DE SEGURIDAD CON PIN Y PASSWORD ADMIN
// ============================================

// Función para generar hash SHA-256 del PIN
function hashPIN(pin) {
  const saltedPin = pin + "CERMAQ_SALT_2026"; // Salt fijo para seguridad adicional
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    saltedPin,
    Utilities.Charset.US_ASCII
  );
  
  return digest.map(byte => {
    const v = (byte < 0) ? 256 + byte : byte;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

// Obtener hash del PIN almacenado
function getStoredPINHash() {
  const props = PropertiesService.getScriptProperties();
  let pinHash = props.getProperty('PIN_HASH');
  
  // Si no existe, crear PIN por defecto: "1234"
  if (!pinHash) {
    pinHash = hashPIN("1234");
    props.setProperty('PIN_HASH', pinHash);
    Logger.log("⚠️ PIN por defecto creado: 1234 - Cámbielo inmediatamente");
  }
  
  return pinHash;
}

// Validar PIN ingresado por el usuario
function validatePIN(inputPin) {
  if (!inputPin || inputPin.length !== 4 || !/^\d{4}$/.test(inputPin)) {
    return false;
  }
  const storedHash = getStoredPINHash();
  const inputHash = hashPIN(inputPin);
  return inputHash === storedHash;
}

// ============================================
// RATE LIMITING (Anti-Brute Force)
// ============================================

// Cache de intentos fallidos (se resetea al reiniciar script, pero suficiente)
const failedAttempts = {};

function validatePINWithRateLimit(inputPin, userIdentifier) {
  const key = userIdentifier || 'unknown';
  const now = Date.now();
  
  // Inicializar si no existe
  if (!failedAttempts[key]) {
    failedAttempts[key] = {count: 0, lockedUntil: 0, firstAttempt: now};
  }
  
  const attempt = failedAttempts[key];
  
  // Limpiar contador si pasó 1 hora desde primer intento
  if (now - attempt.firstAttempt > 3600000) {
    failedAttempts[key] = {count: 0, lockedUntil: 0, firstAttempt: now};
  }
  
  // Si está bloqueado, rechazar
  if (attempt.lockedUntil > now) {
    const minsRemaining = Math.ceil((attempt.lockedUntil - now) / 60000);
    logSecurityEvent(`Intento bloqueado (${minsRemaining} min restantes)`, key);
    return {
      valid: false, 
      locked: true,
      message: `Demasiados intentos fallidos. Bloqueado por ${minsRemaining} minuto(s).`
    };
  }
  
  // Validar PIN
  const isValid = validatePIN(inputPin);
  
  if (!isValid) {
    attempt.count++;
    
    // Bloquear después de 5 intentos
    if (attempt.count >= 5) {
      attempt.lockedUntil = now + (5 * 60 * 1000); // 5 minutos
      logSecurityEvent(`Usuario bloqueado (5 intentos fallidos)`, key);
      return {
        valid: false, 
        locked: true,
        message: "Demasiados intentos fallidos. Bloqueado por 5 minutos."
      };
    }
    
    const attemptsLeft = 5 - attempt.count;
    return {
      valid: false, 
      locked: false,
      attemptsLeft: attemptsLeft,
      message: `PIN incorrecto. ${attemptsLeft} intentos restantes.`
    };
  }
  
  // PIN correcto, resetear contador
  failedAttempts[key] = {count: 0, lockedUntil: 0, firstAttempt: now};
  return {valid: true, locked: false};
}

// Obtener password de administrador
function getAdminPassword() {
  const props = PropertiesService.getScriptProperties();
  let adminPass = props.getProperty('ADMIN_PASSWORD');
  
  // Si no existe, crear password por defecto
  if (!adminPass) {
    adminPass = "mantencioncermaq";
    props.setProperty('ADMIN_PASSWORD', adminPass);
    Logger.log("⚠️ Password Admin por defecto: mantencioncermaq - Cámbielo inmediatamente");
  }
  
  return adminPass;
}

// Cambiar PIN (requiere contraseña de administrador)
function changePIN(adminPassword, currentPin, newPin) {
  const ADMIN_PASSWORD = getAdminPassword();
  
  // Verificar contraseña admin
  if (adminPassword !== ADMIN_PASSWORD) {
    return {success: false, message: "Contraseña de administrador incorrecta"};
  }
  
  // Verificar PIN actual
  if (!validatePIN(currentPin)) {
    return {success: false, message: "PIN actual incorrecto"};
  }
  
  // Validar nuevo PIN (4 dígitos numéricos)
  if (!/^\d{4}$/.test(newPin)) {
    return {success: false, message: "Nuevo PIN debe ser exactamente 4 dígitos numéricos"};
  }
  
  // Evitar PIN débiles
  const weakPins = ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321"];
  if (weakPins.includes(newPin)) {
    Logger.log("⚠️ Advertencia: PIN débil seleccionado");
  }
  
  // Guardar nuevo PIN hasheado
  const newHash = hashPIN(newPin);
  PropertiesService.getScriptProperties().setProperty('PIN_HASH', newHash);
  
  // Registrar evento de seguridad
  logSecurityEvent("PIN cambiado", "Admin");
  
  return {success: true, message: "PIN actualizado exitosamente. Comunique el nuevo PIN a los operadores."};
}

// Cambiar password de administrador
function changeAdminPassword(currentPassword, newPassword) {
  const ADMIN_PASSWORD = getAdminPassword();
  
  // Verificar contraseña actual
  if (currentPassword !== ADMIN_PASSWORD) {
    return {success: false, message: "Contraseña actual incorrecta"};
  }
  
  // Validar nueva contraseña (mínimo 8 caracteres)
  if (!newPassword || newPassword.length < 8) {
    return {success: false, message: "Nueva contraseña debe tener al menos 8 caracteres"};
  }
  
  // Guardar nueva contraseña
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', newPassword);
  
  // Registrar evento
  logSecurityEvent("Password Admin cambiado", "Admin");
  
  return {success: true, message: "Password de administrador actualizado exitosamente"};
}

// Registrar eventos de seguridad y errores de sistema
function logSecurityEvent(event, user) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName('Security_Log');
    
    if (!logSheet) {
      logSheet = ss.insertSheet('Security_Log');
      logSheet.getRange('A1:C1').setValues([['Timestamp', 'Evento', 'Usuario']]);
      logSheet.getRange('A1:C1').setFontWeight('bold').setBackground('#fef3c7');
      logSheet.setFrozenRows(1);
    }
    
    logSheet.appendRow([new Date(), event, user]);
  } catch (e) {
    Logger.log("Error logging security event: " + e.toString());
  }
}

function logSystemError(type, errorMsg) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName('System_Log');
    
    if (!logSheet) {
      logSheet = ss.insertSheet('System_Log');
      logSheet.getRange('A1:C1').setValues([['Timestamp', 'Tipo', 'Error']]);
      logSheet.getRange('A1:C1').setFontWeight('bold').setBackground('#fee2e2'); // Light red
      logSheet.setFrozenRows(1);
    }
    
    logSheet.appendRow([new Date(), type, errorMsg]);
  } catch (e) {
    Logger.log("Critical: Failed to log system error: " + e.toString());
  }
}

// ============================================
// CONSTANTES ORIGINALES
// ============================================

const SHEET_NAME_DB = "O2 y Energía"; 
const SHEET_NAME_VIEW = "Resumen_Diario"; 
const SHEET_NAME_O2 = "Historial_O2";
const SHEET_NAME_ENERGY = "Historial_Energia";

// ============================================
// VALIDACIÓN DE RANGOS (Data Integrity)
// ============================================

const FIELD_VALIDATION = {
  // O2 Fields (índices 0-8)
  0: {name: 'O2 Comp KW', min: 0, max: 500, unit: 'KW', critical: true},
  1: {name: 'O2 Comp M3', min: 0, max: 1000, unit: 'm³', critical: false},
  2: {name: 'O2 Comp HRS', min: 0, max: 24, unit: 'hrs', critical: false},
  3: {name: 'O2 HP1 KW', min: 0, max: 300, unit: 'KW', critical: true},
  4: {name: 'O2 HP1 M3', min: 0, max: 1000, unit: 'm³', critical: false},
  5: {name: 'O2 HP1 HRS', min: 0, max: 24, unit: 'hrs', critical: false},
  6: {name: 'O2 HP2 KW', min: 0, max: 300, unit: 'KW', critical: true},
  7: {name: 'O2 HP2 M3', min: 0, max: 1000, unit: 'm³', critical: false},
  8: {name: 'O2 HP2 HRS', min: 0, max: 24, unit: 'hrs', critical: false},
  
  // Energy Fields (índices 9-16)
  9: {name: 'Gen1 KW', min: 0, max: 1000, unit: 'KW', critical: true},
  10: {name: 'Gen1 HRS', min: 0, max: 24, unit: 'hrs', critical: false},
  11: {name: 'Gen2 KW', min: 0, max: 1000, unit: 'KW', critical: true},
  12: {name: 'Gen2 HRS', min: 0, max: 24, unit: 'hrs', critical: false},
  13: {name: 'RED V12', min: 200, max: 500, unit: 'V', critical: true},
  14: {name: 'RED KW', min: 0, max: 2000, unit: 'KW', critical: true},
  15: {name: 'Baterías V', min: 0, max: 100, unit: 'V', critical: true},
  16: {name: 'Grupo Emerg KW', min: 0, max: 500, unit: 'KW', critical: false}
};

function validateDataRanges(valores) {
  const warnings = [];
  const errors = [];
  
  Object.keys(FIELD_VALIDATION).forEach((index) => {
    const i = parseInt(index);
    const value = parseFloat(valores[i]);
    const field = FIELD_VALIDATION[i];
    
    // Skip si está vacío (campos opcionales)
    if (!value && value !== 0) return;
    
    // Validar si es número
    if (isNaN(value)) {
      warnings.push(`${field.name}: valor no numérico "${valores[i]}"`);
      return;
    }
    
    // Validar rango
    if (value < field.min || value > field.max) {
      const msg = `${field.name}: ${value}${field.unit} fuera de rango esperado (${field.min}-${field.max}${field.unit})`;
      
      if (field.critical) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  });
  
  return {errors, warnings, isValid: errors.length === 0};
}

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Database Sheet (Master)
  let sheetDB = ss.getSheetByName(SHEET_NAME_DB);
  if (!sheetDB) {
    sheetDB = ss.getSheetByName("Hoja 1") || ss.insertSheet(SHEET_NAME_DB);
    if (sheetDB) sheetDB.setName(SHEET_NAME_DB);
  }
    // Headers Master
  const headers = [
      "Timestamp", "Responsable", 
      "O2_Comp_KW", "O2_Comp_M3", "O2_Comp_HRS", 
      "O2_Gen1_HRS", "O2_Gen1_M3", "O2_Gen2_HRS", "O2_Gen2_M3", 
      "O2_Cons_Fry", "O2_Cons_Smolt", 
      "Red_V12", "Red_V23", "Red_V31", "Red_I1", "Red_I2", "Red_I3", 
      "Red_SumP_KW", "Red_EA_GW", 
      "D_Gen1_HRS", "D_Gen1_KW", 
      "D_Gen2_HRS", "D_Gen2_KW", 
      "D_Gen3_HRS", "D_Gen3_KW"
  ];
  
  if (sheetDB.getRange("A1").getValue() === "") {
    sheetDB.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheetDB.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#cfe2f3");
    sheetDB.setFrozenRows(1);
  }

  // 2. Setup History O2
  let sheetO2 = ss.getSheetByName(SHEET_NAME_O2);
  if (!sheetO2) {
      sheetO2 = ss.insertSheet(SHEET_NAME_O2);
  }
  
  // Check if empty and populate
  if (sheetO2.getRange("A1").getValue() === "") {
      const headersO2 = ["Timestamp", "Responsable", ...headers.slice(2, 11)]; // O2 Cols
      sheetO2.getRange(1, 1, 1, headersO2.length).setValues([headersO2]);
      sheetO2.getRange(1, 1, 1, headersO2.length).setFontWeight("bold").setBackground("#e6f7ff");
      sheetO2.setFrozenRows(1);
  }

  // 3. Setup History Energy
  let sheetEnergy = ss.getSheetByName(SHEET_NAME_ENERGY);
  if (!sheetEnergy) {
      sheetEnergy = ss.insertSheet(SHEET_NAME_ENERGY);
  }

  // Check if empty and populate
  if (sheetEnergy.getRange("A1").getValue() === "") {
      const headersEnergy = ["Timestamp", "Responsable", ...headers.slice(11)]; // Energy Cols
      sheetEnergy.getRange(1, 1, 1, headersEnergy.length).setValues([headersEnergy]);
      sheetEnergy.getRange(1, 1, 1, headersEnergy.length).setFontWeight("bold").setBackground("#fff7e6");
      sheetEnergy.setFrozenRows(1);
  }

  // 4. Setup Dashboard (View) Sheet
  let sheetView = ss.getSheetByName(SHEET_NAME_VIEW);
  if (!sheetView) {
    sheetView = ss.insertSheet(SHEET_NAME_VIEW);
  }
}

// --- API HANDLING ---

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_DB);
  
  // Standard JSON Return Helper
  const returnJSON = (data) => ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);

  if (!sheet) return returnJSON({result: "error", message: "Hoja de datos no encontrada"});
  if (!e.postData) return returnJSON({result: "error", message: "No data received"});

  const lock = LockService.getScriptLock();
  lock.tryLock(30000); // 30 seconds for robustness 

  try {
    const data = JSON.parse(e.postData.contents);
    
    // --- ENDPOINT: CAMBIAR PIN ---
    if (data.action === "changePin") {
      const result = changePIN(data.adminPassword, data.currentPin, data.newPin);
      return returnJSON(result);
    }
    
    // --- ENDPOINT: CAMBIAR PASSWORD ADMIN ---
    if (data.action === "changeAdminPassword") {
      const result = changeAdminPassword(data.currentPassword, data.newPassword);
      return returnJSON(result);
    }
    
    // --- VALIDACIÓN DE PIN CON RATE LIMITING ---
    if (data.modo !== "ADMIN") {
      // Usar responsable como identificador para rate limiting
      const userIdentifier = data.responsable || 'unknown';
      const pinCheck = validatePINWithRateLimit(data.authPin, userIdentifier);
      
      if (!pinCheck.valid) {
        // Log con device info si está disponible
        const deviceInfo = data.userAgent ? ` (${data.userAgent.substring(0, 50)})` : '';
        logSecurityEvent(
          pinCheck.locked ? "Intento bloqueado" : "PIN incorrecto", 
          userIdentifier + deviceInfo
        );
        
        return returnJSON({
          result: "error",
          message: pinCheck.message,
          locked: pinCheck.locked,
          attemptsLeft: pinCheck.attemptsLeft
        });
      }
    }
    
    // --- VALIDACIÓN DE RANGOS DE DATOS ---
    if (data.modo !== "ADMIN" && data.valores) {
      const validation = validateDataRanges(data.valores);
      
      // Si hay errores críticos, SOLO REGISTRAR pero PERMITIR (Solicitud Usuario)
      if (!validation.isValid) {
        logSecurityEvent(`Datos fuera de rango (${validation.errors.join(", ")})`, data.responsable);
        // NO BLOQUEAMOS, solo registramos.
        // return returnJSON({ ... }); <--- Disabled
      }
      
      // Si solo hay warnings, registrar pero permitir
      if (validation.warnings.length > 0) {
        logSecurityEvent(`Advertencias de rango (${validation.warnings.length})`, data.responsable);
      }
    }
    
    // --- ADMIN EDIT MODE ---
    if (data.modo === "ADMIN") {
      const ADMIN_PASSWORD = getAdminPassword();
      
      if (data.password === ADMIN_PASSWORD) {
        const ultimaFila = sheet.getLastRow();
        if (ultimaFila < 2) return returnJSON({result: "error", message: "No hay registros para editar"});
        
        // Update last row (excluding timestamp at col 1)
        const filaActualizada = [data.responsable, ...data.valores];
        sheet.getRange(ultimaFila, 2, 1, filaActualizada.length).setValues([filaActualizada]);
        
        logSecurityEvent("Registro editado (modo admin)", data.responsable);
        return returnJSON({result: "success", message: "Último registro corregido exitosamente"});
      } else {
        logSecurityEvent("Intento fallido modo admin (password incorrecta)", data.responsable || "Desconocido");
        return returnJSON({result: "error", message: "Contraseña de Admin incorrecta"});
      }
    }

    // --- NORMAL MODE ---
    // Use Device Timestamp if available (Critical for user trust), otherwise Server Time
    const timestamp = data.localTimestamp || new Date();
    
    // 1. Write to Master DB
    const nuevaFila = [timestamp, data.responsable, ...data.valores];
    sheet.appendRow(nuevaFila);
    
    // 2. Write to Historial O2 (First 9 values)
    const sheetO2 = ss.getSheetByName(SHEET_NAME_O2) || ss.insertSheet(SHEET_NAME_O2);
    // data.valores indexes 0-8 are O2
    const rowO2 = [timestamp, data.responsable, ...data.valores.slice(0, 9)];
    sheetO2.appendRow(rowO2);

    // 3. Write to Historial Energy (Remaining values)
    const sheetEnergy = ss.getSheetByName(SHEET_NAME_ENERGY) || ss.insertSheet(SHEET_NAME_ENERGY);
    // data.valores indexes 9 onwards are Energy
    const rowEnergy = [timestamp, data.responsable, ...data.valores.slice(9)];
    sheetEnergy.appendRow(rowEnergy);
    
    // Update Dashboard View
    updateDashboard(data);
    
    // Log successful submission
    logSecurityEvent("Datos registrados exitosamente", data.responsable);

    return returnJSON({result: "success", message: "Datos guardados en Historiales"});
    
  } catch (err) {
    logSystemError("CRASH", err.toString()); // Log critical failures
    return returnJSON({result: "error", message: "Error interno: " + err.toString()});
  } finally {
    lock.releaseLock();
  }
}

// Helper to update the Visual Dashboard Sheet
function updateDashboard(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetView = ss.getSheetByName(SHEET_NAME_VIEW);
    if (!sheetView) sheetView = ss.insertSheet(SHEET_NAME_VIEW);
    
    sheetView.clearContents();
    
    // Header
    sheetView.getRange("A1:C1").merge().setValue("ÚLTIMO REGISTRO ENERGÍA & O2")
      .setFontWeight("bold").setBackground("#1a73e8").setFontColor("white").setHorizontalAlignment("center");
      
    sheetView.getRange("A2").setValue("Fecha:");
    sheetView.getRange("B2").setValue(new Date());
    sheetView.getRange("A3").setValue("Responsable:");
    sheetView.getRange("B3").setValue(data.responsable);
    
    // Data Loop
    let row = 5;
    const labels = [
       "O2 Comp KW", "O2 Comp M3", "O2 Comp HRS", 
       "O2 Gen1 HRS", "O2 Gen1 M3",
       "O2 Gen2 HRS", "O2 Gen2 M3",
       "O2 Cons Fry", "O2 Cons Smolt",
       "Red V12", "Red V23", "Red V31",
       "Red I1", "Red I2", "Red I3",
       "Red SumP KW", "Red EA GW",
       "D Gen1 HRS", "D Gen1 KW",
       "D Gen2 HRS", "D Gen2 KW",
       "D Gen3 HRS", "D Gen3 KW"
    ];
    
    // Write labels and values
    // data.valores matches the order of labels
    for (let i = 0; i < labels.length; i++) {
      sheetView.getRange(row, 1).setValue(labels[i]).setFontWeight("bold");
      sheetView.getRange(row, 2).setValue(data.valores[i] || "-");
      row++;
    }
    
    // Formatting
    sheetView.getRange("A2:A" + (row-1)).setFontWeight("bold");
    sheetView.autoResizeColumns(1, 2);
    
  } catch(e) {
    console.error("Error updates dashboard: " + e.toString());
  }
}

// Ping for Network Check OR Get Latest Data
// Ping for Network Check OR Get Latest Data
function doGet(e) {
  // If action=latest, return the last submission data
  if (e.parameter && e.parameter.action === "latest") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetDB = ss.getSheetByName(SHEET_NAME_DB);
    let result = {};

    if (sheetDB && sheetDB.getLastRow() >= 2) {
      const lastRow = sheetDB.getLastRow();
      
      // Get timestamp EXACTLY as it appears visually in Google Sheets
      const timestampStr = sheetDB.getRange(lastRow, 1).getDisplayValue();
      
      // Get rest of data normally
      const dataVals = sheetDB.getRange(lastRow, 2, 1, 24).getValues()[0];
      const responsable = dataVals[0];
      const rawValues = dataVals.slice(1); // The rest of the values

      // Reconstruct labels for Valid Response
      const labels = [
       "O2 Comp KW", "O2 Comp M3", "O2 Comp HRS", 
       "O2 Gen1 HRS", "O2 Gen1 M3",
       "O2 Gen2 HRS", "O2 Gen2 M3",
       "O2 Cons Fry", "O2 Cons Smolt",
       "Red V12", "Red V23", "Red V31",
       "Red I1", "Red I2", "Red I3",
       "Red SumP KW", "Red EA GW",
       "D Gen1 HRS", "D Gen1 KW",
       "D Gen2 HRS", "D Gen2 KW",
       "D Gen3 HRS", "D Gen3 KW"
      ];
      
      // Zip labels with values
      const zippedData = labels.map((label, index) => [label, rawValues[index] || "-"]);

      result = {
        timestamp: timestampStr, // Exactly as shown in Sheets
        responsable: responsable,
        data: zippedData
      };
      
    } else {
        result = { error: true, message: "No Data Found" };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  // Default Ping
  return ContentService.createTextOutput(JSON.stringify({status: "online"})).setMimeType(ContentService.MimeType.JSON);
}

// --- MANUAL INIT FUNCTION ---
// Run this ONCE from the GAS Editor to populate the dashboard with the last known data
function manualInitDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDB = ss.getSheetByName(SHEET_NAME_DB);
  
  if (!sheetDB || sheetDB.getLastRow() < 2) {
    Logger.log("No data found in DB to initialize.");
    return;
  }
  
  const lastRow = sheetDB.getLastRow();
  // Col 1=Time, Col 2=Resp, Col 3...=Values
  const responsable = sheetDB.getRange(lastRow, 2).getValue();
  // We have 24 value columns defined in headers
  const valores = sheetDB.getRange(lastRow, 3, 1, 24).getValues()[0];
  
  const data = {
    responsable: responsable,
    valores: valores
  };
  
  updateDashboard(data);
  Logger.log("Dashboard manually initialized with data from Row " + lastRow);
}
