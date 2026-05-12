    document.addEventListener('DOMContentLoaded', function() {
    const youtubeContainer = document.getElementById('youtube-container');
        const player = document.getElementById('player');
        const videoPlayerDiv = document.getElementById('video-player');
        const titleElement = document.getElementById('title');
        const cancionCheckbox = document.getElementById('cancionCheckbox');
        const bibliaCheckbox = document.getElementById('bibliaCheckbox');
        const verseContent = document.getElementById('verse-content');
        const contentBox = document.getElementById('contentBox');
        const videoBackground = document.querySelector('.video-background');
        const backgroundImage = document.getElementById('background-image2');
        const socket = new WebSocket(`ws://${window.location.hostname}:8080`);
        const ws = new WebSocket(`ws://${window.location.hostname}:8081`);

        const youtubeOverlay = document.getElementById('youtube-overlay');
        const youtubePlayButton = document.getElementById('youtube-play-button');
        const youtubeIframe = document.getElementById('youtube-iframe');
        const ytPauseBtn = document.getElementById('yt-pause');
        const ytStopBtn = document.getElementById('yt-stop');
        const ytNextBtn = document.getElementById('yt-next');

        // Elementos del selector de modo
        const modeSelector = document.getElementById('mode-selector');
        const multimediaModeBtn = document.getElementById('multimedia-mode');
        const youtubeModeBtn = document.getElementById('youtube-mode');
        const PORT_YTPLAYER_WS  = 8084;

        // Variables para YouTube
        let ytPlayer;
        let ytQueue = [];
        let currentYtIndex = -1;
        let isYtAutoPlayEnabled = true;   ////////////////////////////false
        let ytVideoDuration = 0;
        let ytEndOverlayTimeout;
        let ytStartOverlayTimeout;
        let isYtInitialPlay = false;   //////////////////////////true

        // Variables para control de reproducción
       // let isCurrentlyPlaying = false;
        let ytWs = null; // 🔥 Inicializar como null
        let isWebSocketReady = false; // 🔥 Bandera para controlar estado de conexión
        let pendingMessages = []; // 🔥 Cola de mensajes pendientes
        let  isHTMLVideoActive = true;
        let isYouTubeActive= false;
        let ytCurrentVideoId = null;
        let ytNextVideoTimeout = null;

        let isVideoUrl2Loop = false;
        let currentVideoUrl2 = '';

        // Al inicio del script, establecer valores por defecto
        let proyectorFontSize = 72;
        let proyectorPosition = 'bottom';  // Valor por defecto: abajo
        let lastReceivedPosition = 'bottom';

        // Configuración
        const YT_CONFIG = {
            overlayImage: '../img/mci-ilo1.png',
            initialHideDelay: 1000,
            preEndShowDelay: 3000,
            fadeDuration: 1000
        };

       // let gui;
        let hideTimeout; // Variable para almacenar el temporizador
        let reproducirLista = JSON.parse(localStorage.getItem('playlist')) || [];
        let currentIndex = parseInt(localStorage.getItem('currentVideoIndex')) || 0;
        let fadeInInterval = null;
        let fadeOutInterval = null;
        let isFadingIn = false;
        let isFadingOut = false;
        player.volume = 1; // Comienza con volumen 0
       let isCheckboxChecked = false; // Variable para almacenar el estado del checkbox
       // Añadir al inicio del script
let lastVideoSrc = '';
let isExternalVideo = false;
 let isPlayingScheduledList = false;
 let isSyncing = false;
let lastSyncTime = 0;
const SYNC_INTERVAL = 1000; // 1 segundo

// Detectar correctamente el entorno
let gui = null;
let isNWJS = false;

try {
    if (typeof require !== 'undefined' && typeof nw !== 'undefined') {
        gui = require('nw.gui');
        isNWJS = true;
        console.log('Ejecutando en NW.js');
    }
} catch (error) {
    console.log('Entorno de navegador normal');
}

// Solo ejecutar código NW.js si está disponible
if (isNWJS && gui) {
    gui.Window.get().on('loaded', function() {
        const window = gui.Window.get();
        const x = 1970;
        const y = 520;
        window.moveTo(x, y);
        window.show();
        window.enterFullscreen();
    });
} else {
    console.log("Ejecutando en navegador/Smart TV - Modo normal");
    // Código específico para navegador/Smart TV aquí
}

socket.addEventListener('open', () => {
    console.log('Conexión WebSocket abierta');
    // Solicitar estado actual
    socket.send(JSON.stringify({ type: 'projectorReady' }));
    // Carga la lista de reproducción desde localStorage
    reproducirLista = JSON.parse(localStorage.getItem('playlist')) || [];
    currentIndex = parseInt(localStorage.getItem('currentVideoIndex')) || 0;

    // Envía la lista de reproducción al servidor
    socket.send(JSON.stringify({ type: 'playlist', data: reproducirLista }));
});

// Al cargar la página, mostrar la imagen de fondo
window.addEventListener('load', function() {
    backgroundImage.style.display = 'block'; // Mostrar la imagen
});

 const video = document.getElementById('player');
// Evento para pausar o reproducir el video al hacer clic
        video.addEventListener('click', function() {
            if (video.paused) {
               // video.play(); // Reproducir si está en pausa
            } else {
             //   video.pause(); // Pausar si está reproduciendo
            }
        });

        // Cargar posición guardada midi
        function loadProyectorPosition() {
            const saved = localStorage.getItem('proyector_position');
            if (saved && (saved === 'top' || saved === 'middle' || saved === 'bottom')) {
                proyectorPosition = saved;
                lastReceivedPosition = saved;
                console.log(`📍 Posición cargada de localStorage: ${proyectorPosition}`);
            } else {
                console.log(`📍 Usando posición por defecto: ${proyectorPosition}`);
            }
        }

        // Llamar a la función al inicio midi
        loadProyectorPosition();

// Función para ocultar la imagen de fondo
function hideBackgroundImage() {
    backgroundImage.style.opacity = '0'; // Establecer opacidad a 0
    setTimeout(() => {
        backgroundImage.style.display = 'none'; // Ocultar completamente después de 2 segundos
    }, 2000); // Esperar a que termine la transición
}

// Función para mostrar la imagen de fondo
function showBackgroundImage() {
    backgroundImage.style.display = 'block'; // Asegúrate de que la imagen se muestre
    checkLoopStatus();
    setTimeout(() => {
        backgroundImage.style.opacity = '1'; // Establecer opacidad a 1
    }, 50); // Esperar un poco antes de aplicar la opacidad para que el display esté establecido
}

//funcion para videos random
let videos = []; // Variable global para almacenar los videos

    async function cargarVideos() {
        try {
            const response = await fetch('../media/FONDO-BIBLIA_videos.json');
            const data = await response.json();
            videos = data.items; // Almacenar videos en la variable global
            console.log('Recibido Videos:', videos);
        } catch (error) {
            console.error('Error cargando videos:', error);
        }
    }

     function reproducirVideoAleatorio() {
        if (!videos || videos.length === 0) {

            console.error('No hay videos disponibles');
            return; // Salir si no hay videos
        }

        const randomIndex = Math.floor(Math.random() * videos.length);
        const randomVideo = videos[randomIndex].action;

        //const videoSource = document.getElementById('video-source');
       // videoSource.src = randomVideo;

        const player = document.getElementById('player');
         player.src = randomVideo; // Reemplazar el src del video
        player.load(); // Cargar el nuevo video
        player.play(); // Reproducir el video
        setTimeout(() => {
                    // Asegúrate de que el índice sea válido
                        videoPlayerDiv.style.display = 'block'; // Mostrar el reproductor
                        player.play();// Agregar un event listener para ocultar la imagen de fondo solo cuando el
                        fadeInVideo(1, 2000);
                        player.volume = 1;
                        hideBackgroundImage();
                        checkLoopStatus();
                        console.log('recibido mensaje play')
                }, 10); // Esperar 10 segundos (10000 milisegundos)
        player.play(); // Reproducir el video
    }

// Evento de clic en la imagen de fondo
backgroundImage.addEventListener('click', function() {
    hideBackgroundImage(); // Ocultar la imagen de fondo al hacer clic
    player.play(); // Reproducir el video
});

// Reemplaza el event listener del evento 'ended' con este código:
/*player.addEventListener('ended', function() {
    console.log('El video ha terminado. Estado del checkbox:', isCheckboxChecked);
    console.log('Estado del loop:', player.loop);

    loadCheckboxState();
    updateLocalStorageAndSocket();
    // Si el loop está activado, NO hacer nada - el video se repetirá automáticamente
    if (player.loop) {
        console.log('Loop activado - el video se repetirá automáticamente');
        return; // Salir de la función sin hacer nada más
    }

    if (isCheckboxChecked === true) {
        // Si el checkbox está marcado, detén el reproductor
        player.pause();
        stop();
        console.log('recibido mensaje pausa, stop por el checkbox activo');
    } else {
        // Si el checkbox no está marcado y NO hay loop, verifica el estado del loop
        checkLoopStatus();

        const loopStatus = player.hasAttribute('loop');
        console.log('Estado loop ended actual', loopStatus);

        if (loopStatus === false) {
            // Si loopStatus es false, enviar mensaje para playNext
            socket.send(JSON.stringify({ type: 'control', action: 'playNext' }));
            console.log('Enviado playNext - loop desactivado', loopStatus);
        }
    }
    showBackgroundImage(); // Mostrar imagen nuevamente al terminar el video
});
*/
// Modifica el event listener 'ended' del player:
player.addEventListener('ended', function() {
    console.log('El video ha terminado. Estado del checkbox:', isCheckboxChecked);
    console.log('Estado del loop:', player.loop);
    console.log('Es VIDEO_URL2 en loop:', isVideoUrl2Loop);

    loadCheckboxState();
    updateLocalStorageAndSocket();

    // Si es un VIDEO_URL2 en modo loop, reiniciar la reproducción
    if (isVideoUrl2Loop && player.src.includes(currentVideoUrl2)) {
        console.log('Reiniciando VIDEO_URL2 en loop');
        player.currentTime = 0;
        player.play();
        return;
    }

    // Si el loop está activado, NO hacer nada - el video se repetirá automáticamente
    if (player.loop) {
        console.log('Loop activado - el video se repetirá automáticamente');
        return;
    }

    if (isCheckboxChecked === true) {
        player.pause();
        stop();
        console.log('recibido mensaje pausa, stop por el checkbox activo');
    } else {
        checkLoopStatus();
        const loopStatus = player.hasAttribute('loop');
        console.log('Estado loop ended actual', loopStatus);

        if (loopStatus === false) {
            socket.send(JSON.stringify({ type: 'control', action: 'playNext' }));
            console.log('Enviado playNext - loop desactivado', loopStatus);
        }
    }
    showBackgroundImage();
});

// También añade esta función para detener el loop cuando sea necesario:
function stopVideoUrl2Loop() {
    isVideoUrl2Loop = false;
    currentVideoUrl2 = '';
    player.loop = false;
    console.log('Loop de VIDEO_URL2 desactivado');
}

// Cuando el video comienza a reproducirse, ocultar la imagen
player.addEventListener('playing', function() {
    hideBackgroundImage(); // Ocultar la imagen de fondo cuando el video comienza
});

// Llamar a showBackgroundImage() cuando se cargue la página
window.addEventListener('load', function() {
    showBackgroundImage();
    checkLoopStatus();
});


function stop() {
    // Lógica para detener el reproductor
    player.pause(); // Pausa el video
    player.currentTime = 0; // Reinicia el tiempo a 0
    videoPlayerDiv.style.display = 'none'; // Oculta el reproductor
    showBackgroundImage(); // Muestra la imagen de fondo
    console.log('ejecutando funcion stop');
}

        // Manejo del WebSocket para control
socket.addEventListener('message', event => {
            const msg = JSON.parse(event.data);
            // console.log('Mensaje recibido general desde socket:', msg);
            //handleWebSocketMessage(msg);
            if (msg.type === 'control') {
                switch (msg.action) {
                case 'updateStopCheckbox':
               // isCheckboxChecked = msg.checked; // Guarda el estado recibido
                saveCheckboxState(msg.checked);
                //console.log('Checkbox estado guardado:', isCheckboxChecked); // Verifica que se guardó correctamente

                break;
                    case 'play':
                        videoPlayerDiv.style.display = 'block'; // Mostrar el reproductor
                        player.play();// Agregar un event listener para ocultar la imagen de fondo solo cuando el
                        fadeInVideo(1, 2000);
                        player.volume = 1;
                        hideBackgroundImage();
                         sendPlayerStateFull();
                        console.log('recibido mensaje play');
                        break;
                    case 'pause':
                        player.pause();
                        fadeOutVideo(2000);
                        showBackgroundImage();
                         console.log('recibido mensaje pausa');
                          sendPlayerStateFull();
                        break;
                    case 'stop':
                        checkLoopStatus();
                        fadeOutVideo(2000);
                        player.pause();
                        player.currentTime = 0;
                        videoPlayerDiv.style.display = 'none'; // Ocultar el reproductor
                        showBackgroundImage();
                         console.log('recibido mensaje stop');
                          sendPlayerStateFull();
                         break;
                    case 'showPlayer':

                        break;
                    /* case 'cambiarimagen':
                      changeBackgroundImage(data.action);
                        break;
*/

                     case 'playNext':
                 // Si el loop está activado, NO hacer nada - el video se repetirá automáticamente
                    if (player.loop) {
                       console.log('Loop activado - el video se repetirá automáticamente');
                    return; // Salir de la función sin hacer nada más
                    }

                console.log('Solicitando siguiente video con fade');

                currentIndex = (currentIndex + 1) % reproducirLista.length;
                localStorage.setItem('currentVideoIndex', currentIndex);

                // Mostrar imagen de fondo durante la transición
                showBackgroundImage();

                // Esperar un momento antes de la transición
                setTimeout(() => {
                    if (currentIndex >= 0 && currentIndex < reproducirLista.length) {
                        loadVideo(); // Esto ahora usará la transición con fade
                    }
                }, 500);
                 sendPlayerStateFull();
                break;
                   case 'removeVideo':
                        reproducirLista.splice(msg.index, 1);
                        localStorage.setItem('playlist', JSON.stringify(reproducirLista));
                        socket.send(JSON.stringify({ type: 'updatePlaylist', data: reproducirLista }));
                        updatePlaylist();
                         sendPlayerStateFull();
                        break;
                        case 'playVideo':
                console.log('Reproduciendo video específico con fade');
                currentIndex = msg.index;
                localStorage.setItem('currentVideoIndex', currentIndex);
                showBackgroundImage();

                setTimeout(() => {
                    if (currentIndex >= 0 && currentIndex < reproducirLista.length) {
                        loadVideo(); // Transición con fade
                    }
                }, 500);
                 sendPlayerStateFull();
                break;
                }
            } else if (msg.type === 'playlist') {
                reproducirLista = msg.data;
                localStorage.setItem('playlist', JSON.stringify(reproducirLista));
            } else if (msg.type === 'volumeControl') {
                handleVolumeControl(msg.data);

                console.log('✅ enviando ajuteddd volume');
            } else if (msg.type === 'videoControl') {
                handleVideoControl(msg.data);
            } else if (msg.type === 'seekRequest') {
                if (typeof msg.time === 'number') {
            player.currentTime = msg.time;
            sendSyncState();
        }
    }
});

// Añadir event listener para actualizaciones de tiempo
// Reemplazar el event listener existente con este:
player.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastSyncTime > SYNC_INTERVAL) {
        sendSyncState();
        lastSyncTime = now;
    }
});
//////////////////////////////////////////////////////////////////////////////
 // Al iniciar la aplicación

        // Función para guardar el estado
        function saveCheckboxState(checked) {
            try {
                localStorage.setItem('stopCheckboxState', JSON.stringify(checked));
                console.log('Estado guardado:', checked);
            } catch (error) {
                console.error('Error al guardar el estado:', error);
            }
            socket.send(JSON.stringify({ type: 'control', action: 'updateStopCheckboxUI', checked: checked }));
    console.log('Enviando Estado UI:', checked);
        }

        // Función para cargar el estado
        function loadCheckboxState() {
            try {
                const saved = localStorage.getItem('stopCheckboxState');
                if (saved !== null) {
                    isCheckboxChecked = JSON.parse(saved);
                    console.log('Estado cargado:', isCheckboxChecked);
                } else {
                    console.log('No se encontró estado guardado. Usando valor por defecto: false');
                }
            } catch (error) {
                console.error('Error al cargar el estado:', error);
                isCheckboxChecked = false;
            }

            // Actualizar UI con el estado cargado
            //updateCheckboxUI(isCheckboxChecked);
            return isCheckboxChecked;
        }

