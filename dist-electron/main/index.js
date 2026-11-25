import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { setupIpcHandlers } from './ipc/index.js';
import { createWindow } from './window.js';
import { loadConfig } from './config.js';
const __dirname = join(fileURLToPath(import.meta.url), '..');
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';
async function initializeApp() {
    // Load config early
    await loadConfig();
    // Set up IPC handlers
    setupIpcHandlers();
    // Create main window
    mainWindow = createWindow();
    if (isDev) {
        mainWindow.loadURL('http://localhost:5174');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
    }
    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
app.whenReady().then(initializeApp);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        initializeApp();
    }
});
// Handle unhandled errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});
// Export for testing
export { mainWindow };
//# sourceMappingURL=index.js.map