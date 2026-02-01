# 🔐 Configuración Inicial del Sistema de Seguridad

## ⚠️ IMPORTANTE: Ejecutar Esta Función UNA VEZ

Después de desplegar el nuevo código de `backend.gs` en Google Apps Script, debes ejecutar la siguiente función **UNA SOLA VEZ** para inicializar los valores de seguridad.

## 📝 Pasos de Configuración

### 1. Abrir Google Apps Script Editor

1. Ve a tu Google Sheet
2. Click en **Extensiones** > **Apps Script**
3. Verás el código de `backend.gs`

### 2. Agregar Función de Setup (Ya está en el código)

El código ya incluye todas las funciones necesarias. Solo necesitas ejecutarlas.

### 3. Ejecutar Setup Inicial

En el editor de Apps Script:

1. Busca la función `getStoredPINHash()` o `getAdminPassword()` en el código
2. Click en el menú **Ejecutar** (▶️)
3. Selecciona cualquier función (automáticamente se crearán los valores por defecto)

**O mejor aún**, abre el Editor y en la línea siguiente de código, ejecuta esto:

```javascript
// Función para setup manual (añadir temporalmente)
function setupManual() {
  const props = PropertiesService.getScriptProperties();
  
  // PIN por defecto: 1234
  const defaultPinHash = hashPIN("1234");
  props.setProperty('PIN_HASH', defaultPinHash);
  
  // Password admin por defecto
  props.setProperty('ADMIN_PASSWORD', 'mantencioncermaq');
  
  Logger.log("✅ Setup completado:");
  Logger.log("PIN por defecto: 1234");
  Logger.log("Password Admin: mantencioncermaq");
  Logger.log("⚠️ CAMBIAR ESTOS VALORES DESDE LA APP");
}
```

### 4. Ejecutar la Función

1. Copia la función `setupManual()` arriba
2. Pégala al final de `backend.gs`
3. Selecciona `setupManual` en el menú desplegable de funciones
4. Click en **Ejecutar** (▶️)
5. Autoriza el script si es la primera vez
6. Revisa los logs: Click en **Ver** > **Logs** para confirmar

### 5. Verificar Configuración

Verás en los logs:

```
✅ Setup completado:
PIN por defecto: 1234
Password Admin: mantencioncermaq
⚠️ CAMBIAR ESTOS VALORES DESDE LA APP
```

---

## 🎯 Valores Por Defecto Iniciales

| Credencial | Valor Por Defecto | Dónde se Almacena |
|------------|------------------|-------------------|
| **PIN de Operadores** | `1234` | PropertiesService (hasheado) |
| **Password Administrador** | `mantencioncermaq` | PropertiesService (texto plano*) |

> *Nota: El password admin se guarda en texto plano en PropertiesService porque solo está accesible desde el script backend. El PIN se hashea para mayor seguridad.

---

## 🔄 Cambiar Credenciales Desde la PWA

Una vez configurado, **NO necesitas volver a Apps Script**. Todo se gestiona desde la app:

### Cambiar PIN (Solo Admin)

1. Abre la PWA en el navegador
2. Click en el icono de **llave** 🔑 (junto al engranaje)
3. Ingresa:
   - Password Admin: `mantencioncermaq`
   - PIN Actual: `1234`
   - Nuevo PIN: `5678` (ejemplo)
   - Confirmar: `5678`
4. Click **Cambiar PIN**
5. ✅ Comunica el nuevo PIN a los 8 operadores

### Usar el Sistema

**Operadores** (envío normal de datos):
- Llenan formulario normalmente
- Click "Confirmar y Enviar"
- Ingresan su nombre y PIN (ej: `5678`)
- ✅ Datos guardados

**Administrador** (editar último registro):
- Click en engranaje ⚙️
- Ingresa password admin
- Edita datos
- PIN no requerido en modo admin

---

## 🔒 Seguridad Implementada

### ✅ Lo que SÍ está seguro:

- **PIN hasheado con SHA-256** + salt en PropertiesService
- **Password Admin** en PropertiesService (no en código)
- **Frontend** (GitHub) NO contiene secretos
- **Sheets** NO contiene credenciales
- **Log de eventos** en hoja Security_Log

### ✅ Protección contra Caso "Lerma":

```
Antes:
❌ Cualquiera podía enviar datos sin validación

Ahora:
✅ Sin PIN correcto = Envío rechazado
✅ Intentos fallidos se registran en Security_Log
✅ Backend valida hash antes de aceptar datos
```

---

## 📊 Verificar que Funciona

### Test 1: Envío con PIN Correcto

1. Llena formulario
2. Ingresa nombre + PIN `1234`
3. ✅ Debe guardar exitosamente

### Test 2: Envío con PIN Incorrecto

1. Llena formulario
2. Ingresa nombre + PIN `0000` (incorrecto)
3. ❌ Debe rechazar con mensaje "PIN de autorización incorrecto"

### Test 3: Cambiar PIN

1. Click en 🔑
2. Usa password admin + PIN actual
3. Define nuevo PIN
4. ✅ Debe cambiar y confirmar

### Test 4: Usar Nuevo PIN

1. Llena formulario
2. Usa el NUEVO PIN
3. ✅ Debe funcionar

---

## 🛠️ Solución de Problemas

### "PIN incorrecto" con PIN correcto

**Causa**: PropertiesService no inicializado

**Solución**:
1. Ve a Apps Script Editor
2. Ejecuta `setupManual()` de nuevo
3. O ejecuta cualquier función que llame a `getStoredPINHash()`

### "Error interno" al cambiar PIN

**Causa**: Password admin incorrecto o función no desplegada

**Solución**:
1. Verifica que desplegaste el nuevo código en Apps Script
2. Click **Implementar** > **Nueva implementación**
3. Asegúrate de que sea "Aplicación web"

### No aparece icono de llave 🔑

**Causa**: HTML no actualizado

**Solución**:
1. Haz hard refresh: `Ctrl + Shift + R` (Windows) o `Cmd + Shift + R` (Mac)
2. Verifica que `index.html` tenga el segundo ícono

---

## 📝 Checklist Final

Antes de entregar a producción:

- [ ] Ejecuté `setupManual()` en Apps Script
- [ ] Verifiqué que PIN por defecto es `1234`
- [ ] Probé envío con PIN correcto (funciona ✅)
- [ ] Probé envío con PIN incorrecto (rechaza ❌)
- [ ] Cambié el PIN desde la app
- [ ] Probé con el nuevo PIN (funciona ✅)
- [ ] Revisé hoja **Security_Log** (tiene registros)
- [ ] Comuniqué PIN actual a los 8 operadores
- [ ] Guardé password admin en lugar seguro

---

## 🎯 Resumen Rápido

```
1. Copiar función setupManual() al final de backend.gs
2. Ejecutar setupManual() una vez desde Apps Script
3. Desplegar nueva versión (Implementar > Nueva implementación)
4. Abrir PWA y probar PIN por defecto (1234)
5. ¿Funciona? → Cambiar PIN desde la app
6. Comunicar nuevo PIN a operadores
7. ¡Listo! 🎉
```

---

**¿Necesitas ayuda?**

Si algo no funciona:
1. Revisa logs en Apps Script (Ver > Logs)
2. Revisa consola del navegador (F12)
3. Verifica hoja Security_Log para intentos fallidos
