
        // Actualizar valores de los controles deslizantes
      //  document.addEventListener('DOMContentLoaded', function() {


     const loadBtn = document.getElementById('load');
       const urlInputyt = document.getElementById('url');
            const playBtn = document.getElementById('playBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            const stopBtn = document.getElementById('stopBtn');
            const nextBtn = document.getElementById('nextBtn');

            const btnmedia = document.getElementById('btnmedia');
            const btnytube = document.getElementById('btnytube');

            const playbutton = document.getElementById('play-button');
            const stopvideo = document.getElementById('stop-video');
            const nextvideo = document.getElementById('next-video');
            const pausevideo = document.getElementById('pause-video');
            //const load = document.getElementById('load');

    const PORT_YTPLAYER_WS = 8084;
    const PORT_PLAYER_WS = 8081;
        let socket;
        let isWebSocketReady = false;
         let pendingMessages = [];
         let ytWs = null;
         let wss = null;
        let isConnected = false;
let currentActivePlayer = 'html';  //'html' o 'youtube'

// Agregar después de las variables globales
let savedVolumeState = {
    htmlVolume: 1.0,
    youtubeVolume: 1.0,
    masterVolume: 1.0,
    htmlOpacity: 1.0,
    youtubeOpacity: 1.0,
    currentActivePlayer: 'html'
};

 // Modificar el event listener para yt-control
    document.querySelectorAll('button[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        const data = { cmd };
        if (btn.hasAttribute('data-value')) {
          data.value = parseFloat(btn.getAttribute('data-value'));
        }
        // Actualizar estado local de reproducción
        if (cmd === 'play') {
          isCurrentlyPlaying = true;
        } else if (cmd === 'pause' || cmd === 'stop') {
          isCurrentlyPlaying = false;
        }
        sendWebSocketMessage('yt-control', data);
      });
    });

  // Cargar video desde la URL manual
     loadBtn.addEventListener('click', () => {
    const url = urlInputyt.value.trim();
    if (url) {
      sendWebSocketMessage('set-video', url);
    }
  });

    // Función para reproducir el siguiente video en la cola
    function playNextVideo() {
      if (queue.length === 0) return;

      currentVideoIndex++;
      if (currentVideoIndex >= queue.length) {
        currentVideoIndex = 0;
      }

      socket.emit('play-video-index', currentVideoIndex);
    }

  // 🔥 WEBSOCKET Y FUNCIONES EXISTENTES
  function initializeWebSocket() {
    const wsUrl = `ws://${window.location.hostname}:${PORT_YTPLAYER_WS}`;
    console.log(`🔗 Conectando a: ${wsUrl}`);

    ytWs = new WebSocket(wsUrl);
    isWebSocketReady = false;

    ytWs.addEventListener('open', () => {
      console.log('✅ Conexión WebSocket ytWs abierta');
      isWebSocketReady = true;
      while (pendingMessages.length > 0) {
        const message = pendingMessages.shift();
        sendWebSocketMessage(message.type, message.data);
      }
      sendWebSocketMessage('request-state');
    });

    ytWs.addEventListener('error', (error) => {
      console.error('❌ Error en WebSocket ytWs:', error);
      isWebSocketReady = false;
    });

    ytWs.addEventListener('close', () => {
      console.log('🔌 Conexión WebSocket ytWs cerrada');
      isWebSocketReady = false;
      setTimeout(() => initializeWebSocket(), 3000);
    });

    ytWs.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 Mensaje recibido:', message);

        switch (message.type) {
          case 'init-state':
            handleInitState(message);
            break;
          case 'update-queue':
            queue = message.data || [];
            //renderQueue();
            break;
          case  'playerState':
              updatePlayerStatusFull(message.data);
              console.log('Player state:', message.data);
              break;


          case 'autoplay-state':
            isAutoPlayEnabled = message.data;
           // updateAutoplayUI();
            break;
          case 'video-ended':
            isCurrentlyPlaying = false;
            if (isAutoPlayEnabled && queue.length > 0) playNextVideo();
            break;
          case 'stop':
               isCurrentlyPlaying = false;

              break;
          case 'playback-started':
            isCurrentlyPlaying = true;
            break;
          case 'playback-paused':
            isCurrentlyPlaying = false;
            break;
        }
      } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
      }
    });
  }

  function sendWebSocketMessage(type, data = null) {
    const message = data !== null ? { type, data } : { type };
    if (isWebSocketReady && ytWs && ytWs.readyState === WebSocket.OPEN) {
      ytWs.send(JSON.stringify(message));
      console.log('📤 Mensaje enviado:', message);
    } else {
      pendingMessages.push({ type, data });
      if (!ytWs || ytWs.readyState === WebSocket.CLOSED) {
        initializeWebSocket();
      }
    }
  }

   function handleInitState(message) {
    const state = message.data;
    queue = state.queue || [];
    isAutoPlayEnabled = state.isAutoPlayEnabled || false;
    isCurrentlyPlaying = state.isPlaying || false;

    //renderQueue();

  }

