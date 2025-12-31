/**
 * Главный файл приложения
 */
import MoonrakerAPI from './services/moonraker-api.js';
import store from './services/store.js';
import { config } from './config.js';

class App {
    constructor() {
        this.api = new MoonrakerAPI(
            config.moonrakerUrl,
            config.apiKey,
            config.username,
            config.password
        );
        this.connectionStatusEl = document.getElementById('connectionStatus');
        this.init();
    }

    async init() {
        // Подписываемся на изменения в сторе
        store.subscribe((state) => {
            this.updateUI(state);
        });

        // Пытаемся подключиться
        this.connect();

        // Периодически проверяем подключение
        setInterval(() => {
            this.checkConnection();
        }, 5000);
    }

    /**
     * Подключается к Moonraker API через WebSocket
     */
    async connect() {
        try {
            console.log('[App] Attempting to connect to Moonraker via WebSocket...');
            
            // Подключаемся к WebSocket (все запросы теперь через WebSocket - нет CORS!)
            await this.api.connect();
            console.log('[App] WebSocket connected!');
            
            // Устанавливаем callback для обновлений статуса
            this.api.setStatusUpdateCallback((status) => {
                this.handleWebSocketMessage({ method: 'notify_status_update', params: [status] });
            });
            
            store.updateConnectionStatus(true);

            // Загружаем начальные данные
            await this.loadInitialData();

            // Теперь подписываемся на обновления (после initial load, чтобы не потерять target)
            this.api.subscribeToUpdates();
        } catch (error) {
            console.error('[App] Connection failed:', error);
            store.updateConnectionStatus(false);
        }
    }

    /**
     * Загружает начальные данные
     */
    async loadInitialData() {
        try {
            const tempData = await this.api.getTemperature();
            const printData = await this.api.getPrintStatus();

            // Обработка данных о температуре
            const tStatus = tempData.result?.status || tempData.result;
            if (tStatus) {
                store.updateTemperature(
                    tStatus.heater_bed,
                    tStatus.extruder
                );
            }

            // Обработка данных о печати
            const pStatus = printData.result?.status || printData.result;
            if (pStatus?.print_stats) {
                const ps = pStatus.print_stats;
                const vsd = pStatus.virtual_sdcard;
                store.updatePrintStats({ ...ps, virtual_sdcard: vsd });
            }
        } catch (error) {
            console.error('[App] Failed to load initial data:', error);
        }
    }

    /**
     * Обрабатывает сообщения WebSocket
     */
    handleWebSocketMessage(data) {
        if (data.method === 'notify_status_update') {
            const status = data.params[0];
            
            if (status.heater_bed || status.extruder) {
                store.updateTemperature(
                    status.heater_bed,
                    status.extruder
                );
            }

            if (status.print_stats) {
                store.updatePrintStats({
                    ...status.print_stats,
                    virtual_sdcard: status.virtual_sdcard
                });
            }
        }
    }


    /**
     * Проверяет подключение
     */
    async checkConnection() {
        try {
            // Проверяем, что WebSocket подключен
            if (this.api.websocket && this.api.websocket.readyState === WebSocket.OPEN) {
                await this.api.getPrinterStatus();
                if (!store.getState().connection.connected) {
                    store.updateConnectionStatus(true);
                }
            } else {
                // Переподключаемся, если соединение потеряно
                store.updateConnectionStatus(false);
                await this.connect();
            }
        } catch (error) {
            store.updateConnectionStatus(false);
        }
    }

    /**
     * Обновляет UI на основе состояния
     */
    updateUI(state) {
        // Обновляем индикатор подключения
        if (this.connectionStatusEl) {
            if (state.connection.connected) {
                this.connectionStatusEl.classList.add('connected');
                this.connectionStatusEl.querySelector('.status-text').textContent = 'Подключено';
            } else {
                this.connectionStatusEl.classList.remove('connected');
                this.connectionStatusEl.querySelector('.status-text').textContent = 'Отключено';
            }
        }
    }
}

// Инициализируем приложение при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

