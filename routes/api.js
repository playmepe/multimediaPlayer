// routes/api.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { PATHS, DATA_FILES } = require('../config/constants');
const constants = require('../config/constants');
const { readSources, writeSources, cargarCancion, appendToFile, readFileContent } = require('../utils/fileManager');
const { listDisplays, openOnDisplayProgrammatic, closeProjectionProgrammatic, closeAllProjectionsProgrammatic } = require('../utils/displayManager');
const { generateMediaJson, generateMenuJson, generateTotalMediaJson, updateImagesInfo } = require('../utils/mediaProcessor');

// Broadcast function (placeholder - se implementará en WebSocket)
function broadcast(data) {
  console.log('Broadcast:', data);
  // Se implementará en el módulo de WebSocket
}

// --- RUTAS DE DISPLAYS ---
router.get('/displays', async (req, res) => {
  try {
    const displays = await listDisplays();
    res.json(displays);
  } catch (error) {
    console.error('Error en /api/displays:', error);
    res.status(500).json({ error: 'Error obteniendo displays' });
  }
});

// --- RUTAS DE SOURCES ---
router.get('/sources', (req, res) => res.json(readSources()));

router.post('/sources', (req, res) => {
  const body = req.body || {};
  const list = readSources();
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const newS = { id, name: body.name || `Fuente ${list.length + 1}`, url: body.url || '' };
  list.push(newS);
  writeSources(list);
  broadcast({ type: 'sources-changed' });
  res.status(201).json(newS);
});

router.put('/sources/:id', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const list = readSources();
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  list[idx] = { id, name: body.name || list[idx].name, url: body.url || list[idx].url };
  writeSources(list);
  broadcast({ type: 'sources-changed' });
  res.json(list[idx]);
});

router.delete('/sources/:id', (req, res) => {
  const id = Number(req.params.id);
  let list = readSources();
  list = list.filter(s => s.id !== id);
  writeSources(list);
  broadcast({ type: 'sources-changed' });
  res.json({ removed: true });
});

// --- RUTAS DE PROYECCIÓN ---
router.post('/open', async (req, res) => {
  const { displayId, url } = req.body || {};
  if (typeof displayId === 'undefined' || !url) return res.status(400).json({ error: 'displayId and url required' });
  try {
    await openOnDisplayProgrammatic(displayId, url);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/close', (req, res) => {
  const { displayId } = req.body || {};
  if (typeof displayId === 'undefined') return res.status(400).json({ error: 'displayId required' });
  const r = closeProjectionProgrammatic(displayId);
  res.json(r);
});

router.post('/close-all', (req, res) => {
  closeAllProjectionsProgrammatic();
  res.json({ ok: true });
});

// --- RUTAS DE MULTIMEDIA ---
router.delete('/videos/*', (req, res) => {
  const relativePath = req.params[0];
  const filePath = path.join(PATHS.VIDEOS_DIR, relativePath);
  console.log('se eliminó el archivo:', filePath);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('El archivo no existe:', err.message);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error al eliminar el archivo:', err.message);
        return res.status(500).json({ message: 'Error al eliminar el archivo' });
      }
      res.json({ message: 'Archivo eliminado correctamente' });
    });
  });
});

router.get('/download-m3u', (req, res) => {
  const playlist = JSON.parse(req.query.playlist || '[]');
  if (playlist.length === 0) {
    return res.status(400).send('La lista de reproducción está vacía.');
  }

  let m3uContent = '#EXTM3U\n';
  const baseUrl = 'http://localhost:4000';

  playlist.forEach(video => {
    m3uContent += `#EXTINF:-1, ${video.title || video.src.split('/').pop()}\n`;
    m3uContent += `${baseUrl}${video.src}\n`;
  });

  const filePath = path.join(__dirname, '..', 'playlist.m3u');
  fs.writeFileSync(filePath, m3uContent);

  res.download(filePath, 'playlist.m3u', (err) => {
    if (err) {
      console.error('Error al descargar el archivo:', err);
      res.status(500).send('Error al generar el archivo.');
    }
  });
});

// --- RUTAS DE CANCIONES ---
router.get('/canciones', (req, res) => {
  const cancionesDir = path.join(PATHS.DATA_DIR, 'canciones');

  fs.readdir(cancionesDir, (err, files) => {
    if (err) {
      console.error('Error leyendo directorio:', err);
      return res.status(500).json({
        error: 'No se pudo leer el directorio',
        details: err.message
      });
    }

    const jsonFiles = files.filter(file =>
      file.endsWith('.json') || file.endsWith('.csv')
    );
    res.json(jsonFiles);
  });
});

router.get('/canciones/:nombre', (req, res) => {
  const filePath = path.join(PATHS.DATA_DIR, 'canciones', req.params.nombre);
  cargarCancion(filePath)
    .then(letras => res.json({ letras }))
    .catch(err => res.status(500).send(err));
});

// --- RUTAS DE GENERACIÓN DE MEDIA ---
router.get('/generate-media', async (req, res) => {
  try {
    const allItems = [];
    await generateMediaJson(PATHS.VIDEOS_DIR, allItems);
    await generateMenuJson();
    await generateTotalMediaJson(allItems);
    await updateImagesInfo();
    console.log('Proceso completado.');
    res.send('JSON y menú generados exitosamente.');
  } catch (err) {
    console.error('Error en la generación del JSON:', err);
    res.status(500).send('Error al generar JSON.');
  }
});

