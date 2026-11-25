import { contextBridge, ipcRenderer } from 'electron';
// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', {
    config: {
        get: () => ipcRenderer.invoke('config:get'),
        set: (config) => ipcRenderer.invoke('config:set', config),
    },
    apiKeys: {
        list: () => ipcRenderer.invoke('apikeys:list'),
        add: (apiKey) => ipcRenderer.invoke('apikeys:add', apiKey),
        delete: (id) => ipcRenderer.invoke('apikeys:delete', id),
    },
    bots: {
        list: () => ipcRenderer.invoke('bots:list'),
        add: (bot) => ipcRenderer.invoke('bots:add', bot),
        update: (id, updates) => ipcRenderer.invoke('bots:update', id, updates),
        delete: (id) => ipcRenderer.invoke('bots:delete', id),
        setActive: (id) => ipcRenderer.invoke('bots:setActive', id),
    },
    history: {
        get: (botId) => ipcRenderer.invoke('history:get', botId),
        save: (botId, messages) => ipcRenderer.invoke('history:save', botId, messages),
        clear: (botId) => ipcRenderer.invoke('history:clear', botId),
    },
    gateway: {
        models: (baseUrl, apiKey) => ipcRenderer.invoke('gateway:models', baseUrl, apiKey),
        chat: (options) => ipcRenderer.invoke('gateway:chat', options),
    },
    fs: {
        read: (path) => ipcRenderer.invoke('fs:read', path),
        write: (path, content) => ipcRenderer.invoke('fs:write', path, content),
        list: (path) => ipcRenderer.invoke('fs:list', path),
        mkdir: (path) => ipcRenderer.invoke('fs:mkdir', path),
        delete: (path) => ipcRenderer.invoke('fs:delete', path),
    },
    dialog: {
        openFile: () => ipcRenderer.invoke('dialog:openFile'),
        openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
        saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    },
    shell: {
        openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
        openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
    },
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        getPath: (name) => ipcRenderer.invoke('app:getPath', name),
        quit: () => ipcRenderer.invoke('app:quit'),
    },
    notification: {
        show: (options) => ipcRenderer.invoke('notification:show', options),
    },
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    },
});
//# sourceMappingURL=preload.js.map