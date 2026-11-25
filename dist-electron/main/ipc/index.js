import { ipcMain, app, dialog, shell, Notification, BrowserWindow } from 'electron';
import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises';
import { loadConfig, saveConfig, loadHistory, saveHistory, getBotHistory, saveBotHistory, } from '../config.js';
export function setupIpcHandlers() {
    // Config handlers
    ipcMain.handle('config:get', async () => {
        return await loadConfig();
    });
    ipcMain.handle('config:set', async (_event, config) => {
        return await saveConfig(config);
    });
    // API Key handlers
    ipcMain.handle('apikeys:list', async () => {
        const config = await loadConfig();
        console.log('[IPC] apikeys:list ->', config.apiKeys.length, 'keys');
        return config.apiKeys;
    });
    ipcMain.handle('apikeys:add', async (_event, apiKey) => {
        console.log('[IPC] apikeys:add ->', apiKey.name);
        const config = await loadConfig();
        const newKey = {
            ...apiKey,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        config.apiKeys.push(newKey);
        await saveConfig(config);
        console.log('[IPC] apikeys:add -> saved, total keys:', config.apiKeys.length);
        return newKey;
    });
    ipcMain.handle('apikeys:delete', async (_event, id) => {
        console.log('[IPC] apikeys:delete ->', id);
        const config = await loadConfig();
        config.apiKeys = config.apiKeys.filter(k => k.id !== id);
        // Also remove bots using this key
        config.bots = config.bots.filter(b => b.apiKeyId !== id);
        if (config.activeBotId && !config.bots.some(b => b.id === config.activeBotId)) {
            config.activeBotId = config.bots[0]?.id || null;
        }
        await saveConfig(config);
        console.log('[IPC] apikeys:delete -> saved, total keys:', config.apiKeys.length);
        return true;
    });
    // Bot handlers
    ipcMain.handle('bots:list', async () => {
        const config = await loadConfig();
        return config.bots;
    });
    ipcMain.handle('bots:add', async (_event, bot) => {
        const config = await loadConfig();
        const newBot = {
            ...bot,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        config.bots.push(newBot);
        if (!config.activeBotId) {
            config.activeBotId = newBot.id;
        }
        await saveConfig(config);
        return newBot;
    });
    ipcMain.handle('bots:update', async (_event, id, updates) => {
        const config = await loadConfig();
        const index = config.bots.findIndex(b => b.id === id);
        if (index >= 0) {
            config.bots[index] = { ...config.bots[index], ...updates };
            await saveConfig(config);
            return config.bots[index];
        }
        return null;
    });
    ipcMain.handle('bots:delete', async (_event, id) => {
        const config = await loadConfig();
        config.bots = config.bots.filter(b => b.id !== id);
        if (config.activeBotId === id) {
            config.activeBotId = config.bots[0]?.id || null;
        }
        await saveConfig(config);
        // Also delete history
        const history = await loadHistory();
        const filtered = history.filter(h => h.botId !== id);
        await saveHistory(filtered);
        return true;
    });
    ipcMain.handle('bots:setActive', async (_event, id) => {
        const config = await loadConfig();
        config.activeBotId = id;
        await saveConfig(config);
        return true;
    });
    // History handlers
    ipcMain.handle('history:get', async (_event, botId) => {
        return await getBotHistory(botId);
    });
    ipcMain.handle('history:save', async (_event, botId, messages) => {
        await saveBotHistory(botId, messages);
        return true;
    });
    ipcMain.handle('history:clear', async (_event, botId) => {
        const history = await loadHistory();
        const filtered = history.filter(h => h.botId !== botId);
        await saveHistory(filtered);
        return true;
    });
    // Gateway handlers
    ipcMain.handle('gateway:models', async (_event, baseUrl, apiKey) => {
        try {
            const response = await fetch(`${baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Failed to fetch models:', error);
            throw error;
        }
    });
    ipcMain.handle('gateway:chat', async (_event, options) => {
        const { baseUrl, apiKey, model, messages, temperature, stream } = options;
        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    stream,
                }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`HTTP ${response.status}: ${error}`);
            }
            if (stream) {
                // For streaming, we return a readable stream
                // The renderer will handle the streaming via a different mechanism
                return response.body;
            }
            return await response.json();
        }
        catch (error) {
            console.error('Chat request failed:', error);
            throw error;
        }
    });
    // File system handlers
    // File system handlers
    ipcMain.handle('fs:read', async (_event, path) => {
        try {
            const content = await readFile(path, 'utf-8');
            return content;
        }
        catch (error) {
            throw new Error(`Failed to read file: ${error}`);
        }
    });
    ipcMain.handle('fs:write', async (_event, path, content) => {
        try {
            await writeFile(path, content, 'utf-8');
            return true;
        }
        catch (error) {
            throw new Error(`Failed to write file: ${error}`);
        }
    });
    ipcMain.handle('fs:list', async (_event, path) => {
        try {
            const entries = await readdir(path, { withFileTypes: true });
            return entries.map(e => ({
                name: e.name,
                isDirectory: e.isDirectory(),
                isFile: e.isFile(),
            }));
        }
        catch (error) {
            throw new Error(`Failed to list directory: ${error}`);
        }
    });
    ipcMain.handle('fs:mkdir', async (_event, path) => {
        try {
            await mkdir(path, { recursive: true });
            return true;
        }
        catch (error) {
            throw new Error(`Failed to create directory: ${error}`);
        }
    });
    ipcMain.handle('fs:delete', async (_event, path) => {
        try {
            await rm(path, { recursive: true, force: true });
            return true;
        }
        catch (error) {
            throw new Error(`Failed to delete: ${error}`);
        }
    });
    // Dialog handlers
    ipcMain.handle('dialog:openFile', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
        });
        return result.filePaths;
    });
    ipcMain.handle('dialog:openDirectory', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
        });
        return result.filePaths;
    });
    ipcMain.handle('dialog:saveFile', async (_event, options) => {
        const result = await dialog.showSaveDialog(options);
        return result.filePath;
    });
    // Shell handlers
    ipcMain.handle('shell:openExternal', async (_event, url) => {
        await shell.openExternal(url);
        return true;
    });
    ipcMain.handle('shell:openPath', async (_event, path) => {
        await shell.openPath(path);
        return true;
    });
    // App handlers
    ipcMain.handle('app:getVersion', () => {
        return app.getVersion();
    });
    ipcMain.handle('app:getPath', async (_event, name) => {
        return app.getPath(name);
    });
    ipcMain.handle('app:quit', () => {
        app.quit();
        return true;
    });
    // Notification handlers
    ipcMain.handle('notification:show', async (_event, options) => {
        if (Notification.isSupported()) {
            new Notification(options).show();
        }
        return true;
    });
    // Window control handlers
    ipcMain.handle('window:minimize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win)
            win.minimize();
        return true;
    });
    ipcMain.handle('window:maximize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize();
            }
            else {
                win.maximize();
            }
        }
        return true;
    });
    ipcMain.handle('window:close', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win)
            win.close();
        return true;
    });
    ipcMain.handle('window:isMaximized', () => {
        const win = BrowserWindow.getFocusedWindow();
        return win?.isMaximized() || false;
    });
}
//# sourceMappingURL=index.js.map