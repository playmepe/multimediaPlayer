// routes/biblia.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { PATHS } = require('../config/constants');
const pathManager = require('../utils/pathManager');

const bibleData = [];

// MODIFICADA: Función loadBibleData SIN crear directorios
function loadBibleData(callback) {
  console.log('📖 Cargando estructura de la Biblia...');

  try {
    // Usar PathManager para obtener la ruta correcta
    const bibliaPath = pathManager.getBibliaPath();
    const versionsDir = path.join(bibliaPath, 'versiones');

    console.log(`📁 Ruta de biblia: ${bibliaPath}`);
    console.log(`📁 Ruta de versiones: ${versionsDir}`);

    // Verificar si existe el directorio de versiones
    if (!fs.existsSync(versionsDir)) {
      console.log(`❌ No se encuentra directorio versiones en: ${versionsDir}`);
      return callback(new Error(`No se encuentra el directorio 'versiones' en ninguna ruta disponible`));
    }

    fs.readdir(versionsDir, (err, versions) => {
      if (err) {
        console.error('❌ Error leyendo directorio versiones:', err);
        return callback(err);
      }

      if (versions.length === 0) {
        console.log('⚠️ No se encontraron versiones en el directorio');
        return callback(new Error('No se encontraron versiones en el directorio'));
      }

      let versionCount = versions.length;
      console.log(`📚 Versiones encontradas: ${versionCount}`);

      versions.forEach(version => {
        console.log(`   - ${version}`);

        const versionPath = path.join(versionsDir, version);

        // Verificar si es directorio
        if (!fs.statSync(versionPath).isDirectory()) {
          versionCount--;
          checkCompletion();
          return;
        }

        fs.readdir(versionPath, (err, books) => {
          if (err) {
            console.error(`❌ Error leyendo versión ${version}:`, err);
            versionCount--;
            checkCompletion();
            return;
          }

          const versionData = {
            name: version,
            books: []
          };

          let bookCount = books.length;
          if (bookCount === 0) {
            versionCount--;
            checkCompletion();
            return;
          }

          books.forEach(book => {
            const bookPath = path.join(versionPath, book);

            // Verificar si es directorio
            if (!fs.statSync(bookPath).isDirectory()) {
              bookCount--;
              checkCompletion();
              return;
            }

            fs.readdir(bookPath, (err, chapterFiles) => {
              if (err) {
                console.error(`❌ Error leyendo libro ${book}:`, err);
                bookCount--;
                checkCompletion();
                return;
              }

              const chapters = chapterFiles
              .filter(file => file.endsWith('.json'))
              .map(file => {
                const chapterPath = path.join(bookPath, file);
                let verses = [];
                try {
                  const data = fs.readFileSync(chapterPath, 'utf8');
                  verses = JSON.parse(data);
                } catch (e) {
                  console.error(`❌ Error cargando ${chapterPath}:`, e);
                }
                return {
                  number: path.basename(file, '.json'),
                   verses: verses
                };
              })
              .sort((a, b) => parseInt(a.number) - parseInt(b.number));

              versionData.books.push({
                name: book,
                chapters: chapters,
                chapterCount: chapters.length
              });

              bookCount--;
              checkCompletion();
            });
          });

          function checkCompletion() {
            if (bookCount === 0) {
              bibleData.push(versionData);
              versionCount--;
              if (versionCount === 0) {
                console.log('✅ Estructura de la Biblia cargada correctamente.');
                return callback();
              }
            }
          }
        });
      });
    });

  } catch (error) {
    console.error('❌ Error general cargando datos de la Biblia:', error);
    callback(error);
  }
}

// Función auxiliar para obtener ruta de archivo
function getBibleFilePath(version, book, chapter) {
  const bibliaPath = pathManager.getBibliaPath();
  return path.join(bibliaPath, 'versiones', version, book, `${chapter}.json`);
}

// Búsqueda en la biblia
router.get('/search/:searchTerm', (req, res) => {
  const { searchTerm } = req.params;

  if (!searchTerm) {
    return res.status(400).json({ error: 'El término de búsqueda es requerido.' });
  }

  // Si no hay datos cargados, intentar cargarlos
  if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0) {
    console.log('⚠️ No hay datos de biblia cargados, intentando cargar...');
    loadBibleData((err) => {
      if (err) {
        return res.status(500).json({
          error: 'No se encontraron datos de la Biblia. Intenta recargar la página.'
        });
      }
      performSearch(searchTerm, res);
    });
  } else {
    performSearch(searchTerm, res);
  }
});

// Función: Realizar búsqueda
function performSearch(searchTerm, res) {
  const results = [];
  const exactPhrase = searchTerm.startsWith('"') && searchTerm.endsWith('"')
  ? searchTerm.slice(1, -1).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "")
  : null;

  const versePattern = /^(?<book>[A-ZÁÉÍÓÚÑ]+) (?<chapter>\d+):(?<verseNumber>\d+)$/i;
  const match = searchTerm.match(versePattern);

  if (!bibleData || !Array.isArray(bibleData) || bibleData.length === 0) {
    return res.status(500).json({ error: 'No se encontraron datos de la Biblia.' });
  }

  if (match) {
    const { book, chapter, verseNumber } = match.groups;
    bibleData.forEach(versionData => {
      const bookData = versionData.books.find(b => b.name.toUpperCase() === book.toUpperCase());
      if (bookData) {
        const chapterData = bookData.chapters.find(ch => ch.number === chapter);
        if (chapterData && chapterData.verses) {
          const verse = chapterData.verses.find(v => v[0] === verseNumber);
          if (verse) {
            results.push({
              version: versionData.name,
              book: book,
              chapter: chapter,
              verseNumber: verse[0],
              text: verse[1]
            });
          }
        }
      }
    });
  } else {
    bibleData.forEach(versionData => {
      versionData.books.forEach(book => {
        book.chapters.forEach(chapter => {
          if (chapter.verses) {
            chapter.verses.forEach(verse => {
              const verseText = verse[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

              if (exactPhrase && verseText.includes(exactPhrase)) {
                results.push({
                  version: versionData.name,
                  book: book.name,
                  chapter: chapter.number,
                  verseNumber: verse[0],
                  text: verse[1]
                });
              } else if (!exactPhrase) {
                const queryWords = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(" ");
                if (queryWords.every(word => verseText.includes(word))) {
                  results.push({
                    version: versionData.name,
                    book: book.name,
                    chapter: chapter.number,
                    verseNumber: verse[0],
                    text: verse[1]
                  });
                }
              }
            });
          }
        });
      });
    });
  }

  if (results.length === 0) {
    return res.status(404).json({ message: 'No se encontraron resultados.' });
  }

  res.json(results);
}

