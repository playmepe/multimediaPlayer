// websocket/websocketManager.js
const WebSocket = require('ws');
const { PORTS } = require('../config/constants');

let playerWss, bibliaWss, ioWss, wssYT;

function initializeWebSockets(server) {
  console.log('🔄 Inicializando todos los servidores WebSocket...');
  
  // Inicializar WebSockets con el servidor HTTP
  playerWss = new WebSocket.Server({ port: PORTS.PLAYER_WS });
  bibliaWss = new WebSocket.Server({ port: PORTS.BIBLIA_WS });
  ioWss = new WebSocket.Server({ port: PORTS.IO_WS });
  wssYT = new WebSocket.Server({ port: PORTS.YTPLAYER_WS });
  
  console.log('✅ Todos los WebSockets inicializados correctamente');
  
  // Configurar los event handlers para cada WebSocket
  configurePlayerWS();
  configureBibliaWS();
  configureIoWS();
  configureYouTubeWS();
  
  return {
    playerWss,
    bibliaWss,
    ioWss,
    wssYT
  };
}

// Mover toda la lógica de playerWS.js aquí
function configurePlayerWS() {
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
    broadcastPlayer(response);
  }

  function handleSyncMessage(msg) {
    if (msg.timestamp > globalState.playback.lastUpdate) {
      globalState.playback = {
        currentTime: msg.currentTime,
        state: msg.state,
        playbackRate: msg.playbackRate,
        currentIndex: msg.videoIndex,
        lastUpdate: msg.timestamp
      };
      broadcastPlayer(msg, msg.originClientId);
    }
  }

  function broadcastPlayer(message, excludeClientId = null) {
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
    ws.id = Date.now() + Math.random();

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
          broadcastPlayer({ type: 'playlist', data: globalState.playlist });
        } else if (msg.type === 'control') {
          handleControlMessage(msg);
        } else if (msg.type === 'sync') {
          handleSyncMessage(msg);
        } else if (msg.type === 'updateStopCheckbox') {
          globalState.manualMode = msg.checked;
          broadcastPlayer({ type: 'updateStopCheckbox', checked: msg.checked });
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
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

  console.log(`Servidor WebSocket de reproductor iniciado en puerto ${PORTS.PLAYER_WS}`);
}

// Configuraciones similares para los otros WebSockets...
function configureBibliaWS() {
  function isValidCloseCode(code) {
    return Number.isInteger(code) && code >= 1000 && code <= 4999 && ![1004,1005,1006,1015].includes(code);
  }

  bibliaWss.on('connection', (ws, req) => {
    console.log('Biblia WebSocket connection established from', req.socket.remoteAddress);

    ws.on('message', (message, isBinary) => {
      try {
        const msgString = isBinary ? message.toString() : (typeof message === 'string' ? message : message.toString());
        
        bibliaWss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            try {
              client.send(msgString);
            } catch (sendErr) {
              console.error('Error sending to client in bibliaWss:', sendErr);
            }
          }
        });

        if (msgString.startsWith('font-size:')) {
          const newSize = msgString.split(':')[1].trim();
          console.log(`Nuevo tamaño de fuente: ${newSize}`);
        }
      } catch (err) {
        console.error('Error procesando mensaje en bibliaWss:', err);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`Biblia WS closed. code=${code}, reason=${reason && reason.toString ? reason.toString() : reason}`);
      if (!isValidCloseCode(code)) {
        console.warn('Biblia WS: recibido código de cierre inválido:', code);
      }
    });

    ws.on('error', (err) => {
      console.error('Biblia WS error:', err);
    });
  });

  console.log(`Biblia WebSocket server is running on ws://localhost:${PORTS.BIBLIA_WS}`);
}

