import { BrowserWindow, nativeTheme, screen, shell } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = join(fileURLToPath(import.meta.url), '..');
export function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const window = new BrowserWindow({
        width: Math.min(1280, width),
        height: Math.min(850, height),
        minWidth: 1000,
        minHeight: 650,
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        backgroundColor: '#0f0f0f',
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
        },
        show: false,
        icon: join(__dirname, '../../public/icon.svg'),
        frame: false,
    });
    // Theme handling
    nativeTheme.themeSource = 'dark';
    // Ensure window shows
    window.once('ready-to-show', () => {
        window.show();
        window.focus();
    });
    // Fallback: show after 2 seconds if ready-to-show doesn't fire
    setTimeout(() => {
        if (!window.isVisible()) {
            window.show();
            window.focus();
        }
    }, 2000);
    // Prevent navigation to external URLs
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    return window;
}
//# sourceMappingURL=window.js.map