loadCheckboxState();
/////////////////////////////////////////////////
       // Función para manejar la lógica de 'playNext'
function handlePlayNext(isCheckboxChecked) {
console.log('Estado de Auto-Manual:', isCheckboxChecked);
    currentIndex = (currentIndex + 1) % reproducirLista.length;
    localStorage.setItem('currentVideoIndex', currentIndex);
    showBackgroundImage();
socket.send(JSON.stringify({ type: 'control', action: 'playNext' }));
    if (isCheckboxChecked) {
        // Lógica para cuando el checkbox está marcado
        player.pause();
       // stop(); // Detiene el reproductor
    } else {
    socket.send(JSON.stringify({ type: 'control', action: 'playNext' }));
        // Esperar 1.5 segundos antes de cargar el video
        setTimeout(() => {
            if (currentIndex >= 0 && currentIndex < reproducirLista.length) {
                loadVideo(); // Cargar el video
            } else {
                console.error('Índice de video inválido:', currentIndex);
            }
        }, 1500); // Esperar 1.5 segundos (1500 milisegundos)

        fadeOutVideo(2000);
    }
}

// Variables de control mejoradas
let fadeState = {
    isFading: false,
    type: null, // 'in' o 'out'
    interval: null,
    targetVolume: 0
};

/////////////////////////////////////  control volume por socket  ////////////////////////
    let htmlVolume = 1.0;      // Volumen del reproductor HTML (0-1)
    let youtubeVolume = 0;   // Volumen del reproductor YouTube (0-1)
    let masterVolume = 1.0;    // Volumen maestro/fader (0-1)

    function applyVolumes() {
       const  youtubePlayer = ytPlayer
        // Aplicar volumen al reproductor HTML
        if (player) {
            player.volume = htmlVolume * masterVolume;
        }
        console.log('✅ enviando ajutesssss volume');
        // Aplicar volumen al reproductor de YouTube
        if (youtubePlayer && typeof youtubePlayer.setVolume === 'function') {
            const youtubeFinalVolume = youtubeVolume * masterVolume * 100; // YouTube usa 0-100
            youtubePlayer.setVolume(Math.round(youtubeFinalVolume));
        }
    }

    function handleVolumeControl(volumeData) {
        console.log('✅ enviando ajutessss volume', volumeData);
        if (volumeData.htmlVolume !== undefined) {
            htmlVolume = Math.max(0, Math.min(1, volumeData.htmlVolume));
            console.log('✅ ajustando  volume html', htmlVolume);
        }
        if (volumeData.youtubeVolume !== undefined) {
            youtubeVolume = Math.max(0, Math.min(1, volumeData.youtubeVolume));
            console.log('✅ ajustando  volume ytb', youtubeVolume);
        }
        if (volumeData.masterVolume !== undefined) {
            masterVolume = Math.max(0, Math.min(1, volumeData.masterVolume));
             console.log('✅ ajustando  volume master', masterVolume);
        }

        applyVolumes();
        sendVolumeState();
    }

    function sendVolumeState() {
        console.log('✅ enviando ajute volume');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'volumeState',
                data: {
                    htmlVolume: htmlVolume,
                    youtubeVolume: youtubeVolume,
                    masterVolume: masterVolume
                }
            }));
        }
    }

    function handleVideoControl(videoData) {
        if (videoData.action === 'mix') {
            handleVideoMix(videoData);
        } else if (videoData.action === 'showHTML') {
            showHTMLVideo();
            hideYouTube();
        } else if (videoData.action === 'showYouTube') {
            showYouTube();
            hideHTMLVideo();
        } else if (videoData.action === 'showBoth') {
            showBothVideos();
        }
    }

    function handleVideoMix(mixData) {
         const  youtubePlayer = ytPlayer
        const htmlOpacity = mixData.htmlOpacity !== undefined ? mixData.htmlOpacity : 1;
        const youtubeOpacity = mixData.youtubeOpacity !== undefined ? mixData.youtubeOpacity : 1;

        // Ajustar opacidades de los reproductores
        if (videoPlayerDiv) {
            videoPlayerDiv.style.opacity = htmlOpacity;
            videoPlayerDiv.style.display = htmlOpacity > 0 ? 'block' : 'none';
        }

        const youtubeContainer = document.getElementById('youtube-container');
        if (youtubeContainer) {
            youtubeContainer.style.opacity = youtubeOpacity;
            youtubeContainer.style.display = youtubeOpacity > 0 ? 'block' : 'none';
        }

        // Ajustar volúmenes según la mezcla
        if (mixData.htmlVolume !== undefined) {
            htmlVolume = mixData.htmlVolume;
        }
        if (mixData.youtubeVolume !== undefined) {
            youtubeVolume = mixData.youtubeVolume;
        }

        applyVolumes();

        // Enviar estado actualizado
        sendPlayerState();
        sendPlayerStateFull();
    }

    // Función para enviar estado del reproductor
   /* function sendPlayerState() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'playerState',
                data: {
                    htmlActive: isHTMLVideoActive,
                    youtubeActive: isYouTubeActive,
                    htmlVolume: htmlVolume,
                    youtubeVolume: youtubeVolume,
                    masterVolume: masterVolume,
                    htmlOpacity: parseFloat(videoPlayerDiv?.style.opacity) || 0,
                                       youtubeOpacity: parseFloat(document.getElementById('youtube-container')?.style.opacity) || 0
                }
            }));
            console.log('Iniciando envio de mensaje playerstate');
        }
    }*/

    function showHTMLVideo() {
        videoPlayerDiv.style.display = 'block';
        videoPlayerDiv.style.opacity = 1;
        isHTMLVideoActive = true;
        htmlVolume = 1.0;
        applyVolumes();
       sendPlayerStateFull();
    }

    function hideHTMLVideo() {
        videoPlayerDiv.style.display = 'none';
        videoPlayerDiv.style.opacity = 0;
        isHTMLVideoActive = false;
        htmlVolume = 0;
        applyVolumes();
       //  player.pause();
        sendPlayerStateFull();

    }

    function showYouTube() {
        const youtubeContainer = document.getElementById('youtube-container');
        youtubeContainer.style.display = 'block';
        youtubeContainer.style.opacity = 1;
        isYouTubeActive = true;
        youtubeVolume = 1.0;
        applyVolumes();
        sendPlayerStateFull();
    }

    function hideYouTube() {
        const youtubeContainer = document.getElementById('youtube-container');
        youtubeContainer.style.display = 'none';
        youtubeContainer.style.opacity = 0;
        isYouTubeActive = false;
        youtubeVolume = 0;
        applyVolumes();
        sendPlayerStateFull();
    }
 /////////////////////////////////////  fin control volume por socket  ////////////////////////

// Función para hacer fade-out
function fadeOutVideo(duration, callback) {
    // Cancelar cualquier fade en progreso
    cancelFade();

    fadeState.isFading = true;
    fadeState.type = 'out';
    fadeState.targetVolume = 0;

    const initialVolume = player.volume;
    const steps = Math.max(Math.ceil(duration / 50), 1); // Mínimo 1 paso, máximo según duración
    const decrement = initialVolume / steps;
    const interval = duration / steps;

    console.log(`Iniciando fade-out: ${initialVolume.toFixed(2)} -> 0 en ${steps} pasos`);

    fadeState.interval = setInterval(() => {
        if (player.volume > decrement) {
            player.volume = Math.max(player.volume - decrement, 0);
        } else {
            player.volume = 0;
            completeFadeOut(callback);
        }
    }, interval);
}

// Función para hacer fade-in
function fadeInVideo(targetVolume, duration) {
    // Cancelar cualquier fade en progreso
    cancelFade();

    fadeState.isFading = true;
    fadeState.type = 'in';
    fadeState.targetVolume = targetVolume;

    // Asegurar que el volumen empiece desde 0
    player.volume = 0;

    // Intentar reproducir
    player.play().catch(error => {
        console.error('Error al reproducir:', error);
        cancelFade();
        return;
    });

    const steps = Math.max(Math.ceil(duration / 50), 1);
    const increment = targetVolume / steps;
    const interval = duration / steps;

    console.log(`Iniciando fade-in: 0 -> ${targetVolume.toFixed(2)} en ${steps} pasos`);

    fadeState.interval = setInterval(() => {
        if (player.volume < targetVolume - increment) {
            player.volume = Math.min(player.volume + increment, targetVolume);
        } else {
            player.volume = targetVolume;
            completeFadeIn();
        }
    }, interval);
}

// Función para cancelar fade actual
function cancelFade() {
    if (fadeState.interval) {
        clearInterval(fadeState.interval);
        console.log(`Fade ${fadeState.type} cancelado`);
    }

    fadeState.isFading = false;
    fadeState.type = null;
    fadeState.interval = null;
    fadeState.targetVolume = 0;
}

// Completar fade-out
function completeFadeOut(callback) {
    clearInterval(fadeState.interval);
    player.pause();

    console.log('Fade-out completado');

    fadeState.isFading = false;
    fadeState.type = null;
    fadeState.interval = null;

    // Ejecutar callback si existe
    if (callback && typeof callback === 'function') {
        setTimeout(callback, 100); // Pequeño delay para asegurar
    }
}

// Completar fade-in
function completeFadeIn() {
    clearInterval(fadeState.interval);

    console.log('Fade-in completado');

    fadeState.isFading = false;
    fadeState.type = null;
    fadeState.interval = null;
}

// Función para verificar estado (útil para debugging)
function getFadeState() {
    return {
        ...fadeState,
        currentVolume: player.volume
    };
}

// Función para transición suave entre videos
function transitionToNextVideo(nextVideoSrc, fadeDuration = 2000) {
    console.log('Iniciando transición al siguiente video');

    // 1. Fade-out del video actual
    fadeOutVideo(fadeDuration / 2, () => {
        // 2. Cambiar al siguiente video cuando termine el fade-out
        player.src = nextVideoSrc;
        player.load();

        // 3. Esperar a que el nuevo video esté listo y hacer fade-in
        player.addEventListener('loadeddata', function onLoaded() {
            player.removeEventListener('loadeddata', onLoaded);

            // 4. Fade-in del nuevo video
            fadeInVideo(1, fadeDuration / 2);
            hideBackgroundImage();

            console.log('Transición completada');
        }, { once: true });
    });
}

// Modificar la función loadVideo para usar transición
function loadVideo() {
    if (reproducirLista.length > 0 && reproducirLista[currentIndex]) {
        const nextVideoSrc = reproducirLista[currentIndex].src;

        // Si ya hay un video reproduciéndose, hacer transición
        if (player.src && !player.paused) {
            transitionToNextVideo(nextVideoSrc, 2000);
        } else {
            // Si no hay video reproduciéndose, cargar directamente
            player.src = nextVideoSrc;
            player.addEventListener('loadeddata', () => {
                player.play().then(() => {
                    fadeInVideo(1, 2000);
                    hideBackgroundImage();
                    // Enviar información completa del video
                sendVideoInfo(true);
            sendPlayerStateFull();
                // Enviar también el índice actual
            sendupdatevideoinfoSocket();
               /* socket.send(JSON.stringify({
                    type: 'videoInfo',
                    src: player.src,
                    title: reproducirLista[currentIndex].title || 'Sin título',
                    currentTime: player.currentTime,
                    duration: player.duration,
                    index: currentIndex,
                    isPlaying: true
                }));*/
                });
            }, { once: true });
        }
    }
}

