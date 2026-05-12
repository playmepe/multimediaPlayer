// utils/pathManager.js
const fs = require('fs');
const path = require('path');
const constants = require('../config/constants');

class PathManager {
    // Obtener ruta de biblia con alternativa (SOLO VERIFICACIÓN, SIN CREAR)
    getBibliaPath() {
        const mainPath = constants.PATHS.BASE_DIR;
        const alternativePath = constants.PATHS.BIBLIA_ALTERNATIVE;

        console.log(`🔍 Buscando ruta de biblia...`);
        console.log(`   📁 Ruta principal: ${mainPath}`);
        console.log(`   📁 Ruta alternativa: ${alternativePath}`);

        // Verificar si la ruta principal existe y tiene versiones
        if (fs.existsSync(mainPath)) {
            const versionesPath = path.join(mainPath, 'versiones');
            if (fs.existsSync(versionesPath)) {
                console.log(`✅ Usando ruta principal con versiones: ${mainPath}`);
                return mainPath;
            } else {
                console.log(`⚠️ Ruta principal existe pero no tiene versiones: ${mainPath}`);
            }
        }

        // Si no existe principal o no tiene versiones, usar alternativa
        if (fs.existsSync(alternativePath)) {
            const versionesPath = path.join(alternativePath, 'versiones');
            if (fs.existsSync(versionesPath)) {
                console.log(`✅ Usando ruta alternativa con versiones: ${alternativePath}`);
                return alternativePath;
            } else {
                console.log(`⚠️ Ruta alternativa existe pero no tiene versiones: ${alternativePath}`);
            }
        }

        // Si ninguna tiene versiones, usar la principal pero NO CREAR DIRECTORIOS
        console.log(`⚠️ Ninguna ruta tiene carpeta 'versiones', usando principal: ${mainPath}`);
        return mainPath;
    }

    // Verificar si un archivo existe en cualquier ruta posible
    resolveMediaPath(filename) {
        const videosDir = constants.PATHS.VIDEOS_DIR;
        const imagesDir = constants.PATHS.IMAGES_DIR;

        const possiblePaths = [
            path.join(videosDir, filename),
            path.join(imagesDir, filename),
            path.join(constants.PATHS.USER_HOME, filename)
        ];

        for (const filePath of possiblePaths) {
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }

        return null; // No encontrado
    }

    // Verificar validez de rutas
    validatePaths() {
        const paths = constants.PATHS;
        const results = {};

        for (const [key, pathValue] of Object.entries(paths)) {
            results[key] = {
                path: pathValue,
                exists: fs.existsSync(pathValue),
                isDirectory: fs.existsSync(pathValue) ? fs.statSync(pathValue).isDirectory() : false
            };
        }

        return results;
    }

    // Crear directorios si no existen (EXCEPTO BIBLIA)
    ensureDirectories() {
        const paths = constants.PATHS;

        console.log('📁 Asegurando directorios...');

        for (const [key, pathValue] of Object.entries(paths)) {
            // NO crear directorios de biblia automáticamente
            if (key !== 'USER_HOME' && key !== 'WEB_UI_DIR' && key !== 'BASE_DIR' && key !== 'BIBLIA_ALTERNATIVE' && !fs.existsSync(pathValue)) {
                try {
                    fs.mkdirSync(pathValue, { recursive: true });
                    console.log(`   ✅ ${key}: ${pathValue}`);
                } catch (error) {
                    console.error(`   ❌ ${key}: ${error.message}`);
                }
            } else if (fs.existsSync(pathValue)) {
                console.log(`   📁 ${key}: ${pathValue} (ya existe)`);
            }
        }
    }

    // Obtener información del estado de las rutas de biblia
    getBibliaStatus() {
        const mainPath = constants.PATHS.BASE_DIR;
        const alternativePath = constants.PATHS.BIBLIA_ALTERNATIVE;

        const mainExists = fs.existsSync(mainPath);
        const altExists = fs.existsSync(alternativePath);

        const mainVersiones = mainExists ? fs.existsSync(path.join(mainPath, 'versiones')) : false;
        const altVersiones = altExists ? fs.existsSync(path.join(alternativePath, 'versiones')) : false;

        return {
            mainPath: {
                path: mainPath,
                exists: mainExists,
                hasVersiones: mainVersiones
            },
            alternativePath: {
                path: alternativePath,
                exists: altExists,
                hasVersiones: altVersiones
            },
            currentPath: this.getBibliaPath()
        };
    }
}

module.exports = new PathManager();
