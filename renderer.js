const { ipcRenderer } = require('electron');

function showStatusMessage(message, type = 'success') {
  const statusElement = document.getElementById('statusMessage');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  statusElement.style.display = 'block';
  
  // Masquer le message après 3 secondes
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

function updateNowPlaying(songInfo) {
  const currentSongElement = document.getElementById('currentSong');
  
  if (!songInfo || !songInfo.artist || !songInfo.song) {
    currentSongElement.innerHTML = '<div class="no-song">Aucune musique en cours de lecture</div>';
    return;
  }

  currentSongElement.innerHTML = `
    <div><span>Artiste :</span> ${songInfo.artist}</div>
    <div><span>Titre :</span> ${songInfo.song}</div>
    ${songInfo.album ? `<div><span>Album :</span> ${songInfo.album}</div>` : ''}
  `;
}

// Récupérer la configuration à partir du processus principal
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('get-config').then((config) => {
    // Pré-remplir les champs avec les valeurs existantes
    document.getElementById('port').value = config.port;
    document.getElementById('fileFormat').value = config.fileFormat;
    document.getElementById('filePath').value = config.filePath;
    document.getElementById('fileTemplate').value = config.fileTemplate || '{{ARTIST}} - {{SONG}}';
  }).catch(error => {
    showStatusMessage('Erreur lors du chargement de la configuration', 'error');
    console.error('Erreur:', error);
  });

  // Sauvegarder la configuration lorsque l'utilisateur clique sur le bouton
  document.getElementById('saveBtn').addEventListener('click', () => {
    const port = document.getElementById('port').value;
    const filePath = document.getElementById('filePath').value;
    
    // Validation des champs
    if (!port || port < 1024 || port > 65535) {
      showStatusMessage('Le port doit être compris entre 1024 et 65535', 'error');
      return;
    }
    
    if (!filePath) {
      showStatusMessage('Le chemin du fichier est requis', 'error');
      return;
    }

    const config = {
      port: parseInt(port),
      fileFormat: document.getElementById('fileFormat').value,
      filePath: filePath,
      fileTemplate: document.getElementById('fileTemplate').value,
    };

    // Désactiver le bouton pendant la sauvegarde
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Sauvegarde en cours...';

    // Envoyer la configuration au processus principal pour la sauvegarder
    ipcRenderer.invoke('save-config', config)
      .then((message) => {
        showStatusMessage('Configuration sauvegardée avec succès !');
      })
      .catch(error => {
        showStatusMessage('Erreur lors de la sauvegarde', 'error');
        console.error('Erreur:', error);
      })
      .finally(() => {
        // Réactiver le bouton
        saveBtn.disabled = false;
        saveBtn.textContent = 'Sauvegarder la configuration';
      });
  });

  // Écouter les mises à jour de la musique en cours
  ipcRenderer.on('now-playing-update', (event, songInfo) => {
    updateNowPlaying(songInfo);
  });

  // Demander la musique actuelle au chargement
  ipcRenderer.invoke('get-current-song').then(updateNowPlaying).catch(error => {
    console.error('Erreur lors de la récupération de la musique en cours:', error);
  });
});