// Modificar las funciones que cambian el estado para que guarden automáticamente
function togglePlayers(duration = 2000) {
    if (currentActivePlayer === 'html') {
        crossfadeToYouTube(duration);
    } else {
        crossfadeToHTML(duration);
    }
    // No guardar aquí, se guardará al completar el crossfade
}

// Modificar las funciones de crossfade para guardar al finalizar
function crossfadeToHTML(duration = 2000) {
    if (!isConnected) {
        alert('No conectado al proyector');
        return;
    }

    console.log(`Iniciando crossfade a HTML Video (${duration}ms)`);
    const steps = 20;
    const stepDuration = duration / steps;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        const htmlVolume = progress;
        const youtubeVolume = 1 - progress;
        const htmlOpacity = progress;
        const youtubeOpacity = 1 - progress;

        sendVideoControl('mix', {
            htmlOpacity: htmlOpacity,
            youtubeOpacity: youtubeOpacity,
            htmlVolume: htmlVolume,
            youtubeVolume: youtubeVolume
        });

        updateMixDisplays(htmlOpacity, youtubeOpacity, htmlVolume, youtubeVolume);

        if (step >= steps) {
            clearInterval(interval);
            currentActivePlayer = 'html';
            updatePlayerStatusDisplay();

            // GUARDAR ESTADO al completar
            saveCurrentState();

            console.log('Crossfade a Media completado');
            sendVideoControl('showHTML');
        }
    }, stepDuration);
}


function crossfadeToYouTube(duration = 2000) {
    if (!isConnected) {
        alert('No conectado al proyector');
        return;
    }

    console.log(`Iniciando crossfade a YouTube (${duration}ms)`);
    const steps = 20;
    const stepDuration = duration / steps;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        const htmlVolume = 1 - progress;
        const youtubeVolume = progress;
        const htmlOpacity = 1 - progress;
        const youtubeOpacity = progress;

        sendVideoControl('mix', {
            htmlOpacity: htmlOpacity,
            youtubeOpacity: youtubeOpacity,
            htmlVolume: htmlVolume,
            youtubeVolume: youtubeVolume
        });

        updateMixDisplays(htmlOpacity, youtubeOpacity, htmlVolume, youtubeVolume);

        if (step >= steps) {
            clearInterval(interval);
            currentActivePlayer = 'youtube';
            updatePlayerStatusDisplay();

            // GUARDAR ESTADO al completar
            saveCurrentState();

            console.log('Crossfade a YouTube completado');
            sendVideoControl('showYouTube');
        }
    }, stepDuration);
}

// Función genérica para crossfade
function crossfadePlayers(duration = 2000) {
    togglePlayers(duration);
}

