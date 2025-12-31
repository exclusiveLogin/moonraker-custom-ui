# 🔧 Разрешение Preflight (OPTIONS) без авторизации в Moonraker

## Проблема

С `force_logins: true` Moonraker может требовать авторизацию даже для OPTIONS запросов, что блокирует preflight.

## ✅ Решение

### Вариант 1: Настройка через cors_domains (рекомендуется)

Moonraker должен автоматически обрабатывать OPTIONS запросы для доменов из `cors_domains` **до** проверки авторизации.

**Убедитесь, что в `moonraker.conf` правильно настроено:**

```ini
[authorization]
force_logins: true
trusted_clients:
    10.0.0.0/8
    127.0.0.0/8
    169.254.0.0/16
    172.16.0.0/12
    192.168.0.0/16
    FE80::/10
    ::1/128

# ✅ ВАЖНО: cors_domains должен быть настроен правильно
cors_domains:
    http://*.lan
    http://*.local
    http://localhost:*
    http://127.0.0.1:*
    # Добавьте ваш конкретный IP, если нужно
    http://192.168.31.75:*
```

**Ключевые моменты:**
- `cors_domains` должен содержать **точный** Origin вашего приложения
- Используйте `*` для порта (например, `http://localhost:*`)
- Moonraker обрабатывает OPTIONS для доменов из `cors_domains` **до** проверки авторизации

### Вариант 2: Временно отключить force_logins (для теста)

Если нужно быстро проверить, работает ли preflight:

```ini
[authorization]
force_logins: false  # Временно для теста
# ... остальное
```

Если после этого preflight заработает - проблема в обработке авторизации при `force_logins: true`.

### Вариант 3: Обновить Moonraker

Старые версии Moonraker могут некорректно обрабатывать preflight с `force_logins: true`. Обновите до последней версии:

```bash
cd ~/moonraker
git pull
./scripts/install-moonraker.sh
sudo systemctl restart moonraker
```

### Вариант 4: Проверить логи Moonraker

Проверьте, как Moonraker обрабатывает OPTIONS запросы:

```bash
sudo journalctl -u moonraker -f
# или
tail -f ~/printer_data/logs/moonraker.log
```

При отправке запроса из браузера вы должны увидеть:
1. **OPTIONS запрос** - должен возвращать статус 200/204
2. **Заголовки ответа** - должны содержать CORS заголовки

Если OPTIONS возвращает 401 - Moonraker требует авторизацию для preflight (проблема).

## 🔍 Диагностика

### Проверка в браузере (F12 → Network)

1. Откройте DevTools → Network
2. Отправьте запрос из приложения
3. Найдите **OPTIONS запрос** (preflight)
4. Проверьте:
   - **Статус:** должен быть 200 или 204 (не 401!)
   - **Заголовки ответа:**
     - `Access-Control-Allow-Origin: http://localhost:3000`
     - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
     - `Access-Control-Allow-Headers: X-Api-Key, Content-Type`

### Если OPTIONS возвращает 401:

**Проблема:** Moonraker требует авторизацию для preflight.

**Решения:**
1. Убедитесь, что Origin точно указан в `cors_domains`
2. Проверьте версию Moonraker (обновите, если старая)
3. Попробуйте временно отключить `force_logins: false` для теста
4. Проверьте, что Moonraker перезапустился после изменения конфига

## 📝 Текущая настройка

Ваш текущий конфиг:
```ini
cors_domains:
    http://*.lan
    http://*.local
    http://localhost:*
    http://127.0.0.1:*
```

**Это должно работать!** Moonraker должен обрабатывать OPTIONS для этих доменов без авторизации.

## 🎯 Рекомендация

1. **Убедитесь, что Origin точно совпадает** с одним из доменов в `cors_domains`
2. **Перезапустите Moonraker** после изменения конфига
3. **Проверьте логи** - должны быть OPTIONS запросы со статусом 200/204
4. **Обновите Moonraker**, если версия старая

Если всё настроено правильно, preflight должен работать без авторизации!

