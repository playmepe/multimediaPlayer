// config/paths.js
const path = require('path');
const { PATHS, DATA_FILES } = require('./constants');

module.exports = {
  getMediaPath: (subpath = '') => path.join(PATHS.VIDEOS_DIR, subpath),
  getDataPath: (subpath = '') => path.join(PATHS.DATA_DIR, 'datos', subpath),
  getImagesPath: (subpath = '') => path.join(PATHS.DATA_DIR, 'images', subpath),
  getCancionesPath: (subpath = '') => path.join(PATHS.DATA_DIR, 'canciones', subpath),
  getBibliaPath: (subpath = '') => path.join(PATHS.BASE_DIR, subpath),
  
  // Rutas específicas
  sourcesFile: DATA_FILES.SOURCES,
  imagesInfoFile: DATA_FILES.IMAGES_INFO,
  menuHideFile: DATA_FILES.MENU_HIDE,
  outputFile: DATA_FILES.OUTPUT_TXT
};
