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
                    state: 'standby',
                    filename: null,
                    progress: 0,
                    printDuration: 0,
                    totalDuration: 0
                },
                toolhead: {
                    position: { x: 0, y: 0, z: 0 },
                    speedFactor: 100,
                    extrudeFactor: 100
                },
                fans: {
                    partFan: 0,
                    heaterFan: 0,
                    chamberFan: 0,
                    auxFan: 0
                }
            },
            system: {
                cpuUsage: 0,
                memoryUsage: 0,
                mcuTemp: null,
                uptime: 0
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
        // Сохраняем предыдущие значения, чтобы не перетирать их, если новые не пришли
        const prevStats = this.state.printer.printStats;
        
        // Возможный прогресс может приходить из print_stats.progress (0..1) или virtual_sdcard.progress
        const vsdProgress = printStats?.virtual_sdcard?.progress;
        const progress = printStats?.progress ?? vsdProgress ?? prevStats.progress ?? 0;

        this.state.printer.printStats = {
            // Сохраняем предыдущий state, если новый не пришел
            state: printStats?.state ?? prevStats.state ?? 'standby',
            // Сохраняем предыдущий filename, если новый не пришел
            filename: printStats?.filename ?? prevStats.filename ?? null,
            progress: progress,
            // Сохраняем предыдущие значения, если новые не пришли
            printDuration: printStats?.print_duration ?? prevStats.printDuration ?? 0,
            totalDuration: printStats?.total_duration ?? prevStats.totalDuration ?? 0
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
     * Обновляет позицию и скорость toolhead
     */
    updateToolhead(toolhead, gcode_move) {
        const prev = this.state.printer.toolhead;
        
        // Позиция из toolhead или gcode_move
        const position = toolhead?.position || gcode_move?.position;
        if (position && Array.isArray(position)) {
            this.state.printer.toolhead.position = {
                x: position[0] ?? prev.position.x,
                y: position[1] ?? prev.position.y,
                z: position[2] ?? prev.position.z
            };
        }
        
        // Speed factor (0-1 -> 0-100%)
        if (gcode_move?.speed_factor !== undefined) {
            this.state.printer.toolhead.speedFactor = gcode_move.speed_factor * 100;
        }
        
        // Extrude factor
        if (gcode_move?.extrude_factor !== undefined) {
            this.state.printer.toolhead.extrudeFactor = gcode_move.extrude_factor * 100;
        }
        
        this.state.connection.lastUpdate = new Date();
        this.notifySubscribers();
    }

    /**
     * Обновляет скорость вентиляторов
     * Поддерживает как стандартные fan/heater_fan, так и QIDI специфичные fan_generic
     */
    updateFans(fansData) {
        const prev = this.state.printer.fans;
        
        // Стандартный fan или QIDI cooling_fan
        const partFanSpeed = fansData?.fan?.speed ?? 
                            fansData?.['fan_generic cooling_fan']?.speed;
        if (partFanSpeed !== undefined) {
            this.state.printer.fans.partFan = partFanSpeed;
        }
        
        // Стандартный heater_fan или QIDI hotend_fan
        const heaterFanSpeed = fansData?.heater_fan?.speed ?? 
                              fansData?.['heater_fan hotend_fan']?.speed;
        if (heaterFanSpeed !== undefined) {
            this.state.printer.fans.heaterFan = heaterFanSpeed;
        }
        
        // Дополнительные вентиляторы QIDI
        const chamberFanSpeed = fansData?.['fan_generic chamber_circulation_fan']?.speed;
        if (chamberFanSpeed !== undefined) {
            this.state.printer.fans.chamberFan = chamberFanSpeed;
        }
        
        const auxFanSpeed = fansData?.['fan_generic auxiliary_cooling_fan']?.speed;
        if (auxFanSpeed !== undefined) {
            this.state.printer.fans.auxFan = auxFanSpeed;
        }
        
        this.state.connection.lastUpdate = new Date();
        this.notifySubscribers();
    }

    /**
     * Обновляет системную информацию
     */
    updateSystemInfo(systemInfo) {
        if (!systemInfo) return;
        
        const prev = this.state.system;
        
        this.state.system = {
            cpuUsage: systemInfo.cpu_usage ?? prev.cpuUsage,
            memoryUsage: systemInfo.memory_usage ?? prev.memoryUsage,
            mcuTemp: systemInfo.mcu_temp ?? prev.mcuTemp,
            uptime: systemInfo.uptime ?? prev.uptime
        };
        
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


