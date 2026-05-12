// utils/fileManager.js
const fs = require('fs');
//const fs = require('fs').promises;
const path = require('path');
const { PATHS, DATA_FILES, PLAYLISTS } = require('../config/constants');
//const { PLAYLISTS } = require('../config/constants');

// Gestión de directorios
function ensureDataDir() {
  if (!fs.existsSync(PATHS.DATA_DIR)) {
    fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
  }

  const subDirs = ['datos', 'images', 'media', 'canciones', 'biblia', 'playlist', 'listasyt'];
  subDirs.forEach(subDir => {
    const dirPath = path.join(PATHS.DATA_DIR, subDir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

function ensureUserDataDir() {
  if (!fs.existsSync(PATHS.USER_DATA_DIR)) {
    fs.mkdirSync(PATHS.USER_DATA_DIR, { recursive: true });
  }
}


////////////////////////////////////////////////////////////////////////////////
// 🔥 MÉTODOS PARA GESTIÓN DE PLAYLISTS
//const PLAYLISTS_DIR = path.join(__dirname, '..', 'data');

const PLAYLISTS_DIR = path.join(PATHS.DATA_DIR,  'data');
const PLAYLISTS_FILE = path.join(PLAYLISTS_DIR, 'playlists.json');

// 🔥 FUNCIONES SIMPLES Y COMPATIBLES
function ensurePlaylistsDirectory() {
  if (!fs.existsSync(PLAYLISTS_DIR)) {
    fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
     console.log(`Archivo Datos creado: ${PLAYLISTS_DIR}`);
  }
   console.log(`Archivo Datos existe: ${PLAYLISTS_DIR}`);
}

function loadPlaylists() {
  try {
    ensurePlaylistsDirectory();

    if (!fs.existsSync(PLAYLISTS_FILE)) {
      fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify([]));
      return [];
    }
    console.log(`Archivo Datos/json existe: ${PLAYLISTS_FILE}`);
    var data = fs.readFileSync(PLAYLISTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error cargando playlists:', error);
    return [];
  }
}

function savePlaylists(playlists) {
  try {
    ensurePlaylistsDirectory();
    fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(playlists, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando playlists:', error);
    return false;
  }
}

function generatePlaylistId() {
  return Date.now().toString();
}


////////////////////////////////////////////////////////////////
// Gestión de sources
function readSources() {
  try {
    if (!fs.existsSync(DATA_FILES.SOURCES)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILES.SOURCES, 'utf8') || '[]');
  } catch (e) { 
    console.error('Read sources error', e); 
    return []; 
  }
}

function writeSources(list) {
  try { 
    fs.writeFileSync(DATA_FILES.SOURCES, JSON.stringify(list, null, 2), 'utf8'); 
    return true; 
  } catch (e) { 
    console.error('Write sources error', e); 
    return false; 
  }
}

// Gestión de archivos de texto
function crearmenuhide(filePath, texto) {
  fs.writeFileSync(filePath, texto.join('\n'), 'utf8');
  console.log(`Archivo creado: ${filePath}`);
}

function appendToFile(filePath, content) {
  return new Promise((resolve, reject) => {
    fs.appendFile(filePath, content + '\n', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function readFileContent(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// Carga de canciones
function cargarCancion(filePath) {
  return new Promise((resolve, reject) => {
    const letras = [];
    const ext = path.extname(filePath);

    if (ext === '.json') {
      fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) return reject(err);
        resolve(JSON.parse(data).letras);
      });
    } else if (ext === '.csv') {
      const csv = require('csv-parser');
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          letras.push(row.linea);
        })
        .on('end', () => {
          resolve(letras);
        })
        .on('error', (err) => {
          reject(err);
        });
    } else {
      reject(new Error('Formato no soportado'));
    }
  });
}

module.exports = {
  ensureDataDir,
  ensureUserDataDir,
  readSources,
  writeSources,
  crearmenuhide,
  appendToFile,
  readFileContent,
  cargarCancion,
  loadPlaylists,
  savePlaylists,
  generatePlaylistId
};