function sendupdatevideoinfoSocket() {
   // localStorage.setItem('playlist', JSON.stringify(reproducirLista));

    // Verificar que el WebSocket esté abierto antes de enviar
    if (socket.readyState === WebSocket.OPEN) {

        socket.send(JSON.stringify({
            type: 'videoInfo',
            src: player.src,
            title: reproducirLista[currentIndex].title || 'Sin título',
            currentTime: player.currentTime,
            duration: player.duration,
            index: currentIndex,
            isPlaying: true
        }));
    } else {
        console.warn('WebSocket no está listo. Estado:', socket.readyState);
        // Opcional: reintentar después de un tiempo
        setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'videoInfo',
                    src: player.src,
                    title: reproducirLista[currentIndex].title || 'Sin título',
                    currentTime: player.currentTime,
                    duration: player.duration,
                    index: currentIndex,
                    isPlaying: true
                }));
            }
        }, 100);
    }
}

        // Cargar una imagen aleatoria
        const loadRandomImage = () => {
            fetch('/datosimagen/images-info.json')
                .then(response => response.json())
                .then(data => {
                    const imagePaths = data.map(item => item.path);
                    const randomIndex = Math.floor(Math.random() * imagePaths.length);
                    document.getElementById('background-image').src = imagePaths[randomIndex]; // Asignar la imagen de fondo
                })
                .catch(error => console.error('Error al cargar la información de la imagen:', error));
        };
        loadRandomImage();

        /////////////////////////////////////////////

        // Manejo del WebSocket para contenido
        ws.onopen = () => console.log('Conexión WebSocket establecida');

         // Verificar el estado en localStorage
            if (localStorage.getItem('contentBoxVisible') === 'true') {
                contentBox.classList.add('show');
            } else {
                contentBox.classList.add('hide');
            }

        ///////////////////////////////////////////////////////////
ws.onmessage = (event) => {
    const data = event.data.split(':');

    switch (data[0]) {
        case 'font-size':
            handleFontSize(data[1]);
            break;

        case 'LISTA_PROGRAMADA':
            const listIndex = parseInt(data[1]);
            const videoIndex = parseInt(data[2]);
            const totalVideos = parseInt(data[3]);
            console.log(`Reproduciendo video ${videoIndex + 1} de ${totalVideos} de la lista programada`);
            break;

        case 'LISTA_PROGRAMADA_TERMINADA':
            console.log('Lista programada terminada, restaurando estado normal');
            if (isPlayingScheduledList) {
                restoreOriginalPlaylist();
            }
            break;

        case 'SHOW':
            showContentBox();
            // Re-aplicar estilos cuando se muestra el contenido
            const savedConfig = localStorage.getItem('bibleDisplayConfig');
            if (savedConfig) {
                try {
                    const config = JSON.parse(savedConfig);
                    applyStylesFromConfig(config);
                } catch (error) {
                    console.error('Error al aplicar configuración guardada:', error);
                }
            }
            break;

        case 'HIDE':
            hideContentBox();
            break;

        case 'VIDEO_URL':
            // Cuando llega VIDEO_URL, desactiva el loop de VIDEO_URL2
            isVideoUrl2Loop = false;
            showBackgroundImage();
            handleVideoUrl(event.data);
            console.log('Mensaje del servidorD: ', event.data);
            break;
        case 'VIDEO_URL2':
            playExternalVideo(event.data, true); // true indica que es loop
            console.log('Mensaje del servidor_lyrics: ', event.data);
            break;

        case 'TEXT_ALIGN':
            manejarAlineacionTexto(data[1]);
            break;

        case 'fondo_biblia':
            var bibliaCheckbox = document.getElementById('bibliaCheckbox');
            if (bibliaCheckbox) {
                bibliaCheckbox.checked = true;
            }
            const playerx = document.getElementById('player');
            if (!playerx.paused) {
                console.log('Reemplazando video actual');

            }
            reproducirVideoAleatorio();
            var video = document.getElementById('player');
            if (!video.hasAttribute('loop')) {
                video.setAttribute('loop', '');
            }
            checkLoopStatus();
             console.log('<>>>>>>>>>>>>>>reproducir fondo biblia');
            break;

        case 'cambiartipoletra':
            changeFontRandomly();
            changeTextShadow();
            break;

        case 'check_disable':
            var bibliaCheckbox = document.getElementById('bibliaCheckbox');
            if (bibliaCheckbox) {
                bibliaCheckbox.checked = false;
                console.log('desactivando el checkbiblia');
            }
            break;

        case 'MUTE_C':
            hideBackgroundImage();
            const player = document.getElementById('player');
            player.muted = !player.muted;
            player.play();
            break;

        case 'LOOP_C':
            const playerB = document.getElementById('player');
            playerB.loop = !playerB.loop;
            checkLoopStatus();
            break;

        case 'LOOP_Cancion':
            var cancionCheckbox = document.getElementById('cancionCheckbox');
            if (cancionCheckbox) {
                cancionCheckbox.checked = true;
            }
            console.log('activando el checkbox');
            var video = document.getElementById('player');
            if (!video.hasAttribute('loop')) {
                video.setAttribute('loop', '');
            }
            break;

        case 'multimedia-mode':
            console.log('multimedia-mode desde ws player');
            updateLocalStorageAndSocket();
            youtubeContainer.style.display = 'none';
            videoPlayerDiv.style.display = 'block';
             sendPlayerStateFull();
            break;

        case 'youtube-mode':
            console.log('youtube-mode desde ws player');
            updateLocalStorageAndSocket();
            youtubeContainer.style.display = 'block';
            videoPlayerDiv.style.display = 'none';
            const playerm = document.getElementById('player');
            console.log('recibido mensaje stop');
            sendPlayerStateFull();
            break;

        case 'cambiarimagen':
            changeBackgroundImage(event.data);
            break;
        case 'cambiarimagen':
            setBackgroundImage(event.data);
            break;

        case 'updatePlugin':
            updatePlugin(event.data);
            console.log('Recibido theme:', event.data);
            break;

        // AÑADIR AQUÍ EL NUEVO CASE PARA CONFIGURACIÓN
        case 'CONFIG':
            try {
                const configData = JSON.parse(event.data.replace('CONFIG:', ''));
                console.log('Configuración recibida:', configData);
                applyStylesFromConfig(configData);
                // Guardar en localStorage para persistencia
                localStorage.setItem('bibleDisplayConfig', JSON.stringify(configData));

            } catch (error) {
                console.error('Error al procesar configuración:', error);
            }
            break;


            default:
             handleDefaultMessage(event.data, data[0]);
            break;

       /* default:
            // Verificar si es un mensaje de biblia
            if (event.data.startsWith('12345:biblia')) {
                handleBibleMessage(event.data);
                console.log('Configuración recibida biblia:', event.data);
            } else {
                handleDefaultMessage(event.data, data[0]);
                console.log('Configuración recibida biblia no:', event.data);
            }
            break;*/
    }
};


function stop() {
                socket.send(JSON.stringify({ type: 'control', action: 'stop' }));
            }

// En tu función handleVideoUrl o similar
function handleVideoUrl(data) {
    // Detener cualquier loop de VIDEO_URL2 activo
    stopVideoUrl2Loop();

    const videoUrl = data.split(':')[1];
    videoPlayerDiv.style.display = 'block';
    player.src = videoUrl;
    player.loop = false; // Asegurar que no esté en loop
    player.play();
    fadeInVideo(1, 2000);
    player.volume = 1;
    hideBackgroundImage();
    checkLoopStatus();

    console.log('Reproducir Url: ', videoUrl);

    // Detectar cuando el video termina
    player.onended = function() {
        console.log('Video terminado, verificando si hay siguiente en lista programada');

        // Verificar si estamos reproduciendo una lista programada
        if (isPlayingScheduledList && scheduledLists[currentPlayingIndex]) {
            const currentList = scheduledLists[currentPlayingIndex].videos;
            const currentVideoIndex = currentList.findIndex(video =>
                video.src.includes(videoUrl.split('/').pop()));

            if (currentVideoIndex !== -1 && currentVideoIndex < currentList.length - 1) {
                // Hay más videos en la lista, reproducir el siguiente
                console.log('Reproduciendo siguiente video de la lista programada');
                playVideoFromList(currentList, currentVideoIndex + 1);
            } else {
                // Es el último video de la lista
                console.log('Último video de la lista programada');
                restoreOriginalPlaylist();

                // Enviar mensaje de finalización
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send("LISTA_PROGRAMADA_TERMINADA");
                }
            }
        }
    };
}

/*function playExternalVideo(data) {
const videoUrl = data.split(':')[1];
      isExternalVideo = true;
    lastVideoSrc = videoUrl;
    player.src = videoUrl;
    videoPlayerDiv.style.display = 'block';

    player.addEventListener('loadeddata', () => {
        player.play().then(() => {

            fadeInVideo(1, 2000);
            player.volume = 1;
            hideBackgroundImage();
            checkLoopStatus();
            sendVideoInfo(true); // Forzar envío de información
            console.log('Reproducir Url: ', videoUrl);
        });
    }, { once: true });
}
*/
// Modifica la función playExternalVideo:
function playExternalVideo(data, isLoop = false) {
    const videoUrl = data.split(':')[1];

    // Si es un video URL2, configurar para loop
    if (isLoop) {
        isVideoUrl2Loop = true;
        currentVideoUrl2 = videoUrl;
    }

    isExternalVideo = true;
    lastVideoSrc = videoUrl;
    player.src = videoUrl;
    videoPlayerDiv.style.display = 'block';

    // Configurar loop si es VIDEO_URL2
    if (isLoop) {
        player.loop = true;
    } else {
        player.loop = false;
    }

    player.addEventListener('loadeddata', () => {
        player.play().then(() => {
            sendVideoInfo(true);
            console.log('Reproducir Url: ', videoUrl);
            if (isLoop) {
                console.log('Modo LOOP activado para VIDEO_URL2');
            }
        });
    }, { once: true });
}

// Función mejorada para enviar información del video
function sendVideoInfo(force = false) {
    if (socket.readyState !== WebSocket.OPEN) return;

    // Solo enviar si ha cambiado el src o si se fuerza
    if (force || player.src !== lastVideoSrc) {
        const videoInfo = {
            type: 'videoInfo',
            src: player.src,
            currentTime: player.currentTime,
            isPlaying: !player.paused,
            isExternal: isExternalVideo,
            duration: player.duration
        };
        socket.send(JSON.stringify(videoInfo));
        lastVideoSrc = player.src;
    }
}


// Modifica la función loadPlaylist para cargar el video externo si existe
function loadPlaylist() {
    reproducirLista = JSON.parse(localStorage.getItem('playlist')) || [];
    currentIndex = parseInt(localStorage.getItem('currentVideoIndex')) || 0;

    // Verificar si hay un video externo guardado
    const reproduciendoExterno = localStorage.getItem('reproduciendoExterno') === 'true';
    const videoExterno = JSON.parse(localStorage.getItem('videoExterno'));

    if (reproduciendoExterno && videoExterno) {
        // Cargar el video externo
        player.src = videoExterno.src;
        videoTitle.textContent = videoExterno.title;
        videoPlayerDiv.style.display = 'block';
    } else if (reproducirLista.length > 0) {
        // Cargar el video de la lista
        if (currentIndex >= reproducirLista.length) currentIndex = 0;
        playVideo(reproducirLista[currentIndex].src);
    }

    updatePlaylist();
}

function changeBackgroundImage() {
    const data = event.data.split(':');
    console.log('Mensaje recibido en cambiar imagen:', data);
    const base = data[1];
    const output = base;

    // Forzar la recarga de la imagen agregando un timestamp
    const newImageUrl = `${output}?t=${new Date().getTime()}`;
    console.log('Cambiando imagen de fondo con:', newImageUrl);

    const backgroundImagez = document.getElementById('background-image2');

    // Limpiar eventos previos
    backgroundImagez.onload = null;
    backgroundImagez.onerror = null;

    // Cambiar la fuente de la imagen
    backgroundImagez.src = newImageUrl;

    // Ajustar la imagen una vez que se haya cargado
    backgroundImagez.onload = function() {
        adjustImageSize(backgroundImagez);
    };

    // Manejar errores de carga
    backgroundImagez.onerror = function() {
        console.error('Error al cargar la imagen:', newImageUrl);
    };
}

/// para proyectar la biblia con fondo imagen   ///
function setBackgroundImage() {
    const data = event.data.split(':');
    console.log('Mensaje recibido en cambiar imagen:', data);
    const base = data[1];
    const output = base;

    // Forzar la recarga de la imagen agregando un timestamp
    const newImageUrl = `${output}?t=${new Date().getTime()}`;
    console.log('Cambiando imagen de fondo con:', newImageUrl);

    const backgroundImagez = document.getElementById('background-image2');

    // Limpiar eventos previos
    backgroundImagez.onload = null;
    backgroundImagez.onerror = null;

    // Cambiar la fuente de la imagen
    backgroundImagez.src = newImageUrl;

    // Ajustar la imagen una vez que se haya cargado
    backgroundImagez.onload = function() {
        adjustImageSize(backgroundImagez);
    };

    // Manejar errores de carga
    backgroundImagez.onerror = function() {
        console.error('Error al cargar la imagen:', newImageUrl);
    };
}

