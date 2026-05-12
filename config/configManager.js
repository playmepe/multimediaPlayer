// configManager.js
const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor(userHomeDir) {
        this.userHomeDir = userHomeDir;
        this.configFile = path.join(userHomeDir, 'bibliaplayweb', 'config.json');
        this.defaultConfig = {
            VIDEOS_DIR: path.join(userHomeDir, 'MULTIMEDIA'),
            IMAGES_DIR: path.join(userHomeDir, 'MULTIMEDIA')
        };
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const configData = fs.readFileSync(this.configFile, 'utf8');
                return { ...this.defaultConfig, ...JSON.parse(configData) };
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
        return { ...this.defaultConfig };
    }

    saveConfig(newConfig) {
        try {
            this.config = { ...this.config, ...newConfig };
            const configDir = path.dirname(this.configFile);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    get(key) {
        return this.config[key];
    }

    getAll() {
        return { ...this.config };
    }

    // Validar si un directorio existe
    validateDirectory(dirPath) {
        try {
            return fs.existsSync(dirPath);
        } catch (error) {
            return false;
        }
    }

    // Crear directorio si no existe
    ensureDirectory(dirPath) {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return true;
        } catch (error) {
            console.error('Error creating directory:', error);
            return false;
        }
    }
}

module.exports = ConfigManager;
