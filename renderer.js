const { ipcRenderer } = require('electron');

function showStatusMessage(message, type = 'success') {
  const statusElement = document.getElementById('statusMessage');
  if (!statusElement) return;
  
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  statusElement.style.display = 'block';
  
  clearTimeout(statusElement.timeoutId);
  statusElement.timeoutId = setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

function updateNowPlaying(songInfo) {
  const currentSongElement = document.getElementById('currentSong');
  const albumCoverElement = document.querySelector('.album-cover');
  
  if (!currentSongElement || !albumCoverElement) return;
  
  if (!songInfo || !songInfo.artist || !songInfo.song) {
    currentSongElement.innerHTML = '<div class="no-song">Aucune musique en cours de lecture</div>';
    albumCoverElement.innerHTML = '<div class="no-cover">Aucune pochette</div>';
    return;
  }

  const { artist, song, album, coverUrl } = songInfo;
  
  currentSongElement.innerHTML = `
    <div><span>Artiste :</span> ${artist}</div>
    <div><span>Titre :</span> ${song}</div>
    ${album ? `<div><span>Album :</span> ${album}</div>` : ''}
  `;

  albumCoverElement.innerHTML = coverUrl 
    ? `<img src="${coverUrl}" alt="Pochette de ${album || song}" loading="lazy">`
    : '<div class="no-cover">Aucune pochette disponible</div>';
}

// Récupérer la configuration à partir du processus principal
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('get-config').then((config) => {
    // Pré-remplir les champs avec les valeurs existantes
    document.getElementById('port').value = config.port;
    document.getElementById('fileFormat').value = config.fileFormat;
    document.getElementById('filePath').value = config.filePath;
    document.getElementById('fileTemplate').value = config.fileTemplate || '{{ARTIST}} - {{SONG}}';
    document.getElementById('coverFormat').value = config.coverFormat || 'text';
    
    // Mettre à jour l'interface en fonction du format de cover
    updateCoverFormatUI(config.coverFormat);
    
    // Gérer la case à cocher des fichiers séparés
    const separateFilesCheckbox = document.getElementById('separateFiles');
    const separateFilesContainer = document.getElementById('separateFilesContainer');
    const singleFileContainer = document.getElementById('singleFileContainer');
    
    if (config.separateFiles) {
      separateFilesCheckbox.checked = true;
      separateFilesContainer.style.display = 'block';
      singleFileContainer.style.display = 'none';
      document.querySelector('.form-group:has(#fileTemplate)').style.display = 'none';
      document.getElementById('artistFilePath').value = config.artistFilePath;
      document.getElementById('songFilePath').value = config.songFilePath;
      document.getElementById('albumFilePath').value = config.albumFilePath;
      document.getElementById('coverFilePath').value = config.coverFilePath;
    }

    // Écouter les changements de format de cover
    document.getElementById('coverFormat').addEventListener('change', (e) => {
      updateCoverFormatUI(e.target.value);
    });

    separateFilesCheckbox.addEventListener('change', () => {
      if (separateFilesCheckbox.checked) {
        separateFilesContainer.style.display = 'block';
        singleFileContainer.style.display = 'none';
        document.querySelector('.form-group:has(#fileTemplate)').style.display = 'none';
        
        // Remplir les champs avec les chemins de la configuration
        document.getElementById('artistFilePath').value = config.artistFilePath;
        document.getElementById('songFilePath').value = config.songFilePath;
        document.getElementById('albumFilePath').value = config.albumFilePath;
        document.getElementById('coverFilePath').value = config.coverFilePath;
      } else {
        separateFilesContainer.style.display = 'none';
        singleFileContainer.style.display = 'block';
        document.querySelector('.form-group:has(#fileTemplate)').style.display = 'block';
      }
    });
  }).catch(error => {
    showStatusMessage('Erreur lors du chargement de la configuration', 'error');
    console.error('Erreur:', error);
  });

  // Sauvegarder la configuration lorsque l'utilisateur clique sur le bouton
  document.getElementById('saveBtn').addEventListener('click', () => {
    const port = document.getElementById('port').value;
    const separateFiles = document.getElementById('separateFiles').checked;
    
    // Validation des champs
    if (!port || port < 1024 || port > 65535) {
      showStatusMessage('Le port doit être compris entre 1024 et 65535', 'error');
      return;
    }

    const config = {
      port: parseInt(port),
      fileFormat: document.getElementById('fileFormat').value,
      separateFiles: separateFiles,
      coverFormat: document.getElementById('coverFormat').value
    };

    if (separateFiles) {
      config.artistFilePath = document.getElementById('artistFilePath').value;
      config.songFilePath = document.getElementById('songFilePath').value;
      config.albumFilePath = document.getElementById('albumFilePath').value;
      config.coverFormat = document.getElementById('coverFormat').value;
      
      // Mettre à jour le chemin de la cover en fonction du format
      const coverPath = document.getElementById('coverFilePath').value;
      if (config.coverFormat === 'image' && coverPath.endsWith('.txt')) {
        config.coverFilePath = coverPath.replace('.txt', '.jpg');
      } else if (config.coverFormat === 'text' && coverPath.endsWith('.jpg')) {
        config.coverFilePath = coverPath.replace('.jpg', '.txt');
      } else {
        config.coverFilePath = coverPath;
      }
      
      if (!config.artistFilePath || !config.songFilePath || !config.albumFilePath || !config.coverFilePath) {
        showStatusMessage('Tous les chemins de fichiers sont requis', 'error');
        return;
      }
    } else {
      config.filePath = document.getElementById('filePath').value;
      config.fileTemplate = document.getElementById('fileTemplate').value;
      
      if (!config.filePath || !config.fileTemplate) {
        showStatusMessage('Le chemin du fichier et le modèle sont requis', 'error');
        return;
      }
    }

    // Désactiver le bouton pendant la sauvegarde
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Sauvegarde en cours...';

    // Envoyer la configuration au processus principal
    ipcRenderer.invoke('save-config', config).then(() => {
      showStatusMessage('Configuration sauvegardée avec succès');
    }).catch(error => {
      showStatusMessage('Erreur lors de la sauvegarde de la configuration', 'error');
      console.error('Erreur:', error);
    }).finally(() => {
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

// Fonction pour mettre à jour l'interface en fonction du format de cover
function updateCoverFormatUI(coverFormat) {
  const coverPathInput = document.getElementById('coverFilePath');
  const coverHelpText = document.getElementById('coverHelpText');
  
  if (coverFormat === 'image') {
    coverPathInput.placeholder = 'C:\\CiderWS\\cover.jpg';
    coverHelpText.textContent = 'Chemin où sera sauvegardée l\'image de la cover';
    // Mettre à jour la valeur si elle correspond à l'ancien format
    if (coverPathInput.value.endsWith('.txt')) {
      coverPathInput.value = coverPathInput.value.replace('.txt', '.jpg');
    } else if (!coverPathInput.value) {
      coverPathInput.value = 'C:\\CiderWS\\cover.jpg';
    }
  } else {
    coverPathInput.placeholder = 'C:\\CiderWS\\cover.txt';
    coverHelpText.textContent = 'Chemin où sera sauvegardé le fichier contenant l\'URL de la cover';
    // Mettre à jour la valeur si elle correspond à l'ancien format
    if (coverPathInput.value.endsWith('.jpg')) {
      coverPathInput.value = coverPathInput.value.replace('.jpg', '.txt');
    } else if (!coverPathInput.value) {
      coverPathInput.value = 'C:\\CiderWS\\cover.txt';
    }
  }
}