/*
function updateMixDisplays(htmlOpacity, youtubeOpacity, htmlVolume, youtubeVolume) {
    // Actualizar controles de opacidad
    document.getElementById('htmlOpacity').value = htmlOpacity;
    document.getElementById('youtubeOpacity').value = youtubeOpacity;

    // Actualizar controles de volumen
    document.getElementById('htmlVolume').value = htmlVolume;
    document.getElementById('youtubeVolume').value = youtubeVolume;

    // Actualizar displays/labels si los tienes
    document.getElementById('htmlOpacityDisplay').textContent = Math.round(htmlOpacity * 100) + '%';
    document.getElementById('youtubeOpacityDisplay').textContent = Math.round(youtubeOpacity * 100) + '%';
    document.getElementById('htmlVolumeDisplay').textContent = Math.round(htmlVolume * 100) + '%';
    document.getElementById('youtubeVolumeDisplay').textContent = Math.round(youtubeVolume * 100) + '%';
}
*/
// Actualizar display del estado actual
function updatePlayerStatusDisplay() {
    const statusElement = document.getElementById('currentPlayerStatus');
    const toggleBtn = document.getElementById('toggleBtn');
  //  const btnmedia = document.getElementById('btnmedia');
   // const btnytube = document.getElementById('btnytube');

    if (currentActivePlayer === 'html') {
        statusElement.textContent = 'Actual: MEDIA';
        statusElement.style.color = '#cc0000';
        toggleBtn.textContent = '🎚️>>';
        btnmedia.classList.add('active');
        btnytube.classList.remove('active');
    } else {
        statusElement.textContent = 'Actual: YOUTUBE';
        statusElement.style.color = '#cc0000';
        toggleBtn.textContent = '<<🎚️';
        btnytube.classList.add('active');
         btnmedia.classList.remove('active');
    }
}

// Modificar la función sendVideoControl para incluir volúmenes
function sendVideoControl(action, data = {}) {
    if (!isConnected) return;

    const message = {
        type: 'videoControl',
        data: {
            action: action,
            ...data
        }
    };

    socket.send(JSON.stringify(message));

    // Si incluye datos de volumen, también enviar comando de volumen
    if (data.htmlVolume !== undefined || data.youtubeVolume !== undefined) {
        setTimeout(() => {
            sendVolumeUpdate();
        }, 10);
    }
}

        // Modificar la función initializeControls
function initializeControls() {
    // Cargar estado guardado primero
    loadSavedState();

    // Configurar event listeners para los controles de volumen
    setupVolumeControl('htmlVolume', 'htmlVolumeValue');
    setupVolumeControl('youtubeVolume', 'youtubeVolumeValue');
    setupVolumeControl('masterVolume', 'masterVolumeValue');
    setupVolumeControl('htmlOpacity', 'htmlOpacityValue');
    setupVolumeControl('youtubeOpacity', 'youtubeOpacityValue');

    // Aplicar estado guardado a los controles
    applySavedStateToControls();
}


// Función para guardar el estado actual
function saveCurrentState() {
    const state = {
        htmlVolume: document.getElementById('htmlVolume').value / 100,
        youtubeVolume: document.getElementById('youtubeVolume').value / 100,
        masterVolume: document.getElementById('masterVolume').value / 100,
        htmlOpacity: document.getElementById('htmlOpacity').value / 100,
        youtubeOpacity: document.getElementById('youtubeOpacity').value / 100,
        currentActivePlayer: currentActivePlayer,
        lastSaved: new Date().toISOString()
    };

    //localStorage.setItem('audioControlState', JSON.stringify(state));
   // savedVolumeState = state;
    console.log('Estado guardado:', state);
}

// Función para cargar estado guardado
function loadSavedState() {
    try {
        const saved = localStorage.getItem('audioControlState');
        if (saved) {
            const state = JSON.parse(saved);
            savedVolumeState = { ...savedVolumeState, ...state };
            console.log('Estado cargado:', state);
        }
    } catch (error) {
        console.error('Error cargando estado guardado:', error);
    }
}

