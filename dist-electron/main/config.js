import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = join(fileURLToPath(import.meta.url), '..');
const CONFIG_DIR = join(app.getPath('userData'), 'freebot');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const HISTORY_FILE = join(CONFIG_DIR, 'history.json');
const DEFAULT_CONFIG = {
    gatewayUrl: 'http://127.0.0.1:8000/v1',
    apiKeys: [],
    bots: [],
    activeBotId: null,
    theme: 'dark',
    settings: {
        launchAtStartup: false,
        notificationsEnabled: true,
        streamingEnabled: true,
        autoSaveHistory: true,
    },
};
async function ensureConfigDir() {
    try {
        await mkdir(CONFIG_DIR, { recursive: true });
    }
    catch {
        // Directory might already exist
    }
}
export async function loadConfig() {
    await ensureConfigDir();
    try {
        const data = await readFile(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(data);
        return { ...DEFAULT_CONFIG, ...config };
    }
    catch {
        return DEFAULT_CONFIG;
    }
}
export async function saveConfig(config) {
    await ensureConfigDir();
    const current = await loadConfig();
    const updated = { ...current, ...config };
    await writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2));
    return updated;
}
export async function loadHistory() {
    await ensureConfigDir();
    try {
        const data = await readFile(HISTORY_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
export async function saveHistory(history) {
    await ensureConfigDir();
    await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}
export async function getBotHistory(botId) {
    const history = await loadHistory();
    const botHistory = history.find(h => h.botId === botId);
    return botHistory?.messages || [];
}
export async function saveBotHistory(botId, messages) {
    const history = await loadHistory();
    const index = history.findIndex(h => h.botId === botId);
    const entry = {
        botId,
        messages,
        updatedAt: Date.now(),
    };
    if (index >= 0) {
        history[index] = entry;
    }
    else {
        history.push(entry);
    }
    await saveHistory(history);
}
export { CONFIG_DIR, CONFIG_FILE, HISTORY_FILE };
//# sourceMappingURL=config.js.map