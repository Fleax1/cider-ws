const { ipcRenderer } = require('electron');

// Récupérer la configuration à partir du processus principal
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('get-config').then((config) => {
    // Pré-remplir les champs avec les valeurs existantes
    document.getElementById('port').value = config.port;
    document.getElementById('fileFormat').value = config.fileFormat;
    document.getElementById('filePath').value = config.filePath;
    document.getElementById('fileTemplate').value = config.fileTemplate || '{{ARTIST}} - {{SONG}}';
  });

  // Sauvegarder la configuration lorsque l'utilisateur clique sur le bouton
  document.getElementById('saveBtn').addEventListener('click', () => {
    const config = {
      port: document.getElementById('port').value,
      fileFormat: document.getElementById('fileFormat').value,
      filePath: document.getElementById('filePath').value,
      fileTemplate: document.getElementById('fileTemplate').value,
    };

    // Envoyer la configuration au processus principal pour la sauvegarder
    ipcRenderer.invoke('save-config', config).then((message) => {
      alert(message); // Afficher un message de confirmation
    });
  });
});
