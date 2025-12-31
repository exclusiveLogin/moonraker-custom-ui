# 🔍 Диагностика Preflight проблемы

## Текущая ситуация

**Ошибка:**
```
Access to fetch at 'http://192.168.31.75:7125/printer/status' 
from origin 'http://127.0.0.1:3000' 
has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status
```

**Конфиг Moonraker:**
```ini
cors_domains:
    http://localhost:*
    http://127.0.0.1:*  # ✅ Должен покрывать http://127.0.0.1:3000
```

## Проблема

OPTIONS запрос отправляется, но Moonraker либо:
1. Не отвечает на него (timeout)
2. Отвечает с ошибкой (не 200/204)
3. Требует авторизацию для OPTIONS (401)

## 🔧 Решения

### 1. Проверьте точное совпадение Origin

В браузере Origin = `http://127.0.0.1:3000`

В `cors_domains` должно быть:
```ini
cors_domains:
    http://127.0.0.1:3000  # ✅ Точное совпадение
    # или
    http://127.0.0.1:*     # ✅ Wildcard для порта
```

**Попробуйте добавить точное совпадение:**
```ini
cors_domains:
    http://localhost:*
    http://127.0.0.1:*
    http://127.0.0.1:3000  # ✅ Добавьте точное совпадение
```

### 2. Проверьте логи Moonraker

```bash
sudo journalctl -u moonraker -f
```

При отправке запроса из браузера вы должны увидеть:
- **OPTIONS** запрос на `/printer/status`
- Статус ответа (должен быть 200 или 204, не 401!)

### 3. Проверьте в браузере (F12 → Network)

1. Откройте DevTools → Network
2. Отправьте запрос
3. Найдите **OPTIONS** запрос
4. Проверьте:
   - **Request URL:** должен быть правильный
   - **Request Headers:** должен быть `Origin: http://127.0.0.1:3000`
   - **Response Status:** должен быть 200/204 (не 401!)
   - **Response Headers:** должны быть CORS заголовки

### 4. Временно отключите force_logins

Для теста попробуйте:
```ini
[authorization]
force_logins: false  # Временно для теста
```

Если после этого preflight заработает - проблема в обработке авторизации при `force_logins: true`.

### 5. Обновите Moonraker

Старые версии могут некорректно обрабатывать preflight:
```bash
cd ~/moonraker
git pull
./scripts/install-moonraker.sh
sudo systemctl restart moonraker
```

### 6. Проверьте версию Moonraker

```bash
# Проверьте версию
grep -i version ~/moonraker/moonraker/__init__.py
# или
curl http://192.168.31.75:7125/server/info
```

## 🎯 Быстрая проверка

Откройте консоль браузера (F12) и выполните:

```javascript
// Проверка OPTIONS запроса
fetch('http://192.168.31.75:7125/printer/status', {
    method: 'OPTIONS',
    headers: {
        'Origin': 'http://127.0.0.1:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-Api-Key'
    }
})
.then(r => {
    console.log('OPTIONS Status:', r.status);
    console.log('OPTIONS Headers:', Object.fromEntries(r.headers.entries()));
    return r.text();
})
.then(console.log)
.catch(console.error);
```

Если видите статус 200/204 - preflight работает!  
Если видите 401 - Moonraker требует авторизацию для OPTIONS (проблема).

## 📝 Рекомендация

1. **Добавьте точное совпадение** в `cors_domains`:
   ```ini
   http://127.0.0.1:3000
   ```

2. **Перезапустите Moonraker**

3. **Проверьте логи** - должен быть OPTIONS со статусом 200/204

4. **Проверьте в Network** - посмотрите, что именно возвращает OPTIONS