// --- RUTAS DE ARCHIVOS DE TEXTO ---
router.post('/save', (req, res) => {
  const { content } = req.body;
  fs.writeFile(DATA_FILES.OUTPUT_TXT, content, (err) => {
    if (err) {
      console.error('Error al guardar el archivo:', err);
      return res.status(500).send('Error al guardar el contenido');
    }
    res.send('Contenido guardado exitosamente');
  });
});
/*
router.post('/add-message', (req, res) => {
  const { message } = req.body;
  appendToFile(DATA_FILES.OUTPUT_TXT, message)
    .then(() => res.send('Mensaje agregado con éxito.'))
    .catch(err => res.status(500).send('Error al escribir en el archivo.'));
});
*/
router.post('/add-message', (req, res) => {
  const { message } = req.body;
  console.log(`📝 Agregando mensaje: ${message}`);
  console.log(`📁 Guardando en: ${DATA_FILES.OUTPUT_TXT}`);

  appendToFile(DATA_FILES.OUTPUT_TXT, message)
  .then(() => {
    console.log('✅ Mensaje agregado con éxito');
    res.send('Mensaje agregado con éxito.');
  })
  .catch(err => {
    console.error('❌ Error al escribir en el archivo:', err);
    res.status(500).send('Error al escribir en el archivo.');
  });
});
/*
router.get('/output', (req, res) => {
  readFileContent(DATA_FILES.OUTPUT_TXT)
    .then(data => res.send(data))
    .catch(err => res.status(500).send('Error al leer el archivo.'));
});
*/
router.get('/output', (req, res) => {
  console.log(`📖 Leyendo archivo: ${DATA_FILES.OUTPUT_TXT}`);

  readFileContent(DATA_FILES.OUTPUT_TXT)
  .then(data => {
    console.log('✅ Archivo leído correctamente');
    res.send(data);
  })
  .catch(err => {
    console.error('❌ Error al leer el archivo:', err);
    res.status(500).send('Error al leer el archivo.');
  });
});

////////////////    config multimedia  ////////////
// routes/api.js
/*const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const constants = require('../config/constants');
*/
// Endpoint para obtener configuración actual
/*router.get(constants.API_PATHS.CONFIG, (req, res) => {
  try {
    const currentConfig = constants.CONFIG_MANAGER.loadConfig();
    res.json({
      success: true,
      config: currentConfig,
      defaultConfig: constants.CONFIG_MANAGER.getDefaultConfig()
    });
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error cargando configuración'
    });
  }
});

// Endpoint para guardar configuración
router.post(constants.API_PATHS.CONFIG, (req, res) => {
  try {
    const { config } = req.body;

    if (!config || !config.PATHS) {
      return res.status(400).json({
        success: false,
        error: 'Configuración inválida'
      });
    }

    const success = constants.CONFIG_MANAGER.saveConfig(config);

    if (success) {
      res.json({
        success: true,
        message: 'Configuración guardada correctamente'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error guardando configuración'
      });
    }
  } catch (error) {
    console.error('Error guardando configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
});

// Endpoint para resetear configuración
router.post('/api/config/reset', (req, res) => {
  try {
    const defaultConfig = constants.CONFIG_MANAGER.getDefaultConfig();
    const success = constants.CONFIG_MANAGER.saveConfig(defaultConfig);

    if (success) {
      res.json({
        success: true,
        message: 'Configuración restablecida a valores por defecto',
        config: defaultConfig
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error restableciendo configuración'
      });
    }
  } catch (error) {
    console.error('Error resetando configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
});
*/
//module.exports = router;
/*
// routes/api.js - VERSIÓN CORREGIDA
const express = require('express');
const router = express.Router();
const constants = require('../config/constants');
*/
// 🔥 MIDDLEWARE DE DEBUG - Agregar esto al inicio
router.use((req, res, next) => {
  console.log(`📨 API Route: ${req.method} ${req.originalUrl}`);
  next();
});

// 🔥 Ruta de prueba simple
router.get('/test', (req, res) => {
  console.log('✅ /api/test funcionando');
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para obtener configuración actual
router.get('/config', (req, res) => {
  try {
    console.log('📥 GET /api/config solicitado');
    const currentConfig = constants.CONFIG_MANAGER.loadConfig();

    res.json({
      success: true,
      config: currentConfig,
      defaultConfig: constants.CONFIG_MANAGER.getDefaultConfig()
    });
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error cargando configuración'
    });
  }
});

// Endpoint para guardar configuración
router.post('/config', (req, res) => {
  try {
    console.log('📥 POST /api/config solicitado');
    const { config } = req.body;

    if (!config || !config.PATHS) {
      return res.status(400).json({
        success: false,
        error: 'Configuración inválida'
      });
    }

    const success = constants.CONFIG_MANAGER.saveConfig(config);

    if (success) {
      res.json({
        success: true,
        message: 'Configuración guardada correctamente'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error guardando configuración'
      });
    }
  } catch (error) {
    console.error('Error guardando configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
});

// Endpoint para resetear configuración
router.post('/config/reset', (req, res) => {
  try {
    console.log('📥 POST /api/config/reset solicitado');
    const defaultConfig = constants.CONFIG_MANAGER.getDefaultConfig();
    const success = constants.CONFIG_MANAGER.saveConfig(defaultConfig);

    if (success) {
      res.json({
        success: true,
        message: 'Configuración restablecida a valores por defecto',
        config: defaultConfig
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error restableciendo configuración'
      });
    }
  } catch (error) {
    console.error('Error resetando configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
});

//module.exports = router;

module.exports = router;
