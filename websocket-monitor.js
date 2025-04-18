const io = require('socket.io-client');
const { port } = require('./settings.json');

// Connexion WebSocket
const socket = io(`ws://localhost:${port}`, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log(`✅ Connecté à Cider via WebSocket (Socket.IO)`);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erreur de connexion à Cider:', error.message);
});

socket.on('API:Playback', (payload) => {
  console.log('📡 Données reçues:', JSON.stringify(payload, null, 2));
});

// Demander l'état actuel de la lecture
socket.emit('API:Playback', { type: 'playbackStatus.getCurrentItem' }); 