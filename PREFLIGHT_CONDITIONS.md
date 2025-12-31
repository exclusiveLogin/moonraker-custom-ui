# 🔍 Условия для Preflight запроса

Браузер автоматически отправляет preflight (OPTIONS) запрос в следующих случаях:

## ❌ Условия, вызывающие Preflight

### 1. Кастомные заголовки (не из "простых")
Любые заголовки, кроме этих "простых":
- `Accept`
- `Accept-Language`
- `Content-Language`
- `Content-Type` (только определенные значения, см. ниже)
- `DPR`
- `Downlink`
- `Save-Data`
- `Viewport-Width`
- `Width`

**Наш случай:** `X-Api-Key` - это кастомный заголовок → вызывает preflight ❌

### 2. Content-Type с определенными значениями
Preflight вызывается, если `Content-Type`:
- `application/json` ❌
- `application/xml` ❌
- `text/xml` ❌
- Любой другой, кроме:
  - `text/plain` ✅
  - `application/x-www-form-urlencoded` ✅
  - `multipart/form-data` ✅

### 3. HTTP методы
- `GET` ✅ (не вызывает preflight)
- `HEAD` ✅ (не вызывает preflight)
- `POST` - зависит от Content-Type
- `PUT`, `DELETE`, `PATCH` и другие - вызывают preflight ❌

### 4. Другие условия
- `credentials: 'include'` (cookies) может вызывать preflight
- Кастомные заголовки в ответе (через `Access-Control-Expose-Headers`)

## ✅ Как избежать Preflight

### Вариант 1: Убрать кастомные заголовки
- ❌ Не можем - нужен `X-Api-Key` для авторизации

### Вариант 2: Использовать простой Content-Type
- ✅ Для GET запросов не нужен Content-Type вообще

### Вариант 3: Использовать только GET/HEAD
- ✅ Уже используем GET

### Вариант 4: Передавать данные через URL
- Можно попробовать передать API ключ через URL параметр
- Но Moonraker может не принимать ключ через URL (мы пробовали - была ошибка 401)

## 🎯 Наш случай

**Проблема:** Заголовок `X-Api-Key` вызывает preflight ❌

**Решения:**
1. ✅ Настроить Moonraker правильно обрабатывать OPTIONS (через cors_domains)
2. ❌ Убрать заголовок - не можем, нужна авторизация
3. ❌ URL параметр - пробовали, не работает (401)
4. ✅ Использовать прокси на стороне сервера (nginx)
5. ✅ Обновить Moonraker до версии, которая правильно обрабатывает preflight

## 📝 Вывод

**Preflight неизбежен**, если нужен заголовок `X-Api-Key`. 

**Решение:** Настроить Moonraker правильно обрабатывать OPTIONS запросы через `cors_domains` и правильную обработку preflight на стороне сервера.

