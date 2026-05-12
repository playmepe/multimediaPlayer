// utils/displayManager.js
const { BrowserWindow, screen } = require('electron');
const si = require('systeminformation');

const displayWindows = new Map();
const winMeta = new WeakMap();
// utils/displayManager.js - MODIFICA getDisplayName y listDisplays
function getDisplayName(display) {
  if (!display) return 'Desconocido';

  // INTELIGENCIA MEJORADA para detectar pantalla interna
  const esProbablementeInterna =
  display.internal === true ||
  (display.bounds.x === 0 && display.bounds.y === 0) ||
  (display.size.width >= 3840); // Muchas laptops tienen alta resolución

  if (esProbablementeInterna) return 'Pantalla Interna (Laptop/Principal)';

  const size = `${display.size.width}x${display.size.height}`;
  const position = `[${display.bounds.x},${display.bounds.y}]`;
  return `Monitor Externo ${size} ${position}`;
}

async function listDisplays() {
  try {
    const graphics = await si.graphics();
    const displays = screen.getAllDisplays();

    return displays.map((d, index) => {
      const displayInfo = graphics.displays?.[index] || {};

      // DETECCIÓN MEJORADA de pantalla interna
      const esInternaReal =
      d.internal === true ||
      (d.bounds.x === 0 && d.bounds.y === 0 && displays.length > 1) || // Principal con múltiples pantallas
      (displayInfo.vendor && displayInfo.vendor.includes('Intel')) || // Gráficos Intel suelen ser internos
      (displayInfo.model && displayInfo.model.includes('Built-in'));

      return {
        id: d.id,
        bounds: d.bounds,
        size: { width: d.size.width, height: d.size.height },
        scaleFactor: d.scaleFactor,
        rotation: d.rotation,
        internal: esInternaReal, // ← Usar nuestra detección mejorada
        name: getDisplayName(d),
                        vendor: displayInfo.vendor || 'Unknown',
                        model: displayInfo.model || 'Unknown',
                        resolution: `${d.size.width}x${d.size.height}`,
                        frequency: d.displayFrequency || displayInfo.currentRefreshRate || 60,
                        position: `[${d.bounds.x},${d.bounds.y}]`,
                        isPrimary: d.bounds.x === 0 && d.bounds.y === 0,
                        isExternal: !esInternaReal // ← Nueva propiedad
      };
    });
  } catch (error) {
    console.error('Error:', error);
    const displays = screen.getAllDisplays();
    return displays.map(d => ({
      id: d.id,
      bounds: d.bounds,
      internal: d.bounds.x === 0 && d.bounds.y === 0, // Simple pero funcional
      isExternal: d.bounds.x !== 0 || d.bounds.y !== 0
    }));
  }
}
/*
// utils/displayManager.js
async function abrirEnSegundaPantalla(url) {
  const pantallas = screen.getAllDisplays();

  console.log('🤖 DETECCIÓN AUTOMÁTICA DE PANTALLAS');

  // Ordenar pantallas por posición X
  const pantallasOrdenadas = [...pantallas].sort((a, b) => a.bounds.x - b.bounds.x);

  pantallasOrdenadas.forEach((p, i) => {
    console.log(`  ${i}: ID=${p.id} en [${p.bounds.x},${p.bounds.y}]`);
  });

  // REGLA: Si hay más de una pantalla, usar la SEGUNDA (índice 1)
  // Esto asume que la primera [0,0] es la interna
  let pantallaObjetivo;

  if (pantallasOrdenadas.length > 1) {
    pantallaObjetivo = pantallasOrdenadas[1]; // Segunda pantalla
    console.log(`✅ Múltiples pantallas detectadas. Usando la segunda: ID=${pantallaObjetivo.id}`);
  } else {
    pantallaObjetivo = pantallasOrdenadas[0];
    console.log('⚠️ Solo una pantalla disponible');
  }

  return openOnDisplayProgrammatic(pantallaObjetivo.id, url);
}

// utils/displayManager.js - AÑADIR esta función
async function abrirEnPantalla1(url) {
    const pantallas = screen.getAllDisplays();

    console.log('🔍 ANALIZANDO PANTALLAS:');
    pantallas.forEach((p, i) => {
      console.log(`  Pantalla ${i}: ID=${p.id}, Posición=[${p.bounds.x},${p.bounds.y}], Interna=${p.internal}`);
    });

    // METODO SEGURO: Siempre usar la pantalla en posición [1920,0] (la de la derecha)
    let pantallaExterna = pantallas.find(p => p.bounds.x === 1920 && p.bounds.y === 0);

    if (pantallaExterna) {
      console.log('✅ ENCONTRADA pantalla externa en posición [1920,0]:', {
        id: pantallaExterna.id,
        tamaño: `${pantallaExterna.bounds.width}x${pantallaExterna.bounds.height}`
      });
    } else {
      // Si no hay en [1920,0], buscar la que NO está en [0,0]
      console.log('⚠️ No hay pantalla en [1920,0], buscando alternativas...');
      pantallaExterna = pantallas.find(p => p.bounds.x !== 0 || p.bounds.y !== 0);

      if (!pantallaExterna) {
        // Si solo hay una pantalla, usar esa
        pantallaExterna = pantallas[0];
        console.log('⚠️ Solo hay una pantalla disponible, usando esa');
      }
    }

    return openOnDisplayProgrammatic(pantallaExterna.id, url);
  }

  // SOLUCIÓN DEFINITIVA - Siempre en pantalla derecha/externa
  async function abrirEnPantallaExterna(url) {
    const pantallas = screen.getAllDisplays();

    console.log('🎯 BUSCANDO PANTALLA EXTERNA...');

    // CASO 1: Si hay pantalla en [1920,0] (derecha) → ESA ES LA EXTERNA
    let pantallaExterna = pantallas.find(p => p.bounds.x > 0);

    // CASO 2: Si no, buscar la que NO sea [0,0]
    if (!pantallaExterna) {
      pantallaExterna = pantallas.find(p => p.bounds.x !== 0 || p.bounds.y !== 0);
    }

    // CASO 3: Si solo hay una pantalla
    if (!pantallaExterna) {
      console.log('⚠️ Solo se detectó una pantalla');
      pantallaExterna = pantallas[0];
    }

    console.log('✅ Seleccionada pantalla EXTERNA:', {
      id: pantallaExterna.id,
      posición: `[${pantallaExterna.bounds.x},${pantallaExterna.bounds.y}]`,
      esDerecha: pantallaExterna.bounds.x > 0
    });

    return openOnDisplayProgrammatic(pantallaExterna.id, url);
  }*/