// Función para aplicar estado guardado a los controles
function applySavedStateToControls() {
    // Aplicar volúmenes
    document.getElementById('htmlVolume').value = savedVolumeState.htmlVolume * 100;
    document.getElementById('youtubeVolume').value = savedVolumeState.youtubeVolume * 100;
    document.getElementById('masterVolume').value = savedVolumeState.masterVolume * 100;

    // Aplicar opacidades
    document.getElementById('htmlOpacity').value = savedVolumeState.htmlOpacity * 100;
    document.getElementById('youtubeOpacity').value = savedVolumeState.youtubeOpacity * 100;

    // Aplicar estado del reproductor activo
    if (savedVolumeState.currentActivePlayer) {
        currentActivePlayer = savedVolumeState.currentActivePlayer;
    }

    // Actualizar displays
    updateVolumeDisplays(savedVolumeState);
    /*updateMixDisplays(
        savedVolumeState.htmlOpacity,
        savedVolumeState.youtubeOpacity,
        savedVolumeState.htmlVolume,
        savedVolumeState.youtubeVolume
    );*/
    updatePlayerStatusDisplay();

    console.log('Estado aplicado a controles');
}

// Modificar setupVolumeControl para guardar automáticamente
function setupVolumeControl(sliderId, valueId) {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);

    slider.addEventListener('input', function() {
        value.textContent = this.value + '%';

        // Guardar estado inmediatamente
        saveCurrentState();

        // Enviar cambios inmediatamente para volumen
        if (sliderId.includes('Volume') && !sliderId.includes('Opacity')) {
            sendVolumeUpdate();
        }
    });
}

       /////////////////////////  mediactl ws  ////////////////////////////////////
        function connectWebSocket() {
            socket = new WebSocket(`ws://${window.location.hostname}:${PORT_PLAYER_WS}`);

            socket.addEventListener('open', function(event) {
                console.log('Conectado al servidor WebSocket - Control');
                isConnected = true;
                updateConnectionStatus(true);
                 // Actualizar estado visual en el control
               // updateMixDisplays(htmlOpacity, youtubeOpacity, htmlVolume, youtubeVolume);
                stateplayers();
            });

                socket.addEventListener('message', function(event) {
    const data = event.data;
    //console.log('Mensaje RAW recibido en control:', data);

    // Filtrar mensajes no deseados ANTES de procesarlos
    if (shouldIgnoreMessage(data)) {
        console.log('Mensaje ignorado:', data.substring(0, 50) + '...');
        return; // Ignorar este mensaje
    }

    // Solo procesar mensajes JSON válidos
    if (isValidControlMessage(data)) {
        try {
            const msg = JSON.parse(data);
            handleWebSocketMessage(msg);
        } catch (error) {
            console.log('Error parseando JSON en control:', error);
        }
    } else {
        console.log('Mensaje no-JSON ignorado en control:', data.substring(0, 50) + '...');
    }
});

            socket.addEventListener('close', function(event) {
                console.log('Conexión WebSocket cerrada, reconectando...');
                isConnected = false;
                updateConnectionStatus(false);
                setTimeout(connectWebSocket, 3000);
            });

            socket.addEventListener('error', function(error) {
                console.error('Error WebSocket:', error);
                isConnected = false;
                updateConnectionStatus(false);
            });
        }

  /////////////////////////  playerctl ws  ////////////////////////////////////
   // Control functions
            function play() {
                socket.send(JSON.stringify({ type: 'control', action: 'play' }));
                console.log('Mensajeo en control:', play);
            }

            function pause() {
                socket.send(JSON.stringify({ type: 'control', action: 'pause' }));
            }

            function stop() {
                socket.send(JSON.stringify({ type: 'control', action: 'stop' }));
            }

            function playNext() {
                socket.send(JSON.stringify({ type: 'control', action: 'playNext' }));
            }
            function stateplayers() {
                socket.send(JSON.stringify({ type: 'control', action: 'init-state' }));
            }

