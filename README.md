# 🖨️ Moonraker Custom UI

Кастомный веб-интерфейс для управления 3D принтером через Moonraker API.

## ✨ Особенности

- 🌙 **Темная тема** - современный темный интерфейс
- 📊 **Виджеты** - модульные компоненты для мониторинга принтера
- 🔄 **WebSocket** - обновления в реальном времени
- 🧩 **Web Components** - переиспользуемые компоненты
- 💾 **Локальный стор** - централизованное управление состоянием
- 🚀 **Нативный HTML/JS** - без фреймворков, быстрая загрузка

## 📦 Структура проекта

```
moonraker-custom-ui/
├── index.html              # Главная страница
├── package.json            # npm скрипты для запуска
├── styles/
│   └── main.css           # Стили с темной темой
└── js/
    ├── config.js          # Конфигурация (URL, API ключ)
    ├── app.js             # Главный файл приложения
    ├── services/
    │   ├── moonraker-api.js  # REST клиент для Moonraker API
    │   └── store.js          # Локальный стор/репозиторий
    └── components/
        ├── temperature-widget.js  # Виджет температуры
        ├── status-widget.js       # Виджет статуса
        └── progress-widget.js     # Виджет прогресса
```

## 🚀 Запуск

### ⚡ Быстрый запуск (Windows)

**Двойной клик по файлу:**
- `start.bat` - запуск с автоматическим открытием браузера
- `start-simple.bat` - простой запуск без открытия браузера

### Вариант 1: Через npx напрямую (рекомендуется)

**В PowerShell (если разрешено):**
```powershell
npx serve . -p 3000 -o
```

**В CMD (Command Prompt):**
```cmd
npx serve . -p 3000 -o
```

### Вариант 2: Через npm (если политика PowerShell разрешена)

Если нужно изменить политику выполнения PowerShell:
```powershell
# Запустите PowerShell от имени администратора и выполните:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Затем можно использовать:
```bash
npm start        # Запуск на порту 3000
npm run dev      # Запуск + автоматическое открытие браузера
```

### Вариант 3: Другие статические серверы

```bash
# http-server
npx http-server . -p 3000

# python (если установлен)
python -m http.server 3000
```

### ⚠️ Важно

Для работы WebSocket и CORS **обязательно** используйте локальный сервер. Простое открытие `index.html` в браузере не будет работать из-за ограничений безопасности браузера.

## ⚙️ Настройка

Все настройки находятся в файле `js/config.js`:

```javascript
export const config = {
    // Адрес Moonraker API
    moonrakerUrl: 'http://localhost:7125',
    
    // API ключ для Moonraker
    apiKey: 'ваш-api-ключ'
};
```

### Настройка подключения

1. **Изменение адреса Moonraker**: отредактируйте `moonrakerUrl` в `js/config.js`
2. **API ключ**: уже настроен в `js/config.js` (ключ передается автоматически во всех запросах)

API ключ добавляется в заголовок `X-Api-Key` для HTTP запросов и в параметр `token` для WebSocket подключений.

### 🔧 Настройка CORS в Moonraker

**Если вы видите ошибку CORS**, нужно настроить доверенные узлы в Moonraker.

📖 **Подробная инструкция**: см. файл [`MOONRAKER_SETUP.md`](MOONRAKER_SETUP.md)

**Кратко:**
1. Откройте `moonraker.conf`
2. Добавьте в секцию `[authorization]`:
```ini
trusted_clients:
    127.0.0.1
    localhost
    192.168.31.75  # IP вашего компьютера
```
3. Перезапустите Moonraker

## 🎨 Виджеты

### 🌡️ Температура
- Текущая и целевая температура экструдера
- Текущая и целевая температура стола
- Визуальные индикаторы прогресса нагрева

### 📊 Статус
- Текущее состояние принтера
- Имя файла печати
- Время печати

### 📈 Прогресс
- Круговой индикатор прогресса
- Оставшееся время печати

## 🔧 Технологии

- **HTML5** - структура
- **CSS3** - стилизация с CSS переменными
- **Vanilla JavaScript (ES6+)** - логика приложения
- **Web Components API** - модульные виджеты
- **Fetch API** - HTTP запросы
- **WebSocket API** - обновления в реальном времени

## 📡 Moonraker API

Приложение использует следующие endpoints:
- `GET /printer/status` - статус принтера
- `GET /printer/objects/query` - данные о температуре и печати
- `WebSocket /websocket` - подписка на обновления

## 🎯 Планы развития

- [ ] Управление печатью (старт/пауза/стоп)
- [ ] Список файлов для печати
- [ ] История печатей
- [ ] Настройки принтера
- [ ] Графики температуры
- [ ] Камера (если доступна)

## 🔔 WebSocket события (Moonraker)

Основное событие: `notify_status_update`
- `params[0].heater_bed.temperature|target`
- `params[0].extruder.temperature|target`
- `params[0].print_stats.state|filename|progress|print_duration|total_duration`
- `params[0].virtual_sdcard.progress`

Подписка, которую используем:
- Метод: `printer.objects.subscribe`
- Объекты: `heater_bed[temperature,target]`, `extruder[temperature,target]`, `print_stats[...]`, `virtual_sdcard[progress]`

Формат JSON-RPC кадра:
```json
{
  "jsonrpc": "2.0",
  "method": "notify_status_update",
  "params": [
    {
      "heater_bed": { "temperature": 60, "target": 60 },
      "extruder": { "temperature": 210, "target": 210 },
      "print_stats": {
        "state": "printing",
        "filename": "...",
        "progress": 0.67,
        "print_duration": 22656,
        "total_duration": 22748
      },
      "virtual_sdcard": { "progress": 0.67 }
    }
  ]
}
```