function adjustImageSize(imageElement) {
    setTimeout(() => {
        const naturalWidth = imageElement.naturalWidth;
        const naturalHeight = imageElement.naturalHeight;
        const aspectRatio = naturalWidth / naturalHeight;

        console.log(`Dimensiones originales: ${naturalWidth}x${naturalHeight}, Relación: ${aspectRatio.toFixed(2)}`);

        // Resetear estilos
        imageElement.style.width = '';
        imageElement.style.height = '';
        imageElement.style.objectFit = '';
        imageElement.style.objectPosition = '';

        if (aspectRatio >= (4/3)) { // 4:3 o más ancha
            // Para imágenes anchas (4:3 o más): altura 100%, ancho auto, centrado
            imageElement.style.height = '100%';
            imageElement.style.width = 'auto';
            imageElement.style.objectFit = 'contain';
            imageElement.style.objectPosition = 'center';
            console.log('Imagen ancha (4:3+): altura 100%, ancho auto');
        } else {
            // Para imágenes más altas que 4:3: ancho 100%, altura auto, centrado
            imageElement.style.width = '100%';
            imageElement.style.height = 'auto';
            imageElement.style.objectFit = 'contain';
            imageElement.style.objectPosition = 'center';
            console.log('Imagen alta: ancho 100%, altura auto');
        }

        // Asegurar que no exceda 1920px de ancho
        if (naturalWidth > 1080) {
            imageElement.style.maxWidth = '2410px';
            console.log('Limitando ancho máximo a 1080px');
        }

    }, 100); // Pequeño delay para asegurar que la imagen esté completamente cargada
}
/*
function changeBackgroundImage() {
    const data = event.data.split(':');
    console.log('Mensaje recibido en cambiar imagen:', data); // Verificar
    const base = data[1]; // Parte 1
    const output = base; // Ajusta según sea necesario

    // Forzar la recarga de la imagen agregando un timestamp
    const newImageUrl = `${output}?t=${new Date().getTime()}`;
    console.log('Cambiando imagen de fondo con:', newImageUrl); // Verificar la URL

    const backgroundImagez = document.getElementById('background-image2');

    // Cambiar la fuente de la imagen
    backgroundImagez.src = newImageUrl;

    // Limpiar el evento onload previo para evitar problemas
    backgroundImagez.onload = null; // Evitar que se ejecute más de una vez

    // Ajustar la imagen una vez que se haya cargado
    backgroundImagez.onload = function() {
        adjustImageSize(backgroundImagez);
    };

    // Disparar la carga de la imagen de nuevo
    backgroundImagez.src = newImageUrl;
    console.log('Ajustando imagen: ', newImageUrl); // Cambié `event.data` por `data`
}


function adjustImageSize(imageElement) {
    // Usar un pequeño timeout para asegurarse de que las dimensiones estén disponibles
    console.log('Ajustando imagen: ', imageElement); // Cambié `event.data` por `data`
    setTimeout(() => {
        if (imageElement.naturalHeight > imageElement.naturalWidth) {
            // Si la altura es mayor que la anchura
            imageElement.style.height = 'auto';
            imageElement.style.width = '100%';  // Mantener proporción
            console.log('La altura es mayor que la anchura');
        } else {
            // Si la anchura es mayor o igual que la altura
            imageElement.style.height = '100%';   // Auto
            imageElement.style.width = '100%';  // 100%
            console.log('La altura es igual o menor');
        }
    }, 0); // Espera a que la imagen se cargue y se midan correctamente
}
*/
const colors = ['#3de158', '#e1a53d', '#229bf5', '#fa5e5e', '#FFC300', '#77f507', '#0789f5', '#e13d49']; // Array de colores

const updateTitleBackgroundColor = () => {
    const titleElement = document.getElementById('title');
    const randomIndex = Math.floor(Math.random() * colors.length); // Genera un índice aleatorio
    titleElement.style.backgroundColor = colors[randomIndex]; // Cambia el color de fondo a uno aleatorio
};

// Llama a la función para alternar el color al cargar la página
document.addEventListener('DOMContentLoaded', updateTitleBackgroundColor);


         // Función mejorada para generar sombras de texto
        function changeTextShadow() {
            const title = document.getElementById('title');
            const verseContent = document.getElementById('verse-content');

            // Genera valores aleatorios para text-shadow con rangos más adecuados
            const hShadow = Math.floor(Math.random() * 20) - 10; // Sombra horizontal (-10px a 10px)
            const vShadow = Math.floor(Math.random() * 20) - 10; // Sombra vertical (-10px a 10px)
            const blur = Math.floor(Math.random() * 15) + 3; // Desenfoque (3px a 18px)

            // Color RGBA con opacidad
            const color = `rgba(
                ${Math.floor(Math.random() * 256)},
                ${Math.floor(Math.random() * 256)},
                ${Math.floor(Math.random() * 256)},
                ${(Math.random() * 0.5 + 0.5).toFixed(2)}
            )`;

            // Crear el valor de text-shadow
            const textShadowValue = `${hShadow}px ${vShadow}px ${blur}px ${color}`;

            // Aplicar el text-shadow a ambos elementos
            title.style.textShadow = textShadowValue;
            verseContent.style.textShadow = textShadowValue;

            // Actualizar la visualización de valores
            //updateShadowInfo(hShadow, vShadow, blur, color);
        }
// Define las fuentes disponibles
const fonts = [
'"Bebas Neue", sans-serif',
'"Anton", sans-serif',
'"Oswald", sans-serif',
'"Bungee", sans-serif',
'"Righteous", cursive',
'"Abril Fatface", serif',
'"Playfair Display", serif',
'"Lobster", cursive',
'"Changa One", sans-serif',
'"Alfa Slab One", serif'
];

// Función para cambiar la fuente al azar
function changeFontRandomly() {
    const verseContent = document.querySelector('#verse-content');
     const title = document.querySelector('#title');
    const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
    verseContent.style.fontFamily = randomFont; // Cambia la fuente del body
    title.style.fontFamily = randomFont; // Cambia la fuente del body
}

function manejarAlineacionTexto(alineacion) {
    const verseContent = document.querySelector('#verse-content');
    if (verseContent) {
        verseContent.style.textAlign = alineacion === 'center' ? 'center' : 'justify';
        console.log('Results:', alineacion);
    }
}

function handleFontSize(size) {
    const newSize = parseInt(size, 10);
    const verseContent = document.querySelector('#verse-contentId'); // Ensure this is inside DOMContentLoaded
    if (verseContent && !isNaN(newSize)) {
        verseContent.style.fontSize = `${newSize}px`;
        console.log(verseContent); // This should show the element or null
    }
}


function handleDefaultMessage(data) {
    console.log('Mensaje del servidor: ', data);

    const lines = data.split('\n');
    const identifierAndType = lines[0].split(':'); // Obtiene el ID y el tipo
    const identifier = identifierAndType[0]; // Obtiene el ID
    const contentType = identifierAndType[1]; // Obtiene el tipo

    // Primero verificar si es un mensaje JSON de volumeControl
    try {
        const jsonData = JSON.parse(data);
        if (jsonData.type === 'volumeControl') {
            handleVolumeControl(jsonData.data || jsonData);
            console.log('Mensaje recibido desde volctl:', jsonData);
            return; // Salir de la función después de manejar volumeControl

    } else if (jsonData.type === 'videoControl') {
        handleVideoControl(jsonData.data || jsonData);
        console.log('Mensaje recibido desde Videoctl:', jsonData);
        return; // Salir de la función después de manejar volumeControl
    } else if (jsonData.type === 'control') {
        // También puedes manejar mensajes de control general aquí si es necesario
        handleControlMessage(jsonData);
        return;
    }
    } catch (error) {
        // No es JSON, continuar con el procesamiento normal
        console.log('No es un mensaje JSON, continuando con procesamiento normal');
    }

    // Si llegamos aquí, es un mensaje normal de canción/biblia
    if (contentType === 'cancion') {
        const existingLines = verseContent.querySelectorAll('.linea-cancion');
        document.getElementById('title').style.display = 'none';   //no mostrar title en canción

        existingLines.forEach((line, index) => {
            setTimeout(() => {
                line.classList.add('hide'); // Añadir clase para la animación de salida
            }, index * 400);
        });

        setTimeout(() => {
            titleElement.textContent = ''; // No mostrar título para canciones
            verseContent.innerHTML = '';

            const filteredLines = lines.slice(1).filter(line =>
            !line.startsWith("Mensajes enviados:") && line.trim() !== ""
            );

            if (filteredLines.length === 0) {
                hideContentBox();
                return;
            }

            filteredLines.forEach((line, index) => {
                const lineElement = document.createElement('div');
                lineElement.textContent = line;
                // Agregar clase diferente para cada línea
                lineElement.classList.add(`linea-cancion${index + 1}`); // línea-cancion1, línea-cancion2, etc.
                lineElement.classList.add('linea-cancion'); // Añadir clase para animación
                verseContent.appendChild(lineElement);

                setTimeout(() => {
                    lineElement.classList.add('show'); // Activar la animación
                }, index * 400);
            });
        }, existingLines.length * 300);

    } else if (contentType === 'biblia') {
        titleElement.textContent = lines[1]; // Mostrar título para Biblia
        verseContent.innerHTML = ''; // Limpiar el contenido anterior

        document.getElementById('title').style.display = 'inline-block';   //mostrar title en canción con fondo solo en el texto
        updateTitleBackgroundColor();
        const versesDiv = document.createElement('div');
        versesDiv.className = 'verses-class';
        versesDiv.id = 'verse-contentId';
        versesDiv.textContent = lines.slice(2).join('\n'); // Mostrar versos
        verseContent.appendChild(versesDiv);
        console.log(lines[1], '\n', lines.slice(2).join('\n'));
    }

    loadRandomImage(); // Cargar nueva imagen con nuevo contenido si es necesario
}

function handleControlMessage(msg) {

                switch (msg.action) {

                    case 'play':
                        videoPlayerDiv.style.display = 'block'; // Mostrar el reproductor
                        player.play();// Agregar un event listener para ocultar la imagen de fondo solo cuando el
                        fadeInVideo(1, 2000);
                        player.volume = 1;
                        hideBackgroundImage();
                        checkLoopStatus();
                        console.log('recibido mensaje play');
                        sendPlayerStateFull();
                        break;
                    case 'pause':
                        player.pause();
                        fadeOutVideo(2000);
                        showBackgroundImage();
                        console.log('recibido mensaje pausa');
                        sendPlayerStateFull();
                        break;
                    case 'stop':
                        checkLoopStatus();
                        fadeOutVideo(2000);
                        player.pause();
                        player.currentTime = 0;
                        videoPlayerDiv.style.display = 'none'; // Ocultar el reproductor
                        showBackgroundImage();
                        console.log('recibido mensaje stop');
                        sendPlayerStateFull();
                        break;
                        case 'playNext':
                            // Si el loop está activado, NO hacer nada - el video se repetirá automáticamente
                            if (player.loop) {
                                console.log('Loop activado - el video se repetirá automáticamente');
                                return; // Salir de la función sin hacer nada más
                            }

                            console.log('Solicitando siguiente video con fade');

                            currentIndex = (currentIndex + 1) % reproducirLista.length;
                            localStorage.setItem('currentVideoIndex', currentIndex);

                            // Mostrar imagen de fondo durante la transición
                            showBackgroundImage();

                            // Esperar un momento antes de la transición
                            setTimeout(() => {
                                if (currentIndex >= 0 && currentIndex < reproducirLista.length) {
                                    loadVideo(); // Esto ahora usará la transición con fade
                                }
                            }, 500);
                            sendPlayerStateFull();
                            break;
                        case 'init-state':
                            sendPlayerStateFull();         // ws de player   funciona
                            console.log('recibido mensaje enviar estado players');
                            break;
    }
}


        /////////////////////////////////////////////////////////////

        ws.onclose = () => console.log('Conexión WebSocket cerrada');
        ws.onerror = (error) => console.error('Error en WebSocket:', error);


function showContentBox() {
            contentBox.style.display = 'block'; // Mostrar el contentBox
            // Para asegurarte de que el "fade in" se vea, usa un timeout

    setTimeout(() => {
        contentBox.classList.remove('hide'); // Asegurarse de que la clase "hide" no esté aplicada
        contentBox.classList.add('show'); // Asegúrate de que se aplique la clase "show"
    }, 2); // Un pequeño retraso para permitir que el navegador registre el cambio de estilo
        localStorage.setItem('contentBoxVisible', 'true');
         if (isSocketOpen) {
            ws.send(`UPDATE_BUTTON_BIBLIA_ON`);
            console.log('desactivado contentbox' );
        } else {
            console.warn('El WebSocket no está conectado. Estado actual:', ws.readyState);
        }
    // Limpiar cualquier temporizador existente
    clearTimeout(hideTimeout);
    // Establecer nuevo temporizador para ocultar el contenido
   hideTimeout = setTimeout(hideContentBox, 60000); // Ocultar después de 60 segundos
   // localStorage.setItem('contentBoxVisible', 'false');
}

function hideContentBox() {
    // Ocultar el contentBox con animación
    contentBox.classList.remove('show');
    contentBox.classList.add('hide');

    // Esperar a que termine la transición antes de ocultar el elemento
    setTimeout(() => {
        contentBox.style.display = 'none'; // Ocultar el contentBox
    }, 1500); // Coincide con la duración de la transición (ajustar según sea necesario)

    // Guardar el estado en el localStorage
    localStorage.setItem('contentBoxVisible', 'false');

    // Limpiar la clase 'hide' para la próxima vez
    contentBox.classList.remove('hide');

    // Verificar si el video tiene el atributo 'loop'
    const loopStatus = playerS.hasAttribute('loop');  // Asegúrate de que 'playerS' está definido correctamente

    if (loopStatus) {
        showBackgroundImage(); // Llamar a esta función según sea necesario

        // Verificar el estado del checkbox
        var video = document.getElementById('player');
        var cancionCheckbox = document.getElementById('cancionCheckbox');

        // Corregir la comparación de checkbox (debería ser '===' en lugar de '=')
        if (cancionCheckbox && !cancionCheckbox.checked) {
            // Si el video está en loop, quitar el atributo 'loop'
            if (video.hasAttribute('loop')) {
                video.removeAttribute('loop');
            }
        }
         if (bibliaCheckbox && bibliaCheckbox.checked) {
            // Si el video está en loop, quitar el atributo 'loop'
            showBackgroundImage(); // Llamar a esta función según sea necesario
             // Si el checkbox está marcado, detén el reproductor
        player.pause();
        stop(); // Asegúrate de que la función 'stop' esté implementada correctamente
        console.log('recibido mensaje pausa, stop por el checkbox activo');
            if (video.hasAttribute('loop')) {
                video.removeAttribute('loop');
            }
        }
    }

     if (isSocketOpen) {
            ws.send(`UPDATE_BUTTON_BIBLIA_OFF`);
            console.log('desactivado contentbox' );
        } else {
            console.warn('El WebSocket no está conectado. Estado actual:', ws.readyState);
        }
}