// Función para determinar qué mensajes ignorar
function shouldIgnoreMessage(data) {
    const ignorePatterns = [
        /^(check_disable|SHOW|TEXT_ALIGN|cambiartipoletra|LOOP_STATUS|UPDATE_BUT)/i,
        /^[a-zA-Z]+:[a-zA-Z]/, // patrones "CLAVE:VALOR"
        /^[a-zA-Z_]+$/,        // solo texto con underscores
        /^\d+:.+/,             // números seguidos de texto
        /^cancion:/i,          // mensajes de canción
        /^biblia:/i,           // mensajes de biblia
        /^Mensajes enviados:/i // logs del servidor
    ];

    return ignorePatterns.some(pattern => pattern.test(data.trim()));
}

// Función para validar mensajes de control JSON
function isValidControlMessage(data) {
    // Solo procesar si es JSON válido y tiene el formato esperado
    try {
        const parsed = JSON.parse(data);

        // Verificar que tenga la estructura esperada para controles
        const validTypes = [
            'volumeState',
            'playerState',
            'systemStatus',
            'playlist',
            'seekResponse'
        ];

        return parsed.type && validTypes.includes(parsed.type);
    } catch (error) {
        return false;
    }
}

// Manejar solo los mensajes que nos interesan
function handleWebSocketMessage(msg) {
    console.log('Procesando mensaje en control:', msg.type);

    switch (msg.type) {
        case 'volumeState':
            updateVolumeDisplays(msg.data);
            break;

        case 'playerState':
            // Actualizar todo el estado incluyendo opacidades
            updateVolumeDisplays(msg.data);
            updatePlayerStatusFull(msg.data);
            updatePlayerStatusDisplay();
            console.log('Player state actualizado completamente:', msg.data);
            break;

        case 'systemStatus':
            updateSystemStatus(msg.data);
            break;

        case 'playlist':
            // Si necesitas manejar updates de playlist
            console.log('Playlist actualizada:', msg.data);
            break;

        default:
            console.log('Tipo de mensaje no manejado en control:', msg.type);
    }
}
/*
function updateVolumeDisplays(volumeData) {
    if (volumeData.htmlVolume !== undefined) {
        const value = Math.round(volumeData.htmlVolume * 100);
        document.getElementById('htmlVolume').value = value;
        document.getElementById('htmlVolumeValue').textContent = value + '%';
    }
    if (volumeData.youtubeVolume !== undefined) {
        const value = Math.round(volumeData.youtubeVolume * 100);
        document.getElementById('youtubeVolume').value = value;
        document.getElementById('youtubeVolumeValue').textContent = value + '%';
    }
    if (volumeData.masterVolume !== undefined) {
        const value = Math.round(volumeData.masterVolume * 100);
        document.getElementById('masterVolume').value = value;
        document.getElementById('masterVolumeValue').textContent = value + '%';
    }

    // Guardar el estado cuando recibimos actualizaciones del proyector
    saveCurrentState();
}
*/
function updateVolumeDisplays(volumeData) {
    console.log('Actualizando displays con:', volumeData);

    // Actualizar volúmenes
    if (volumeData.htmlVolume !== undefined) {
        const value = Math.round(volumeData.htmlVolume * 100);
        document.getElementById('htmlVolume').value = value;
        document.getElementById('htmlVolumeValue').textContent = value + '%';
    }
    if (volumeData.youtubeVolume !== undefined) {
        const value = Math.round(volumeData.youtubeVolume * 100);
        document.getElementById('youtubeVolume').value = value;
        document.getElementById('youtubeVolumeValue').textContent = value + '%';
    }
    if (volumeData.masterVolume !== undefined) {
        const value = Math.round(volumeData.masterVolume * 100);
        document.getElementById('masterVolume').value = value;
        document.getElementById('masterVolumeValue').textContent = value + '%';
    }

    // Actualizar opacidades (esto es lo que falta)
    if (volumeData.htmlOpacity !== undefined) {
        const value = Math.round(volumeData.htmlOpacity * 100);
        document.getElementById('htmlOpacity').value = value;
        document.getElementById('htmlOpacityValue').textContent = value + '%';
    }
    if (volumeData.youtubeOpacity !== undefined) {
        const value = Math.round(volumeData.youtubeOpacity * 100);
        document.getElementById('youtubeOpacity').value = value;
        document.getElementById('youtubeOpacityValue').textContent = value + '%';
    }

    // Actualizar estado del reproductor activo basado en opacidades
    if (volumeData.htmlOpacity !== undefined && volumeData.youtubeOpacity !== undefined) {
        if (volumeData.htmlOpacity > volumeData.youtubeOpacity) {
            currentActivePlayer = 'html';
        } else if (volumeData.youtubeOpacity > volumeData.htmlOpacity) {
            currentActivePlayer = 'youtube';
        }
        updatePlayerStatusDisplay();
    }

    // Guardar el estado cuando recibimos actualizaciones del proyector
    saveCurrentState();

    console.log('Displays actualizados correctamente');
}

