// utils/mediaProcessor.js
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');   // <-- nuevo
const ffmpeg = require('fluent-ffmpeg');
const { PATHS } = require('../config/constants');

const generateThumbnail = async (filePath, thumbnailPath) => {
  const ext = path.extname(filePath).toLowerCase();

  // ---------- IMÁGENES ----------
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    try {
      const img = await loadImage(filePath);

      // Calculamos escala para cubrir 200x120 sin deformar
      const targetW = 200;
      const targetH = 120;
      const ratio = Math.max(targetW / img.width, targetH / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const offsetX = (targetW - drawW) / 2;   // centrado
      const offsetY = (targetH - drawH) / 2;

      const canvas = createCanvas(targetW, targetH);
      const ctx = canvas.getContext('2d');

      // Fondo transparente (para PNG) o blanco si prefieres
      ctx.clearRect(0, 0, targetW, targetH);

      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      // Guardamos como PNG (el path ya tiene .png)
      const out = fs.createWriteStream(thumbnailPath);
      const stream = canvas.createPNGStream();
      await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
      });

      console.log(`Thumbnail generado para imagen: ${filePath}`);
    } catch (error) {
      console.error('Error generando thumbnail para imagen:', filePath, error);
    }
  }
  // ---------- VÍDEOS ----------
  else if (['.mp4', '.mkv', '.webm'].includes(ext)) {
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
        .on('end', () => {
          console.log(`Thumbnail generado para video: ${filePath}`);
          resolve();
        })
        .on('error', (err) => {
          console.error('Error generando thumbnail para video:', filePath, err);
          reject(err);
        })
        .screenshots({
          count: 1,
          folder: path.dirname(thumbnailPath),
                     filename: path.basename(thumbnailPath),
                     size: '200x120'
        });
      });
    } catch (error) {
      console.error('Error en la promesa de FFmpeg:', filePath, error);
    }
  } else {
    console.warn('Formato de archivo no soportado para thumbnail:', ext);
  }
};


const getThumbnailForFile = async (filePath) => {
  const thumbnailDir = path.join(path.dirname(filePath), 'thumbnails');
  const title = path.basename(filePath, path.extname(filePath));
  const thumbnailFile = path.join(thumbnailDir, `${title}.png`);

  if (!fs.existsSync(thumbnailFile)) {
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }
    await generateThumbnail(filePath, thumbnailFile);
  }

  return `/api/vplay/${encodeURIComponent(path.relative(PATHS.VIDEOS_DIR, thumbnailFile))}`;
};

const generateMediaJson = async (dir, allItems) => {
  const readDirectory = async (directory) => {
    const items = [];
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        if (file === 'thumbnails' || file === '.Trash-1000' || file.startsWith('1000-') || file === 'System Volume Information') {
          continue;
        }
        await readDirectory(filePath);
      } else {
        const ext = path.extname(file).toLowerCase();
        const title = path.basename(file, ext).replace(/_/g, ' ');
        const action = `/api/vplay/${encodeURIComponent(path.relative(PATHS.VIDEOS_DIR, filePath))}`;

        let icon = '';

        if (['.mp4', '.mkv', '.webm', '.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          icon = await getThumbnailForFile(filePath);

          const type = ['.mp4', '.mkv', '.webm'].includes(ext) ? 'video' : 'image';
          const item = { title, action, icon, type, playerLabel: type === 'video' ? title : undefined };
          items.push(item);
          allItems.push(item);
        }
      }
    }

    if (items.length > 0) {
      const folderName = path.basename(directory);
      const outputJsonFile = path.join(PATHS.DATA_DIR, 'media', `${folderName}_videos.json`);
      fs.writeFileSync(outputJsonFile, JSON.stringify({ items }, null, 2));
      console.log('JSON generado exitosamente en', outputJsonFile);
    }
  };

  await readDirectory(dir);
};

const generateMenuJson = async () => {
  const menuItems = [
    { title: "NUEVOS", action: "nuevas_descargas_videos.json" },
    { title: "TODAS", action: "all_videos.json" },
    { title: "MULTIMEDIA", action: "MULTIMEDIA_videos.json" }
  ];

  const readDirectories = async (directory) => {
    const folders = fs.readdirSync(directory).filter(file => {
      const filePath = path.join(directory, file);
      return fs.statSync(filePath).isDirectory() &&
      file !== 'thumbnails' &&
      file !== '.Trash-1000' &&
      !file.startsWith('1000-') &&
      file !== 'System Volume Information';
    });

    for (const folder of folders) {
      const folderPath = path.join(directory, folder);
      const jsonFile = `${folder}_videos.json`;
      menuItems.push({ title: folder, action: jsonFile });
      await readDirectories(folderPath);
    }
  };

  await readDirectories(PATHS.VIDEOS_DIR);

  const outputmenuJsonFile = path.join(PATHS.DATA_DIR, 'datos', 'menu.json');
  fs.writeFileSync(outputmenuJsonFile, JSON.stringify({ items: menuItems }, null, 2));
  console.log('menu.json generado exitosamente en:', outputmenuJsonFile);
};

const generateTotalMediaJson = async (allItems) => {
  const outputTotalJsonFile = path.join(PATHS.DATA_DIR, 'media', 'all_videos.json');
  fs.writeFileSync(outputTotalJsonFile, JSON.stringify({ items: allItems }, null, 2));
  console.log('JSON total generado exitosamente en', outputTotalJsonFile);
};

const updateImagesInfo = () => {
  const imagesDirectory = path.join(PATHS.DATA_DIR, 'images');
  const outputPath = path.join(PATHS.DATA_DIR, 'datos', 'images-info.json');

  const images = fs.readdirSync(imagesDirectory).map(file => {
    const filePath = path.join(imagesDirectory, file);
    const stats = fs.statSync(filePath);
    return {
      name: file,
      path: `http://localhost:4000/imagesbiblia/${file}`,
      size: stats.size
    };
  });

  if (!fs.existsSync(outputPath)) {
    fs.writeFileSync(outputPath, JSON.stringify([], null, 2));
  }

  fs.writeFileSync(outputPath, JSON.stringify(images, null, 2));
  console.log('images-info.json actualizado');
};

module.exports = {
  generateThumbnail,
  getThumbnailForFile,
  generateMediaJson,
  generateMenuJson,
  generateTotalMediaJson,
  updateImagesInfo
};