/////////////////////// para vigilar loop //////////////////////////
// Obtener el elemento de video
//var video = document.getElementById('player');

// Crear un observer para monitorear cambios en el atributo 'loop'
var observer = new MutationObserver(function(mutationsList) {
    for (var mutation of mutationsList) {
        // Verificar si el atributo 'loop' ha cambiado
        if (mutation.type === 'attributes' && mutation.attributeName === 'loop') {
            console.log('El atributo loop ha cambiado');
            checkLoopStatus()
        const loopStatus = playerS.hasAttribute('loop'); // Verificar si el atributo loop está presente
            // Aquí puedes ejecutar cualquier acción que necesites cuando el atributo cambie
            if (video.hasAttribute('loop')) {
            ws.send(`LOOP_STATUS: ${loopStatus}`);

                console.log('Loop está activado');
            } else {
            ws.send(`LOOP_STATUS: ${loopStatus}`);

                console.log('Loop está desactivado');
            }
        }
    }
});

// Función para enviar estado del reproductor
function sendPlayerStateFull() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'playerState',
            data: {
                htmlActive: isHTMLVideoActive,
                youtubeActive: isYouTubeActive,
                htmlVolume: htmlVolume,
                youtubeVolume: youtubeVolume,
                masterVolume: masterVolume,
                htmlOpacity: parseFloat(videoPlayerDiv?.style.opacity) || 0,
                                   youtubeOpacity: parseFloat(document.getElementById('youtube-container')?.style.opacity) || 0
            }
        }));
        console.log('Iniciando envio de mensaje playerstate');
    }
}

// Configurar el observer para observar cambios en el atributo 'loop'
observer.observe(video, {
    attributes: true  // Solo monitoreamos cambios en los atributos
});
/////////////////////////////// fin vigilar loop ////////////////////////////////////////////////////////////////////7

//monitor status loop
const playerS = document.getElementById('player');
 // Variable para rastrear el estado de conexión
    let isSocketOpen = false;
let lastLoopStatus = null;
    ws.addEventListener('open', function() {
        isSocketOpen = true; // La conexión se ha abierto
        console.log('WebSocket conectado');
    });

    ws.addEventListener('close', function() {
        isSocketOpen = false; // La conexión se ha cerrado
        console.log('WebSocket desconectado');
    });

    // Función para verificar el estado de loop
/*   function checkLoopStatus() {
        if (isSocketOpen) {
        const loopStatus = playerS.hasAttribute('loop'); // Verificar si el atributo loop está presente
        console.log('El estado de loop1 es:', loopStatus);
        // Solo enviar si el estado ha cambiado
            if (loopStatus !== lastLoopStatus) {
            ws.send(`LOOP_STATUS: ${loopStatus}`);
            console.log('El estado de loop es:', loopStatus);
            lastLoopStatus = loopStatus; // Actualizar el último estado enviado
            }
        } else {
            console.warn('El WebSocket no está conectado. Estado actual:', ws.readyState);
        }

    }
*/
    // También necesitas modificar la función checkLoopStatus para que sea más precisa:
function checkLoopStatus() {
    // Verificar el estado actual del loop del video
    const isLoopActive = player.loop || player.hasAttribute('loop');  // Verificar si el atributo loop está presente
    console.log('Estado de loop actual:', isLoopActive);

    if (isSocketOpen) {
        if (isLoopActive !== lastLoopStatus) {
            ws.send(`LOOP_STATUS: ${isLoopActive}`);
            console.log('El estado de loop es:', isLoopActive);
            lastLoopStatus = isLoopActive;  // Actualizar el último estado enviado
            updateLocalStorageAndSocket();

        }
    } else {
        updateLocalStorageAndSocket();

        console.warn('El WebSocket no está conectado. Estado actual:', ws.readyState);
    }
}


let reconnectInterval = 5000;  // Intervalo de reconexión en milisegundos (5 segundos)
let maxReconnectAttempts = 10;  // Intentos máximos de reconexión

let reconnectAttempts1 = 0;  // Intentos actuales de reconexión para el WebSocket 1
let reconnectAttempts2 = 0;  // Intentos actuales de reconexión para el WebSocket 2

// Función para crear y manejar la conexión WebSocket
function connectWebSocket(serverUrl, socketIndex) {
    let socket;

    // Crear WebSocket
    socket = new WebSocket(serverUrl);

    // Configuración del WebSocket
    socket.onopen = function() {
        console.log(`Conexión WebSocket ${socketIndex} establecida`);
        // Resetear intentos de reconexión cuando la conexión es exitosa
        if (socketIndex === 1) {
            reconnectAttempts1 = 0;
        } else {
            reconnectAttempts2 = 0;
        }
    };

    socket.onclose = function() {
        console.log(`Conexión WebSocket ${socketIndex} cerrada`);
        attemptReconnect(serverUrl, socketIndex);  // Intentar reconectar
    };

    socket.onerror = function(error) {
        console.log(`Error en WebSocket ${socketIndex}:`, error);
    };

    socket.onmessage = function(event) {
       // console.log(`Mensaje recibido del WebSocket ${socketIndex}:`, event.data);
    };

    // Retornar el socket si es necesario hacer algo adicional
    return socket;
}

// Función para intentar la reconexión de un WebSocket
function attemptReconnect(serverUrl, socketIndex) {
    let reconnectAttempts = (socketIndex === 1) ? reconnectAttempts1 : reconnectAttempts2;

    if (reconnectAttempts < maxReconnectAttempts) {
        console.log(`Reintentando conexión con el servidor ${socketIndex}...`);
        reconnectAttempts++;

        // Actualizar el número de intentos de reconexión
        if (socketIndex === 1) {
            reconnectAttempts1 = reconnectAttempts;
        } else {
            reconnectAttempts2 = reconnectAttempts;
        }

        // Intentar reconectar después de un intervalo
        setTimeout(function() {
            connectWebSocket(serverUrl, socketIndex);
        }, reconnectInterval);
    } else {
        console.log(`Máximo número de intentos de reconexión alcanzado para el servidor ${socketIndex}`);
    }
}

// Iniciar la conexión con los dos servidores WebSocket
const wsServer1 = `ws://${window.location.hostname}:8080`;
const wsServer2 = `ws://${window.location.hostname}:8081`;
const wsServer3 = `ws://${window.location.hostname}:8084`;

// Conectar ambos WebSockets
let socket1 = connectWebSocket(wsServer1, 1);
let socket2 = connectWebSocket(wsServer2, 2);
let socket3 = connectWebSocket(wsServer3, 3);



 // Ejecutar la carga de videos al inicio
/*    window.onload = async () => {
     checkLoopStatus();
        loadVideo();
        await cargarVideos(); // Cargar videos al inicio
       // console.log('Videos cargados:', videos); // Comprobar si los videos se cargaron correctamente
    };
*/
    ////////////////////////////// inicio sincronizar con lista.html  /////////////////////////////////////////////////
        // Función para enviar estado de sincronización

function sendSyncState() {
    if (socket.readyState !== WebSocket.OPEN || isSyncing) return;

    // Solo enviar si el video está cargado
    if (player.readyState > 1) { // 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
        const syncMsg = {
            type: 'sync',
            src: player.src,
            currentTime: player.currentTime,
            state: player.paused ? 'paused' : 'playing',
            isExternal: isExternalVideo,
            timestamp: Date.now(),
            index: currentIndex,
            duration: player.duration
        };

        socket.send(JSON.stringify(syncMsg));
    }
}


// En el reproductor principal (PantallaBiblia.html), agregar:
function sendTimeUpdate() {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'timeUpdate',
            currentTime: player.currentTime,
            duration: player.duration,
            index: currentIndex
        }));
    }
}

///////////////// para fijar posicion contentBox  ////////////////////////////////////////
// Configuración inicial desde localStorage
const savedTheme = localStorage.getItem("pluginTheme") || "1";
const savedPosition = localStorage.getItem("pluginPosition") || "center";

// Aplica configuración guardada al cargar
function initPlugin() {
    const plugin = document.getElementById("contentBox");
    plugin.setAttribute("data-theme", savedTheme);
    plugin.setAttribute("data-position", savedPosition);
}

initPlugin();

//function updatePlugin(event) {
function updatePlugin(theme, position) {
    const data = event.data.split(':');
    console.log('Mensaje recibido cambiar plugin:', data);

    const base = data[2];
    console.log('Valor base:', base);

    const plugin = document.getElementById("contentBox");
    const title = document.getElementById("title");
    const verseContent = document.getElementById("verse-content");

    if (['top', 'center', 'centerm', 'bottom'].includes(base)) {
        plugin.setAttribute("data-position", base);
        localStorage.setItem("pluginPosition", base);
    } else {
        plugin.setAttribute("data-theme", base);
        title.setAttribute("data-theme", base);
        verseContent.setAttribute("data-theme", base);
        localStorage.setItem("pluginTheme", base);
    }
}

// Configurar intervalo para enviar actualizaciones de tiempo
setInterval(sendTimeUpdate, 500); // Enviar actualización cada 500ms

// Event listeners para detectar cambios y enviar sincronización
player.addEventListener('play', sendSyncState);
player.addEventListener('pause', sendSyncState);
player.addEventListener('seeked', sendSyncState);
player.addEventListener('ratechange', sendSyncState);

// Sincronización periódica
setInterval(sendSyncState, 2000); // Enviar cada 2 segundos

////////////////////////////// fin sincronizar con lista.html  /////////////////////////////////////////////////
        // ===== INTEGRACIÓN CON YOUTUBE =====

// Inicializar en modo multimedia
youtubeContainer.style.display = 'none';

// Inicializar overlay de YouTube
youtubeOverlay.style.backgroundImage = `url('${YT_CONFIG.overlayImage}')`;
youtubeOverlay.style.opacity = 1;

// Cargar API de YouTube
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 🔥 FUNCIÓN MEJORADA PARA INICIALIZAR WEBSOCKET        yt-ws   ////////////////
function initializeWebSocket() {
    const wsUrl = `ws://${window.location.hostname}:${PORT_YTPLAYER_WS}`;
    console.log(`🔗 Conectando a: ${wsUrl}`);

    ytWs = new WebSocket(wsUrl);
    isWebSocketReady = false;

    ytWs.addEventListener('open', () => {
        console.log('✅ Conexión WebSocket ytWs abierta');
        isWebSocketReady = true;

        // 🔥 Procesar mensajes pendientes
        while (pendingMessages.length > 0) {
            const message = pendingMessages.shift();
            sendWebSocketMessage(message.type, message.data);
        }

        // Solicitar estado actual
        sendWebSocketMessage('request-state');

    });

    ytWs.addEventListener('error', (error) => {
        console.error('❌ Error en WebSocket ytWs:', error);
        isWebSocketReady = false;
    });

    ytWs.addEventListener('close', () => {
        console.log('🔌 Conexión WebSocket ytWs cerrada');
        isWebSocketReady = false;

        // 🔥 Reconectar después de 3 segundos
        setTimeout(() => {
            console.log('🔄 Intentando reconectar WebSocket...');
            initializeWebSocket();
        }, 3000);
    });

    ytWs.addEventListener('message', (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('📨 Mensaje recibido de ytWs:', message);

            switch (message.type) {

            //    switch (message.type) {
                    case 'init-state':
                        sendPlayerStateFull();
                         handleInitState(message);
                        const state = message.data;
                        if (state.queue) {
                            ytQueue = state.queue;
                        }
                        if (state.isAutoPlayEnabled !== undefined) {
                            isYtAutoPlayEnabled = state.isAutoPlayEnabled;
                        }
                        if (state.currentVideoIndex !== undefined) {
                            currentYtIndex = state.currentVideoIndex;
                        }
                        if (ytQueue.length > 0 && ytPlayer) {
                            // loadYtVideo(currentYtIndex >= 0 ? currentYtIndex : 0); // para reproducir automáticamente al inicio
                        }
                        break;

                    case 'update-queue':
                        ytQueue = message.data;
                        break;

                    case 'autoplay-state':
                        isYtAutoPlayEnabled = message.data;
                        break;

                    case 'set-video':
                        const url = message.data;
                        console.log(`Mostrando ${url} videos`);
                        const videoId = extractYtVideoId(url);
                        if (videoId && ytPlayer) {
                            const newItem = { url: url, title: "Nuevo video", thumbnail: "" };
                            ytQueue.push(newItem);
                            currentYtIndex = ytQueue.length - 1;
                            loadYtVideo(currentYtIndex);
                        }
                        break;

                    case 'play-video-index':
                        const index = message.data;
                        if (index >= 0 && index < ytQueue.length) {
                            currentYtIndex = index;
                            loadYtVideo(index);
                        }
                        break;

                    case 'play-all':
                        if (ytQueue.length > 0) {
                            currentYtIndex = 0;
                            loadYtVideo(0);
                            playNextYtVideo();
                        }
                        break;

                    case 'yt-control':
                        const { cmd, value } = message.data;
                        handleYtControl(cmd, value);
                        break;
                   default:
                    console.log('❓ Tipo de mensaje no manejado:', message.type);
            }
        } catch (error) {
            console.error('❌ Error procesando mensaje WebSocket:', error);
        }
    });
}

