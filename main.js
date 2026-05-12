// main.js - VERSIÓN CON WEBSOCKET NATIVO
const { app, BrowserWindow } = require('electron');
const pathManager = require('./utils/pathManager');
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws'); // ← CAMBIO: WebSocket nativo
const cors = require('cors');
const bodyParser = require('body-parser');
// Configuración
const { PORTS, PATHS, SERVER_ONLY } = require('./config/constants');

// Servicios
const { ensureDataDir, ensureUserDataDir } = require('./utils/fileManager');
const { initializeWebSockets, sendAutoProjectionRequest } = require('./websocket/websocketManager');

// Rutas
const apiRoutes = require('./routes/api');
const { router: bibliaRoutes, loadBibleData } = require('./routes/biblia');
const mediaRoutes = require('./routes/media');
const youtubeRoutes = require('./routes/youtube').router || require('./routes/youtube');

// Handlers IPC
require('./electron/ipcHandlers');

// --- FUNCIÓN DE DIAGNÓSTICO ---
function diagnoseStaticPaths() {
  console.log('\n🔍 DIAGNÓSTICO DE RUTAS ESTÁTICAS:');
  console.log('====================================');

  const pathsToCheck = [
    { name: 'Directorio actual', path: process.cwd() },
    { name: 'Directorio __dirname', path: __dirname },
    { name: 'Directorio public', path: path.join(__dirname, 'public') },
    { name: 'Directorio Biblia2', path: path.join(__dirname, 'biblia') },
    { name: 'BASE_DIR_biblia', path: PATHS.BASE_DIR },
    { name: 'Recursos de la app', path: process.resourcesPath ? path.join(process.resourcesPath, 'biblia') : 'N/A' },
    { name: 'PATHS.WEB_UI_DIR', path: PATHS.WEB_UI_DIR },
    { name: 'Recursos de la app', path: process.resourcesPath ? path.join(process.resourcesPath, 'public') : 'N/A' }
  ];

  pathsToCheck.forEach(item => {
    const exists = fs.existsSync(item.path);
    const isDirectory = exists ? fs.statSync(item.path).isDirectory() : false;
    console.log(`📁 ${item.name}: ${item.path}`);
    console.log(`   ✅ Existe: ${exists}, 📂 Es directorio: ${isDirectory}`);

    if (exists && isDirectory) {
      try {
        const files = fs.readdirSync(item.path);
        console.log(`   📄 Archivos (primeros 5): ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
      } catch (err) {
        console.log(`   ❌ Error leyendo directorio: ${err.message}`);
      }
    }
    console.log('   ---');
  });

  const htmlFiles = [
    path.join(__dirname, 'public', 'index.html'),
    path.join(process.cwd(), 'public', 'index.html'),
    PATHS.WEB_UI_DIR ? path.join(PATHS.WEB_UI_DIR, 'index.html') : 'N/A'
  ];

  console.log('\n🔍 VERIFICANDO ARCHIVOS HTML:');
  htmlFiles.forEach(htmlPath => {
    const exists = fs.existsSync(htmlPath);
    console.log(`📄 ${htmlPath} - ${exists ? '✅ EXISTE' : '❌ NO EXISTE'}`);
  });

  console.log('====================================\n');
}


// --- INICIALIZACIÓN DE LA APLICACIÓN ---
async function initializeApp() {
  try {
    console.log('🚀 Iniciando BibliaPlay Web...');

    // Ejecutar diagnóstico ANTES de inicializar
    diagnoseStaticPaths();

    // 1. Directorios de datos
    ensureDataDir();
    ensureUserDataDir();
    //////pathManager.ensureDirectories();
    // 2. Crear servidor Express y HTTP
    const appServer = express();
    const server = http.createServer(appServer);

    // 🔥 CAMBIO: Configurar WebSocket para temporizador
    const timerWss = new WebSocket.Server({
      port: PORTS.TEMPO_WS || 8085, // Puerto separado para WebSocket
      perMessageDeflate: false
    });

    console.log(`✅ WebSocket del temporizador en puerto ${PORTS.TEMPO_WS || 8085}`);

    // Configurar middleware básico
    //appServer.use(cors());
    // Configurar CORS para permitir peticiones desde cualquier lugar
    appServer.use(cors({
      origin: '*', // O especifica la IP de tu TV: 'http://192.168.1.20'
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type']
    }));
    appServer.use(bodyParser.json());
    appServer.use(express.json({
      extended: true,
      type: 'application/json; charset=UTF-8'
    }));


    // 3. Cargar datos de la Biblia

    // 3. Cargar datos de la Biblia
    await new Promise((resolve, reject) => {
      loadBibleData((err) => {
        if (err) {
          console.error('❌ Error al cargar datos de la Biblia:', err.message);
          console.log('⚠️ Continuando sin datos de biblia...');

          // No rechazamos la promesa, solo continuamos
          // La biblia se puede cargar más tarde
          resolve();
        } else {
          console.log('✅ Datos de la Biblia cargados correctamente');
          resolve();
        }
      });
    });

    // 4. Configurar rutas (MISMOS ENDPOINTS)
    appServer.use('/api', apiRoutes);
    appServer.use('/api', bibliaRoutes);
    appServer.use('/api', mediaRoutes);
    appServer.use('/', youtubeRoutes);
    // Registrar rutas de playlists
    //appServer.use('/playlists', youtubeRoutes);

    // 🔥 CAMBIO: Configurar temporizador con WebSocket
    configureTimerWebSocket(timerWss, appServer);

    // 5. Configurar archivos estáticos
    console.log('🔄 Configurando archivos estáticos...');
    configureStaticFiles(appServer);

    // 6. Inicializar WebSockets adicionales (si existen)
    initializeWebSockets(server);

    // 7. Configurar Electron
    initializeElectron();

    // 8. Iniciar servidor principal
    await startServer(server, timerWss);
    initializeElectron();
    // Llamar después de montar todas las rutas
    logRegisteredRoutes(appServer);
    console.log('✅ Aplicación inicializada correctamente');

  } catch (error) {
    console.error('❌ Error durante la inicialización:', error);
    process.exit(1);
  }
}

// 🔥 NUEVO: Configuración del temporizador con WebSocket
function configureTimerWebSocket(wss, appServer) {
  console.log('⏰ Configurando temporizador con WebSocket...');

  let timerState = {
    remainingTime: 0,
    endTime: 0,
    isPaused: true,
    hideHours: true
  };

  // Rutas HTML del temporizador
  appServer.get('/tempoctl', (req, res) => {
    const baseDir = getBaseDir();
    const filePath = path.join(baseDir, 'public', 'tempoctl.html');

    if (fs.existsSync(filePath)) {
      console.log(`⏰ Sirviendo tempoctl.html desde: ${filePath}`);
      res.sendFile(filePath);
    } else {
      console.log(`❌ tempoctl.html no encontrado en: ${filePath}`);
      res.status(404).send('tempoctl.html no encontrado');
    }
  });

  appServer.get('/tempoptlla', (req, res) => {
    const baseDir = getBaseDir();
    const filePath = path.join(baseDir, 'public', 'tempoptlla.html');

    if (fs.existsSync(filePath)) {
      console.log(`⏰ Sirviendo tempoptlla.html desde: ${filePath}`);
      res.sendFile(filePath);
    } else {
      console.log(`❌ tempoptlla.html no encontrado en: ${filePath}`);
      res.status(404).send('tempoptlla.html no encontrado');
    }
  });

  // Servir la página de configuración
  appServer.get('/config', (req, res) => {
    res.sendFile(path.join(PATHS.WEB_UI_DIR, 'config.html'));
  });


  // WebSocket para temporizador
  wss.on('connection', (ws, req) => {
    console.log(`⏰ Cliente WebSocket conectado: ${req.socket.remoteAddress}`);

    // Enviar estado actual al cliente
    ws.send(JSON.stringify({
      type: 'timerState',
      data: timerState
    }));

    console.log(`⏰ Estado enviado a nuevo cliente`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`⏰ Mensaje recibido:`, data);

        switch (data.type) {
          case 'toggleHideHours':
            timerState.hideHours = data.data;
            console.log(`⏰ Ocultar horas: ${timerState.hideHours}`);
            broadcastToAll(wss, { type: 'timerState', data: timerState });
            break;

          case 'controlTimer':
            console.log(`⏰ Control:`, data.data);
            handleTimerControl(data.data);
            break;

          case 'setInitialTime':
            console.log(`⏰ Tiempo inicial: ${data.data}`);
            timerState.remainingTime = data.data;
            timerState.endTime = Date.now() + data.data;
            timerState.isPaused = false;
            broadcastToAll(wss, { type: 'timerState', data: timerState });
            break;
        }
      } catch (error) {
        console.error('❌ Error procesando mensaje WebSocket:', error);
      }
    });

    ws.on('close', () => {
      console.log(`⏰ Cliente WebSocket desconectado`);
    });

    ws.on('error', (error) => {
      console.error(`⏰ Error WebSocket:`, error);
    });
  });

  // Función para manejar controles del temporizador
  function handleTimerControl(action) {
    switch (action.action) {
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
    broadcastToAll(wss, { type: 'timerState', data: timerState });
  }

  // Función para broadcast a todos los clientes
  function broadcastToAll(wss, message) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Actualizar temporizador cada segundo
  setInterval(() => {
    if (!timerState.isPaused) {
      const now = Date.now();
      timerState.remainingTime = Math.max(0, timerState.endTime - now);
      if (timerState.remainingTime <= 0) {
        timerState.remainingTime = 0;
        timerState.isPaused = true;
        broadcastToAll(wss, { type: 'timerState', data: timerState });
      }
    }
  }, 1000);

  console.log('✅ Temporizador configurado con WebSocket');
}

// 🔧 FUNCIÓN AUXILIAR PARA OBTENER DIRECTORIO BASE
function getBaseDir() {
  const isPackaged = app?.isPackaged || false;
  if (isPackaged) {
    return path.join(process.resourcesPath, 'app.asar', 'dist-obf');
  } else {
    return __dirname;
  }
}

// 🔧 CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS
function configureStaticFiles(appServer) {
  const path = require('path');
  const fs = require('fs');
  const { PATHS } = require('./config/constants');

  console.log('\n📁 CONFIGURANDO ARCHIVOS ESTÁTICOS:');

  const baseDir = getBaseDir();

  // RUTAS ESTÁTICAS
  const staticPaths = [
    { route: '/', path: path.join(baseDir, 'public') },
    { route: '/canciones', path: path.join(PATHS.DATA_DIR, 'canciones') },
    { route: '/media', path: path.join(PATHS.DATA_DIR, 'media') },
    { route: '/datosimagen', path: path.join(PATHS.DATA_DIR, 'datos') },
    { route: '/imagesbiblia', path: path.join(PATHS.DATA_DIR, 'images') },
    { route: '/videos', path: PATHS.VIDEOS_DIR },
    { route: '/images', path: PATHS.IMAGES_DIR },
    { route: '/api/vplay', path: PATHS.VIDEOS_DIR }
  ];

  staticPaths.forEach(static => {
    const exists = fs.existsSync(static.path);
    console.log(`📁 ${static.route} -> ${static.path} ${exists ? '✅' : '❌'}`);

    if (exists) {
      appServer.use(static.route, express.static(static.path));
    }
  });

  // RUTA PRINCIPAL
  appServer.get('/', (req, res) => {
    const indexPath = path.join(baseDir, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('index.html no encontrado');
    }
  });
}

// --- CONFIGURACIÓN ELECTRON ---
function initializeElectron() {
  app.whenReady().then(() => {
     //console.log(`🏁 Electron iniciado en ${isWayland ? 'Wayland' : 'X11'}`);
    // Asegurar que todos los directorios existan
    //////////////////pathManager.ensureDirectories();    //crea directorio multimedia si no existe
    console.log('✅ Electron listo');

    console.log('\n🔍 INFORMACIÓN DE ELECTRON:');
    console.log('===========================');
    console.log(`📦 Está empaquetado: ${app.isPackaged}`);
    console.log(`🖥️  Plataforma: ${process.platform}`);
    console.log(`📁 Directorio de la app: ${app.getAppPath()}`);
    console.log(`🏠 Directorio de usuario: ${app.getPath('userData')}`);
    console.log(`📚 Directorio de recursos: ${process.resourcesPath || 'N/A'}`);
    console.log('===========================\n');

    app.on('window-all-closed', (e) => {
      if (process.platform !== 'darwin') {
        e.preventDefault();
        console.log('Ventana cerrada, pero servidor sigue activo en segundo plano');
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        console.log('Servidor activado desde dock (macOS)');
      }
    });
  });

  app.on('before-quit', (e) => {
    console.log('Cerrando servidor...');
  });
}

// --- INICIAR SERVIDOR ---
function startServer(server, timerWss) {
  return new Promise((resolve) => {
    server.listen(PORTS.TEMPO, () => {
      console.log(`🌐 Servidor HTTP iniciado en http://localhost:${PORTS.TEMPO}`);
      console.log(`🔌 WebSocket temporizador en ws://localhost:${PORTS.TEMPO_WS || 8085}`);
      console.log(`👥 Clientes conectados al temporizador: ${timerWss.clients.size}`);
      console.log(`//////////////////   No se inician las ventanas porque inicia en modo servidor  ////////////////////`);

      // Abrir navegador automáticamente
      setTimeout(() => {
        openBrowser();
      }, 2000);

      // Enviar solicitud de proyección automática
      setTimeout(() => {
        sendAutoProjectionRequest();
      }, 10000);

      resolve();
    });
  });
}

// 🔥 DIAGNÓSTICO DE RUTAS REGISTRADAS
function logRegisteredRoutes(appServer) {
  console.log('\n📋 RUTAS REGISTRADAS EN EXPRESS:');
  console.log('================================');

  appServer._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Rutas directas
      const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
      console.log(`   ${methods} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      // Rutas de router
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
          const basePath = middleware.regexp.toString().replace(/^\/\^?|\$?\/?$/g, '') || '/';
          console.log(`   ${methods} ${basePath}${handler.route.path}`);
        }
      });
    }
  });

  console.log('================================\n');
}


// --- FUNCIÓN PARA ABRIR NAVEGADOR ---
function openBrowser() {
  const url = `http://localhost:${PORTS.TEMPO}`;

  console.log('\n🔗 INTENTANDO ABRIR NAVEGADOR:');
  console.log('==============================');
  console.log(`🌐 URL: ${url}`);
  console.log(`🖥️  Plataforma: ${process.platform}`);
  console.log(`📦 App empaquetada: ${app.isPackaged}`);

  if (app.isPackaged) {
    console.log('🚀 Modo producción - Creando ventana de Electron...');
    createElectronWindow();
    return;
  }

  const { exec } = require('child_process');
  const commands = {
    darwin: ['open -a "Google Chrome"', 'open'],
    win32: ['start chrome', 'start'],
    linux: ['google-chrome', 'xdg-open']
  };

  const platform = process.platform;
  const [chromeCmd, defaultCmd] = commands[platform] || commands.linux;

  function tryCommand(command, isChrome = true) {
    exec(`${command} ${url}`, (error) => {
      if (error && isChrome) {
        console.log('❌ Chrome no disponible, intentando navegador por defecto...');
        tryCommand(defaultCmd, false);
      } else if (error) {
        console.log('❌ No se pudo abrir ningún navegador');
        console.log('📋 Abre manualmente:', url);
        createElectronWindow();
      } else {
        console.log(`✅ ${isChrome ? 'Chrome' : 'Navegador'} abierto exitosamente`);
      }
    });
  }

  console.log('Intentando abrir Chrome...');
  tryCommand(chromeCmd);
}

// --- FUNCIÓN PARA ABRIR NAVEGADOR ---
/*function openBrowser() {
  const url = `http://localhost:${PORTS.TEMPO}`;

  console.log('\n🔗 INTENTANDO ABRIR NAVEGADOR:');
  console.log('==============================');
  console.log(`🌐 URL: ${url}`);
  console.log(`🖥️  Plataforma: ${process.platform}`);
  console.log(`📦 App empaquetada: ${app.isPackaged}`);

  if (app.isPackaged) {
    console.log('🚀 Modo producción - Creando ventana de Electron...');
    createElectronWindow();
    return;
  }

  const { exec } = require('child_process');

  // Comandos por plataforma: [chrome, firefox, default]
  const commands = {
    darwin: [
      'open -a "Google Chrome"',
      'open -a "Firefox"',
      'open'
    ],
    win32: [
      'start chrome',
      'start firefox',
      'start'
    ],
    linux: [
      'google-chrome',
      'firefox',
      'xdg-open'
    ]
  };

  const platform = process.platform;
  const [chromeCmd, firefoxCmd, defaultCmd] = commands[platform] || commands.linux;

  function tryCommand(command, browserName, nextFallback) {
    exec(`${command} "${url}"`, (error) => {
      if (error) {
        console.log(`❌ ${browserName} no disponible.`);
        if (nextFallback) {
          console.log(`➡️  Intentando con ${nextFallback.name}...`);
          nextFallback.fn();
        } else {
          console.log('❌ No se pudo abrir ningún navegador.');
          console.log('📋 Abre manualmente:', url);
          createElectronWindow();
        }
      } else {
        console.log(`✅ ${browserName} abierto exitosamente.`);
      }
    });
  }

  console.log('Intentando abrir Chrome...');
  tryCommand(
    chromeCmd,
    'Chrome',
    {
      name: 'Firefox',
      fn: () => tryCommand(
        firefoxCmd,
        'Firefox',
        {
          name: 'navegador predeterminado',
          fn: () => tryCommand(defaultCmd, 'navegador predeterminado', null)
        }
      )
    }
  );
}
*/
// --- FUNCIÓN PARA CREAR VENTANA DE ELECTRON ---
function createElectronWindow() {
  try {
    console.log('🪟 Creando ventana de Electron...');
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      /////show: false, // Oculto por defecto en modo servidor
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    });

    const url = `http://localhost:${PORTS.TEMPO}`;
    console.log(`📡 Cargando URL en ventana: ${url}`);

    mainWindow.loadURL(url);

    mainWindow.on('ready-to-show', () => {
      console.log('✅ Ventana de Electron lista y mostrada');
      mainWindow.show();
    });

    mainWindow.on('closed', () => {
      console.log('🔒 Ventana de Electron cerrada');
    });

    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }

  } catch (error) {
    console.error('❌ Error creando ventana de Electron:', error);
  }
}

// --- INICIAR LA APLICACIÓN ---
initializeApp().catch(console.error);

