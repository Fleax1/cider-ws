const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');

let mainWindow;
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

    if (type === 'playbackStatus.nowPlayingItemDidChange' || type === 'playbackStatus.getCurrentItem') {
      if (data) {
        currentSong = {
          artist: data.artistName || 'Inconnu',
          song: data.name || 'Inconnu',
          album: data.albumName || 'Inconnu',
        };

        console.log('🎵 Musique en cours:', `${currentSong.artist} - ${currentSong.song}`);

        if (mainWindow) {
          mainWindow.webContents.send('now-playing-update', currentSong);
        }

        saveToFile(currentSong);
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
  
  let output;
  if (config.fileFormat === 'json') {
    output = JSON.stringify(songInfo, null, 2);
  } else {
    output = config.fileTemplate
      .replace('{{ARTIST}}', songInfo.artist)
      .replace('{{SONG}}', songInfo.song)
      .replace('{{ALBUM}}', songInfo.album);
  }

  fs.writeFileSync(config.filePath, output);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    x: screen.getPrimaryDisplay().bounds.x,
    y: screen.getPrimaryDisplay().bounds.y,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.on('ready', () => {
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