// 🔥 FUNCIÓN MEJORADA PARA ENVIAR MENSAJES WEBSOCKET
function sendWebSocketMessage(type, data = null) {
    const message = data !== null ? { type, data } : { type };

    if (isWebSocketReady && ytWs && ytWs.readyState === WebSocket.OPEN) {
        ytWs.send(JSON.stringify(message));
        console.log('📤 Mensaje enviado:', message);
    } else {
        console.log('⏳ Mensaje en cola (WebSocket no listo):', message);
        pendingMessages.push({ type, data });

        // 🔥 Si el WebSocket está cerrado, intentar reconectar
        if (!ytWs || ytWs.readyState === WebSocket.CLOSED) {
            initializeWebSocket();
            //updateLocalStorageAndSocket();
        }
    }
}

// 🔥 FUNCIÓN MEJORADA PARA MANEJAR ESTADO INICIAL
function handleInitState(message) {
    const state = message.data;
    console.log('🔄 Iniciando carga del estado:', state);

    queue = state.queue || [];
    isAutoPlayEnabled = state.isAutoPlayEnabled || false;
    isCurrentlyPlaying = state.isPlaying || false;

    // Actualizar UI
    //updateAutoplayUI();
    //renderQueue();
    sendPlayerStateFull();
    // 🔥 Lógica mejorada para reproducción automática
    const shouldAutoPlay = state.autoPlayOnStart &&
    queue.length > 0 &&
    !isCurrentlyPlaying;

   /* if (shouldAutoPlay) {
        console.log('🎵 Reproducción automática iniciada');
        currentVideoIndex = 0;
        sendWebSocketMessage('play-video-index', 0);
        showStatusMessage(`Reproduciendo lista con ${queue.length} videos`);
    } else {
        console.log('⏸️  Reproducción automática no iniciada:', {
            autoPlayOnStart: state.autoPlayOnStart,
            queueLength: queue.length,
            isCurrentlyPlaying: isCurrentlyPlaying
        });
    }*/
}


// Cuando la API de YouTube está lista
window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('youtube-iframe', {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0
        },
        events: {
            'onReady': initializeWebSocket,                  //onYtPlayerReady,   ////initializeWebSocket
            'onStateChange': onYtPlayerStateChange
        }
    });
};
/////////////////////////////////// yt-ws /////////////////////////////////////////////
/*
function onYtPlayerReady(event) {
    console.log('Reproductor YouTube listo');

    const wsUrl = `ws://${window.location.hostname}:${PORT_YTPLAYER_WS}`;
    console.log(`🔗 Conectando a: ${wsUrl}`);

    ytWs = new WebSocket(wsUrl);
    isWebSocketReady = false;

    // Solicitar estado actual al servidor (vía WebSocket)
     if (!isWebSocketReady) return;
    ytWs.send('request-state');

    // Manejar mensajes del servidor
    ytWs.handleMessage = function(message) {
        switch (message.type) {
            case 'init-state':                 ////youtube
                const state = message.data;
                sendPlayerStateFull();
                if (state.queue) {
                    ytQueue = state.queue;
                }
                if (state.isAutoPlayEnabled !== undefined) {
                    isYtAutoPlayEnabled = state.isAutoPlayEnabled;
                }
                if (state.currentVideoIndex !== undefined) {
                    currentYtIndex = state.currentVideoIndex;
                }
                if (ytQueue.length > 0 && ytPlayer) {
                    // loadYtVideo(currentYtIndex >= 0 ? currentYtIndex : 0); // para reproducir automáticamente al inicio
                }
                break;

            case 'update-queue':
                ytQueue = message.data;
                break;

            case 'autoplay-state':
                isYtAutoPlayEnabled = message.data;
                break;

            case 'set-video':
                const url = message.data;
                 console.log(`Mostrando ${url} videos`);
                const videoId = extractYtVideoId(url);
                if (videoId && ytPlayer) {
                    const newItem = { url: url, title: "Nuevo video", thumbnail: "" };
                    ytQueue.push(newItem);
                    currentYtIndex = ytQueue.length - 1;
                    loadYtVideo(currentYtIndex);
                }
                break;

            case 'play-video-index':
                const index = message.data;
                if (index >= 0 && index < ytQueue.length) {
                    currentYtIndex = index;
                    loadYtVideo(index);
                }
                break;

            case 'play-all':
                if (ytQueue.length > 0) {
                    currentYtIndex = 0;
                    loadYtVideo(0);
                    playNextYtVideo();
                }
                break;
            case 'yt-control':
                const { cmd, value } = message.data;
                handleYtControl(cmd, value);
                break;
        }
    };
}
*/
function handleYtControl(cmd, value) {
    if (!ytPlayer) return;

    switch (cmd) {
        case 'play':
            playYtVideoWithDelay();
            showYtOverlay();
             sendPlayerStateFull();   //envia mensajes de status de los reproductores.
            break;
        case 'pause':
            ytPlayer.pauseVideo();
             sendPlayerStateFull();
            break;
        case 'stop':
            ytPlayer.stopVideo();
            showYtOverlay();
             sendPlayerStateFull();
            break;
        case 'next':
            playNextYtVideo();
            showYtOverlay();
             sendPlayerStateFull();
            console.log('next');
            break;
        case 'seek':
            ytPlayer.seekTo(value || 0, true);
            scheduleYtEndOverlay();
             sendPlayerStateFull();
            break;
        case 'toggle-autoplay':
            isYtAutoPlayEnabled = value;
            break;
    }
}
/*
function onYtPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        if (isYtInitialPlay) {
            isYtInitialPlay = false;
            ytStartOverlayTimeout = setTimeout(() => {
                hideYtOverlay();
            }, YT_CONFIG.initialHideDelay);
        }

        scheduleYtEndOverlay();
    }
    else if (event.data === YT.PlayerState.ENDED) {
        showYtOverlay();
        ytWs.send(JSON.stringify({type: 'video-ended'}));
        if (isYtAutoPlayEnabled && ytQueue.length > 0) {
            setTimeout(() => {
                playNextYtVideo();                                   ///////////////////////////solo esta vale
            }, YT_CONFIG.preEndShowDelay);
        }
    }
    else if (event.data === YT.PlayerState.PAUSED ||
        event.data === YT.PlayerState.CUED) {
        // youtubePlayButton.style.display = 'block';
        }
        else if (event.data === YT.PlayerState.BUFFERING) {
            showYtOverlay();
        }
}
*/

function onYtPlayerStateChange(event) {
    console.log('🔄 Estado YouTube:', getYtStateName(event.data), 'Video actual:', ytCurrentVideoId);

    switch (event.data) {
        case YT.PlayerState.PLAYING:
            console.log('▶️ Reproduciendo video:', ytCurrentVideoId);
            if (isYtInitialPlay) {
                isYtInitialPlay = false;
                ytStartOverlayTimeout = setTimeout(() => {
                    hideYtOverlay();
                }, YT_CONFIG.initialHideDelay);
            }
            isTransitioning = false;
            scheduleYtEndOverlay();
            break;

        case YT.PlayerState.ENDED:
            console.log('⏹️ Video terminado:', ytCurrentVideoId, 'Autoplay:', isYtAutoPlayEnabled);
            showYtOverlay();

            // Limpiar timeout del overlay anterior
            clearTimeout(ytEndOverlayTimeout);

            if (isYtAutoPlayEnabled && ytQueue.length > 0 && !isTransitioning) {
                isTransitioning = true;

                // 🔥 LIMPIAR TIMEOUT ANTERIOR ANTES DE CREAR UNO NUEVO
                clearTimeout(ytNextVideoTimeout);

                ytNextVideoTimeout = setTimeout(() => {
                    console.log('🔄 Iniciando siguiente video después de delay');
                    if (isTransitioning) {
                        playNextYtVideo();
                    }
                }, YT_CONFIG.preEndShowDelay);
            }
            break;

        case YT.PlayerState.BUFFERING:
            console.log('📥 Buffering video:', ytCurrentVideoId);
            // NO mostrar overlay durante buffering - deja que el reproductor maneje la transición
            break;

        case YT.PlayerState.CUED:
            console.log('🎯 Video cargado (cued):', ytCurrentVideoId);
            break;

        case YT.PlayerState.PAUSED:
            console.log('⏸️ Video pausado:', ytCurrentVideoId);
            break;

        case YT.PlayerState.UNSTARTED:
            console.log('❓ Video no iniciado:', ytCurrentVideoId);
            break;
    }
}


function showYtOverlay() {
    clearTimeout(ytStartOverlayTimeout);
    youtubeOverlay.style.opacity = 1;
    youtubeOverlay.classList.remove('hidden');
}

function hideYtOverlay() {
    youtubeOverlay.classList.add('hidden');
    setTimeout(() => {
        youtubeOverlay.style.opacity = 0;
    }, YT_CONFIG.fadeDuration);
}
/*
function scheduleYtEndOverlay() {
    const currentTime = ytPlayer.getCurrentTime();
    ytVideoDuration = ytPlayer.getDuration();
    const remainingTime = ytVideoDuration - currentTime;

    const timeBeforeEnd = remainingTime - (YT_CONFIG.preEndShowDelay / 1000);

    if (timeBeforeEnd > 0) {
        clearTimeout(ytEndOverlayTimeout);
        ytEndOverlayTimeout = setTimeout(() => {
            showYtOverlay();
        }, timeBeforeEnd * 1000);
    }
}
*/
function scheduleYtEndOverlay() {
    if (!ytPlayer || !ytCurrentVideoId) return;

    try {
        const currentTime = ytPlayer.getCurrentTime();
        const duration = ytPlayer.getDuration();

        if (duration && currentTime) {
            const remainingTime = duration - currentTime;
            const timeBeforeEnd = remainingTime - (YT_CONFIG.preEndShowDelay / 1000);

            if (timeBeforeEnd > 0) {
                clearTimeout(ytEndOverlayTimeout);
                ytEndOverlayTimeout = setTimeout(() => {
                    console.log('🕒 Mostrando overlay (fin próximo)');
                    showYtOverlay();
                }, timeBeforeEnd * 1000);
            }
        }
    } catch (error) {
        console.error('Error al programar overlay:', error);
    }
}

/*
function loadYtVideo(index) {
    if (!ytPlayer || !ytQueue[index]) return;

    showYtOverlay();
    isYtInitialPlay = true;

    const videoId = extractYtVideoId(ytQueue[index].url);
    if (!videoId) return;

    ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: 0
    });

    currentYtIndex = index;
}
*/
function loadYtVideo(index) {
    if (!ytPlayer || !ytQueue[index]) {
        console.log('❌ Reproductor no disponible o índice inválido');
        isTransitioning = false;
        return;
    }

    const videoId = extractYtVideoId(ytQueue[index].url);
    if (!videoId) {
        console.log('❌ ID de video inválido');
        isTransitioning = false;
        return;
    }

    // 🔥 VERIFICAR SI ES EL MISMO VIDEO ACTUAL
    if (videoId === ytCurrentVideoId) {
        console.log('⚠️ Mismo video, saltando carga');
        isTransitioning = false;
        return;
    }

    console.log('🎬 Cargando nuevo video:', videoId, 'Índice:', index);

    showYtOverlay();
    isYtInitialPlay = true;
    ytCurrentVideoId = videoId; // 🔥 ACTUALIZAR VIDEO ACTUAL

    // 🔥 LIMPIAR COMPLETAMENTE ANTES DE CARGAR NUEVO VIDEO
    clearTimeout(ytEndOverlayTimeout);
    clearTimeout(ytStartOverlayTimeout);

    // Cargar el nuevo video
    ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: 0
    });

    currentYtIndex = index;

    // 🔥 ENVIAR ESTADO AL SERVIDOR
    sendWebSocketMessage('video-changed', {
        index: index,
        videoId: videoId,
        title: ytQueue[index].title || 'Sin título'
    });
}


function playYtVideoWithDelay() {
    // youtubePlayButton.style.display = 'none';
    // loadYtVideo(0);
    ytPlayer.playVideo();
    hideYtOverlay();
}
/*
function playNextYtVideo() {
    if (ytQueue.length === 0) return;
    const nextIndex = (currentYtIndex + 1) % ytQueue.length;
    loadYtVideo(nextIndex);
}
*/
function playNextYtVideo() {
    if (ytQueue.length === 0) {
        console.log('❌ Cola vacía, no hay siguiente video');
        isTransitioning = false;
        return;
    }

    const nextIndex = (currentYtIndex + 1) % ytQueue.length;
    console.log('🎵 Avanzando al índice:', nextIndex, 'de', ytQueue.length - 1);

    // 🔥 DETENER COMPLETAMENTE EL VIDEO ACTUAL ANTES DE CARGAR EL SIGUIENTE
    if (ytPlayer && ytPlayer.stopVideo) {
        ytPlayer.stopVideo();
    }

    // Pequeño delay para asegurar que el reproductor se limpie
    setTimeout(() => {
        loadYtVideo(nextIndex);
    }, 100);
}

function extractYtVideoId(url) {
    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) {
        console.error('URL inválida:', url);
        return null;
    }
}

// Métodos para enviar comandos al servidor
function sendYtCommand(type, data) {
    ytWs.send(type, data);
}

// Función helper para debug de estados
function getYtStateName(state) {
    const states = {
        [-1]: 'UNSTARTED',
        [0]: 'ENDED',
        [1]: 'PLAYING',
        [2]: 'PAUSED',
        [3]: 'BUFFERING',
        [5]: 'CUED'
    };
    return states[state] || 'UNKNOWN';
}

// Función principal que se ejecuta al cargar la página
/*window.onload = async () => {
    console.log('🚀 Inicializando aplicación...');
    await initializeApp();
};
*/
// Función para inicializar la aplicación
async function initializeApp() {
    initializeWebSocket();
    await cargarVideos(); // Cargar videos al inicio
    loadVideo();
// renderQueue();
    // Cargar configuración guardada si existe
    loadSavedConfig();

    // Solicitar estado actual si el WebSocket está listo
    requestCurrentState();
}

