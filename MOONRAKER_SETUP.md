# 🔧 Настройка Moonraker для работы с Custom UI

## Проблема CORS

Если вы видите ошибку CORS в браузере (особенно "preflight request doesn't pass"), это может быть связано с:

1. **Не настроены `cors_domains`** в Moonraker
2. **Preflight запросы (OPTIONS)** не обрабатываются правильно
3. **API ключ в заголовке** вызывает preflight запрос

**Решение в коде:** API ключ теперь передается через URL параметр `token` вместо заголовка `X-Api-Key`, что избегает preflight для GET запросов.

## 📝 Решение

### 1. Найдите файл конфигурации Moonraker

Обычно это файл `moonraker.conf` в папке конфигурации Klipper/Moonraker.

**Типичные расположения:**
- `~/printer_data/config/moonraker.conf` (Linux)
- `C:\Users\YourName\AppData\Roaming\Klipper\config\moonraker.conf` (Windows)
- Или в папке, где установлен Moonraker

### 2. Откройте `moonraker.conf` и найдите секцию `[authorization]`

Если секции нет, добавьте её в конец файла.

### 3. Добавьте или обновите `trusted_clients`

```ini
[authorization]
# Список доверенных IP адресов и доменов
trusted_clients:
    # Локальный хост (для разработки)
    127.0.0.1
    localhost
    # IP адрес вашего компьютера (где запущен веб-интерфейс)
    192.168.31.75
    # Или весь локальный диапазон (менее безопасно, но удобно)
    # 192.168.31.0/24
```

### 4. Если используете API ключ (уже настроено)

Убедитесь, что в секции `[authorization]` есть:

```ini
[authorization]
# API ключ (уже настроен в js/config.js)
api_key_file: ~/.moonraker_api_key
# или
api_key: c0a0a871d7b34951838a3ad2f09491cd

# Доверенные клиенты
trusted_clients:
    127.0.0.1
    localhost
    192.168.31.75
```

### 5. Перезапустите Moonraker

После изменения конфигурации перезапустите Moonraker:

```bash
# Linux (через systemd)
sudo systemctl restart moonraker

# Или через Mainsail/Fluidd интерфейс
# Settings -> Machine -> Restart Moonraker
```

## 🔍 Проверка

После перезапуска откройте браузер и проверьте:

1. Откройте консоль разработчика (F12)
2. Перезагрузите страницу
3. Проверьте, что CORS ошибок больше нет

## 📋 Обновление вашего конфига

Ваш текущий конфиг уже имеет широкие диапазоны в `trusted_clients`, что хорошо. Нужно только добавить в `cors_domains` явные адреса для локальной разработки:

```ini
[authorization]
force_logins: true
trusted_clients:
    10.0.0.0/8
    127.0.0.0/8
    169.254.0.0/16
    172.16.0.0/12
    192.168.0.0/16  # ✅ Уже покрывает ваш IP 192.168.31.75
    FE80::/10
    ::1/128
cors_domains:
    http://*.lan
    http://*.local
    https://my.mainsail.xyz
    http://my.mainsail.xyz
    https://app.fluidd.xyz
    http://app.fluidd.xyz
    http://*.qidi3dprinter.com
    https://*.qidi3dprinter.com
    # ✅ Добавьте эти строки для локальной разработки:
    http://localhost:3000
    http://127.0.0.1:3000
    http://192.168.31.75:3000
    # Или используйте wildcard для всех портов:
    http://localhost:*
    http://192.168.31.75:*
```

**⚠️ Важно:** Moonraker не поддерживает wildcards в top-level domain (например, `192.168.*.*`). Нужно указывать конкретный IP адрес:

```ini
cors_domains:
    http://*.lan
    http://*.local
    https://my.mainsail.xyz
    http://my.mainsail.xyz
    https://app.fluidd.xyz
    http://app.fluidd.xyz
    http://*.qidi3dprinter.com
    https://*.qidi3dprinter.com
    # Локальная разработка - конкретный IP адрес
    http://localhost:*
    http://127.0.0.1:*
    http://192.168.31.75:*  # Ваш конкретный IP адрес
```

Если IP адрес меняется, можно добавить несколько конкретных адресов или использовать `*.lan` / `*.local` если они работают в вашей сети.

## ⚠️ Важные замечания

1. **IP адрес вашего компьютера**: Убедитесь, что указан правильный IP адрес компьютера, с которого вы открываете веб-интерфейс
2. **Порт**: Если используете другой порт (не 3000), добавьте его в `cors_domains`
3. **Безопасность**: Не добавляйте `*` или `0.0.0.0/0` в `trusted_clients` - это небезопасно!

## 🆘 Если не помогло

1. Проверьте, что Moonraker действительно перезапустился
2. Проверьте логи Moonraker на наличие ошибок
3. Убедитесь, что IP адрес в `trusted_clients` совпадает с IP вашего компьютера
4. Попробуйте добавить `cors_domains` с явным указанием URL вашего интерфейса