// Actualizar displays durante la transición
 function updateMixDisplays(htmlOpacity, youtubeOpacity, htmlVolume, youtubeVolume) {
    // Actualizar sliders de opacidad
   if (htmlOpacity !== undefined) {
        const value = Math.round(htmlOpacity * 100);
        document.getElementById('htmlOpacity').value = value;
        document.getElementById('htmlOpacityValue').textContent = value + '%';
    }
    if (youtubeOpacity !== undefined) {
        const value = Math.round(youtubeOpacity * 100);
        document.getElementById('youtubeOpacity').value = value;
        document.getElementById('youtubeOpacityValue').textContent = value + '%';
    }

    // Actualizar volúmenes si se proporcionan
    if (htmlVolume !== undefined) {
        const value = Math.round(htmlVolume * 100);
        document.getElementById('htmlVolume').value = value;
        document.getElementById('htmlVolumeValue').textContent = value + '%';
    }
    if (youtubeVolume !== undefined) {
        const value = Math.round(youtubeVolume * 100);
        document.getElementById('youtubeVolume').value = value;
        document.getElementById('youtubeVolumeValue').textContent = value + '%';
    }
}

// Llamar la función así:
// updateMixDisplays(volumeData.htmlOpacity, volumeData.youtubeOpacity, volumeData.htmlVolume, volumeData.youtubeVolume);

        function updatePlayerStatus(data) {
            //console.log('Player state update:', msg.data);
            // Actualizar estado HTML Video
            const htmlStatus = document.getElementById('htmlStatus');
            const htmlStatusText = document.getElementById('htmlStatusText');
            if (playerData.htmlActive) {
                htmlStatus.className = 'status-indicator status-active';
                htmlStatusText.textContent = 'Media: Activo';
            } else {
                htmlStatus.className = 'status-indicator status-inactive';
                htmlStatusText.textContent = 'Media: Inactivo';
            }

            // Actualizar estado YouTube
            const youtubeStatus = document.getElementById('youtubeStatus');
            const youtubeStatusText = document.getElementById('youtubeStatusText');
            if (playerData.youtubeActive) {
                youtubeStatus.className = 'status-indicator status-active';
                youtubeStatusText.textContent = 'YouTube: Activo';
            } else {
                youtubeStatus.className = 'status-indicator status-inactive';
                youtubeStatusText.textContent = 'YouTube: Inactivo';
            }
        }

        function updatePlayerStatusFull(data) {
           // console.log('Player state update:', msg.data);
            //console.log('Player state update:', playerData.data); // Cambiar msg a playerData
            // Actualizar estado HTML Video
            const playerData = data;
            const htmlStatus = document.getElementById('htmlStatus');
            const htmlStatusText = document.getElementById('htmlStatusText');
            if (playerData.htmlActive) {
                htmlStatus.className = 'status-indicator status-active';
                htmlStatusText.textContent = 'Media: Activo';
            } else {
                htmlStatus.className = 'status-indicator status-inactive';
                htmlStatusText.textContent = 'Media: Inactivo';
            }

            // Actualizar estado YouTube
            const youtubeStatus = document.getElementById('youtubeStatus');
            const youtubeStatusText = document.getElementById('youtubeStatusText');
            if (playerData.youtubeActive) {
                youtubeStatus.className = 'status-indicator status-active';
                youtubeStatusText.textContent = 'YouTube: Activo';
            } else {
                youtubeStatus.className = 'status-indicator status-inactive';
                youtubeStatusText.textContent = 'YouTube: Inactivo';
            }
        }


        function updateSystemStatus(systemData) {
            const systemStatus = document.getElementById('systemStatus');
            systemStatus.innerHTML = `
                <p><strong>Estado del Proyector:</strong> Conectado</p>
                <p><strong>Reproduciendo:</strong> ${systemData.playing || 'Nada'}</p>
                <p><strong>Tiempo actual:</strong> ${systemData.currentTime || '0'}s</p>
            `;
        }

        function updateConnectionStatus(connected) {
            const statusElement = document.getElementById('connectionStatus');
            if (connected) {
                statusElement.textContent = 'Conectado';
                statusElement.className = 'connection-status connected';
            } else {
                statusElement.textContent = 'Desconectado';
                statusElement.className = 'connection-status disconnected';
            }
        }

        // Funciones de control
        function sendControl(player, action, additionalData = {}) {
            if (!isConnected) {
                alert('No conectado al proyector');
                return;
            }

            const message = {
                type: 'control',
                action: action,
                player: player,
                ...additionalData
            };

            socket.send(JSON.stringify(message));
        }

        function sendVolumeUpdate() {
            if (!isConnected) return;

            const message = {
                type: 'volumeControl',
                data: {
                    htmlVolume: document.getElementById('htmlVolume').value / 100,
                    youtubeVolume: document.getElementById('youtubeVolume').value / 100,
                    masterVolume: document.getElementById('masterVolume').value / 100
                }
            };
console.log('✅ enviando ajute volume', message);
            socket.send(JSON.stringify(message));
        }

        function playYouTube() {
            const youtubeInput = document.getElementById('youtubeUrl').value.trim();
            if (!youtubeInput) {
                alert('Ingresa un ID o URL de YouTube');
                return;
            }

            let videoId = youtubeInput;

            // Extraer ID de URL si es una URL completa
            if (youtubeInput.includes('youtube.com') || youtubeInput.includes('youtu.be')) {
                const match = youtubeInput.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                if (match && match[1]) {
                    videoId = match[1];
                } else {
                    alert('URL de YouTube no válida');
                    return;
                }
            }

            sendControl('youtube', 'play', { videoId: videoId });
        }


