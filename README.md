# Omnicom — омниканальная платформа коммуникации

MVP омниканальной платформы с единым inbox и интеграцией **Telegram через бота** (Bot API / grammY). Клиенты пишут боту, их сообщения попадают в общий инбокс в реальном времени, менеджеры отвечают из интерфейса. Каждый диалог можно **назначить на конкретного менеджера**.

## Стек

- **Backend:** Node.js, NestJS, Prisma, PostgreSQL, Redis, Socket.IO, grammY (Telegram Bot API)
- **Frontend:** Next.js (App Router), React, TailwindCSS, React Query, socket.io-client
- **Инфраструктура:** Docker, docker-compose (dev + prod), монорепо на npm workspaces

## Структура

```
omnicom/
├─ apps/
│  ├─ api/        # NestJS API (auth, telegram-bot, conversations, users, realtime)
│  └─ web/        # Next.js веб-клиент (login, connect/статус бота, inbox)
├─ packages/
│  └─ shared/     # Общие TypeScript-типы
├─ docker-compose.dev.yml   # dev с hot-reload
├─ docker-compose.yml       # prod
└─ .env.example
```

## Предварительные требования

1. Docker и Docker Compose.
2. **Токен Telegram-бота** (создаётся за минуту, без my.telegram.org):
   - Откройте в Telegram [@BotFather](https://t.me/BotFather).
   - Отправьте `/newbot`, задайте имя и username бота.
   - Скопируйте выданный токен вида `123456789:AAE...`.

> Важный нюанс бота: он **не может написать первым** пользователю, который ему ещё не писал. Клиент должен сам начать диалог с ботом (нажать «Старт» / написать сообщение). Для поддержки это стандартное поведение.

## Быстрый старт (dev, с hot-reload)

```bash
cp .env.example .env
```

Заполните в `.env`:

- `TELEGRAM_BOT_TOKEN` — токен от @BotFather
- `SESSION_ENC_KEY` — 32-байтный ключ:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- `JWT_SECRET` — любая длинная случайная строка
- Проверьте, что `DATABASE_URL` использует те же логин/пароль, что `POSTGRES_USER` / `POSTGRES_PASSWORD`

Запуск:

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Веб: http://localhost:3000 (или `WEB_PORT` из `.env`)
- API: http://localhost:4000 (health: `/health`)

В dev-режиме исходники смонтированы в контейнеры: API перезапускается через `nest start --watch`, фронт — через `next dev`.

## Прод

```bash
docker compose up --build -d
```

Образы собираются оптимизированными (multi-stage), API при старте синхронизирует схему БД (`prisma db push`), Next.js работает в `standalone`-режиме.

> `NEXT_PUBLIC_API_URL` инлайнится во фронтенд на этапе сборки. Если API доступен по другому адресу/домену, задайте переменную перед `docker compose build`.

## Прокси (для сетей с ограничениями)

Если сервер не может напрямую достучаться до `api.telegram.org`, задайте прокси в `.env`:

```
TELEGRAM_PROXY_URL=socks5://user:pass@host:1080
# или
TELEGRAM_PROXY_URL=http://user:pass@host:3128
```

Пусто — подключение напрямую. Бот работает в режиме long polling (только исходящие соединения), поэтому из РФ обычно работает и без прокси.

## Как пользоваться

1. http://localhost:3000 → **Регистрация**, создайте оператора (email + пароль). Зарегистрируйте по аккаунту на каждого менеджера.
2. Откройте страницу **Бот** — проверьте статус (онлайн), там же инструкция по @BotFather.
3. Напишите своему боту в Telegram — диалог появится в инбоксе в реальном времени.
4. В инбоксе:
   - вкладки **Все / Мои / Без менеджера**;
   - в шапке диалога — выпадающий список **Менеджер** для назначения/снятия;
   - ответы отправляются клиенту через бота.

## Модель данных (Prisma)

- `User` — оператор/менеджер платформы (JWT-аутентификация)
- `Contact` — клиент, написавший боту
- `Conversation` — диалог с клиентом, поле `assignedTo` — назначенный менеджер
- `Message` — сообщение (`in`/`out`), `sentById` — кто из менеджеров отправил

## Архитектура потока сообщения

```
Клиент в Telegram
  → Bot API (grammY long polling)
    → NestJS (persist в PostgreSQL)
      → Redis (Socket.IO adapter) → WebSocket → инбокс (все операторы)
Ответ: инбокс → REST → NestJS → bot.api.sendMessage → клиенту
```

## Замечания и ограничения MVP

- Поддерживаются текстовые сообщения; вложения сохраняются как пометка (`[фото]`, `[документ]` и т.п.).
- Инбокс общий для всех операторов (shared inbox); назначение менеджера — организационное, доступ к диалогу есть у всех.
- Бот не пишет первым — клиент инициирует диалог сам.

## Полезные команды

```bash
# Логи API
docker compose -f docker-compose.dev.yml logs -f api

# Синхронизировать схему вручную (dev)
docker compose -f docker-compose.dev.yml exec api npx --workspace @omnicom/api prisma db push

# Prisma Studio (dev)
docker compose -f docker-compose.dev.yml exec api npx --workspace @omnicom/api prisma studio
```
