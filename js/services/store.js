/**
 * Локальный стор/репозиторий для управления состоянием приложения
 */
class Store {
    constructor() {
        this.state = {
            printer: {
                status: 'disconnected',
                temperature: {
                    bed: { current: 0, target: 0 },
                    hotend: { current: 0, target: 0 }
                },
                printStats: {
                    state: 'idle',
                    filename: null,
                    progress: 0,
                    printDuration: 0,
                    totalDuration: 0
                }
            },
            connection: {
                connected: false,
                lastUpdate: null
            }
        };
        
        this.subscribers = [];
    }

    /**
     * Получает текущее состояние
     */
    getState() {
        return JSON.parse(JSON.stringify(this.state)); // Deep copy
    }

    /**
     * Обновляет состояние
     */
    setState(newState) {
        this.state = {
            ...this.state,
            ...newState
        };
        this.notifySubscribers();
    }

    /**
     * Обновляет температуру
     */
    updateTemperature(bed, hotend) {
        // Берем предыдущие значения, чтобы не сбрасывать до нулей, если пришли пустые поля
        const prevBed = this.state.printer.temperature.bed;
        const prevHotend = this.state.printer.temperature.hotend;

        const nextBed = {
            current: bed?.temperature ?? prevBed.current ?? 0,
            target: bed?.target ?? prevBed.target ?? 0
        };

        const nextHotend = {
            current: hotend?.temperature ?? prevHotend.current ?? 0,
            target: hotend?.target ?? prevHotend.target ?? 0
        };

        this.state.printer.temperature = {
            bed: nextBed,
            hotend: nextHotend
        };
        this.state.connection.lastUpdate = new Date();
        this.notifySubscribers();
    }

    /**
     * Обновляет статус печати
     */
    updatePrintStats(printStats) {
        // Возможный прогресс может приходить из print_stats.progress (0..1) или virtual_sdcard.progress
        const vsdProgress = printStats?.virtual_sdcard?.progress;
        const progress = printStats?.progress ?? vsdProgress ?? this.state.printer.printStats.progress ?? 0;

        this.state.printer.printStats = {
            state: printStats?.state || 'idle',
            filename: printStats?.filename || null,
            progress: progress,
            printDuration: printStats?.print_duration || 0,
            totalDuration: printStats?.total_duration || 0
        };
        this.state.connection.lastUpdate = new Date();
        this.notifySubscribers();
    }

    /**
     * Обновляет статус подключения
     */
    updateConnectionStatus(connected) {
        this.state.connection.connected = connected;
        this.state.printer.status = connected ? 'connected' : 'disconnected';
        this.notifySubscribers();
    }

    /**
     * Подписывается на изменения состояния
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        
        // Возвращаем функцию для отписки
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    /**
     * Уведомляет всех подписчиков об изменениях
     */
    notifySubscribers() {
        const state = this.getState();
        this.subscribers.forEach(callback => {
            try {
                callback(state);
            } catch (error) {
                console.error('Error in store subscriber:', error);
            }
        });
    }
}

// Экспортируем singleton
const store = new Store();
export default store;