// Modificar las funciones de control directo para que guarden
function showOnlyHTML() {
    currentActivePlayer = 'html';
    updatePlayerStatusDisplay();
    saveCurrentState(); // Guardar inmediatamente
    sendVideoControl('showHTML');
}

function showOnlyYouTube() {
    currentActivePlayer = 'youtube';
    updatePlayerStatusDisplay();
    saveCurrentState(); // Guardar inmediatamente
    sendVideoControl('showYouTube');
}

function showBothVideos() {
    // En modo "ambos", mantener el último reproductor activo
    updatePlayerStatusDisplay();
    saveCurrentState(); // Guardar inmediatamente
    sendVideoControl('showBoth');
}

function applyMix() {
    const htmlOpacity = document.getElementById('htmlOpacity').value / 100;
    const youtubeOpacity = document.getElementById('youtubeOpacity').value / 100;

    // Determinar reproductor activo basado en opacidades
    if (htmlOpacity > youtubeOpacity) {
        currentActivePlayer = 'html';
    } else if (youtubeOpacity > htmlOpacity) {
        currentActivePlayer = 'youtube';
    }
    // Si son iguales, mantener el actual

    updatePlayerStatusDisplay();
    saveCurrentState(); // Guardar inmediatamente

    sendVideoControl('mix', {
        htmlOpacity: htmlOpacity,
        youtubeOpacity: youtubeOpacity
    });
}

