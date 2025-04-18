const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('Création de la fenêtre');

  // Récupérer l'affichage principal
  const primaryDisplay = screen.getPrimaryDisplay();
  console.log('Écran principal :', primaryDisplay);

  // Créer la fenêtre principale
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    show: false, // Ne pas afficher immédiatement
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Permet d'utiliser `nodeIntegration`
    },
  });

  // Charger le fichier HTML
  mainWindow.loadFile('index.html').catch(err => {
    console.log("Erreur de chargement du fichier HTML : ", err);
  });

  // Afficher la fenêtre quand elle est prête
  mainWindow.once('ready-to-show', () => {
    console.log('Fenêtre prête à être affichée');
    mainWindow.show();
  });

  // Gérer les erreurs du processus de rendu
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Erreur de chargement : ${errorCode} - ${errorDescription}`);
  });
}

mainWindow.webPreferences = {
    nodeIntegration: true,
    contextIsolation: false,
    devTools: true, // Active les outils de développement dans Electron
  };  

// Lancer la création de la fenêtre quand l'application est prête
app.on('ready', () => {
  console.log('Lancement de l\'application');
  createWindow();
});

// Quitter l'application lorsque toutes les fenêtres sont fermées (sauf sur macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    console.log('Application fermée');
    app.quit();
  }
});

// Lire les paramètres de configuration
ipcMain.handle('get-config', () => {
  const configPath = path.join(__dirname, 'settings.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath));
  } else {
    // Retourner les valeurs par défaut si le fichier n'existe pas
    return {
      port: 10767,
      fileFormat: 'text', // 'text' ou 'json'
      filePath: 'now_playing.txt',
      fileTemplate: '{{ARTIST}} - {{SONG}}', // Format par défaut
    };
  }
});

// Sauvegarder les paramètres de configuration
ipcMain.handle('save-config', (event, config) => {
  const configPath = path.join(__dirname, 'settings.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return 'Configuration sauvegardée !';
});
