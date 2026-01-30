/**
 * Главный файл приложения
 */
import api from './services/api-instance.js';
import store from './services/store.js';

class App {
    constructor() {
        this.api = api; // Используем singleton API
        this.connectionStatusEl = document.getElementById('connectionStatus');
        this.callbackSet = false; // Флаг установки callback
        this.init();
    }

    async init() {
        // Подписываемся на изменения в сторе
        store.subscribe((state) => {
            this.updateUI(state);
        });

        // Пытаемся подключиться (не блокируем если не получилось)
        try {
            await this.connect();
        } catch (error) {
            console.log('[App] Initial connection failed, will retry...');
        }

        // Периодически проверяем подключение (каждые 10 секунд)
        setInterval(() => {
            this.checkConnection();
        }, 10000);

        // Периодически обновляем системную информацию (каждые 15 секунд)
        setInterval(() => {
            if (store.getState().connection.connected) {
                this.loadSystemInfo();
            }
        }, 15000);
    }

    /**
     * Подключается к Moonraker API через WebSocket
     */
    async connect() {
        try {
            console.log('[App] Attempting to connect to Moonraker via WebSocket...');
            
            // Подключаемся к WebSocket
            await this.api.connect();
            console.log('[App] WebSocket connected!');
            
            // Устанавливаем callback для обновлений статуса (только один раз)
            if (!this.callbackSet) {
                this.api.setStatusUpdateCallback((status) => {
                    this.handleWebSocketMessage({ method: 'notify_status_update', params: [status] });
                });
                this.callbackSet = true;
            }
            
            store.updateConnectionStatus(true);

            // Загружаем начальные данные
            await this.loadInitialData();

            // Подписываемся на обновления
            this.api.subscribeToUpdates();
        } catch (error) {
            console.error('[App] Connection failed:', error.message);
            store.updateConnectionStatus(false);
            throw error; // Прокидываем ошибку для обработки в checkConnection
        }
    }

    /**
     * Загружает начальные данные
     */
    async loadInitialData() {
        try {
            // Загружаем все данные параллельно
            const [tempData, printData, toolheadData] = await Promise.all([
                this.api.getTemperature(),
                this.api.getPrintStatus(),
                this.api.getToolheadData()
            ]);

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

            // Обработка данных о toolhead и вентиляторах
            const thStatus = toolheadData.result?.status || toolheadData.result;
            if (thStatus) {
                store.updateToolhead(thStatus.toolhead, thStatus.gcode_move);
                // Передаем весь объект с вентиляторами (включая QIDI fan_generic)
                store.updateFans(thStatus);
            }

            // Загружаем системную информацию
            this.loadSystemInfo();
        } catch (error) {
            console.error('[App] Failed to load initial data:', error);
        }
    }

    /**
     * Загружает системную информацию
     */
    async loadSystemInfo() {
        try {
            const procStats = await this.api.getProcStats();
            const stats = procStats.result;
            
            if (stats) {
                store.updateSystemInfo({
                    cpu_usage: stats.system_cpu_usage?.cpu ?? 0,
                    memory_usage: stats.system_memory?.percent ?? 0,
                    uptime: stats.moonraker_stats?.[0]?.time ?? 0
                });
            }
        } catch (error) {
            console.error('[App] Failed to load system info:', error);
        }
    }

    /**
     * Обрабатывает сообщения WebSocket
     */
    handleWebSocketMessage(data) {
        if (data.method === 'notify_status_update') {
            const status = data.params[0];
            
            // Температура
            if (status.heater_bed || status.extruder) {
                store.updateTemperature(
                    status.heater_bed,
                    status.extruder
                );
            }

            // Статус печати
            if (status.print_stats) {
                store.updatePrintStats({
                    ...status.print_stats,
                    virtual_sdcard: status.virtual_sdcard
                });
            }

            // Позиция и скорость
            if (status.toolhead || status.gcode_move) {
                store.updateToolhead(status.toolhead, status.gcode_move);
            }

            // Вентиляторы (включая QIDI fan_generic)
            if (status.fan || status['fan_generic cooling_fan'] || 
                status.heater_fan || status['heater_fan hotend_fan'] ||
                status['fan_generic chamber_circulation_fan'] ||
                status['fan_generic auxiliary_cooling_fan']) {
                store.updateFans(status);
            }
        }
    }


    /**
     * Проверяет подключение
     */
    async checkConnection() {
        // Если уже подключен - всё ок
        if (this.api.isConnected()) {
            if (!store.getState().connection.connected) {
                store.updateConnectionStatus(true);
            }
            return;
        }
        
        // Если не подключен - пробуем подключиться
        console.log('[App] Connection lost, attempting to reconnect...');
        store.updateConnectionStatus(false);
        
        try {
            await this.connect();
        } catch (error) {
            console.error('[App] Reconnection failed:', error.message);
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