function configureIoWS() {
  function isValidCloseCode(code) {
    return Number.isInteger(code) && code >= 1000 && code <= 4999 && ![1004,1005,1006,1015].includes(code);
  }

  ioWss.on('connection', (ws, req) => {
    console.log('🔌 WebSocket connection established from', req.socket.remoteAddress);

    ws.on('message', (message, isBinary) => {
      try {
        const msgString = isBinary ? message.toString() : (typeof message === 'string' ? message : message.toString());
        console.log('📨 received message:', msgString);

        if (msgString.includes('auto-project-startup')) {
          console.log('🔄 Mensaje auto-project-startup recibido, reenviando a todos los clientes...');
          
          ioWss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              try {
                client.send(msgString);
                console.log('✅ Mensaje reenviado a cliente');
              } catch (sendErr) {
                console.error('Error reenviando mensaje:', sendErr);
              }
            }
          });
          return;
        }

        if (msgString.startsWith('font-size:')) {
          const newSize = msgString.split(':')[1].trim();
          console.log(`Nuevo tamaño de fuente: ${newSize}`);
          
          ioWss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              try {
                client.send(msgString);
              } catch (sendErr) {
                console.error('Error sending to client:', sendErr);
              }
            }
          });
        }
      } catch (err) {
        console.error('Error procesando mensaje:', err);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed. code=${code}, reason=${reason && reason.toString ? reason.toString() : reason}`);
      if (!isValidCloseCode(code)) {
        console.warn('Recibido código de cierre inválido:', code);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });
}

function configureYouTubeWS() {
  let timerState = {
    remainingTime: 0,
    endTime: 0,
    isPaused: true,
    hideHours: false
  };

  let appState = {
    autoPlayOnStart: false,
    queue: [],
    isPlaying: false,
    currentVideoIndex: 0,
    currentVideoUrl: '',
    isAutoPlayEnabled: false
  };

  function broadcastToAll(clients, message) {
    const data = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  function sendToClient(client, message) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  wssYT.on('connection', (ws) => {
    console.log('✅ Cliente WebSocket YouTube conectado');

    sendToClient(ws, { type: 'timerState', data: timerState });
    sendToClient(ws, { type: 'init-state', data: appState });

    if (appState.autoPlayOnStart && appState.queue.length > 0 && !appState.isPlaying) {
      appState.currentVideoIndex = 0;
      appState.isPlaying = true;
      if (appState.queue[0]) {
        appState.currentVideoUrl = appState.queue[0].url;
      }
      broadcastToAll(wssYT.clients, { type: 'play-video-index', data: 0 });
    }

    ws.on('message', (message) => {
      try {
        // Verificar si el mensaje es exactamente "video-ended" (sin formato JSON)
        if (message === '"video-ended"' || message === 'video-ended') {
          console.log('📨 Mensaje de video-ended recibido (formato directo)');

          appState.isPlaying = false;
          if (appState.isAutoPlayEnabled && appState.queue.length > 0) {
            const nextIndex = (appState.currentVideoIndex + 1) % appState.queue.length;
            appState.currentVideoIndex = nextIndex;
            appState.isPlaying = true;
            if (appState.queue[nextIndex]) {
              appState.currentVideoUrl = appState.queue[nextIndex].url;
            }
            broadcastToAll(wssYT.clients, { type: 'play-video-index', data: nextIndex });
          }
          return;
        }

        const parsed = JSON.parse(message);
        console.log('📨 Mensaje recibido YouTube:', parsed);

        switch (parsed.type) {
          case 'toggleHideHours':
            timerState.hideHours = parsed.data;
            console.log('Ocultar horas:', parsed.data);
            broadcastToAll(wssYT.clients, { type: 'timerState', data: timerState });
            break;

          case 'controlTimer':
            console.log('Control de temporizador:', parsed.data);
            const action = parsed.data.action;
            switch (action) {
              case 'start':
                if (timerState.isPaused) {
                  timerState.isPaused = false;
                  timerState.endTime = Date.now() + timerState.remainingTime;
                }
                break;
              case 'pause':
                if (!timerState.isPaused) {
                  timerState.isPaused = true;
                  timerState.remainingTime = timerState.endTime - Date.now();
                }
                break;
              case 'resume':
                if (timerState.isPaused) {
                  timerState.isPaused = false;
                  timerState.endTime = Date.now() + timerState.remainingTime;
                }
                break;
              case 'stop':
                timerState.remainingTime = 0;
                timerState.endTime = 0;
                timerState.isPaused = true;
                break;
            }
            broadcastToAll(wssYT.clients, { type: 'timerState', data: timerState });
            break;

          case 'setInitialTime':
            console.log('Tiempo inicial del temporizador recibido:', parsed.data);
            timerState.remainingTime = parsed.data;
            timerState.endTime = Date.now() + parsed.data;
            timerState.isPaused = false;
            broadcastToAll(wssYT.clients, { type: 'timerState', data: timerState });
            break;

          case 'request-state':
            sendToClient(ws, { type: 'init-state', data: appState });
            break;

          case 'update-queue':
            appState.queue = parsed.data;
            broadcastToAll(wssYT.clients, { type: 'update-queue', data: parsed.data });
            break;

          case 'autoplay-state':
            appState.isAutoPlayEnabled = parsed.data;
            broadcastToAll(wssYT.clients, { type: 'autoplay-state', data: parsed.data });
            break;

          case 'play-video-index':
            appState.currentVideoIndex = parsed.data;
            appState.isPlaying = true;
            if (appState.queue[parsed.data]) {
              appState.currentVideoUrl = appState.queue[parsed.data].url;
            }
            broadcastToAll(wssYT.clients, { type: 'play-video-index', data: parsed.data });
            break;

          case 'yt-control':
            const cmd = parsed.data.cmd;
            if (cmd === 'toggle-autoplay') {
              appState.isAutoPlayEnabled = parsed.data.value;
              broadcastToAll(wssYT.clients, { type: 'autoplay-state', data: parsed.data.value });
            } else if (cmd === 'play') {
              appState.isPlaying = true;
            } else if (cmd === 'pause' || cmd === 'stop') {
              appState.isPlaying = false;
            }
            broadcastToAll(wssYT.clients, { type: 'yt-control', data: parsed.data });
            break;

          case 'set-video':
            appState.currentVideoUrl = parsed.data;
            appState.isPlaying = true;
            broadcastToAll(wssYT.clients, { type: 'set-video', data: parsed.data });
            break;

          case 'play-all':
            if (appState.queue.length > 0) {
              appState.currentVideoIndex = 0;
              appState.isPlaying = true;
              if (appState.queue[0]) {
                appState.currentVideoUrl = appState.queue[0].url;
              }
              broadcastToAll(wssYT.clients, { type: 'play-video-index', data: 0 });
            }
            break;

          case 'video-ended':
            appState.isPlaying = false;
            if (appState.isAutoPlayEnabled && appState.queue.length > 0) {
              const nextIndex = (appState.currentVideoIndex + 1) % appState.queue.length;
              appState.currentVideoIndex = nextIndex;
              appState.isPlaying = true;
              if (appState.queue[nextIndex]) {
                appState.currentVideoUrl = appState.queue[nextIndex].url;
              }
              broadcastToAll(wssYT.clients, { type: 'play-video-index', data: nextIndex });
            }
            break;
        }
      } catch (error) {
        console.error('❌ Error procesando mensaje YouTube:', error);
        console.log('Mensaje recibido (raw):', message);
      }
    });

    ws.on('close', () => {
      console.log('❌ Cliente WebSocket YouTube desconectado');
    });

    ws.on('error', (error) => {
      console.error('💥 Error WebSocket YouTube:', error);
    });
  });

  setInterval(() => {
    if (!timerState.isPaused) {
      const now = Date.now();
      timerState.remainingTime = Math.max(0, timerState.endTime - now);
      if (timerState.remainingTime <= 0) {
        timerState.remainingTime = 0;
        timerState.isPaused = true;
      }
      broadcastToAll(wssYT.clients, { type: 'timerState', data: timerState });
    }
  }, 1000);

  console.log(`Servidor WebSocket de YouTube iniciado en puerto ${PORTS.YTPLAYER_WS}`);
}

function sendAutoProjectionRequest() {
  console.log('🚀 Enviando solicitud de proyección automática a clientes...');
  
  let clientCount = 0;
  if (ioWss && ioWss.clients) {
    ioWss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        clientCount++;
        try {
          client.send(JSON.stringify({
            type: 'auto-project-startup',
            timestamp: new Date().toISOString(),
            message: 'Iniciar proyección automática'
          }));
          console.log(`✅ Mensaje enviado a cliente ${clientCount}`);
        } catch (err) {
          console.error('Error enviando mensaje a cliente:', err);
        }
      }
    });
  }
  
  console.log(`✅ Solicitud enviada a ${clientCount} clientes`);
}

module.exports = {
  initializeWebSockets,
  sendAutoProjectionRequest
};
