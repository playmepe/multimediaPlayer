// routes/youtube.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ytsr = require('@distube/ytsr');
const ytpl = require('ytpl');
const { PATHS } = require('../config/constants');
const fileManager = require('../utils/fileManager');
const { PLAYLISTS } = require('../config/constants');

// 🔥 MIDDLEWARE DE VALIDACIÓN
const validatePlaylist = (req, res, next) => {
  const { name, items } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: 'El nombre de la lista es requerido'
    });
  }

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({
      success: false,
      error: 'Los items deben ser un array válido'
    });
  }

  if (items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'La lista no puede estar vacía'
    });
  }

  if (items.length > PLAYLISTS.MAX_ITEMS_PER_PLAYLIST) {
    return res.status(400).json({
      success: false,
      error: `La lista no puede tener más de ${PLAYLISTS.MAX_ITEMS_PER_PLAYLIST} items`
    });
  }

  next();
};


// 🔥 VARIABLE PARA WEBSOCKET SERVER
let wsServer = null;

// Estado de la aplicación YouTube
let appState = {
  queue: [],
  isAutoPlayEnabled: true,
  currentVideoIndex: -1,
  autoPlayOnStart: true,
  isPlaying: false,
  currentVideoUrl: null
};

// 🔥 FUNCIÓN PARA ESTABLecer WEBSOCKET SERVER
function setWebSocketServer(server) {
  wsServer = server;
  console.log('✅ WebSocket server establecido en módulo YouTube');
}

// 🔥 FUNCIÓN PARA SINCRONIZAR ESTADO CON CLIENTES
function broadcastState() {
  if (wsServer) {
    const state = {
      queue: appState.queue,
      isAutoPlayEnabled: appState.isAutoPlayEnabled,
      autoPlayOnStart: appState.autoPlayOnStart,
      isPlaying: appState.isPlaying,
      currentVideoIndex: appState.currentVideoIndex
    };

    wsServer.clients.forEach(client => {
      if (client.readyState === require('ws').OPEN) {
        client.send(JSON.stringify({
          type: 'init-state',
          data: state
        }));
      }
    });
    console.log('📢 Estado broadcast a clientes:', state.queue.length, 'videos');
  }
}

// 🔥 FUNCIÓN PARA ACTUALIZAR COLA Y NOTIFICAR
function updateQueue(newQueue) {
  appState.queue = newQueue;
  console.log('🔄 Cola actualizada:', newQueue.length, 'videos');
  broadcastState();
  saveDefaultPlaylist(newQueue);
}

// Cargar lista inicial
function loadInitialPlaylist() {
  try {
    const playlistPath = path.join(PATHS.DATA_DIR, 'listasyt', 'default-playlist.json');
    console.log('📁 Ruta lista inicial json:', playlistPath);

    if (fs.existsSync(playlistPath)) {
      const data = fs.readFileSync(playlistPath, 'utf8');
      const loadedPlaylist = JSON.parse(data);
      appState.queue = loadedPlaylist;
      console.log(`✅ Lista inicial cargada: ${appState.queue.length} videos`);

      // 🔥 NOTIFICAR A CLIENTES SOBRE LA CARGA INICIAL
      setTimeout(() => {
        broadcastState();
      }, 1000);
    } else {
      console.log('⚠️ No se encontró archivo de lista inicial, creando uno por defecto');
      appState.queue = [
        {
          url: "https://www.youtube.com/watch?v=xiJlO7_PZRg",
          title: "Un Nuevo tiempo",
          thumbnail: "https://i.ytimg.com/vi/xiJlO7_PZRg/hq720.jpg?sqp=-oaymwEXCNAFEJQDSFryq4qpAwkIARUAAIhCGAE=&rs=AOn4CLDDr9znV9e8PTl2oPH6ilk7AWgivA",
          duration: "3:33"
        }
      ];
      fs.mkdirSync(path.dirname(playlistPath), { recursive: true });
      fs.writeFileSync(playlistPath, JSON.stringify(appState.queue, null, 2));

      // 🔥 NOTIFICAR A CLIENTES SOBRE LA CREACIÓN INICIAL
      setTimeout(() => {
        broadcastState();
      }, 1000);
    }
  } catch (error) {
    console.error('❌ Error cargando lista inicial:', error);
  }
}

// 🔥 GUARDAR LISTA POR DEFECTO
function saveDefaultPlaylist(playlist) {
  try {
    const playlistPath = path.join(PATHS.DATA_DIR, 'listasyt', 'default-playlist.json');
    fs.mkdirSync(path.dirname(playlistPath), { recursive: true });
    fs.writeFileSync(playlistPath, JSON.stringify(playlist, null, 2));
    console.log(`💾 Lista por defecto guardada: ${playlist.length} videos`);
  } catch (error) {
    console.error('❌ Error guardando lista por defecto:', error);
  }
}

