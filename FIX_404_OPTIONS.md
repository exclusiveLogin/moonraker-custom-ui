# 🔧 Решение проблемы 404 OPTIONS

## Проблема

В логах Moonraker видно:
```
404 OPTIONS /printer/status (192.168.31.167) [No User]
```

**Moonraker возвращает 404 для OPTIONS запросов!** Это значит, что он не обрабатывает preflight запросы вообще.

## ✅ Решения

### Вариант 1: Обновить Moonraker (рекомендуется)

Старые версии Moonraker могут не поддерживать обработку OPTIONS запросов для CORS.

```bash
cd ~/moonraker
git pull
./scripts/install-moonraker.sh
sudo systemctl restart moonraker
```

### Вариант 2: Использовать nginx как прокси

Если обновление не помогает, можно использовать nginx для обработки OPTIONS:

```nginx
server {
    listen 7126;
    server_name _;

    location / {
        proxy_pass http://localhost:7125;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Передаем API ключ
        proxy_set_header X-Api-Key $http_x_api_key;
        
        # CORS заголовки
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'X-Api-Key, Content-Type, Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        # Обработка OPTIONS запросов
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'X-Api-Key, Content-Type, Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
```

Затем в `js/config.js` измените адрес на:
```javascript
moonrakerUrl: 'http://192.168.31.75:7126'  // nginx прокси
```

### Вариант 3: Проверить версию Moonraker

```bash
# Проверьте версию
grep -i version ~/moonraker/moonraker/__init__.py
# или
curl http://192.168.31.75:7125/server/info | grep version
```

Если версия старая (< 0.7.0), обновите обязательно.

### Вариант 4: Временно отключить CORS проверку (только для разработки)

Можно использовать расширение браузера для отключения CORS (только для разработки!):
- Chrome: "CORS Unblock" или "Allow CORS"
- Firefox: "CORS Everywhere"

**⚠️ ВНИМАНИЕ:** Это только для разработки! Не используйте в продакшене!

## 🎯 Рекомендация

1. **Сначала попробуйте обновить Moonraker** - это самое простое решение
2. **Если не поможет** - используйте nginx прокси
3. **Для разработки** можно временно использовать расширение браузера

## 📝 После исправления

После обновления Moonraker или настройки nginx, в логах должно быть:
```
200 OPTIONS /printer/status  # ✅ Вместо 404
```

Или вообще не должно быть OPTIONS в логах (если nginx обрабатывает).

