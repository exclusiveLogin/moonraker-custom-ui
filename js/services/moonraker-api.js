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
    }

    /**
     * Подключается к WebSocket
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                let wsUrl = this.wsUrl + '/websocket';
                
                // Логика подключения:
                // 1. Если есть API ключ - используем его в URL (работает и с force_logins: true, и без)
                // 2. Если нет API ключа, но есть username/password - пробуем без токена, затем access.login
                // 3. Если первая попытка без токена не удалась (403) - пробуем С токеном в URL
                const hasTokenInUrl = this.apiKey && (!this.username || this.connectionAttempt === 1);
                if (hasTokenInUrl) {
                    wsUrl += `?token=${this.apiKey}`;
                }
                
                console.log('[MoonrakerAPI] Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=***'));
                this.websocket = new WebSocket(wsUrl);

                this.websocket.onopen = async () => {
                    console.log('[MoonrakerAPI] WebSocket connected');
                    this.reconnectAttempts = 0;
                    this.connectionAttempt = 0; // Сбрасываем счетчик при успешном подключении
                    
                    // Авторизуемся, если есть креды/ключ
                    // Если токен был в URL, авторизация может уже пройти на этапе handshake
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
                    // Подписку делаем позже, после initial load (в App)
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
                    reject(error);
                };

                this.websocket.onclose = (event) => {
                    const closeCode = event.code;
                    const closeReason = event.reason || 'Unknown';
                    
                    console.log(`[MoonrakerAPI] WebSocket disconnected. Code: ${closeCode}, Reason: ${closeReason}`);
                    
                    // Ошибка авторизации (403 обычно приходит как 1008 или 4003)
                    if ((closeCode === 1008 || closeCode === 4003 || closeCode === 4001) && 
                        this.username && this.apiKey && this.connectionAttempt === 0) {
                        // Первая попытка без токена не удалась - пробуем с токеном в URL
                        console.log('[MoonrakerAPI] First attempt failed, retrying with token in URL...');
                        this.connectionAttempt = 1;
                        this.websocket = null;
                        setTimeout(() => {
                            this.connect().then(resolve).catch(reject);
                        }, 500);
                        return;
                    }
                    
                    // Очищаем все pending запросы
                    this.pendingRequests.forEach(({ reject }) => {
                        reject(new Error(`WebSocket disconnected: ${closeReason} (code: ${closeCode})`));
                    });
                    this.pendingRequests.clear();
                    
                    // Пытаемся переподключиться только если это не ошибка авторизации
                    if (closeCode !== 1008 && closeCode !== 4003 && closeCode !== 4001) {
                        this.connectionAttempt = 0; // Сбрасываем счетчик для следующей попытки
                        this.attemptReconnect();
                    }
                };
            } catch (error) {
                console.error('[MoonrakerAPI] WebSocket connection error:', error);
                reject(error);
            }
        });
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
                    virtual_sdcard: ['progress']
                }
            },
            id: 5434
        };

        this.websocket.send(JSON.stringify(subscription));
        this.isSubscribed = true;
    }

    /**
     * Устанавливает callback для обновлений статуса
     */
    setStatusUpdateCallback(callback) {
        this.onStatusUpdate = callback;
    }

    /**
     * Попытка переподключения
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[MoonrakerAPI] Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`[MoonrakerAPI] Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect().catch(console.error);
        }, delay);
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