// Guardar estado antes de que la página se cierre
window.addEventListener('beforeunload', function() {
    saveCurrentState();
    console.log('Estado guardado antes de cerrar la página');
});

// Función para resetear a valores por defecto (opcional)
function resetToDefaults() {
    if (confirm('¿Restablecer todos los controles a valores por defecto?')) {
        const defaultState = {
            htmlVolume: 1.0,
            youtubeVolume: 1.0,
            masterVolume: 1.0,
            htmlOpacity: 1.0,
            youtubeOpacity: 1.0,
            currentActivePlayer: 'html'
        };

        savedVolumeState = defaultState;
        applySavedStateToControls();
        saveCurrentState();

        // Enviar valores por defecto al proyector
        sendVolumeUpdate();
        sendVideoControl('showHTML');

        console.log('Controles restablecidos a valores por defecto');
    }
}

// Agregar botón de reset (opcional - puedes agregarlo en el HTML)
function addResetButton() {
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Reset';
    resetBtn.onclick = resetToDefaults;
    resetBtn.style.background = '#ff6600';
    resetBtn.style.marginTop = '10px';

    // Agregar al primer section
    const firstSection = document.querySelector('.section');
    if (firstSection) {
        firstSection.appendChild(resetBtn);
    }
}

// Llamar en DOMContentLoaded si quieres el botón de reset
document.addEventListener('DOMContentLoaded', function() {
    initializeControls();
    connectWebSocket();
    sendWebSocketMessage('init-state');

    // addResetButton(); // Descomenta si quieres el botón de reset
});

        function sendVideoControl(action, data = {}) {
            if (!isConnected) return;

            const message = {
                type: 'videoControl',
                data: {
                    action: action,
                    ...data
                }
            };

            socket.send(JSON.stringify(message));
        }

          // Event listeners
            playBtn.addEventListener('click', play);
            pauseBtn.addEventListener('click', pause);
            stopBtn.addEventListener('click', stop);
            nextBtn.addEventListener('click', playNext);
           // loopBtn.addEventListener('click', toggleLoop);
            //muteBtn.addEventListener('click', toggleMute);
//sendVolumeUpdate();
updatePlayerStatusDisplay();
        // Enviar actualizaciones de volumen en tiempo real
        document.getElementById('htmlVolume').addEventListener('input', sendVolumeUpdate);
        document.getElementById('youtubeVolume').addEventListener('input', sendVolumeUpdate);
        document.getElementById('masterVolume').addEventListener('input', sendVolumeUpdate);

            // Configurar eventos para los controles deslizantes de volumen
            const volumeSliders = document.querySelectorAll('.volume-slider');
            volumeSliders.forEach(slider => {
                const valueDisplay = document.getElementById(slider.id + 'Value');

                slider.addEventListener('input', function() {
                    if (valueDisplay) {
                        valueDisplay.textContent = this.value + '%';
                    }
                });
            });

            // FUNCIÓN: Escape HTML
            function escapeHtml(s) {
                return String(s).replace(/[&<>"']/g, c => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[c]));
            }

            // Inicialización
            setTimeout(() => {
                initializeWebSocket();
            }, 3000);
