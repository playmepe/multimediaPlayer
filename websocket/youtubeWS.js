// websocket/youtubeWS.js
const WebSocket = require('ws');
const { PORT_YTPLAYER_WS } = require('../config/constants');

// 🔥 IMPORTAR CORRECTAMENTE - usar .youtubeRouter
const { youtubeRouter, setWebSocketServer, getAppState, updateQueue } = require('../routes/youtube');

const wssYT = new WebSocket.Server({ port: PORT_YTPLAYER_WS });

// Estado del temporizador
let timerState = {
  remainingTime: 0,
  endTime: 0,
  isPaused: true,
  hideHours: false
};

// 🔥 USAR EL ESTADO DEL MÓDULO YOUTUBE EN LUGAR DE DUPLICARLO
function getYouTubeState() {
  return getAppState();
}

// Función para broadcast a todos los clientes
function broadcastToAll(clients, message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Función para enviar a un cliente específico
function sendToClient(client, message) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

// 🔥 PASAR LA REFERENCIA DEL WEBSOCKET AL MÓDULO YOUTUBE
setWebSocketServer(wssYT);

wssYT.on('connection', (ws) => {
  console.log('✅ Cliente WebSocket YouTube conectado');

  // 🔥 ENVIAR ESTADO INICIAL AL CLIENTE AL CONECTARSE
  const initialState = {
    type: 'init-state',
    data: getYouTubeState()
  };
  sendToClient(ws, initialState);

  // Auto-play al conectar si está configurado
  const youTubeState = getYouTubeState();
  if (youTubeState.autoPlayOnStart && youTubeState.queue.length > 0 && !youTubeState.isPlaying) {
    setTimeout(() => {
      broadcastToAll(wssYT.clients, { type: 'play-video-index', data: 0 });
    }, 1000);
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Mensaje recibido YouTube:', data);

      // 🔥 MANEJAR ACTUALIZACIONES DE COLA DESDE EL CLIENTE
      if (data.type === 'update-queue') {
        updateQueue(data.data);
        // No necesitas reenviar porque updateQueue ya hace broadcast
        return;
      }

      // 🔥 MANEJAR SOLICITUD DE ESTADO
      if (data.type === 'request-state') {
        const state = getYouTubeState();
        sendToClient(ws, {
          type: 'init-state',
          data: state
        });
        return;
      }

      // Reenviar otros mensajes a los clientes (para controles de reproducción, etc.)
      wssYT.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });

      // Manejar otros tipos de mensajes específicos de YouTube
      switch (data.type) {
        case 'autoplay-state':
          // El estado de autoplay se maneja en el cliente principal
          broadcastToAll(wssYT.clients, { type: 'autoplay-state', data: data.data });
          break;

        case 'play-video-index':
          broadcastToAll(wssYT.clients, { type: 'play-video-index', data: data.data });
          break;

        case 'yt-control':
          broadcastToAll(wssYT.clients, { type: 'yt-control', data: data.data });
          break;

        case 'set-video':
          broadcastToAll(wssYT.clients, { type: 'set-video', data: data.data });
          break;

        case 'play-all':
          broadcastToAll(wssYT.clients, { type: 'play-all' });
          break;

        case 'video-ended':
          broadcastToAll(wssYT.clients, { type: 'video-ended' });
          break;
      }

    } catch (error) {
      console.error('❌ Error procesando mensaje YouTube:', error);
    }
  });

  ws.on('close', () => {
    console.log('❌ Cliente WebSocket YouTube desconectado');
  });

  ws.on('error', (error) => {
    console.error('💥 Error WebSocket YouTube:', error);
  });
});

console.log(`🎵 Servidor WebSocket de YouTube iniciado en puerto ${PORT_YTPLAYER_WS}`);


// websocket/youtubeWS.js
const fileManager = require('../utils/fileManager');

class YoutubeWebSocketHandler {
  constructor(websocketManager) {
    this.wsManager = websocketManager;
  }

  initialize(ws) {
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this.handleMessage(ws, data);
      } catch (error) {
        console.error('❌ Error procesando mensaje YouTube WS:', error);
      }
    });
  }

  async handleMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
      case 'get-playlists':
        await this.handleGetPlaylists(ws);
        break;

      case 'save-playlist':
        await this.handleSavePlaylist(ws, payload);
        break;

      case 'load-playlist':
        await this.handleLoadPlaylist(ws, payload);
        break;

      case 'delete-playlist':
        await this.handleDeletePlaylist(ws, payload);
        break;

      default:
        // Otros tipos de mensaje YouTube
        break;
    }
  }

  async handleGetPlaylists(ws) {
    try {
      const playlists = await fileManager.loadPlaylists();
      this.send(ws, 'playlists-data', playlists);
    } catch (error) {
      console.error('❌ Error obteniendo playlists via WS:', error);
      this.send(ws, 'error', { message: 'Error cargando playlists' });
    }
  }

  async handleSavePlaylist(ws, payload) {
    try {
      const { name, items } = payload;
      const playlists = await fileManager.loadPlaylists();

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

      this.send(ws, 'playlist-saved', newPlaylist);
      this.broadcastPlaylistsUpdate(); // Notificar a todos los clientes

    } catch (error) {
      console.error('❌ Error guardando playlist via WS:', error);
      this.send(ws, 'error', { message: 'Error guardando playlist' });
    }
  }

  async handleLoadPlaylist(ws, payload) {
    try {
      const { playlistId } = payload;
      const playlists = await fileManager.loadPlaylists();
      const playlist = playlists.find(p => p.id === playlistId);

      if (playlist) {
        this.send(ws, 'playlist-loaded', playlist);
      } else {
        this.send(ws, 'error', { message: 'Playlist no encontrada' });
      }
    } catch (error) {
      console.error('❌ Error cargando playlist via WS:', error);
      this.send(ws, 'error', { message: 'Error cargando playlist' });
    }
  }

  async handleDeletePlaylist(ws, payload) {
    try {
      const { playlistId } = payload;
      const playlists = await fileManager.loadPlaylists();
      const filteredPlaylists = playlists.filter(p => p.id !== playlistId);

      await fileManager.savePlaylists(filteredPlaylists);
      this.send(ws, 'playlist-deleted', { playlistId });
      this.broadcastPlaylistsUpdate(); // Notificar a todos los clientes

    } catch (error) {
      console.error('❌ Error eliminando playlist via WS:', error);
      this.send(ws, 'error', { message: 'Error eliminando playlist' });
    }
  }

  broadcastPlaylistsUpdate() {
    // Notificar a todos los clientes sobre cambios en playlists
    this.wsManager.broadcastToAll('playlists-updated');
  }

  send(ws, type, data) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  }
}




// 🔥 EXPORTAR EL ROUTER PARA USO EN EXPRESS
module.exports = {
  wssYT,
  timerState,
  youtubeRouter, // 🔥 Exportar el router correctamente
  getYouTubeState
};
module.exports = YoutubeWebSocketHandler;
