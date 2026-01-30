/**
 * Singleton экземпляр MoonrakerAPI для использования во всех виджетах
 */
import MoonrakerAPI from './moonraker-api.js';
import { config } from '../config.js';

// Создаем единственный экземпляр API
const api = new MoonrakerAPI(
    config.moonrakerUrl,
    config.apiKey,
    config.username,
    config.password
);

export default api;
