
    document.addEventListener('DOMContentLoaded', function() {
        // Elementos del DOM
        const player = document.getElementById('player');
        const videoPlayerDiv = document.getElementById('video-player');
        const titleElement = document.getElementById('title');
        const cancionCheckbox = document.getElementById('cancionCheckbox');
        const bibliaCheckbox = document.getElementById('bibliaCheckbox');
        const verseContent = document.getElementById('verse-content');
        const contentBox = document.getElementById('contentBox');
        const backgroundImage = document.getElementById('background-image2');

        // Conexiones WebSocket (mismos puertos que el monitor principal)
        const socket = new WebSocket(`ws://${window.location.hostname}:8080`);
        const ws = new WebSocket(`ws://${window.location.hostname}:8081`);

        // Variables de estado
        let gui;
        let hideTimeout;
        let reproducirLista = JSON.parse(localStorage.getItem('playlist')) || [];
        let currentIndex = parseInt(localStorage.getItem('currentVideoIndex')) || 0;
        let fadeInInterval, fadeOutInterval;
        let isFadingIn = false, isFadingOut = false;
        let isCheckboxChecked = false;
        let lastVideoSrc = '';
        let isExternalVideo = false;
        let isSyncing = false;
        let lastSyncTime = 0;
        const SYNC_INTERVAL = 1000;

        // Configuración inicial idéntica al monitor principal
        player.volume = 1;

        if (typeof require !== 'undefined') {
            gui = require('nw.gui');
        }

        if (gui) {
            gui.Window.get().on('loaded', function() {
                const window = gui.Window.get();
                const x = 0; // Posición diferente para el monitor secundario
                const y = 0;
                window.moveTo(x, y);
                window.show();
                window.enterFullscreen();
            });
        }

        // Eventos WebSocket idénticos al monitor principal
        socket.addEventListener('open', () => {
            console.log('Conexión WebSocket abierta (secundario)');
            reproducirLista = JSON.parse(localStorage.getItem('playlist')) || [];
            currentIndex = parseInt(localStorage.getItem('currentVideoIndex')) || 0;
            socket.send(JSON.stringify({ type: 'playlist', data: reproducirLista }));
        });

        // Función para sincronizar con el monitor principal
        function syncWithPrimary(data) {
            const msg = JSON.parse(data);

            if (msg.type === 'sync') {
                isSyncing = true;

                // Sincronizar fuente de video
                if (player.src !== msg.src) {
                    player.src = msg.src;
                    isExternalVideo = msg.isExternal;
                    lastVideoSrc = msg.src;
                }

                // Sincronizar tiempo de reproducción
                if (Math.abs(player.currentTime - msg.currentTime) > 0.5) {
                    player.currentTime = msg.currentTime;
                }

                // Sincronizar estado de reproducción
                if (msg.state === 'playing' && player.paused) {
                    player.play().catch(e => console.error(e));
                } else if (msg.state === 'paused' && !player.paused) {
                    player.pause();
                }

                setTimeout(() => { isSyncing = false; }, 100);
            }
        }

        // Manejador de mensajes WebSocket para sincronización
        socket.addEventListener('message', event => {
            const msg = JSON.parse(event.data);

            // Prioridad a mensajes de sincronización
            if (msg.type === 'sync') {
                syncWithPrimary(event.data);
                return;
            }

            // Resto de manejo de mensajes idéntico al monitor principal
            if (msg.type === 'control') {
                switch (msg.action) {
                    case 'play':
                        videoPlayerDiv.style.display = 'block';
                        player.play();
                        fadeInVideo(1, 2000);
                        player.volume = 1;
                        hideBackgroundImage();
                        checkLoopStatus();
                        break;
                    case 'pause':
                        player.pause();
                        fadeOutVideo(2000);
                        showBackgroundImage();
                        break;
                    case 'stop':
                        checkLoopStatus();
                        fadeOutVideo(2000);
                        player.pause();
                        player.currentTime = 0;
                        videoPlayerDiv.style.display = 'none';
                        showBackgroundImage();
                        break;
                    case 'playNext':
                        currentIndex = (currentIndex + 1) % reproducirLista.length;
                        localStorage.setItem('currentVideoIndex', currentIndex);
                        showBackgroundImage();
                        setTimeout(() => {
                            if (currentIndex >= 0 && currentIndex < reproducirLista.length) {
                                loadVideo();
                            }
                        }, 1500);
                        fadeOutVideo(2000);
                        break;
                    case 'playVideo':
                        currentIndex = msg.index;
                        localStorage.setItem('currentVideoIndex', currentIndex);
                        showBackgroundImage();
                        checkLoopStatus();
                        setTimeout(() => {
                            if (currentIndex >= 0 && currentIndex < reproducirLista.length) {
                                loadVideo();
                            }
                        }, 1500);
                        fadeOutVideo(2000);
                        break;
                }
            } else if (msg.type === 'playlist') {
                reproducirLista = msg.data;
                localStorage.setItem('playlist', JSON.stringify(reproducirLista));
            }
        });

        // WebSocket para contenido (idéntico al monitor principal)
        ws.onmessage = (event) => {
            const data = event.data.split(':');

            switch (data[0]) {
                case 'font-size':
                    handleFontSize(data[1]);
                    break;
                case 'playExternal':
                    showBackgroundImage();
                    playExternalVideo(event.data);
                    break;
                case 'SHOW':
                    showContentBox();
                    break;
                case 'HIDE':
                    hideContentBox();
                    break;
                case 'VIDEO_URL':
                    showBackgroundImage();
                   // handleVideoUrl(event.data);
                    break;
                case 'TEXT_ALIGN':
                    manejarAlineacionTexto(data[1]);
                    break;
                case 'fondo_biblia':
                    var bibliaCheckbox = document.getElementById('bibliaCheckbox');
                    if (bibliaCheckbox) bibliaCheckbox.checked = true;
                    reproducirVideoAleatorio();
                    checkLoopStatus();
                    break;
                case 'cambiartipoletra':
                    changeFontRandomly();
                    changeTextShadow();
                    break;
                case 'check_disable':
                    var bibliaCheckbox = document.getElementById('bibliaCheckbox');
                    if (bibliaCheckbox) bibliaCheckbox.checked = false;
                    break;
                case 'MUTE_C':
                    hideBackgroundImage();
                    player.muted = !player.muted;
                    break;
                case 'LOOP_C':
                    player.loop = !player.loop;
                    checkLoopStatus();
                    break;
                case 'LOOP_Cancion':
                    var cancionCheckbox = document.getElementById('cancionCheckbox');
                    if (cancionCheckbox) cancionCheckbox.checked = true;
                    if (!player.hasAttribute('loop')) player.setAttribute('loop', '');
                    break;
                case 'cambiarimagen':
                    changeBackgroundImage(event.data);
                    break;
                default:
                    handleDefaultMessage(event.data, data[0]);
                    break;
            }
        };

        // Funciones auxiliares idénticas al monitor principal
        function hideBackgroundImage() {
            backgroundImage.style.opacity = '0';
            setTimeout(() => backgroundImage.style.display = 'none', 2000);
        }

        function showBackgroundImage() {
            backgroundImage.style.display = 'block';
            checkLoopStatus();
            setTimeout(() => backgroundImage.style.opacity = '1', 50);
        }

        async function cargarVideos() {
            const response = await fetch('http://localhost:4000/media/FONDO-BIBLIA_videos.json');
            const data = await response.json();
            videos = data.items;
        }

        function reproducirVideoAleatorio() {
            if (!videos || videos.length === 0) return;

            const randomIndex = Math.floor(Math.random() * videos.length);
            const randomVideo = videos[randomIndex].action;

            player.src = randomVideo;
            player.load();
            player.play();

            setTimeout(() => {
                videoPlayerDiv.style.display = 'block';
                player.play();
                fadeInVideo(1, 2000);
                player.volume = 1;
                hideBackgroundImage();
                checkLoopStatus();
            }, 10);
        }
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // ... (Todas las demás funciones auxiliares idénticas al monitor principal)


function handleDefaultMessage(data) {
    console.log('Mensaje del servidor: ', data); // Cambié `event.data` por `data`

    const lines = data.split('\n');
    const identifierAndType = lines[0].split(':'); // Obtiene el ID y el tipo
    const identifier = identifierAndType[0]; // Obtiene el ID
    const contentType = identifierAndType[1]; // Obtiene el tipo

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
/*
const output = `${lines[1]}\n${lines.slice(2).join('\n')}`;
fetch('/api/add-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: output }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al agregar el mensaje.');
            }
            return response.text();
        })
        .then(data => {
            console.log(data); // Mensaje de éxito
        })
        .catch(error => {
            console.error('Error al enviar el mensaje al servidor:', error);
        });*/
    }

    loadRandomImage(); // Cargar nueva imagen con nuevo contenido si es necesario
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
// Llama a la función para alternar el color al cargar la página
//updateTitleBackgroundColor();

const colors = ['#3de158', '#e1a53d', '#229bf5', '#fa5e5e', '#FFC300', '#77f507', '#0789f5', '#e13d49']; // Array de colores

const updateTitleBackgroundColor = () => {
    const titleElement = document.getElementById('title');
    const randomIndex = Math.floor(Math.random() * colors.length); // Genera un índice aleatorio
    titleElement.style.backgroundColor = colors[randomIndex]; // Cambia el color de fondo a uno aleatorio
};

// Llama a la función para alternar el color al cargar la página
document.addEventListener('DOMContentLoaded', updateTitleBackgroundColor);

function adjustImageSize(imageElement) {
    // Usar un pequeño timeout para asegurarse de que las dimensiones estén disponibles
    setTimeout(() => {
        if (imageElement.naturalHeight > imageElement.naturalWidth) {
            // Si la altura es mayor que la anchura
            imageElement.style.height = '100%';
            imageElement.style.width = 'auto';  // Mantener proporción
            console.log('La altura es mayor que la anchura');
        } else {
            // Si la anchura es mayor o igual que la altura
            imageElement.style.height = '100%';   // Auto
            imageElement.style.width = '100%';  // 100%
            console.log('La altura es igual o menor');
        }
    }, 0); // Espera a que la imagen se cargue y se midan correctamente
}



 function changeTextShadow() {
            const title = document.getElementById('title');
            const verseContent = document.getElementById('verse-content');

            // Genera valores aleatorios para text-shadow
            const hShadow = Math.floor(Math.random() * 10) - 5; // Sombra horizontal
            const vShadow = Math.floor(Math.random() * 10) - 5; // Sombra vertical
            const blur = Math.floor(Math.random() * 10) + 5; // Desenfoque
            const color = `rgba(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, 0.7)`; // Color

            // Aplica el text-shadow
            title.style.textShadow = `${hShadow}px ${color}`;
            verseContent.style.textShadow = `${hShadow}px ${vShadow}px ${blur}px ${color}`;
        }
// Define las fuentes disponibles
const fonts = [
    'Arial, sans-serif',
    'Roboto, sans-serif',
    'Georgia, serif',
    'Times New Roman, serif',
    'Verdana, sans-serif',
    'Comic Sans MS, negrita',
     'Ubuntu, Bold'
];

// Función para cambiar la fuente al azar
function changeFontRandomly() {
    const verseContent = document.querySelector('#verse-content');
    const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
    verseContent.style.fontFamily = randomFont; // Cambia la fuente del body
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

function showContentBox() {
            contentBox.style.display = 'block'; // Mostrar el contentBox
            // Para asegurarte de que el "fade in" se vea, usa un timeout

    setTimeout(() => {
        contentBox.classList.remove('hide'); // Asegurarse de que la clase "hide" no esté aplicada
        contentBox.classList.add('show'); // Asegúrate de que se aplique la clase "show"
    }, 2); // Un pequeño retraso para permitir que el navegador registre el cambio de estilo
        localStorage.setItem('contentBoxVisible', 'true');
         if (isSocketOpen) {
            //ws.send(`UPDATE_BUTTON_BIBLIA_ON`);
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
            //ws.send(`UPDATE_BUTTON_BIBLIA_OFF`);
            console.log('desactivado contentbox' );
        } else {
            console.warn('El WebSocket no está conectado. Estado actual:', ws.readyState);
        }
}

/////////////////////// para vigilar loop //////////////////////////

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
// Obtener el elemento de video
//var video = document.getElementById('player');

// Crear un observer para monitorear cambios en el atributo 'loop'
var observer = new MutationObserver(function(mutationsList) {
    for (var mutation of mutationsList) {
        // Verificar si el atributo 'loop' ha cambiado
        if (mutation.type === 'attributes' && mutation.attributeName === 'loop') {
            console.log('El atributo loop ha cambiado');
            checkLoopStatus()

            // Aquí puedes ejecutar cualquier acción que necesites cuando el atributo cambie
            if (video.hasAttribute('loop')) {
                console.log('Loop está activado');
            } else {
                console.log('Loop está desactivado');
            }
        }
    }
});

// Configurar el observer para observar cambios en el atributo 'loop'
observer.observe(video, {
    attributes: true  // Solo monitoreamos cambios en los atributos
});
/////////////////////////////// fin vigilar loop ////////////////////////////////////////////////////////////////////7

//monitor status loop
const playerS = document.getElementById('player');
//const socketX = new WebSocket('ws://localhost:8080');
    // Función para verificar el estado de loop
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
    function checkLoopStatus() {
        if (isSocketOpen) {
        const loopStatus = playerS.hasAttribute('loop'); // Verificar si el atributo loop está presente
        console.log('El estado de loop1 es:', loopStatus);
        // Solo enviar si el estado ha cambiado
            if (loopStatus !== lastLoopStatus) {
            //ws.send(`LOOP_STATUS: ${loopStatus}`);
            console.log('El estado de loop es:', loopStatus);
            lastLoopStatus = loopStatus; // Actualizar el último estado enviado
            }
        } else {
            console.warn('El WebSocket no está conectado. Estado actual:', ws.readyState);
        }

    }

// Función para hacer fade-in
function fadeInVideo(volume, duration) {
    if (isFadingIn) return; // Evitar múltiples fade-ins
    isFadingIn = true;

    player.volume = 0; // Comienza en volumen 0
    player.play().catch(error => {
        console.error('Error al intentar reproducir el video:', error);
    });

    let increment = 0.05; // Incremento en el volumen
    let totalSteps = Math.ceil(volume / increment); // Total de pasos necesarios
    let interval = duration / totalSteps; // Duración de cada incremento

    fadeInInterval = setInterval(() => {
        if (player.volume < volume) {
            player.volume = Math.min(player.volume + increment, volume); // Incrementa el volumen
        } else {
            clearInterval(fadeInInterval); // Detén el intervalo al alcanzar el volumen deseado
            isFadingIn = false; // Restablecer el estado
        }
    }, interval);
}

function stop() {
    // Lógica para detener el reproductor
    player.pause(); // Pausa el video
    player.currentTime = 0; // Reinicia el tiempo a 0
    videoPlayerDiv.style.display = 'none'; // Oculta el reproductor
    showBackgroundImage(); // Muestra la imagen de fondo
    console.log('ejecutando funcion stop');
}
// Función para hacer fade-out
function fadeOutVideo(duration) {
    if (isFadingOut) {
        // Si ya está en fade-out, se puede reiniciar el volumen a 1 (o el volumen deseado) y reiniciar el fade-out.
        clearInterval(fadeOutInterval);
        isFadingOut = false;
        player.volume = 1; // Asegúrate de que el volumen esté en el nivel deseado antes de comenzar de nuevo.
    }

    isFadingOut = true;

    let decrement = 0.05; // Decremento en el volumen
    let totalSteps = Math.ceil(player.volume / decrement); // Total de pasos necesarios
    let interval = duration / totalSteps; // Duración de cada decremento

    fadeOutInterval = setInterval(() => {
        if (player.volume > 0) {
            player.volume = Math.max(player.volume - decrement, 0); // Decrementa el volumen
        } else {
            clearInterval(fadeOutInterval); // Detén el intervalo al llegar a 0
            player.pause(); // Pausa el video al llegar a 0
            isFadingOut = false; // Restablecer el estado
            console.log('ejecutando funcion fade out pause');
        }
    }, interval);
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

 function loadVideo() {

    if (reproducirLista.length > 0 && reproducirLista[currentIndex]) {
        //player.src = reproducirLista[currentIndex].src;
         lastVideoSrc = reproducirLista[currentIndex].src;
        isExternalVideo = false;
        player.src = lastVideoSrc;
        videoPlayerDiv.style.display = 'block'; // Mostrar el reproductor

        player.addEventListener('loadeddata', () => {

            player.play().then(() => {
                hideBackgroundImage(); // Ocultar imagen de fondo cuando el video comienza


                fadeInVideo(1, 2000);
                 player.volume = 1;
                 // Enviar información del video actual
                sendVideoInfo(true);
            }).catch(error => {
                console.error('Error al intentar reproducir el video:', error);
            });
        }, { once: true }); // Eliminar el evento después de que se ejecute una vez
    } else {
        console.warn('No hay video disponible para reproducir.');
    }
}

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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Inicialización
        window.onload = async () => {
            checkLoopStatus();
            loadVideo();
            await cargarVideos();
        };
    });
