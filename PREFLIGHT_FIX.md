# 🔧 Решение проблемы Preflight (OPTIONS запрос)

## Проблема

Moonraker не обрабатывает preflight запрос (OPTIONS), который браузер отправляет перед запросом с кастомным заголовком `X-Api-Key`.

## ✅ Решения

### Вариант 1: Проверьте версию Moonraker

Старые версии Moonraker могут не поддерживать CORS правильно. Обновите до последней версии:

```bash
cd ~/moonraker
git pull
./scripts/install-moonraker.sh
```

### Вариант 2: Проверьте логи Moonraker

Посмотрите, что происходит с OPTIONS запросами:

```bash
sudo journalctl -u moonraker -f
# или
tail -f ~/printer_data/logs/moonraker.log
```

При отправке запроса из браузера вы должны увидеть OPTIONS запрос в логах.

### Вариант 3: Временно отключите force_logins

Для теста попробуйте временно отключить `force_logins`:

```ini
[authorization]
force_logins: false  # Временно для теста
# ... остальное
```

Если это поможет - проблема в обработке авторизации при preflight.

### Вариант 4: Используйте прокси на стороне сервера

Если Moonraker не может обработать preflight, можно использовать nginx как прокси:

```nginx
location /api/ {
    proxy_pass http://localhost:7125/;
    proxy_set_header X-Api-Key $http_x_api_key;
    
    # CORS заголовки
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'X-Api-Key, Content-Type' always;
    
    if ($request_method = 'OPTIONS') {
        return 204;
    }
}
```

### Вариант 5: Проверьте, что Moonraker действительно перезапустился

Убедитесь, что Moonraker перезапустился после изменения конфига:

```bash
# Проверьте статус
sudo systemctl status moonraker

# Проверьте, что новый конфиг загружен
# В логах должно быть видно загрузку конфига
sudo journalctl -u moonraker | grep -i "config"
```

### Вариант 6: Используйте другой метод авторизации

Если `force_logins: true` вызывает проблемы, попробуйте:

1. Отключить `force_logins`
2. Использовать только `trusted_clients` для авторизации
3. Или настроить авторизацию через сессию вместо API ключа

## 🔍 Диагностика

Откройте консоль браузера (F12) → Network и проверьте:

1. **OPTIONS запрос** - должен возвращать статус 200 или 204
2. **Заголовки ответа** - должны содержать:
   - `Access-Control-Allow-Origin: http://localhost:3000`
   - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   - `Access-Control-Allow-Headers: X-Api-Key`

Если OPTIONS запрос возвращает ошибку или не возвращает нужные заголовки - проблема в Moonraker.

## 📝 Текущая ситуация

- ✅ `cors_domains` настроен правильно
- ✅ `trusted_clients` настроен правильно
- ❌ Preflight (OPTIONS) не проходит

**Вероятная причина:** Moonraker не обрабатывает OPTIONS запросы правильно, возможно из-за `force_logins: true` или версии Moonraker.

## 🎯 Рекомендация

1. Проверьте логи Moonraker при отправке запроса
2. Попробуйте временно отключить `force_logins: false`
3. Если поможет - проблема в обработке авторизации при preflight
4. Обновите Moonraker до последней версии