// Función para cargar la configuración guardada
function loadSavedConfig() {
    const savedConfig = localStorage.getItem('bibleDisplayConfig');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            applyStylesFromConfig(config);
            console.log('Configuración guardada aplicada al iniciar');
        } catch (error) {
            console.error('Error al cargar configuración guardada:', error);
        }
    }

    // Aplicar estilos cuando el tema cambie (si usas temas)
    const titleElement = document.getElementById('title');
    const verseContentElement = document.getElementById('verse-content');

    if (titleElement) {
        titleElement.addEventListener('DOMAttrModified', (e) => {
            if (e.attrName === 'data-theme') {
                applyConfigOnThemeChange();
            }
        });
    }
}

// Función para aplicar la configuración en caso de un cambio de tema
function applyConfigOnThemeChange() {
    const savedConfig = localStorage.getItem('bibleDisplayConfig');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            applyStylesFromConfig(config);
        } catch (error) {
            console.error('Error al aplicar configuración con cambio de tema:', error);
        }
    }
}

// Función para solicitar el estado actual del WebSocket
function requestCurrentState() {
    setTimeout(() => {
        if (isWebSocketReady) {
            sendWebSocketMessage('request-state');
            updateLocalStorageAndSocket();
        } else {
            console.log('⏳ WebSocket no listo, reintentando en 1 segundo...');
            requestCurrentState(); // Reintento
        }
    }, 1000);
}


////////////   color  ////////

// Función para obtener la configuración actual de los estilos
function getCurrentStyles() {
    const titleElement = document.getElementById('title');
    const verseContentElement = document.getElementById('verse-content');

    const currentStyles = {
        title: {},
        content: {}
    };

    if (titleElement) {
        currentStyles.title = {
            fontFamily: titleElement.style.fontFamily,
            fontSize: titleElement.style.fontSize,
            color: titleElement.style.color,
            backgroundColor: titleElement.style.backgroundColor,
            shadow: titleElement.style.textShadow !== 'none',
            shadowColor: titleElement.style.textShadow.replace(/^[^#]*#/, '#'),
                              bold: titleElement.style.fontWeight === 'bold',
                              italic: titleElement.style.fontStyle === 'italic'
        };
    }

    if (verseContentElement) {
        currentStyles.content = {
            fontFamily: verseContentElement.style.fontFamily,
            fontSize: verseContentElement.style.fontSize,
            color: verseContentElement.style.color,
            lineHeight: verseContentElement.style.lineHeight,
            shadow: verseContentElement.style.textShadow !== 'none',
            shadowColor: verseContentElement.style.textShadow.replace(/^[^#]*#/, '#'),
                              bold: verseContentElement.style.fontWeight === 'bold',
                              italic: verseContentElement.style.fontStyle === 'italic',
                              padding: verseContentElement.style.padding
        };
    }

    return currentStyles;
}



let displayConfig = {
    title: {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#333333',
        shadow: true,
        shadowColor: '#000000',
        bold: true,
        italic: false
    },
    content: {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        lineHeight: '1.4',
        shadow: true,
        shadowColor: '#000000',
        bold: false,
        italic: false,
        padding: '10px'
    }
};

// Función para aplicar estilos al título
function applyTitleStyles() {
    const titleElement = document.getElementById('title');
    if (titleElement) {
        const title = displayConfig.title;
        titleElement.style.fontFamily = title.fontFamily;
        titleElement.style.fontSize = title.fontSize;
        titleElement.style.color = title.color;
        titleElement.style.backgroundColor = title.backgroundColor;
        titleElement.style.fontWeight = title.bold ? 'bold' : 'normal';
        titleElement.style.fontStyle = title.italic ? 'italic' : 'normal';
        titleElement.style.padding = '10px';
        titleElement.style.borderRadius = '5px';
        titleElement.style.textAlign = 'center';

        if (title.shadow) {
            titleElement.style.textShadow = `2px 2px 4px ${title.shadowColor}`;
        } else {
            titleElement.style.textShadow = 'none';
        }
    }
}

// Función para aplicar estilos al contenido
function applyContentStyles() {
    const contentElement = document.getElementById('verse-contentId');
    if (contentElement) {
        const content = displayConfig.content;
        contentElement.style.fontFamily = content.fontFamily;
        contentElement.style.fontSize = content.fontSize;
        contentElement.style.color = content.color;
        contentElement.style.lineHeight = content.lineHeight;
        contentElement.style.fontWeight = content.bold ? 'bold' : 'normal';
        contentElement.style.fontStyle = content.italic ? 'italic' : 'normal';
        contentElement.style.padding = content.padding;

        if (content.shadow) {
            contentElement.style.textShadow = `1px 1px 2px ${content.shadowColor}`;
        } else {
            contentElement.style.textShadow = 'none';
        }
    }
}


function applyStylesFromConfig(config) {
    console.log('Aplicando estilos desde configuración:', config);

    // Aplicar estilos al título
    const titleElement = document.getElementById('title');
    if (titleElement && config.title) {
        applyTitleStyles(titleElement, config.title);
    }

    // Aplicar estilos al contenido de versículos
    const verseContentElement = document.getElementById('verse-content');
    if (verseContentElement && config.content) {
        applyContentStyles(verseContentElement, config.content);
    }
}

// Función para aplicar estilos al título
function applyTitleStyles(element, titleConfig) {
    // Estilos de texto
    element.style.fontFamily = titleConfig.fontFamily || 'Arial';
    element.style.fontSize = titleConfig.fontSize || '32px';
    element.style.color = titleConfig.color || '#ffffff';
    element.style.fontWeight = titleConfig.bold ? 'bold' : 'normal';
    element.style.fontStyle = titleConfig.italic ? 'italic' : 'normal';
    element.style.textAlign = 'center';

    // Estilos de fondo
    element.style.backgroundColor = titleConfig.backgroundColor || '#333333';
    element.style.padding = '15px 20px';
    element.style.borderRadius = '8px';
    element.style.marginBottom = '-14px';
    element.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';

    // Sombra de texto
    if (titleConfig.shadow) {
        element.style.textShadow = `2px 2px 4px ${titleConfig.shadowColor || '#000000'}`;
    } else {
        element.style.textShadow = 'none';
    }

    // Asegurar que el texto sea legible
    element.style.lineHeight = '1.2';
    element.style.letterSpacing = '0.5px';

    console.log('Estilos de título aplicados:', titleConfig);
}
// Función para aplicar estilos al contenido de versículos
function applyContentStyles(element, contentConfig) {
    // Estilos de texto
    element.style.fontFamily = contentConfig.fontFamily || 'Arial';
    element.style.fontSize = contentConfig.fontSize || '124px';
    element.style.color = contentConfig.color || '#ffffff';
    element.style.lineHeight = contentConfig.lineHeight || '1.4';
    element.style.fontWeight = contentConfig.bold ? 'bold' : 'normal';
    element.style.fontStyle = contentConfig.italic ? 'italic' : 'normal';

    // Espaciado y layout
    element.style.padding = contentConfig.padding || '20px';
    element.style.textAlign = 'justify';
    element.style.margin = '0 auto';
    element.style.maxWidth = '98%';

    // Sombra de texto
    if (contentConfig.shadow) {
        element.style.textShadow = `1px 1px 3px ${contentConfig.shadowColor || '#000000'}`;
    } else {
        element.style.textShadow = 'none';
    }

    // Mejorar legibilidad
    element.style.wordWrap = 'break-word';
    element.style.overflowWrap = 'break-word';
    element.style.letterSpacing = '0.3px';

    console.log('Estilos de contenido aplicados:', contentConfig);
}


///// color  ///////

function updateLocalStorageAndSocket() {
    localStorage.setItem('playlist', JSON.stringify(reproducirLista));

    // Verificar que el WebSocket esté abierto antes de enviar
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'updatePlaylist', data: reproducirLista }));
    } else {
        console.warn('WebSocket no está listo. Estado:', socket.readyState);
        // Opcional: reintentar después de un tiempo
        setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'updatePlaylist', data: reproducirLista }));
            }
        }, 100);
    }
}

// ============ RECEPCIÓN DE LETRAS KARAOKE DESDE SERVIDOR MIDI ============
function createKaraokeOverlay() {
    if (document.getElementById('karaoke-overlay')) {
        return document.getElementById('karaoke-overlay');
    }

    console.log('🆕 Creando overlay con posición inicial:', proyectorPosition);
    console.log('🆕 Tamaño inicial:', proyectorFontSize);

    const overlay = document.createElement('div');
    overlay.id = 'karaoke-overlay';

    let positionStyle = '';
    switch(proyectorPosition) {
        case 'top':
            positionStyle = 'top: 10%; bottom: auto; transform: none;';
            break;
        case 'middle':
            positionStyle = 'top: 50%; bottom: auto; transform: translateY(-50%);';
            break;
        default:
            positionStyle = 'bottom: 15%; top: auto; transform: none;';
            break;
    }

   overlay.style.cssText = `
    position: fixed;
    left: 0;
    right: 0;
    text-align: center;
    z-index: 200;
    pointer-events: none;
    transition: all 0.3s ease;
    font-family:  '"Bebas Neue", sans-serif',
    font-size: ${proyectorFontSize}px;
    font-weight: '"Bungee", sans-serif';
    color: #CEFAFE;
    text-shadow: 5px 3px 6px black;
    background: rgba(0,0,0,0.5);
    padding: 10px 10px;
    margin: 0 5%;
    border-radius: 15px;
    backdrop-filter: blur(5px);
    ${positionStyle}
`;
//'Arial', sans-serif;
    document.body.appendChild(overlay);
    console.log('✅ Overlay creado');
    return overlay;
}
/*function createKaraokeOverlay() {
    if (document.getElementById('karaoke-overlay')) {
        return document.getElementById('karaoke-overlay');
    }

    console.log('🆕 Creando overlay con posición inicial:', proyectorPosition);

    const overlay = document.createElement('div');
    overlay.id = 'karaoke-overlay';

    // Establecer posición inicial basada en proyectorPosition
    let positionStyle = '';
    switch(proyectorPosition) {
        case 'top':
            positionStyle = 'top: 10%; bottom: auto; transform: none;';
            break;
        case 'middle':
            positionStyle = 'top: 50%; bottom: auto; transform: translateY(-50%);';
            break;
        default:
            positionStyle = 'bottom: 15%; top: auto; transform: none;';
            break;
    }

    overlay.style.cssText = `
    position: fixed;
    left: 0;
    right: 0;
    text-align: center;
    z-index: 200;
    pointer-events: none;
    transition: all 0.3s ease;
    font-family: 'Arial', sans-serif;
    font-size: ${proyectorFontSize}px;
    font-weight: bold;
    color: white;
    text-shadow: 3px 3px 6px black;
    background: rgba(0,0,0,0.2);
    padding: 20px;
    margin: 0 10%;
    border-radius: 15px;
    backdrop-filter: blur(5px);
    ${positionStyle}
    `;

    document.body.appendChild(overlay);
    console.log('✅ Overlay creado', overlay.style.cssText);
    return overlay;
}
  */    
    // Versión corregida de showKaraokeLyric
