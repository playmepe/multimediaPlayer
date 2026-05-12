// config/constants.js
const path = require('path');
const { app } = require('electron');
const userHomeDir = require('os').homedir();
const fs = require('fs');

// Define las dos posibles rutas primero para mayor claridad
const path1 = path.join(__dirname, '..', 'dist-obf', 'biblia');
const path2 = path.join(__dirname, 'biblia');

// Configuración por defecto
const DEFAULT_CONFIG = {
  PATHS: {
    USER_HOME: userHomeDir,
    DATA_DIR: path.join(userHomeDir, 'bibliaplayweb'),
    USER_DATA_DIR: app.getPath('userData'),
    BASE_DIR: path.join(userHomeDir, 'bibliaplayweb', 'biblia'),
    VIDEOS_DIR: path.join(userHomeDir, 'MULTIMEDIA'),
    IMAGES_DIR: path.join(userHomeDir, 'MULTIMEDIA'),
    WEB_UI_DIR: path.join(__dirname, '..', 'public'),
    // Ruta alternativa para biblia
    //BIBLIA_ALTERNATIVE: path.join(__dirname, '..', 'dist-obf', 'biblia')
    // Usa fs.existsSync() para verificar qué ruta existe y asignarla.
    BIBLIA_ALTERNATIVE: fs.existsSync(path1) ? path1 : path2
  }
};

// Archivo de configuración
const CONFIG_FILE = path.join(userHomeDir, 'bibliaplayweb', 'config.json');

// Función para cargar configuración
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      const userConfig = JSON.parse(configData);

      // Combinar configuración por defecto con la del usuario
      return {
        PATHS: { ...DEFAULT_CONFIG.PATHS, ...userConfig.PATHS }
      };
    }
  } catch (error) {
    console.error('Error cargando configuración:', error);
  }

  return DEFAULT_CONFIG;
}

// Función para guardar configuración
function saveConfig(newConfig) {
  try {
    // Crear directorio si no existe
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error guardando configuración:', error);
    return false;
  }
}

// Cargar configuración actual
const currentConfig = loadConfig();

module.exports = {
  // Puertos
  PORTS: {
    TEMPO: 4000,
    BIBLIA_WS: 8081,
    PLAYER_WS: 8080,
    IO_WS: 8082,
    YTPLAYER_WS: 8084,
    TEMPO_WS: 8085
  },

  // Rutas (usando configuración cargada)
  PATHS: currentConfig.PATHS,

  // Archivos de datos
  DATA_FILES: {
    PLAYLISTS_FILE:  path.join(userHomeDir, 'bibliaplayweb', 'datos', 'playlists.json'),
    SOURCES: path.join(userHomeDir, 'bibliaplayweb', 'datos', 'sources.json'),
    IMAGES_INFO: path.join(userHomeDir, 'bibliaplayweb', 'datos', 'images-info.json'),
    MENU_HIDE: path.join(userHomeDir, 'bibliaplayweb', 'datos', 'menuhide.txt'),
    OUTPUT_TXT: path.join(userHomeDir, 'bibliaplayweb', 'datos', 'output.txt'),
    CONFIG_FILE: CONFIG_FILE
  },

  // Nuevas constantes para playlists
  PLAYLISTS: {
    DATA_DIR: path.join(userHomeDir, 'bibliaplayweb', 'data'),
    PLAYLISTS_FILE: 'playlists.json',
    MAX_PLAYLISTS: 100,
    MAX_ITEMS_PER_PLAYLIST: 500
  },

  // Endpoints API
  API_PATHS: {
    PLAYLISTS: '/api/playlists',
    PLAYLISTS_ID: '/api/playlists/:id',
    PLAYLISTS_BACKUP: '/api/playlists/backup/download',
    CONFIG: '/api/config'  // 🔥 NUEVO: Endpoint para configuración
  },

  SERVER_ONLY: {
    enable: true
  },

  // Funciones de configuración
  CONFIG_MANAGER: {
    loadConfig,
    saveConfig,
    getDefaultConfig: () => DEFAULT_CONFIG
  }
};
