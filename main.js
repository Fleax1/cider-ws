const { app, BrowserWindow, ipcMain, screen, Tray, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');

let mainWindow;
let tray = null;
let currentSong = null;

// Connexion WebSocket à Cider
function connectToCider(port) {
  console.log(`Tentative de connexion à Cider sur le port ${port}...`);
  
  const socket = io(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000,
    forceNew: true,
    autoConnect: true,
    forceBase64: false,
    extraHeaders: {},
    path: '/socket.io/',
    query: {},
    agent: false,
    onlyBinaryUpgrades: false,
    forceNode: true,
    localAddress: '127.0.0.1'
  });

  socket.on('connect', () => {
    console.log('✅ Connecté à Cider via WebSocket');
    socket.emit('API:Playback', { type: 'playbackStatus.getCurrentItem' });
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Erreur de connexion à Cider:', error.message);
  });

  socket.on('API:Playback', (payload) => {
    const { type, data } = payload;

    if (type === 'playbackStatus.nowPlayingItemDidChange' || type === 'playbackStatus.getCurrentItem' || type === 'playbackStatus.playbackStateDidChange') {
      if (data && (data.attributes || (data.artistName && data.name))) {
        // Remplacer les variables de dimensions dans l'URL
        let coverUrl = data.attributes?.artwork?.url || data.artwork?.url;
        if (coverUrl) {
          coverUrl = coverUrl.replace('{w}', '500').replace('{h}', '500');
        }
        
        currentSong = {
          artist: data.attributes?.artistName || data.artistName || 'Inconnu',
          song: data.attributes?.name || data.name || 'Inconnu',
          album: data.attributes?.albumName || data.albumName || 'Inconnu',
          coverUrl: coverUrl || null
        };

        console.log('🎵 Musique en cours:', `${currentSong.artist} - ${currentSong.song}`);

        if (mainWindow) {
          mainWindow.webContents.send('now-playing-update', currentSong);
        }

        saveToFile(currentSong);
      } else if (type === 'playbackStatus.playbackStateDidChange' && data.state === 'stopped') {
        console.log('⏹️ Lecture arrêtée');
        currentSong = null;
        if (mainWindow) {
          mainWindow.webContents.send('now-playing-update', null);
        }
      } else {
        console.log('⏸️ Aucune musique en cours de lecture');
        currentSong = null;
        if (mainWindow) {
          mainWindow.webContents.send('now-playing-update', null);
        }
      }
    }
  });

  return socket;
}

function saveToFile(songInfo) {
  const configPath = path.join(__dirname, 'settings.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Remplacer %APPDATA% par le chemin réel
  let filePath = config.filePath;
  if (filePath.includes('%APPDATA%')) {
    filePath = filePath.replace('%APPDATA%', process.env.APPDATA);
  }
  
  // Créer le dossier s'il n'existe pas
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
  tray.setToolTip('Cider WS');
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
      connectToCider(config.port);
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

ipcMain.handle('get-config', () => {
  const configPath = path.join(__dirname, 'settings.json');
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } else {
      return {
        port: 10767,
        fileFormat: 'text',
        filePath: 'now_playing.txt',
        fileTemplate: '{{ARTIST}} - {{SONG}}',
      };
    }
  } catch (error) {
    console.error('Erreur lors de la lecture de la configuration:', error);
    return {
      port: 10767,
      fileFormat: 'text',
      filePath: 'now_playing.txt',
      fileTemplate: '{{ARTIST}} - {{SONG}}',
    };
  }
});

ipcMain.handle('save-config', (event, config) => {
  const configPath = path.join(__dirname, 'settings.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  connectToCider(config.port);
  return 'Configuration sauvegardée !';
});
