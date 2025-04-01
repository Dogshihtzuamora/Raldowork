const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, 'JSON');
const CONFIG_FILE = path.join(CONFIG_DIR, 'userConfig.json');
const RLND_LIST_FILE = path.join(CONFIG_DIR, 'rlnd_list.json');

function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

const defaultConfig = {
    id: '',
    username: '',
    data: '',
    lastUsedRLND: ''
};

function loadUser() {
    const userFile = path.join(__dirname, 'user_config.json');
    if (fs.existsSync(userFile)) {
        return JSON.parse(fs.readFileSync(userFile, 'utf-8'));
    }
    return null;
}

function loadConfig() {
    ensureConfigDir();
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            return { ...defaultConfig, ...config };
        }
    } catch (error) {
        console.error('Erro ao carregar configuração:', error);
    }
    return defaultConfig;
}

function saveConfig(config) {
    ensureConfigDir();
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Erro ao salvar configuração:', error);
    }
}

function saveUser(username) {
    const config = loadConfig();
    
    if (!config.id) {
        config.id = generateUserId();
    }
    
    if (!config.data) {
        config.data = new Date().toISOString();
    }

    config.username = username;
    saveConfig(config);
}

function updateLastUsedRLND(rlnd) {
    const config = loadConfig();
    config.lastUsedRLND = rlnd;
    saveConfig(config);
}

function generateUserId() {
    return `usr-${Date.now()}`;
}

function getUsername() {
    return loadConfig().username || null;
}

function saveRLNDList(data) {
    ensureConfigDir();
    try {
        fs.writeFileSync(RLND_LIST_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Erro ao salvar rlnd_list:', error);
    }
}

function loadRLNDs() {
    ensureConfigDir();
    return fs.existsSync(RLND_LIST_FILE) ? JSON.parse(fs.readFileSync(RLND_LIST_FILE, 'utf8')) : [];
}

function saveRLNDs(rlnds) {
    ensureConfigDir();
    fs.writeFileSync(RLND_LIST_FILE, JSON.stringify(rlnds, null, 2), 'utf8');
}

module.exports = {
    loadUser,
    loadConfig,
    saveConfig,
    saveUser,
    updateLastUsedRLND,
    getUsername,
    saveRLNDList,
    loadRLNDs,
    saveRLNDs
};
