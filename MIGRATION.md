# Guía de Migración de Proyecto

Esta guía detalla los pasos para migrar el proyecto a la nueva cuenta de GitHub y configurar el backend en la nueva cuenta de Google.

## 1. Migración de GitHub

El repositorio remoto ya ha sido actualizado a `https://github.com/cermaqsj/reg`.
Sin embargo, el intento de subida automática falló porque las credenciales actuales (`cracklabchile`) no tienen permiso en el nuevo repositorio.

**Acción Requerida:**
Abra una terminal en la carpeta del proyecto y ejecute:

```powershell
git push -u origin main
```

Si se le solicitan credenciales, ingrese el **Nombre de Usuario** y el **Token de Acceso Personal (PAT)** o la contraseña de la nueva cuenta `cermaqsj`.

---

## 2. Migración del Backend (Google Sheets + Apps Script)

El backend debe ser recreado manualmente en la nueva cuenta de Google.

### Paso 2.1: Crear la Hoja de Cálculo
1. Inicie sesión en la **Nueva Cuenta de Google**.
2. Vaya a [Google Sheets](https://docs.google.com/spreadsheets).
3. Cree una nueva hoja de cálculo en blanco.
4. Póngale un nombre, ej: `Registro O2 y Energía`.

### Paso 2.2: Configurar el Script
1. En la hoja de cálculo, vaya al menú **Extensiones** > **Apps Script**.
2. Se abrirá el editor. Borre todo el código que aparece en el archivo `Código.gs` (o `Code.gs`).
3. Copie y pegue **todo** el contenido del archivo `backend.gs` de este proyecto (se encuentra en `c:\Users\Mac\Documents\PROYECTO2\backend.gs`).
4. (Opcional) Renombre el proyecto arriba a la izquierda a `Backend Registro`.
5. Guarde el proyecto (Icono de disquete o `Ctrl + S`).

### Paso 2.3: Inicializar la Base de Datos
1. En el editor de Apps Script, asegúrese de que la función seleccionada en la barra de herramientas sea `setupSpreadsheet`.
2. Haga clic en **Ejecutar**.
3. Google le pedirá permisos. Revise y acepte (Configuración avanzada > Ir a ... (inseguro) > Permitir).
4. Vuelva a la Hoja de Cálculo. Verá que se han creado las hojas: `O2 y Energía`, `Historial_O2`, `Historial_Energia`, y `Resumen_Diario`.

### Paso 2.4: Desplegar como Aplicación Web
1. En el editor de Apps Script, haga clic en el botón azul **Implementar** (o Deploy) > **Nueva implementación**.
2. En "Seleccionar tipo", elija la rueda dentada > **Aplicación web**.
3. Configure lo siguiente:
   - **Descripción**: `Versión 1`
   - **Ejecutar como**: `Yo` (su correo)
   - **Quién tiene acceso**: **Cualquier persona** (o Anyone). *Esto es vital para que la app funcione sin pedir login a los usuarios.*
4. Haga clic en **Implementar**.
5. Copie la **URL de la aplicación web** (termina en `/exec`).

---

## 3. Actualizar el Frontend

Una vez tenga la **Nueva URL** del paso anterior, debe actualizarla en dos archivos del proyecto:

1.  **Archivo `app.js`** (Línea 2):
    ```javascript
    const API_URL = "https://script.google.com/macros/s/SU_NUEVA_URL_AQUI/exec";
    ```

2.  **Archivo `monitor.html`** (Línea 266):
    ```javascript
    const API_URL = "https://script.google.com/macros/s/SU_NUEVA_URL_AQUI/exec";
    ```

3.  Guarde los cambios y haga un nuevo commit/push a GitHub:
    ```powershell
    git add app.js monitor.html
    git commit -m "Update API URL for new account"
    git push
    ```

¡Listo! La migración estará completa.
