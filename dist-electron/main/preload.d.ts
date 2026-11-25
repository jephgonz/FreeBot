import type { AppConfig, ApiKey, Bot, ChatMessage } from './config.js';
interface ElectronAPI {
    config: {
        get: () => Promise<AppConfig>;
        set: (config: Partial<AppConfig>) => Promise<AppConfig>;
    };
    apiKeys: {
        list: () => Promise<ApiKey[]>;
        add: (apiKey: Omit<ApiKey, 'id' | 'createdAt'> & {
            cloudflareAccountId?: string;
        }) => Promise<ApiKey>;
        delete: (id: string) => Promise<boolean>;
    };
    bots: {
        list: () => Promise<Bot[]>;
        add: (bot: Omit<Bot, 'id' | 'createdAt'>) => Promise<Bot>;
        update: (id: string, updates: Partial<Bot>) => Promise<Bot | null>;
        delete: (id: string) => Promise<boolean>;
        setActive: (id: string) => Promise<boolean>;
    };
    history: {
        get: (botId: string) => Promise<ChatMessage[]>;
        save: (botId: string, messages: ChatMessage[]) => Promise<boolean>;
        clear: (botId: string) => Promise<boolean>;
    };
    gateway: {
        models: (baseUrl: string, apiKey: string) => Promise<any>;
        chat: (options: {
            baseUrl: string;
            apiKey: string;
            model: string;
            messages: {
                role: string;
                content: string;
            }[];
            temperature: number;
            stream: boolean;
        }) => Promise<any>;
    };
    fs: {
        read: (path: string) => Promise<string>;
        write: (path: string, content: string) => Promise<boolean>;
        list: (path: string) => Promise<Array<{
            name: string;
            isDirectory: boolean;
            isFile: boolean;
        }>>;
        mkdir: (path: string) => Promise<boolean>;
        delete: (path: string) => Promise<boolean>;
    };
    dialog: {
        openFile: () => Promise<string[]>;
        openDirectory: () => Promise<string[]>;
        saveFile: (options?: {
            defaultPath?: string;
            filters?: any[];
        }) => Promise<string | undefined>;
    };
    shell: {
        openExternal: (url: string) => Promise<boolean>;
        openPath: (path: string) => Promise<boolean>;
    };
    app: {
        getVersion: () => Promise<string>;
        getPath: (name: string) => Promise<string>;
        quit: () => Promise<boolean>;
    };
    notification: {
        show: (options: {
            title: string;
            body: string;
            icon?: string;
        }) => Promise<boolean>;
    };
    window: {
        minimize: () => Promise<boolean>;
        maximize: () => Promise<boolean>;
        close: () => Promise<boolean>;
        isMaximized: () => Promise<boolean>;
    };
}
declare global {
    interface Window {
        electron: ElectronAPI;
    }
}
export {};
//# sourceMappingURL=preload.d.ts.map