// Cargar lista al iniciar (con retardo para asegurar que WebSocket esté listo)
setTimeout(() => {
  loadInitialPlaylist();
  console.log('🔄 Iniciando carga de playlist YouTube');
}, 3000);

// Extraer ID de playlist
function extractPlaylistId(url) {
  try {
    const parsed = new URL(url);
    const listId = parsed.searchParams.get('list');

    if (listId) {
      if (listId.startsWith('RD') || listId.startsWith('PL')) {
        return listId;
      }
      return 'RD' + listId;
    }

    if (parsed.pathname.includes('/playlist')) {
      const match = parsed.pathname.match(/\/playlist\?list=([^&]+)/);
      return match ? match[1] : null;
    }

    return null;
  } catch {
    return null;
  }
}

// 🔥 RUTAS EXPRESS (deben exportarse como router)
router.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Falta parámetro q' });

  try {
    const playlistId = extractPlaylistId(q);
    if (playlistId) {
      try {
        const playlist = await ytpl(playlistId, { limit: 100 });

        // 🔥 ACTUALIZAR COLA CON LA NUEVA LISTA
        updateQueue(playlist.items.map(item => ({
          id: item.id,
          title: item.title || item.name,
          duration: item.duration,
          url: item.url,
          thumbnail: item.bestThumbnail.url,
          isPlaylist: false
        })));

        return res.json(playlist.items.map(item => ({
          id: item.id,
          title: item.title || item.name,
          duration: item.duration,
          url: item.url,
          thumbnail: item.bestThumbnail.url,
          isPlaylist: false
        })));
      } catch (e) {
        console.error('Error al procesar lista:', e);
      }
    }

    const searchResults = await ytsr(q, {
      limit: 100,
      type: 'video'
    });

    return res.json(searchResults.items.map(item => ({
      id: item.id,
      title: item.title || item.name,
      duration: item.duration,
      url: item.url,
      thumbnail: item.thumbnails[0]?.url || '',
      isPlaylist: false
    })));

  } catch (err) {
    console.error('Error en /search:', err);
    return res.status(500).json({ error: 'Error al buscar' });
  }
});

router.post('/save-default-playlist', express.json(), (req, res) => {
  try {
    const playlist = req.body;
    updateQueue(playlist);
    res.json({ success: true, message: `Lista por defecto guardada con ${playlist.length} videos` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/set-autoplay', express.json(), (req, res) => {
  appState.autoPlayOnStart = req.body.autoPlay;
  broadcastState();
  res.json({ success: true, autoPlayOnStart: appState.autoPlayOnStart });
});

// 🔥 RUTA PARA OBTENER ESTADO ACTUAL
router.get('/current-state', (req, res) => {
  res.json({
    queue: appState.queue,
    isAutoPlayEnabled: appState.isAutoPlayEnabled,
    autoPlayOnStart: appState.autoPlayOnStart,
    isPlaying: appState.isPlaying,
    currentVideoIndex: appState.currentVideoIndex
  });
});

///////////  para listas youtube  ///////////////
// 🔥 GET /api/playlists - Obtener todas las listas
router.get('/playlists', async (req, res) => {
  try {
    const playlists = await fileManager.loadPlaylists();
    res.json({
      success: true,
      data: playlists,
      count: playlists.length
    });
  } catch (error) {
    console.error('❌ Error cargando playlists:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al cargar playlists'
    });
  }
});

// 🔥 POST /api/playlists - Guardar nueva lista
router.post('/playlists', validatePlaylist, async (req, res) => {
  try {
    const { name, items } = req.body;
    const playlists = await fileManager.loadPlaylists();

    // Verificar límite de playlists
    if (playlists.length >= PLAYLISTS.MAX_PLAYLISTS) {
      return res.status(400).json({
        success: false,
        error: `Se ha alcanzado el límite máximo de ${PLAYLISTS.MAX_PLAYLISTS} playlists`
      });
    }

    // Verificar si ya existe una lista con el mismo nombre
    const existingPlaylist = playlists.find(p =>
    p.name.toLowerCase() === name.toLowerCase()
    );

    if (existingPlaylist) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una lista con ese nombre'
      });
    }

    // Crear nueva playlist
    const newPlaylist = {
      id: fileManager.generatePlaylistId(),
            name: name.trim(),
            items: items,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            itemCount: items.length
    };

    playlists.push(newPlaylist);
    await fileManager.savePlaylists(playlists);

    console.log(`✅ Lista guardada: "${name}" con ${items.length} videos`);

    res.status(201).json({
      success: true,
      data: newPlaylist,
      message: `Lista "${name}" guardada correctamente`
    });

  } catch (error) {
    console.error('❌ Error guardando playlist:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al guardar playlist'
    });
  }
});

