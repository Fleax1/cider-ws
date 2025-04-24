const { app, BrowserWindow, ipcMain, screen, Tray, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');

let mainWindow;
let tray = null;
let currentSong = null;
let socket;

// Connexion WebSocket à Cider
function connectToCider(port) {
  console.log(`Tentative de connexion à Cider sur le port ${port}...`);
  
  if (socket) {
    socket.disconnect();
  }

  const socketOptions = {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000,
    forceNew: true,
    autoConnect: true
  };

  socket = io(`http://127.0.0.1:${port}`, socketOptions);

  socket.on('connect', () => {
    console.log('✅ Connecté à Cider via WebSocket');
    socket.emit('API:Playback', { type: 'playbackStatus.getCurrentItem' });
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Erreur de connexion à Cider:', error.message);
  });

  socket.on('API:Playback', handlePlaybackEvent);

  return socket;
}

function handlePlaybackEvent(payload) {
  const { type, data } = payload;

  if (!['playbackStatus.nowPlayingItemDidChange', 'playbackStatus.getCurrentItem', 'playbackStatus.playbackStateDidChange'].includes(type)) {
    return;
  }

  if (data?.state === 'stopped') {
    handleStoppedPlayback();
    return;
  }

  if (!data?.attributes && !(data?.artistName && data?.name)) {
    handleNoPlayback();
    return;
  }

  handleCurrentSong(data);
}

function handleStoppedPlayback() {
  console.log('⏹️ Lecture arrêtée');
  currentSong = null;
  if (mainWindow) {
    mainWindow.webContents.send('now-playing-update', null);
  }
}

function handleNoPlayback() {
  console.log('⏸️ Aucune musique en cours de lecture');
  currentSong = null;
  if (mainWindow) {
    mainWindow.webContents.send('now-playing-update', null);
  }
}

function handleCurrentSong(data) {
  const attributes = data.attributes || data;
  const coverUrl = attributes.artwork?.url || attributes.artwork?.url;
  
  currentSong = {
    artist: attributes.artistName || attributes.artistName || 'Inconnu',
    song: attributes.name || attributes.name || 'Inconnu',
    album: attributes.albumName || attributes.albumName || 'Inconnu',
    coverUrl: coverUrl ? coverUrl.replace('{w}', '500').replace('{h}', '500') : null
  };

  console.log('🎵 Musique en cours:', `${currentSong.artist} - ${currentSong.song}`);

  if (mainWindow) {
    mainWindow.webContents.send('now-playing-update', currentSong);
  }

  saveToFile(currentSong);
}

function saveToFile(songInfo) {
  const configPath = path.join(process.env.APPDATA, 'CiderWS', 'settings.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  if (config.separateFiles) {
    // Sauvegarder dans des fichiers séparés
    const files = [
      { path: config.artistFilePath, content: songInfo.artist },
      { path: config.songFilePath, content: songInfo.song },
      { path: config.albumFilePath, content: songInfo.album },
      { path: config.coverFilePath, content: songInfo.coverUrl || '' }
    ];

    files.forEach(({ path: filePath, content }) => {
      // Remplacer %APPDATA% par le chemin réel
      if (filePath.includes('%APPDATA%')) {
        filePath = filePath.replace('%APPDATA%', process.env.APPDATA);
      }
      
      // Créer le dossier s'il n'existe pas
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(filePath, content);
    });
  } else {
    // Sauvegarder dans un seul fichier (comportement original)
    let filePath = config.filePath;
    if (filePath.includes('%APPDATA%')) {
      filePath = filePath.replace('%APPDATA%', process.env.APPDATA);
    }
    
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    let output;
    if (config.fileFormat === 'json') {
      output = JSON.stringify(songInfo, null, 2);
    } else {
      output = config.fileTemplate
        .replace('{{ARTIST}}', songInfo.artist)
        .replace('{{SONG}}', songInfo.song)
        .replace('{{ALBUM}}', songInfo.album)
        .replace('{{COVER}}', songInfo.coverUrl || '');
    }

    fs.writeFileSync(filePath, output);
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Ouvrir', 
      click: () => {
        mainWindow.show();
      }
    },
    { 
      label: 'Quitter', 
      click: () => {
        app.quit();
      }
    }
  ]);
  tray.setToolTip('CiderWS');
  tray.setContextMenu(contextMenu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    x: screen.getPrimaryDisplay().bounds.x,
    y: screen.getPrimaryDisplay().bounds.y,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setMenu(null);

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Gérer la fermeture de la fenêtre
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.on('ready', () => {
  createTray();
  createWindow();

  const configPath = path.join(__dirname, 'settings.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      socket = connectToCider(config.port);
    } catch (error) {
      console.error('Erreur lors de la lecture de la configuration:', error);
    }
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-current-song', () => {
  return currentSong;
});

// Fonction pour migrer la configuration vers une nouvelle version
function migrateConfig(config, defaultConfig) {
  const migratedConfig = { ...defaultConfig };
  
  // Copier les valeurs existantes
  for (const key in config) {
    if (key in defaultConfig) {
      migratedConfig[key] = config[key];
    }
  }
  
  // Ajouter ici la logique de migration pour les versions futures
  // Par exemple :
  // if (!config.hasOwnProperty('newParameter')) {
  //   migratedConfig.newParameter = defaultConfig.newParameter;
  // }
  
  return migratedConfig;
}

ipcMain.handle('get-config', () => {
  const configPath = path.join(process.env.APPDATA, 'CiderWS', 'settings.json');
  const defaultConfig = {
    port: 10767,
    fileFormat: 'text',
    filePath: 'C:\\CiderWS\\now_playing.txt',
    fileTemplate: '{{ARTIST}} - {{SONG}}',
    separateFiles: false,
    artistFilePath: 'C:\\CiderWS\\artist.txt',
    songFilePath: 'C:\\CiderWS\\song.txt',
    albumFilePath: 'C:\\CiderWS\\album.txt',
    coverFilePath: 'C:\\CiderWS\\cover.txt',
    // Ajoutez ici les nouveaux paramètres pour les futures versions
    // newParameter: 'defaultValue'
  };

  try {
    // Créer le dossier s'il n'existe pas
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Migrer la configuration si nécessaire
      const migratedConfig = migrateConfig(config, defaultConfig);
      
      // Sauvegarder la configuration migrée si des changements ont été effectués
      if (JSON.stringify(config) !== JSON.stringify(migratedConfig)) {
        fs.writeFileSync(configPath, JSON.stringify(migratedConfig, null, 2));
      }
      
      return migratedConfig;
    } else {
      // Créer le fichier de configuration avec les valeurs par défaut
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
  } catch (error) {
    console.error('Erreur lors de la lecture de la configuration:', error);
    return defaultConfig;
  }
});

ipcMain.handle('save-config', (event, config) => {
  const configPath = path.join(process.env.APPDATA, 'CiderWS', 'settings.json');
  
  // Créer le dossier s'il n'existe pas
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  // Redémarrer la connexion WebSocket avec la nouvelle configuration
  if (socket) {
    socket.disconnect();
  }
  connectToCider(config.port);
  return 'Configuration sauvegardée !';
});
