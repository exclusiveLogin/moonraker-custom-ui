# Moonraker Custom UI

> **Статья-урок**: [Klipper и открытая архитектура — почему это правильно](#)

Кастомный веб-интерфейс для управления 3D-принтером через Moonraker API. Написан без фреймворков — чистые Web Components, ES6 модули, нативный WebSocket. Proof of concept к статье о том, почему открытая API-архитектура Klipper/Moonraker выигрывает у закрытых прошивок.

## Почему это интересно

Большинство прошивок для 3D-принтеров — чёрный ящик. Klipper устроен иначе: принтер это просто **JSON-RPC сервер**. Любой клиент, любой UI, любая интеграция — без модификации firmware.

Этот проект показывает: полноценный дашборд реального времени пишется за вечер на ванильном JS, **без единой зависимости в рантайме**.

## Что внутри

10 Web Components, каждый автономен:

| Виджет | Данные |
|--------|-------|
| `temperature-widget` | Температура экструдера и стола (текущая / целевая) |
| `status-widget` | Состояние принтера, имя файла, время печати |
| `progress-widget` | Круговой индикатор прогресса + оставшееся время |
| `toolhead-widget` | Позиция X/Y/Z, скорость, управление |
| `fan-widget` | Скорость обдува |
| `system-widget` | CPU, температура Raspberry Pi, память |
| `control-widget` | Старт / пауза / стоп, температурные пресеты |
| `chart-widget` | График температур в реальном времени |
| `history-widget` | История последних печатей |
| `files-widget` | Файловый менеджер на принтере |

## Архитектура

```
moonraker-custom-ui/
├── index.html               # 10 custom elements — никаких зависимостей
├── js/
│   ├── app.js               # Bootstrap: WebSocket + store init
│   ├── config.js            # moonrakerUrl, apiKey
│   ├── services/
│   │   ├── moonraker-api.js # REST + WebSocket клиент (JSON-RPC)
│   │   ├── store.js         # Centralized state store
│   │   └── api-instance.js  # Singleton
│   └── components/          # 10 Web Components (HTMLElement extends)
└── styles/main.css          # CSS variables, тёмная тема, grid layout
```

**Паттерн компонентов:**

```javascript
class TemperatureWidget extends HTMLElement {
  connectedCallback() {
    store.subscribe('temperature', data => this.render(data));
  }
}
customElements.define('temperature-widget', TemperatureWidget);
```

Store получает данные через WebSocket `notify_status_update`, раздаёт подписчикам — каждый виджет обновляется независимо.

## Стек

| Технология | Почему |
|-----------|--------|
| Vanilla JS (ES6 modules) | Нет фреймворка = нет абстракций между кодом и браузером |
| Web Components API | Нативная изоляция, нет virtual DOM |
| WebSocket + JSON-RPC | Moonraker Protocol — нативный для Klipper |
| CSS Variables | Тёмная тема без препроцессоров |
| **Нет npm в рантайме** | Всё что нужно — уже в браузере |

## Запуск

```bash
# Просто статический сервер (npm только для этого)
npm start        # localhost:3000
# или
python -m http.server 3000
```

Настроить `js/config.js`:

```javascript
export const config = {
    moonrakerUrl: 'http://<ip-принтера>:7125',
    apiKey: 'ваш-ключ'
};
```

## Moonraker: минимальный CORS

В `moonraker.conf`:

```ini
[authorization]
trusted_clients:
    192.168.x.x   # IP вашей машины
    127.0.0.1
```

Подробнее — [`MOONRAKER_SETUP.md`](MOONRAKER_SETUP.md), решение типичных проблем — [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

---

**Вывод из проекта:** 300 строк кода, 0 рантайм-зависимостей, полноценный дашборд. Открытая архитектура — это не просто слова.
