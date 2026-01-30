const PASSWORD_ADMIN = "mantencioncermaq";
const SHEET_NAME_DB = "O2 y Energía"; 
const SHEET_NAME_VIEW = "Resumen_Diario"; 
const SHEET_NAME_O2 = "Historial_O2";
const SHEET_NAME_ENERGY = "Historial_Energia";

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
  lock.tryLock(10000); 

  try {
    const data = JSON.parse(e.postData.contents);
    
    // --- ADMIN EDIT MODE ---
    if (data.modo === "ADMIN") {
      if (data.password === PASSWORD_ADMIN) {
        const ultimaFila = sheet.getLastRow();
        if (ultimaFila < 2) return returnJSON({result: "error", message: "No hay registros para editar"});
        
        // Update last row (excluding timestamp at col 1)
        const filaActualizada = [data.responsable, ...data.valores];
        sheet.getRange(ultimaFila, 2, 1, filaActualizada.length).setValues([filaActualizada]);
        
        return returnJSON({result: "success", message: "Último registro corregido exitosamente"});
      } else {
        return returnJSON({result: "error", message: "Contraseña de Admin incorrecta"});
      }
    }

    // --- NORMAL MODE ---
    // Get timestamp in Chile timezone (GMT-3)
    const timestamp = new Date();
    const chileTime = Utilities.formatDate(timestamp, "America/Santiago", "yyyy-MM-dd HH:mm:ss");
    const chileTimestamp = new Date(chileTime);
    
    // 1. Write to Master DB
    const nuevaFila = [chileTimestamp, data.responsable, ...data.valores];
    sheet.appendRow(nuevaFila);
    
    // 2. Write to Historial O2 (First 9 values)
    const sheetO2 = ss.getSheetByName(SHEET_NAME_O2) || ss.insertSheet(SHEET_NAME_O2);
    // data.valores indexes 0-8 are O2
    const rowO2 = [chileTimestamp, data.responsable, ...data.valores.slice(0, 9)];
    sheetO2.appendRow(rowO2);

    // 3. Write to Historial Energy (Remaining values)
    const sheetEnergy = ss.getSheetByName(SHEET_NAME_ENERGY) || ss.insertSheet(SHEET_NAME_ENERGY);
    // data.valores indexes 9 onwards are Energy
    const rowEnergy = [chileTimestamp, data.responsable, ...data.valores.slice(9)];
    sheetEnergy.appendRow(rowEnergy);
    
    // Update Dashboard View
    updateDashboard(data);

    return returnJSON({result: "success", message: "Datos guardados en Historiales"});
    
  } catch (err) {
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
      
      // Get all values from the last row (25 columns based on headers)
      const dataVals = sheetDB.getRange(lastRow, 1, 1, 25).getValues()[0];
      
      // Extract Data
      const timestamp = dataVals[0];
      const responsable = dataVals[1];
      const rawValues = dataVals.slice(2); // The rest of the values

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
        timestamp: timestamp,
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