// 🔥 GET /api/playlists/:id - Obtener lista específica
router.get('/playlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const playlists = await fileManager.loadPlaylists();
    const playlist = playlists.find(p => p.id === id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: 'Lista no encontrada'
      });
    }

    res.json({
      success: true,
      data: playlist
    });

  } catch (error) {
    console.error('❌ Error obteniendo playlist:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener playlist'
    });
  }
});

// 🔥 DELETE /api/playlists/:id - Eliminar lista
router.delete('/playlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const playlists = await fileManager.loadPlaylists();
    const playlistIndex = playlists.findIndex(p => p.id === id);

    if (playlistIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Lista no encontrada'
      });
    }

    const deletedPlaylist = playlists.splice(playlistIndex, 1)[0];
    await fileManager.savePlaylists(playlists);

    console.log(`🗑️ Lista eliminada: "${deletedPlaylist.name}"`);

    res.json({
      success: true,
      data: deletedPlaylist,
      message: `Lista "${deletedPlaylist.name}" eliminada correctamente`
    });

  } catch (error) {
    console.error('❌ Error eliminando playlist:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al eliminar playlist'
    });
  }
});

// 🔥 PUT /api/playlists/:id - Actualizar lista (OPCIONAL)
router.put('/playlists/:id', validatePlaylist, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, items } = req.body;

    const playlists = await fileManager.loadPlaylists();
    const playlistIndex = playlists.findIndex(p => p.id === id);

    if (playlistIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Lista no encontrada'
      });
    }

    // Verificar nombre duplicado (excluyendo la actual)
    const nameExists = playlists.some((p, index) =>
    index !== playlistIndex && p.name.toLowerCase() === name.toLowerCase()
    );

    if (nameExists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe otra lista con ese nombre'
      });
    }

    // Actualizar playlist
    playlists[playlistIndex] = {
      ...playlists[playlistIndex],
      name: name.trim(),
           items: items,
           updatedAt: new Date().toISOString(),
           itemCount: items.length
    };

    await fileManager.savePlaylists(playlists);

    res.json({
      success: true,
      data: playlists[playlistIndex],
      message: `Lista "${name}" actualizada correctamente`
    });

  } catch (error) {
    console.error('❌ Error actualizando playlist:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al actualizar playlist'
    });
  }
});

// 🔥 GET /api/playlists/backup/download - Descargar backup
router.get('/playlists/backup/download', async (req, res) => {
  try {
    const playlists = await fileManager.loadPlaylists();
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
           totalPlaylists: playlists.length,
           totalItems: playlists.reduce((sum, playlist) => sum + playlist.items.length, 0),
           playlists: playlists
    };

    res.setHeader('Content-Disposition', 'attachment; filename=playlists-backup.json');
    res.setHeader('Content-Type', 'application/json');
    res.json(backupData);

  } catch (error) {
    console.error('❌ Error generando backup:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al generar backup'
    });
  }
});

// Rutas de descarga en el servidor (Node.js con Express)
router.post('/api/download', async (req, res) => {
  const { videoId, format, quality } = req.body;

  try {
    // Usar ytdl-core o similar para descargar
    const downloadId = Date.now().toString();
    const filename = `video_${videoId}_${quality}.${format}`;

    // Iniciar descarga en segundo plano
    startDownload(videoId, format, quality, downloadId);

    res.json({
      success: true,
      downloadId,
      filename,
      message: 'Descarga iniciada'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/api/download/progress/:id', (req, res) => {
  const { id } = req.params;
  const progress = getDownloadProgress(id); // Función que obtiene el progreso

  res.json(progress);
});

router.get('/api/download/folder', (req, res) => {
  // Abrir carpeta de descargas
  const downloadsPath = path.join(__dirname, 'downloads');

  // Para Windows
  if (process.platform === 'win32') {
    require('child_process').exec(`explorer "${downloadsPath}"`);
  }
  // Para macOS
  else if (process.platform === 'darwin') {
    require('child_process').exec(`open "${downloadsPath}"`);
  }
  // Para Linux
  else {
    require('child_process').exec(`xdg-open "${downloadsPath}"`);
  }

  res.json({ success: true });
});
//module.exports = router;
/////////////////  fin para crear listas  /////////////////////////////////

// 🔥 O si necesitas exportar funciones adicionales, hazlo así:
module.exports = Object.assign(router, {
  setWebSocketServer,
  getAppState: () => appState,
                               updateQueue,
                               broadcastState
});