/*    function showKaraokeLyric(text, positionFromServer = null, velocity = 0, totalLines = 0) {
        console.log(`🎤 showKaraokeLyric llamado - texto: "${text?.substring(0, 30)}", positionFromServer: ${positionFromServer}, positionGlobal: ${proyectorPosition}`);

        let overlay = document.getElementById('karaoke-overlay');
        if (!overlay) {
            console.log('🆕 Creando nuevo overlay');
            overlay = createKaraokeOverlay();
        }

        // PRIORIDAD: Usar posición del servidor si viene, si no usar la global
        let activePosition = proyectorPosition;
        if (positionFromServer && positionFromServer !== 'undefined') {
            activePosition = positionFromServer;
            console.log(`📍 Usando posición del servidor: ${activePosition}`);
        } else {
            console.log(`📍 Usando posición global: ${activePosition}`);
        }

        // Configurar posición
        switch(activePosition) {
            case 'top':
                overlay.style.top = '10%';
                overlay.style.bottom = 'auto';
                overlay.style.transform = 'none';
                console.log('⬆️ Posición: Arriba');
                break;
            case 'middle':
                overlay.style.top = '50%';
                overlay.style.bottom = 'auto';
                overlay.style.transform = 'translateY(-50%)';
                console.log('⬜ Posición: Medio');
                break;
            case 'bottom':
            default:
                overlay.style.bottom = '15%';
                overlay.style.top = 'auto';
                overlay.style.transform = 'none';
                console.log('⬇️ Posición: Abajo');
                break;
        }

        // Aplicar tamaño actual
        overlay.style.fontSize = proyectorFontSize + 'px';

        // Mostrar letra
        overlay.style.opacity = '0';
        //Mostrar informacion del velocity
    
        overlay.innerHTML = `
        <div style="animation: karaokeFadeIn 0.3s ease forwards;">
        ${escapeHtml(text)}
        </div>
        `;

        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
    }
*/
/*    function showKaraokeLyric(text, positionFromServer = null, velocity = 0, totalLines = 0, isEmpty = false) {
        let overlay = document.getElementById('karaoke-overlay');
        if (!overlay) {
            overlay = createKaraokeOverlay();
        }

        // Usar posición global
        let activePosition = proyectorPosition;

        // Configurar posición
        switch(activePosition) {
            case 'top':
                overlay.style.top = '10%';
                overlay.style.bottom = 'auto';
                overlay.style.transform = 'none';
                break;
            case 'middle':
                overlay.style.top = '50%';
                overlay.style.bottom = 'auto';
                overlay.style.transform = 'translateY(-50%)';
                break;
            case 'bottom':
            default:
                overlay.style.bottom = '15%';
                overlay.style.top = 'auto';
                overlay.style.transform = 'none';
                break;
        }

        overlay.style.fontSize = proyectorFontSize + 'px';

        // ⭐ Si es línea vacía, mostrar overlay transparente o con un punto sutil
        if (isEmpty || text === '') {
            overlay.style.opacity = '0.3';
            overlay.innerHTML = `<div style="animation: karaokeFadeIn 0.3s ease forwards; color: #666;">⋯</div>`;
        } else {
            overlay.style.opacity = '0';
            overlay.innerHTML = `<div style="animation: karaokeFadeIn 0.3s ease forwards;">${escapeHtml(text)}</div>`;
        }

        setTimeout(() => {
            if (!isEmpty && text !== '') {
                overlay.style.opacity = '1';
            }
        }, 10);
    }*/
 /*     
function showKaraokeLyric(currentLine, nextLine = null, velocity = 0, totalLines = 0, isEmpty = false) {
    console.log(`🎤 showKaraokeLyric - currentLine: "${currentLine?.substring(0, 30)}", nextLine: "${nextLine?.substring(0, 30)}", isEmpty: ${isEmpty}, velocity: ${velocity}`);
    
    let overlay = document.getElementById('karaoke-overlay');
    if (!overlay) {
        overlay = createKaraokeOverlay();
    }

    // Usar posición global
    let activePosition = proyectorPosition;

    // Configurar posición
    switch(activePosition) {
        case 'top':
            overlay.style.top = '10%';
            overlay.style.bottom = 'auto';
            overlay.style.transform = 'none';
            break;
        case 'middle':
            overlay.style.top = '50%';
            overlay.style.bottom = 'auto';
            overlay.style.transform = 'translateY(-50%)';
            break;
        case 'bottom':
        default:
            overlay.style.bottom = '15%';
            overlay.style.top = 'auto';
            overlay.style.transform = 'none';
            break;
    }

    overlay.style.fontSize = proyectorFontSize + 'px';
    overlay.style.whiteSpace = 'pre-wrap';
    overlay.style.lineHeight = '1.5';

    // ⭐ Si es línea vacía, mostrar separador
    if (isEmpty === true || currentLine === '' || currentLine === undefined) {
        console.log('⬜ Mostrando separador');
        overlay.style.opacity = '0.5';
        overlay.innerHTML = `<div style="animation: karaokeFadeIn 0.3s ease forwards; color: #666; font-size: ${proyectorFontSize * 0.5}px;">⋯</div>`;
    } 
   // ⭐ Si hay siguiente línea, mostrar ambas (espaciado mínimo)
else if (nextLine && nextLine !== '' && nextLine !== 'undefined') {
    overlay.style.opacity = '0';
    overlay.innerHTML = `
        <div style="animation: karaokeFadeIn 0.3s ease forwards;">
            <div style="font-weight: bold;">${escapeHtml(currentLine)}</div>
            <div style="opacity: 0.8; margin-top: 16px;">${escapeHtml(nextLine)}</div>
        </div>
    `;
}
    // ⭐ Solo línea actual
    else {
        console.log(`📝 Mostrando 1 línea: "${currentLine.substring(0, 50)}"`);
        overlay.style.opacity = '0';
        overlay.innerHTML = `<div style="animation: karaokeFadeIn 0.3s ease forwards;">${escapeHtml(currentLine)}</div>`;
    }

    setTimeout(() => {
        if (isEmpty !== true && currentLine && currentLine !== '') {
            overlay.style.opacity = '1';
        }
    }, 10);
}
  */    
      
////////////////
/*      function showKaraokeLyric(text, isEmpty = false) {
    console.log(`🎤 showKaraokeLyric - text: "${text?.substring(0, 50)}"`);
    
    let overlay = document.getElementById('karaoke-overlay');
    if (!overlay) {
        overlay = createKaraokeOverlay();
    }

    // Usar posición global
    let activePosition = proyectorPosition;

    // Configurar posición
    switch(activePosition) {
        case 'top':
            overlay.style.top = '10%';
            overlay.style.bottom = 'auto';
            overlay.style.transform = 'none';
            break;
        case 'middle':
            overlay.style.top = '50%';
            overlay.style.bottom = 'auto';
            overlay.style.transform = 'translateY(-50%)';
            break;
        case 'bottom':
        default:
            overlay.style.bottom = '15%';
            overlay.style.top = 'auto';
            overlay.style.transform = 'none';
            break;
    }

    overlay.style.fontSize = proyectorFontSize + 'px';
    overlay.style.whiteSpace = 'pre-wrap';
    overlay.style.lineHeight = '1.4';

    // Mostrar texto (puede contener saltos de línea \n)
    if (isEmpty || !text || text === '') {
        overlay.style.opacity = '0.5';
        overlay.innerHTML = `<div style="animation: karaokeFadeIn 0.3s ease forwards; color: #666;">⋯</div>`;
    } else {
        overlay.style.opacity = '0';
        // Reemplazar \n con <br> para HTML
        const htmlText = escapeHtml(text).replace(/\n/g, '<br>');
        overlay.innerHTML = `<div style="animation: karaokeFadeIn 0.3s ease forwards;">${htmlText}</div>`;
    }

    setTimeout(() => {
        if (!isEmpty && text && text !== '') {
            overlay.style.opacity = '1';
        }
    }, 10);
}
 */
      ///////////////
      
function showKaraokeLyric(html, isEmpty = false) {
    console.log(`🎤 showKaraokeLyric - isEmpty: ${isEmpty}`);
    
    let overlay = document.getElementById('karaoke-overlay');
    if (!overlay) {
        overlay = createKaraokeOverlay();
    }

    // Usar posición global
    let activePosition = proyectorPosition;

    // Configurar posición
    switch(activePosition) {
        case 'top':
            overlay.style.top = '10%';
            overlay.style.bottom = 'auto';
            overlay.style.transform = 'none';
            break;
        case 'middle':
            overlay.style.top = '50%';
            overlay.style.bottom = 'auto';
            overlay.style.transform = 'translateY(-50%)';
            break;
        case 'bottom':
        default:
            overlay.style.bottom = '15%';
            overlay.style.top = 'auto';
            overlay.style.transform = 'none';
            break;
    }

    overlay.style.fontSize = proyectorFontSize + 'px';
    overlay.style.whiteSpace = 'normal';
    overlay.style.lineHeight = '1.4';

    // Mostrar texto
    if (isEmpty) {
        overlay.style.opacity = '0.5';
        overlay.innerHTML = `<div style="animation: karaokeFadeIn 0.3s ease forwards; color: #666;">⋯</div>`;
    } else if (html) {
        overlay.style.opacity = '0';
        overlay.innerHTML = `<div style="animation: karaokeFadeIn 0.3s ease forwards;">${html}</div>`;
    }

    setTimeout(() => {
        if (!isEmpty && html) {
            overlay.style.opacity = '1';
        }
    }, 10);
}
      
// Función para limpiar overlay (Note Off)
function clearKaraokeLyric() {
    const overlay = document.getElementById('karaoke-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0.9)';
        setTimeout(() => {
            if (overlay.innerHTML !== '') {
                overlay.innerHTML = '<div style="font-size: 24px; opacity: 0.5;">🎵</div>';
                setTimeout(() => {
                    if (overlay.innerHTML === '<div style="font-size: 24px; opacity: 0.5;">🎵</div>') {
                        overlay.innerHTML = '';
                    }
                }, 2000);
            }
        }, 300);
    }
}

// Función para mostrar canción cargada
function showKaraokeSongLoaded(title, artist) {
    const overlay = document.getElementById('karaoke-overlay');
    if (!overlay) {
        createKaraokeOverlay();
    }
    const overlayElement = document.getElementById('karaoke-overlay');
    overlayElement.innerHTML = `
    <div style="animation: karaokeFadeIn 0.5s ease;">
    🎤 ${escapeHtml(title)}<br>
    <small style="font-size: 18px;">${escapeHtml(artist)}</small>
    </div>
    `;
    overlayElement.style.opacity = '1';

    // Ocultar después de 3 segundos
    setTimeout(() => {
        if (overlayElement.innerHTML.includes(title)) {
            overlayElement.style.opacity = '0';
            setTimeout(() => {
                if (overlayElement.innerHTML.includes(title)) {
                    overlayElement.innerHTML = '';
                }
            }, 500);
        }
    }, 3000);
}

// Añadir animación CSS
const karaokeStyle = document.createElement('style');
karaokeStyle.textContent = `
@keyframes karaokeFadeIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
`;
document.head.appendChild(karaokeStyle);

// ============ WEBSOCKET PARA RECIBIR LETRAS ============
// Conectar al servidor MIDI (puerto 3003)

// Función helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ RECEPCIÓN DE LETRAS KARAOKE DESDE SERVIDOR MIDI ============
// Conectar al WebSocket Server del servidor MIDI (puerto 8085)
const SERVER_IP = '192.168.18.25';  // ← IP de tu PC con Windows
const MIDI_SERVER_WS_PORT = 8086;

const wsUrl = `ws://${SERVER_IP}:${MIDI_SERVER_WS_PORT}`;
console.log(`🔌 Conectando a servidor Karaoke en ${wsUrl}`);

const midiServerWs = new WebSocket(wsUrl);

//const midiServerWs = new WebSocket(`ws://${window.location.hostname}:${MIDI_SERVER_WS_PORT}`);  //http://192.168.18.20/
//const midiServerWs = new WebSocket(`ws://${192.168.18.20}:${MIDI_SERVER_WS_PORT}`);  //http://192.168.18.20/

midiServerWs.onopen = () => {
    console.log('✅ Conectado al servidor MIDI Karaoke en puerto', MIDI_SERVER_WS_PORT);
};

// En el manejador de mensajes WebSocket, agrega más logs
midiServerWs.onmessage = (event) => {
    console.log('📨 Mensaje RAW recibido:', event.data);

    try {
        const data = JSON.parse(event.data);
        console.log('📨 Mensaje parseado:', data);

        switch(data.type) {
          /*  case 'lyric':
                console.log('🎤 Recibido lyric:', data.text?.substring(0, 50));
                showKaraokeLyric(data.text, data.position, data.velocity, data.totalLines);
                break;
                */
        /*   case 'lyric':
    console.log('🎤 Recibido lyric:', data);
    // CORREGIDO: orden correcto de parámetros
    showKaraokeLyric(
        data.currentLine,      // texto principal
        data.nextLine,         // siguiente línea
        data.currentVelocity,  // velocidad
        data.totalLines,       // total de líneas
        data.isEmpty           // si es vacío
    );
    break;
          */  
            case 'lyric':
    console.log('🎤 Recibido lyric:', data);
    showKaraokeLyric(data.html, data.isEmpty);
    break;
          /*  case 'lyric':
    console.log('🎤 Recibido lyric:', data);
    showKaraokeLyric(data.text, data.isEmpty);
    break;*/
           /* case 'lyric':
    console.log('🎤 Recibido lyric:', data);
    // Los parámetros correctos son: (text, positionFromServer, velocity, totalLines, isEmpty)
    showKaraokeLyric(data.currentLine || data.text, null, data.currentVelocity || data.velocity, data.totalLines, data.isEmpty);
    break;
            case 'lyric':
    showKaraokeLyric(data.text, null, data.velocity, data.totalLines, data.isEmpty);
    break;
            case 'lyric':
                console.log('🎤 Recibido lyric:', data.text?.substring(0, 50));
                showKaraokeLyric(data.text, null, data.position, data.velocity, data.totalLines, data.isEmpty);
                break;*/

            case 'clear_lyric':
                console.log('🧹 Recibido clear_lyric');
                clearKaraokeLyric();
                break;

            case 'font_size_change':
                console.log('🔤 Recibido font_size_change:', data.fontSize);
                proyectorFontSize = data.fontSize;
                updateProyectorFontSize();
                break;

            case 'position_change':
                console.log('📍 Recibido position_change:', data.position);
                proyectorPosition = data.position;
                updateProyectorPosition();
                break;

            default:
                console.log('❓ Tipo no reconocido:', data.type);
        }
    } catch (error) {
        console.error('❌ Error parseando mensaje:', error);
        console.log('Mensaje original:', event.data);
    }
};
      
midiServerWs.onerror = (error) => {
    console.log('⚠️ Error con servidor MIDI:', error);
};

midiServerWs.onclose = () => {
    console.log('🔌 Desconectado del servidor MIDI');
    // Intentar reconectar después de 5 segundos
   /* setTimeout(() => {
        console.log('🔄 Reintentando conexión con servidor MIDI...');
        window.location.reload();
    }, 5000);*/
};

// ============ RECIBIR TAMAÑO DE LETRA DEL SERVIDOR ==========
//let proyectorFontSize = 48;

function updateProyectorFontSize() {
    const overlay = document.getElementById('karaoke-overlay');
    if (overlay) {
        overlay.style.fontSize = proyectorFontSize + 'px';
        console.log(`🔤 Tamaño de letra del proyector actualizado: ${proyectorFontSize}px`);
    }
}
// ============ FIN RECEPCIÓN DE LETRAS KARAOKE DESDE SERVIDOR MIDI ============


// En el cliente, modificar la inicialización
window.onload = async () => {
    console.log('🚀 Inicializando aplicación...');
    initializeWebSocket();
   // renderQueue();
    checkLoopStatus();
    loadVideo();
    await cargarVideos(); // Cargar videos al inicio
    console.log('Videos cargados:', videos); // Comprobar si los videos se cargaron correctamente
   sendPlayerStateFull();
    // 🔥 SOLICITAR ESTADO ACTUAL AL CARGAR LA PÁGINA
    setTimeout(() => {
        if (isWebSocketReady) {
            sendWebSocketMessage('request-state');
            updateLocalStorageAndSocket();
        } else {
            console.log('⏳ WebSocket no listo, reintentando en 1 segundo...');
            setTimeout(() => sendWebSocketMessage('request-state'), 1000);
        }
    }, 500);
};

// 🔥 Asegurar que las funciones críticas estén disponibles globalmente si es necesario
window.sendWebSocketMessage = sendWebSocketMessage;
window.initializeWebSocket = initializeWebSocket;


    });
