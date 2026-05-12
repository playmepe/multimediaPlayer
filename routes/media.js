// routes/media.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { PATHS } = require('../config/constants');
const constants = require('../config/constants');
const pathManager = require('../utils/pathManager');

// Función para obtener videos recursivamente
const getVideosFromDir = (dir, videos = []) => {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getVideosFromDir(fullPath, videos);
    } else if (file.endsWith('.mp4')) {
      videos.push({
        video: '/videos/' + path.relative(PATHS.VIDEOS_DIR, fullPath).replace(/\\/g, '/'),
        thumbnail: '/default-thumbnail.png'
      });
    }
  });
  return videos;
};

// Función para obtener imágenes recursivamente
const getImagesFromDir = (dir, images = []) => {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      if (!file.toLowerCase().includes('thumbnails')) {
        getImagesFromDir(fullPath, images);
      }
    } else {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
        images.push({
          src: '/images/' + path.relative(PATHS.IMAGES_DIR, fullPath).replace(/\\/g, '/'),
          title: file
        });
      }
    }
  });
  return images;
};

// Rutas de medios
router.get('/videos', (req, res) => {
  const videos = [];
  const videoFiles = [];
  
  const getFiles = (dir) => {
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        const thumbnailDir = path.join(fullPath, 'thumbnails');
        getFiles(fullPath);
        fs.readdirSync(fullPath).forEach(subfile => {
          if (path.extname(subfile) === '.mp4') {
            const videoPath = path.join(fullPath, subfile);
            const thumbnailName = path.basename(subfile, '.mp4') + '.png';
            const thumbnailPath = path.join(thumbnailDir, thumbnailName);

            videoFiles.push({
              video: '/videos/' + path.relative(PATHS.VIDEOS_DIR, videoPath).replace(/\\/g, '/'),
              thumbnail: fs.existsSync(thumbnailPath) ? '/videos/' + path.relative(PATHS.VIDEOS_DIR, thumbnailPath).replace(/\\/g, '/') : '/default-thumbnail.png'
            });
          }
        });
      }
    });
  };

  getVideosFromDir(PATHS.VIDEOS_DIR, videos);
  getFiles(PATHS.VIDEOS_DIR);
  res.json(videoFiles);
});

router.get('/images', (req, res) => {
  const images = [];
  getImagesFromDir(PATHS.IMAGES_DIR, images);
  res.json(images);
});

router.post('/update-videos', async (req, res) => {
  try {
    const videos = getVideosFromDir(PATHS.VIDEOS_DIR);
    const files = fs.readdirSync(PATHS.VIDEOS_DIR);

    for (const file of files) {
      if (file.endsWith('.mp4')) {
        const videoPath = path.join(PATHS.VIDEOS_DIR, file);
        const thumbnailPath = path.join(PATHS.VIDEOS_DIR, 'thumbnails', `${path.basename(file, '.mp4')}.png`);
        videos.push({ video: videoPath, thumbnail: thumbnailPath });
      }
    }

    const videosJsonPath = path.join(PATHS.DATA_DIR, 'videos.json');
    fs.writeFileSync(videosJsonPath, JSON.stringify(videos, null, 2));
    res.send('Archivo JSON actualizado exitosamente.');
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).send(`Error: ${err.message}`);
  }
});

router.get('/download-json', (req, res) => {
  const file = path.join(PATHS.DATA_DIR, 'videos.json');
  res.download(file, 'videos.json', (err) => {
    if (err) {
      console.error('Error al descargar el archivo JSON:', err);
      res.status(500).send('Error al descargar el archivo JSON.');
    }
  });
});
//////////////////  multimedia config   ///////////

// Servir archivos multimedia con rutas dinámicas
router.get('/media/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = pathManager.resolveMediaPath(filename);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: 'Archivo no encontrado'
      });
    }

    // Verificar que el archivo existe y es seguro
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Archivo no encontrado'
      });
    }

    // Obtener extensión y tipo MIME
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm'
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error sirviendo archivo multimedia:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
});

// Listar archivos multimedia disponibles
router.get('/api/media/files', (req, res) => {
  try {
    const videosDir = constants.PATHS.VIDEOS_DIR;
    const imagesDir = constants.PATHS.IMAGES_DIR;

    const mediaFiles = [];

    // Leer directorio de videos
    if (fs.existsSync(videosDir)) {
      const videoFiles = fs.readdirSync(videosDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.avi', '.mov', '.webm'].includes(ext);
      });

      videoFiles.forEach(file => {
        mediaFiles.push({
          name: file,
          path: `/media/${file}`,
          type: 'video',
          fullPath: path.join(videosDir, file)
        });
      });
    }

    // Leer directorio de imágenes
    if (fs.existsSync(imagesDir)) {
      const imageFiles = fs.readdirSync(imagesDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
      });

      imageFiles.forEach(file => {
        mediaFiles.push({
          name: file,
          path: `/media/${file}`,
          type: 'image',
          fullPath: path.join(imagesDir, file)
        });
      });
    }

    res.json({
      success: true,
      files: mediaFiles,
      directories: {
        videos: videosDir,
        images: imagesDir
      }
    });

  } catch (error) {
    console.error('Error listando archivos multimedia:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
});

//module.exports = router;


module.exports = router;