// Rutas para usar PathManager
router.get('/versions', (req, res) => {
  const bibliaPath = pathManager.getBibliaPath();
  const dirPath = path.join(bibliaPath, 'versiones');

  console.log(`📁 Buscando versiones en: ${dirPath}`);

  // Verificar si existe el directorio
  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: 'No se encuentra el directorio de versiones' });
  }

  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error('❌ Error leyendo directorio de versiones:', err);
      return res.status(500).json({ error: 'Error reading the book directory' });
    }
    const folders = files.filter(file => {
      const fullPath = path.join(dirPath, file);
      return fs.statSync(fullPath).isDirectory();
    });
    console.log(`📚 Versiones encontradas: ${folders.length}`);
    res.json(folders);
  });
});

router.get('/books/:version', (req, res) => {
  const { version } = req.params;
  const bibliaPath = pathManager.getBibliaPath();
  const dirPath = path.join(bibliaPath, 'versiones', version);

  console.log(`📁 Buscando libros en: ${dirPath}`);

  // Verificar si existe el directorio
  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: 'No se encuentra la versión solicitada' });
  }

  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error(`❌ Error leyendo versión ${version}:`, err);
      return res.status(500).json({ error: 'Error reading the book directory' });
    }
    const folders = files.filter(file => {
      const fullPath = path.join(dirPath, file);
      return fs.statSync(fullPath).isDirectory();
    });
    console.log(`📖 Libros encontrados en ${version}: ${folders.length}`);
    res.json(folders);
  });
});

router.get('/chapters/:version/:book', (req, res) => {
  const version = req.params.version;
  const book = req.params.book;
  const bibliaPath = pathManager.getBibliaPath();
  const dirPath = path.join(bibliaPath, 'versiones', version, book);

  console.log(`📁 Buscando capítulos en: ${dirPath}`);

  // Verificar si existe el directorio
  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: 'No se encuentra el libro solicitado' });
  }

  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error(`❌ Error leyendo capítulos de ${version}/${book}:`, err);
      return res.status(500).json({ error: 'Error reading chapters' });
    }
    const chapters = files.filter(file => file.endsWith('.json')).map(file => path.basename(file, '.json'));
    console.log(`📄 Capítulos encontrados en ${version}/${book}: ${chapters.length}`);
    res.json(chapters);
  });
});

router.get('/verses/:version/:book/:chapter', (req, res) => {
  const version = req.params.version;
  const book = decodeURIComponent(req.params.book);
  const chapter = req.params.chapter;

  const filePath = getBibleFilePath(version, book, chapter);
  console.log(`📖 Buscando versículos en: ${filePath}`);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`❌ Archivo no encontrado: ${filePath}`);
      return res.status(404).json({ error: 'Chapter not found' });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error(`❌ Error leyendo archivo: ${filePath}`, err);
        return res.status(500).json({ error: 'Error reading file' });
      }

      try {
        const verses = JSON.parse(data);
        console.log(`✅ Versículos cargados: ${version}/${book}/${chapter} (${verses.length} versículos)`);
        res.json(verses);
      } catch (parseErr) {
        console.error(`❌ Error procesando JSON: ${filePath}`, parseErr);
        return res.status(500).json({ error: 'Error processing JSON file' });
      }
    });
  });
});

// Ruta: Diagnóstico de biblia
router.get('/biblia/diagnostic', (req, res) => {
  try {
    const bibliaStatus = pathManager.getBibliaStatus();

    res.json({
      success: true,
      bibliaStatus,
      bibleDataLoaded: bibleData.length > 0,
      bibleDataCount: bibleData.length,
      paths: {
        BASE_DIR: PATHS.BASE_DIR,
        BIBLIA_ALTERNATIVE: PATHS.BIBLIA_ALTERNATIVE
      }
    });
  } catch (error) {
    console.error('Error en diagnóstico de biblia:', error);
    res.status(500).json({
      success: false,
      error: 'Error en diagnóstico'
    });
  }
});

// Ruta: Recargar biblia
router.post('/biblia/reload', (req, res) => {
  try {
    // Limpiar datos existentes
    bibleData.length = 0;

    loadBibleData((err, result) => {
      if (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      } else {
        res.json({
          success: true,
          message: 'Biblia recargada correctamente',
          versionsLoaded: bibleData.length,
          result
        });
      }
    });
  } catch (error) {
    console.error('Error recargando biblia:', error);
    res.status(500).json({
      success: false,
      error: 'Error recargando biblia'
    });
  }
});

module.exports = {
  router,
  loadBibleData,
  bibleData
};
