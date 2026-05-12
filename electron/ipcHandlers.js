// electron/ipcHandlers.js
const { ipcMain, BrowserWindow, dialog, screen, session, app } = require('electron');
const path = require('path');
const {
  listDisplays,
  openOnDisplayProgrammatic,
  closeProjectionProgrammatic,
  closeAllProjectionsProgrammatic,
  getEnvironmentInfo
} = require('../utils/displayManager');
const { readSources, writeSources } = require('../utils/fileManager');


// Configuración para Wayland
const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' ||
process.env.WAYLAND_DISPLAY ||
process.env.ELECTRON_OZONE_PLATFORM_HINT === 'wayland';

// Forzar Wayland si es necesario
if (isWayland) {
  console.log('🚀 Detectado Wayland, configurando entorno...');
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations,WebRTCPipeWireCapturer');
}

// Configuración de uBlock Origin
const UBLOCK_PATH = path.join(__dirname, '../extensions/ublock-origin');

// Nuevo handler para información del entorno
ipcMain.handle('get-environment-info', () => {
  return getEnvironmentInfo();
});

// Broadcast function (compatibilidad)
function broadcast(data) {
  console.log('Broadcast IPC:', data);
}

// Cargar uBlock Origin en todas las sesiones
async function setupUblockOrigin() {
  try {
    if (require('fs').existsSync(UBLOCK_PATH)) {
      await session.defaultSession.loadExtension(UBLOCK_PATH);
      console.log('✅ uBlock Origin cargado correctamente');
    } else {
      console.warn('⚠️ uBlock Origin no encontrado en:', UBLOCK_PATH);
    }
  } catch (error) {
    console.error('❌ Error cargando uBlock Origin:', error);
  }
}

// Inicializar extensiones al cargar el módulo
//setupUblockOrigin();

// Handlers IPC mejorados
ipcMain.handle('get-displays', async () => {
  try {
    return await listDisplays();
  } catch (error) {
    console.error('Error en get-displays:', error);
    throw error;
  }
});

ipcMain.handle('get-sources', () => {
  try {
    return readSources();
  } catch (error) {
    console.error('Error en get-sources:', error);
    throw error;
  }
});

ipcMain.handle('add-source', (e, src) => {
  try {
    const list = readSources();
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const newS = {
      id,
      name: src.name || `Fuente ${list.length + 1}`,
      url: src.url || '',
      createdAt: new Date().toISOString()
    };
    list.push(newS);
    writeSources(list);
    broadcast({ type: 'sources-changed' });
    return newS;
  } catch (error) {
    console.error('Error en add-source:', error);
    throw error;
  }
});

ipcMain.handle('update-source', (e, updated) => {
  try {
    const list = readSources();
    const idx = list.findIndex(s => s.id === updated.id);
    if (idx === -1) throw new Error('Fuente no encontrada');

    list[idx] = {
      ...list[idx],
      ...updated,
      updatedAt: new Date().toISOString()
    };

    writeSources(list);
    broadcast({ type: 'sources-changed' });
    return list[idx];
  } catch (error) {
    console.error('Error en update-source:', error);
    throw error;
  }
});

ipcMain.handle('remove-source', (e, id) => {
  try {
    let list = readSources();
    const source = list.find(s => s.id === id);
    list = list.filter(s => s.id !== id);
    writeSources(list);
    broadcast({ type: 'sources-changed' });
    return { removed: true, source };
  } catch (error) {
    console.error('Error en remove-source:', error);
    throw error;
  }
});
/*
ipcMain.handle('open-on-display', async (event, displayId, url) => {
  try {
    return await openOnDisplayProgrammatic(displayId, url);
  } catch (error) {
    console.error('Error en open-on-display:', error);
    throw error;
  }
});
*/
// Handler mejorado para abrir en display
ipcMain.handle('open-on-display', async (event, displayId, url) => {
  try {
    console.log(`🎯 Solicitado abrir en pantalla ${displayId} en ${isWayland ? 'Wayland' : 'X11'}`);

    const result = await openOnDisplayProgrammatic(displayId, url);

    // Debug info
    const displays = await listDisplays();
    console.log('📊 Pantallas disponibles:', displays);
    console.log('🎯 Resultado apertura:', result);

    return result;
  } catch (error) {
    console.error('Error en open-on-display:', error);

    // Mostrar diálogo informativo para Wayland
    if (isWayland) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Información Wayland',
        message: 'En Wayland, la gestión de múltiples pantallas puede tener limitaciones.',
        detail: 'Si la ventana no aparece en la pantalla correcta, prueba a: \n1. Mover la ventana manualmente\n2. Verificar los permisos del compositor\n3. Usar X11 si es posible'
      });
    }

    throw error;
  }
});

console.log(`✅ Handlers IPC configurados para ${isWayland ? 'Wayland' : 'X11'}`);

ipcMain.handle('close-projection-on', (event, displayId) => {
  try {
    return closeProjectionProgrammatic(displayId);
  } catch (error) {
    console.error('Error en close-projection-on:', error);
    throw error;
  }
});

ipcMain.handle('close-all-projections', () => {
  try {
    closeAllProjectionsProgrammatic();
    return { ok: true };
  } catch (error) {
    console.error('Error en close-all-projections:', error);
    throw error;
  }
});

ipcMain.handle('preview-url', async (e, url) => {
  let previewWindow = null;

  try {
    previewWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      show: false,
      title: `Vista previa: ${url}`,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true
      }
    });

    // Cargar uBlock Origin también en ventanas de preview
    await previewWindow.webContents.session.loadExtension(UBLOCK_PATH);

    previewWindow.on('closed', () => {
      previewWindow = null;
    });

    previewWindow.once('ready-to-show', () => {
      previewWindow.show();
    });

    await previewWindow.loadURL(url);
    return { opened: true, success: true };

  } catch (error) {
    console.error('Error en preview-url:', error);
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.close();
    }

    // Mostrar diálogo de error
    dialog.showErrorBox('Error de vista previa', `No se pudo cargar la URL: ${url}\n\nError: ${error.message}`);

    return { opened: false, success: false, error: error.message };
  }
});

// Nuevo handler para gestionar uBlock Origin
ipcMain.handle('toggle-adblock', async (event, enabled) => {
  try {
    if (enabled) {
      await session.defaultSession.loadExtension(UBLOCK_PATH);
    } else {
      // Nota: Esto requiere manejar el ID de la extensión
      // session.defaultSession.removeExtension(extensionId);
    }
    return { success: true, enabled };
  } catch (error) {
    console.error('Error toggle-adblock:', error);
    throw error;
  }
});

console.log('✅ Handlers IPC configurados con uBlock Origin');

module.exports = { ipcMain, setupUblockOrigin };
