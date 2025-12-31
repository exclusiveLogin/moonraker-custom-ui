# ✅ Чеклист решения CORS проблемы

## Шаг 1: Проверьте moonraker.conf

Убедитесь, что в секции `[authorization]` добавлены строки в `cors_domains`:

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
cors_domains:
    http://*.lan
    http://*.local
    https://my.mainsail.xyz
    http://my.mainsail.xyz
    https://app.fluidd.xyz
    http://app.fluidd.xyz
    http://*.qidi3dprinter.com
    https://*.qidi3dprinter.com
    # ✅ ОБЯЗАТЕЛЬНО ДОБАВЬТЕ ЭТИ СТРОКИ:
    http://localhost:*
    http://127.0.0.1:*
    http://192.168.31.75:*  # ⚠️ Конкретный IP (wildcards в top-level domain не поддерживаются)
```

## Шаг 2: Перезапустите Moonraker

**ВАЖНО:** После изменения конфигурации обязательно перезапустите Moonraker:

```bash
sudo systemctl restart moonraker
```

Или через веб-интерфейс:
- Mainsail/Fluidd → Settings → Machine → Restart Moonraker

## Шаг 3: Hard Refresh в браузере

- **Windows/Linux**: `Ctrl + Shift + R` или `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

## Шаг 4: Проверьте результат

Откройте консоль браузера (F12) и проверьте:

✅ **Успех:** Видите данные принтера, нет ошибок CORS  
❌ **Ошибка 401:** API ключ не принимается - проверьте ключ в `js/config.js`  
❌ **Ошибка CORS:** Preflight не проходит - проверьте `cors_domains` и перезапуск Moonraker

## 🔍 Диагностика

### Если видите ошибку 401 Unauthorized:

1. Проверьте API ключ в `js/config.js` - должен совпадать с ключом в Moonraker
2. Убедитесь, что `force_logins: true` не блокирует API ключ
3. Попробуйте временно отключить `force_logins` для теста

### Если видите CORS ошибку:

1. Убедитесь, что добавили `cors_domains` с правильными адресами
2. Проверьте, что перезапустили Moonraker (не просто перезагрузили страницу)
3. Сделайте Hard Refresh в браузере
4. Проверьте логи Moonraker на ошибки

## 📝 Текущий статус

После последнего изменения:
- ✅ CORS ошибка решена (preflight проходит)
- ⚠️ Ошибка 401 - API ключ передается в заголовке `X-Api-Key`
- 🔧 Нужно убедиться, что ключ правильный и Moonraker его принимает

