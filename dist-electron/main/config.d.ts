declare const CONFIG_DIR: string;
declare const CONFIG_FILE: string;
declare const HISTORY_FILE: string;
export interface AppConfig {
    gatewayUrl: string;
    apiKeys: ApiKey[];
    bots: Bot[];
    activeBotId: string | null;
    theme: 'dark' | 'light';
    settings: AppSettings;
}
export type ApiProvider = 'gemini' | 'nvidia' | 'cloudflare' | 'groq' | 'openai' | 'custom';
export interface ApiKey {
    id: string;
    name: string;
    key: string;
    provider: ApiProvider;
    createdAt: number;
}
export interface Bot {
    id: string;
    name: string;
    avatarColor: string;
    systemPrompt: string;
    temperature: number;
    model: string;
    apiKeyId: string;
    createdAt: number;
}
export interface AppSettings {
    launchAtStartup: boolean;
    notificationsEnabled: boolean;
    streamingEnabled: boolean;
    autoSaveHistory: boolean;
}
export interface ChatHistory {
    botId: string;
    messages: ChatMessage[];
    updatedAt: number;
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
}
export declare function loadConfig(): Promise<AppConfig>;
export declare function saveConfig(config: Partial<AppConfig>): Promise<AppConfig>;
export declare function loadHistory(): Promise<ChatHistory[]>;
export declare function saveHistory(history: ChatHistory[]): Promise<void>;
export declare function getBotHistory(botId: string): Promise<ChatMessage[]>;
export declare function saveBotHistory(botId: string, messages: ChatMessage[]): Promise<void>;
export { CONFIG_DIR, CONFIG_FILE, HISTORY_FILE };
//# sourceMappingURL=config.d.ts.map