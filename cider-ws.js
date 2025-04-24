const fs = require('fs');
const io = require('socket.io-client');
const { port, fileFormat, filePath, fileTemplate } = require('./settings.json');

const socketOptions = {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000
};

const socket = io(`ws://localhost:${port}`, socketOptions);

function ensureDirectoryExists(filePath) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveToFile(songInfo) {
  ensureDirectoryExists(filePath);
  
  let output;
  if (fileFormat === 'json') {
    output = JSON.stringify(songInfo, null, 2);
  } else {
    output = fileTemplate
      .replace('{{ARTIST}}', songInfo.artist)
      .replace('{{SONG}}', songInfo.song)
      .replace('{{ALBUM}}', songInfo.album);
  }

  fs.writeFileSync(filePath, output);
  console.log('Musique enregistrée:', songInfo);
}

socket.on('connect', () => {
  console.log(`✅ Connecté à Cider via WebSocket (Socket.IO)`);
});

socket.on('API:Playback', (payload) => {
  const { type, data } = payload;

  if (type === 'playbackStatus.nowPlayingItemDidChange' && data) {
    const songInfo = {
      artist: data.artistName || 'Inconnu',
      song: data.name || 'Inconnu',
      album: data.albumName || 'Inconnu'
    };

    saveToFile(songInfo);
  }
});

socket.on('error', (error) => {
  console.error('Erreur de connexion:', error);
});

socket.on('disconnect', () => {
  console.log('Déconnecté de Cider');
});
