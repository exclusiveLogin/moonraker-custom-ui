/**
 * WebSocket сервис для работы с Moonraker API через JSON-RPC
 * Использует WebSocket вместо HTTP, что полностью решает проблему CORS
 */
class MoonrakerAPI {
    constructor(baseUrl = 'http://localhost:7125', apiKey = null, username = null, password = null) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.username = username;
        this.password = password;
        this.wsUrl = baseUrl.replace('http', 'ws');
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.requestId = 0;
        this.pendingRequests = new Map(); // Хранит промисы ожидающих запросов
        this.onStatusUpdate = null; // Callback для обновлений статуса
        this.isSubscribed = false;
        this.connectionAttempt = 0; // Счетчик попыток подключения
        this.isConnecting = false; // Флаг для предотвращения множественных подключений
        this.connectPromise = null; // Текущий промис подключения
    }

    /**
     * Проверяет, подключен ли WebSocket
     */
    isConnected() {
        return this.websocket && this.websocket.readyState === WebSocket.OPEN;
    }

    /**
     * Подключается к WebSocket
     */
    async connect() {
        // Если уже подключены - возвращаем успех
        if (this.isConnected()) {
            console.log('[MoonrakerAPI] Already connected');
            return Promise.resolve();
        }
        
        // Если уже идет подключение - возвращаем существующий промис
        if (this.isConnecting && this.connectPromise) {
            console.log('[MoonrakerAPI] Connection already in progress, waiting...');
            return this.connectPromise;
        }
        
        this.isConnecting = true;
        this.isSubscribed = false; // Сбрасываем флаг подписки
        
        this.connectPromise = new Promise((resolve, reject) => {
            try {
                // Закрываем старое соединение если есть
                if (this.websocket) {
                    this.websocket.onclose = null; // Отключаем обработчик чтобы не было лишних reconnect
                    this.websocket.close();
                    this.websocket = null;
                }
                
                let wsUrl = this.wsUrl + '/websocket';
                
                // Логика подключения:
                // 1. Если есть API ключ - используем его в URL
                // 2. Если нет API ключа, но есть username/password - пробуем без токена, затем access.login
                const hasTokenInUrl = this.apiKey && (!this.username || this.connectionAttempt === 1);
                if (hasTokenInUrl) {
                    wsUrl += `?token=${this.apiKey}`;
                }
                
                console.log('[MoonrakerAPI] Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=***'));
                this.websocket = new WebSocket(wsUrl);

                this.websocket.onopen = async () => {
                    console.log('[MoonrakerAPI] WebSocket connected');
                    this.reconnectAttempts = 0;
                    this.connectionAttempt = 0;
                    this.isConnecting = false;
                    
                    // Авторизуемся, если есть креды/ключ
                    if (!hasTokenInUrl || (this.username && this.password)) {
                        try {
                            await this.authenticate();
                            console.log('[MoonrakerAPI] Authentication successful');
                        } catch (authError) {
                            console.error('[MoonrakerAPI] Authentication failed:', authError);
                            this.websocket.close();
                            reject(authError);
                            return;
                        }
                    } else {
                        console.log('[MoonrakerAPI] Using token-based authentication (token in URL)');
                    }
                    
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('[MoonrakerAPI] Error parsing message:', error);
                    }
                };

                this.websocket.onerror = (error) => {
                    console.error('[MoonrakerAPI] WebSocket error:', error);
                    // Не reject здесь - onclose тоже вызовется
                };

                this.websocket.onclose = (event) => {
                    const closeCode = event.code;
                    const closeReason = event.reason || 'Unknown';
                    
                    console.log(`[MoonrakerAPI] WebSocket disconnected. Code: ${closeCode}, Reason: ${closeReason}`);
                    this.isConnecting = false;
                    
                    // Ошибка авторизации (403 обычно приходит как 1008 или 4003)
                    if ((closeCode === 1008 || closeCode === 4003 || closeCode === 4001) && 
                        this.username && this.apiKey && this.connectionAttempt === 0) {
                        console.log('[MoonrakerAPI] First attempt failed, retrying with token in URL...');
                        this.connectionAttempt = 1;
                        this.websocket = null;
                        setTimeout(() => {
                            this.connect().then(resolve).catch(reject);
                        }, 500);
                        return;
                    }
                    
                    // Очищаем все pending запросы
                    this.pendingRequests.forEach(({ reject: rej }) => {
                        rej(new Error(`WebSocket disconnected: ${closeReason} (code: ${closeCode})`));
                    });
                    this.pendingRequests.clear();
                    
                    // Reject текущий промис
                    reject(new Error(`WebSocket closed: ${closeReason} (code: ${closeCode})`));
                };
            } catch (error) {
                console.error('[MoonrakerAPI] WebSocket connection error:', error);
                this.isConnecting = false;
                reject(error);
            }
        });
        
        return this.connectPromise;
    }

    /**
     * Обрабатывает входящие сообщения
     */
    handleMessage(data) {
        // Если это ответ на запрос (есть id)
        if (data.id !== undefined && this.pendingRequests.has(data.id)) {
            const { resolve, reject } = this.pendingRequests.get(data.id);
            this.pendingRequests.delete(data.id);
            
            if (data.error) {
                reject(new Error(data.error.message || 'Request failed'));
            } else {
                resolve(data.result);
            }
            return;
        }
        
        // Если это уведомление об обновлении статуса
        if (data.method === 'notify_status_update' && this.onStatusUpdate) {
            this.onStatusUpdate(data.params[0]);
        }
    }

    /**
     * Отправляет JSON-RPC запрос через WebSocket
     */
    async request(method, params = {}) {
        // Убеждаемся, что WebSocket подключен
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            
            const request = {
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: id
            };
            
            // Если есть API ключ, добавляем его в params для некоторых методов
            // (некоторые версии Moonraker требуют это)
            if (this.apiKey && method.startsWith('printer.') || method.startsWith('server.')) {
                // Токен уже в URL, но можно попробовать добавить в запрос
                // request.token = this.apiKey; // если поддерживается
            }

            // Сохраняем промис для ожидания ответа
            this.pendingRequests.set(id, { resolve, reject });
            
            // Таймаут для запроса (10 секунд)
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 10000);

            try {
                this.websocket.send(JSON.stringify(request));
                console.log('[MoonrakerAPI] Request sent:', method, params);
            } catch (error) {
                this.pendingRequests.delete(id);
                reject(error);
            }
        });
    }

    /**
     * Получает статус принтера
     */
    async getPrinterStatus() {
        try {
            const result = await this.request('printer.info');
            return { result };
        } catch (error) {
            // Fallback: пробуем через objects.query
            const result = await this.request('printer.objects.query', {
                objects: {}
            });
            return { result };
        }
    }

    /**
     * Получает информацию о температуре
     */
    async getTemperature() {
        const result = await this.request('printer.objects.query', {
            objects: {
                heater_bed: ['temperature', 'target'],
                extruder: ['temperature', 'target']
            }
        });
        return { result };
    }

    /**
     * Получает информацию о текущем задании печати
     */
    async getPrintStatus() {
        const result = await this.request('printer.objects.query', {
            objects: {
                print_stats: ['state', 'filename', 'progress', 'print_duration', 'total_duration'],
                virtual_sdcard: ['progress']
            }
        });
        return { result };
    }

    /**
     * Получает данные о toolhead, позиции и вентиляторах
     * Адаптировано под конфиг QIDI с fan_generic и heater_fan
     */
    async getToolheadData() {
        const result = await this.request('printer.objects.query', {
            objects: {
                toolhead: ['position', 'homed_axes'],
                gcode_move: ['position', 'speed_factor', 'extrude_factor'],
                // Стандартный part cooling fan
                fan: ['speed'],
                // QIDI специфичные вентиляторы
                'fan_generic cooling_fan': ['speed'],
                'heater_fan hotend_fan': ['speed'],
                'fan_generic chamber_circulation_fan': ['speed'],
                'fan_generic auxiliary_cooling_fan': ['speed']
            }
        });
        return { result };
    }

    /**
     * Получает информацию о файлах
     */
    async getFiles() {
        const result = await this.request('server.files.list', { root: 'gcodes' });
        return { result: result };
    }

    /**
     * Авторизуется через access.login или передает токен
     */
    async authenticate() {
        // Если заданы логин/пароль — используем их
        if (this.username && this.password) {
            try {
                const result = await this.request('access.login', {
                    username: this.username,
                    password: this.password
                });
                console.log('[MoonrakerAPI] Login successful via access.login');
                return result;
            } catch (error) {
                console.error('[MoonrakerAPI] access.login failed with username/password', error);
                // Если не получилось с username/password, пробуем API ключ через _api_key_user_
                if (this.apiKey) {
                    console.log('[MoonrakerAPI] Trying API key authentication via _api_key_user_');
                    try {
                        const result = await this.request('access.login', {
                            username: '_api_key_user_',
                            password: this.apiKey
                        });
                        console.log('[MoonrakerAPI] Login successful via API key');
                        return result;
                    } catch (apiKeyError) {
                        console.error('[MoonrakerAPI] API key authentication also failed', apiKeyError);
                        throw apiKeyError;
                    }
                }
                throw error;
            }
        }

        // Если только API ключ - пробуем через _api_key_user_
        if (this.apiKey) {
            try {
                const result = await this.request('access.login', {
                    username: '_api_key_user_',
                    password: this.apiKey
                });
                console.log('[MoonrakerAPI] Login successful via API key');
                return result;
            } catch (error) {
                console.warn('[MoonrakerAPI] API key login failed, relying on token in URL (if provided)');
                // Если токен был в URL, возможно авторизация уже прошла
                return;
            }
        }

        // Если нет ни ключа, ни логина — работать не сможем
        throw new Error('No credentials provided');
    }

    /**
     * Подписывается на обновления принтера
     * Адаптировано под конфиг QIDI с fan_generic и heater_fan
     */
    subscribeToUpdates() {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (this.isSubscribed) return;

        const subscription = {
            jsonrpc: '2.0',
            method: 'printer.objects.subscribe',
            params: {
                objects: {
                    heater_bed: ['temperature', 'target'],
                    extruder: ['temperature', 'target'],
                    print_stats: ['state', 'filename', 'progress', 'print_duration', 'total_duration'],
                    virtual_sdcard: ['progress'],
                    // Позиция и скорость
                    toolhead: ['position', 'homed_axes'],
                    gcode_move: ['position', 'speed_factor', 'extrude_factor'],
                    // Стандартный вентилятор
                    fan: ['speed'],
                    // QIDI специфичные вентиляторы
                    'fan_generic cooling_fan': ['speed'],
                    'heater_fan hotend_fan': ['speed'],
                    'fan_generic chamber_circulation_fan': ['speed'],
                    'fan_generic auxiliary_cooling_fan': ['speed'],
                    // Температура камеры
                    'heater_generic chamber': ['temperature', 'target'],
                    'temperature_sensor Chamber_Thermal_Protection_Sensor': ['temperature']
                }
            },
            id: 5434
        };

        this.websocket.send(JSON.stringify(subscription));
        this.isSubscribed = true;
    }

    // ========== Методы управления принтером ==========

    /**
     * Отправляет G-code команду
     */
    async sendGcode(script) {
        const result = await this.request('printer.gcode.script', { script });
        return { result };
    }

    /**
     * Ставит печать на паузу
     */
    async pausePrint() {
        const result = await this.request('printer.print.pause');
        return { result };
    }

    /**
     * Возобновляет печать
     */
    async resumePrint() {
        const result = await this.request('printer.print.resume');
        return { result };
    }

    /**
     * Отменяет печать
     */
    async cancelPrint() {
        const result = await this.request('printer.print.cancel');
        return { result };
    }

    /**
     * Аварийная остановка
     */
    async emergencyStop() {
        const result = await this.request('printer.emergency_stop');
        return { result };
    }

    /**
     * Запускает печать файла
     */
    async startPrint(filename) {
        const result = await this.request('printer.print.start', { filename });
        return { result };
    }

    /**
     * Получает системную информацию
     */
    async getSystemInfo() {
        const result = await this.request('machine.system_info');
        return { result };
    }

    /**
     * Получает информацию о процессе Moonraker
     */
    async getProcStats() {
        const result = await this.request('machine.proc_stats');
        return { result };
    }

    // ========== История печатей (server.history) ==========

    /**
     * Получает историю печатей
     */
    async getHistory(limit = 50, start = 0, order = 'desc') {
        const result = await this.request('server.history.list', {
            limit,
            start,
            order
        });
        return { result };
    }

    /**
     * Получает статистику печатей
     */
    async getHistoryTotals() {
        const result = await this.request('server.history.totals');
        return { result };
    }

    /**
     * Получает информацию о конкретной печати
     */
    async getHistoryJob(jobId) {
        const result = await this.request('server.history.get_job', { uid: jobId });
        return { result };
    }

    /**
     * Удаляет запись из истории
     */
    async deleteHistoryJob(jobId) {
        const result = await this.request('server.history.delete_job', { uid: jobId });
        return { result };
    }

    // ========== Дополнительные объекты Klipper ==========

    /**
     * Получает данные датчиков (temperature_sensor, temperature_fan, etc.)
     */
    async getSensors() {
        const result = await this.request('printer.objects.query', {
            objects: {
                'temperature_sensor mcu_temp': null,
                'temperature_sensor raspberry_pi': null,
                'temperature_fan hotend_fan': null
            }
        });
        return { result };
    }

    /**
     * Получает данные о шаговых двигателях
     */
    async getStepperInfo() {
        const result = await this.request('printer.objects.query', {
            objects: {
                stepper_enable: null,
                'tmc2209 stepper_x': ['run_current', 'hold_current'],
                'tmc2209 stepper_y': ['run_current', 'hold_current'],
                'tmc2209 stepper_z': ['run_current', 'hold_current'],
                'tmc2209 extruder': ['run_current', 'hold_current']
            }
        });
        return { result };
    }

    /**
     * Устанавливает callback для обновлений статуса
     */
    setStatusUpdateCallback(callback) {
        this.onStatusUpdate = callback;
    }

    /**
     * Отключается от WebSocket
     */
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.pendingRequests.clear();
        this.isSubscribed = false;
    }
}

export default MoonrakerAPI;