async function openOnDisplayProgrammatic(displayId, url) {
  const d = screen.getAllDisplays().find(x => x.id === displayId);
  if (!d) throw new Error('Display not found');

  if (displayWindows.has(displayId)) {
    const existing = displayWindows.get(displayId);
    if (existing && !existing.isDestroyed()) {
      console.log('Closing existing window for display', displayId);
      existing.close();
    }
  }

  const win = new BrowserWindow({
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
    frame: false,
    fullscreen: true,
    webPreferences: { contextIsolation: true }
  });

  winMeta.set(win, { displayId, bounds: d.bounds });
  displayWindows.set(displayId, win);

  win.on('closed', () => {
    const cur = displayWindows.get(displayId);
    if (cur === win) displayWindows.delete(displayId);
    winMeta.delete(win);
  });

  try {
    await win.loadURL(url);
    console.log('Opened projection', { displayId, url });
    return { success: true };
  } catch (err) {
    if (!win.isDestroyed()) win.close();
    const cur = displayWindows.get(displayId);
    if (cur === win) displayWindows.delete(displayId);
    winMeta.delete(win);
    throw err;
  }
}

function closeProjectionProgrammatic(displayId) {
  const w = displayWindows.get(displayId);
  if (w && !w.isDestroyed()) {
    const meta = winMeta.get(w);
    if (meta && meta.displayId === displayId) {
      console.log('Closing window on display', displayId);
      w.close();
      return { closed: true };
    }
  }
  return { closed: false };
}

function closeAllProjectionsProgrammatic() {
  for (const [id, w] of Array.from(displayWindows.entries())) {
    if (w && !w.isDestroyed()) {
      const meta = winMeta.get(w);
      console.log('Closing (all) window on', id, 'meta', meta);
      w.close();
    }
  }
}

module.exports = {
  listDisplays,
  openOnDisplayProgrammatic,
  closeProjectionProgrammatic,
  closeAllProjectionsProgrammatic
};
