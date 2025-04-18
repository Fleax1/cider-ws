const fs = require('fs');
const io = require('socket.io-client');
const { port, fileFormat, filePath, fileTemplate } = require('./settings.json');

// Connexion WebSocket
const socket = io(`ws://localhost:${port}`, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log(`✅ Connecté à Cider via WebSocket (Socket.IO)`);
});

socket.on('API:Playback', (payload) => {
  const { type, data } = payload;

  if (type === 'playbackStatus.nowPlayingItemDidChange') {
    const songInfo = {
      artist: data.artistName,
      song: data.name,
      album: data.albumName,
    };

    // Appliquer le modèle personnalisé
    let output = fileTemplate
      .replace('{{ARTIST}}', songInfo.artist)
      .replace('{{SONG}}', songInfo.song)
      .replace('{{ALBUM}}', songInfo.album);

    // Sauvegarder dans le fichier selon le format choisi
    if (fileFormat === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(songInfo, null, 2));
    } else {
      fs.writeFileSync(filePath, output);
    }

    console.log('Musique enregistrée:', songInfo);
  }
});
