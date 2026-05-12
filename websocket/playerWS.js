// websocket/playerWS.js
const WebSocket = require('ws');
const { PORT_PLAYER_WS } = require('../config/constants');

const playerWss = new WebSocket.Server({ port: PORT_PLAYER_WS });

let globalState = {
  playlist: [],
  playback: {
    currentTime: 0,
    state: 'paused',
    playbackRate: 1,
    currentIndex: 0,
    lastUpdate: Date.now()
  },
  manualMode: false
};

function isValidCloseCode(code) {
  return Number.isInteger(code) && code >= 1000 && code <= 4999 && ![1004,1005,1006,1015].includes(code);
}

// Función para manejar mensajes de control
function handleControlMessage(msg) {
  const response = {
    type: 'control',
    action: msg.action,
    index: msg.index,
    checked: msg.checked
  };

  switch(msg.action) {
    case 'playVideo':
      globalState.playback.state = 'playing';
      globalState.playback.currentIndex = msg.index;
      globalState.playback.currentTime = 0;
      break;

    case 'play':
      globalState.playback.state = 'playing';
      break;

    case 'pause':
      globalState.playback.state = 'paused';
      break;

    case 'stop':
      globalState.playback.state = 'paused';
      globalState.playback.currentTime = 0;
      break;

    case 'playNext':
      if (!globalState.manualMode) {
        const nextIndex = (globalState.playback.currentIndex + 1) % globalState.playlist.length;
        globalState.playback.currentIndex = nextIndex;
        globalState.playback.currentTime = 0;
        globalState.playback.state = 'playing';
        response.index = nextIndex;
      }
      break;
  }

  globalState.playback.lastUpdate = Date.now();
  broadcast(response);
}

// Función para manejar mensajes de sincronización
function handleSyncMessage(msg) {
  if (msg.timestamp > globalState.playback.lastUpdate) {
    globalState.playback = {
      currentTime: msg.currentTime,
      state: msg.state,
      playbackRate: msg.playbackRate,
      currentIndex: msg.videoIndex,
      lastUpdate: msg.timestamp
    };

    broadcast(msg, msg.originClientId);
  }
}

// Función para difundir mensajes a todos los clientes
function broadcast(message, excludeClientId = null) {
  playerWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN &&
      (!excludeClientId || client.id !== excludeClientId)) {
      try {
        client.send(JSON.stringify(message));
      } catch (sendErr) {
        console.error('Error sending to client:', sendErr);
      }
    }
  });
}

playerWss.on('connection', (ws, req) => {
  console.log('Player WS: nuevo cliente conectado desde', req.socket.remoteAddress);

  // Asignar ID único al cliente
  ws.id = Date.now() + Math.random();

  // Enviar estado completo al nuevo cliente
  try {
    ws.send(JSON.stringify({
      type: 'fullSync',
      playlist: globalState.playlist,
      playback: globalState.playback,
      manualMode: globalState.manualMode
    }));
  } catch (err) {
    console.error('Player WS: error al enviar fullSync:', err);
  }

  ws.on('message', (message, isBinary) => {
    try {
      const raw = isBinary ? message.toString() : (typeof message === 'string' ? message : message.toString());
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (jsonErr) {
        console.warn('Player WS: mensaje no JSON recibido, ignorando:', raw);
        return;
      }

      if (msg.type === 'updatePlaylist') {
        globalState.playlist = msg.data;
        broadcast({ type: 'playlist', data: globalState.playlist });

      } else if (msg.type === 'control') {
        handleControlMessage(msg);

      } else if (msg.type === 'sync') {
        handleSyncMessage(msg);

      } else if (msg.type === 'updateStopCheckbox') {
        globalState.manualMode = msg.checked;
        broadcast({ type: 'updateStopCheckbox', checked: msg.checked });

      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));

      } else {
        console.warn('Player WS: tipo de mensaje desconocido:', msg.type);
      }
    } catch (err) {
      console.error('Player WS: error procesando mensaje:', err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`Player WS closed. code=${code}, reason=${reason && reason.toString ? reason.toString() : reason}`);
    if (!isValidCloseCode(code)) {
      console.warn('Player WS: recibido código de cierre inválido:', code);
    }
  });

  ws.on('error', (err) => {
    console.error('Player WS error:', err);
  });
});

console.log(`Servidor WebSocket de reproductor iniciado en puerto ${PORT_PLAYER_WS}`);

module.exports = { playerWss, globalState };
