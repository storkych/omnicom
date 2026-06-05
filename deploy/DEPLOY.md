# Деплой Omnicom на сервер

Домен: **https://omnicanal.storkyproduct.ru**

Стек на сервере: Docker Compose (prod) + Nginx + Certbot (SSL).  
CI/CD: GitHub Actions → SSH → `docker compose up --build`.

---

## Шаг 1. DNS

У регистратора домена добавь **A-запись**:

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `omnicanal` | IP твоего VPS |

Проверка (с любого ПК):

```bash
nslookup omnicanal.storkyproduct.ru
```

---

## Шаг 2. Подготовка сервера (один раз)

Подключись по SSH:

```bash
ssh root@ТВОЙ_IP
```

Установи Docker:

```bash
apt update && apt install -y ca-certificates curl git nginx certbot python3-certbot-nginx
curl -fsSL https://get.docker.com | sh
systemctl enable docker nginx
```

Создай пользователя для деплоя (рекомендуется):

```bash
adduser deploy
usermod -aG docker deploy
```

Создай папку проекта:

```bash
mkdir -p /opt/omnicom
chown deploy:deploy /opt/omnicom
```

Клонируй репозиторий (под `deploy` или root):

```bash
su - deploy
cd /opt/omnicom
git clone https://github.com/ТВОЙ_ОРГ/omnicom.git .
```

---

## Шаг 3. SSH-ключ для GitHub Actions

**На своём ПК** (не на сервере):

```bash
ssh-keygen -t ed25519 -C "github-actions-omnicom" -f ~/.ssh/omnicom_deploy -N ""
```

Публичный ключ на сервер:

```bash
ssh-copy-id -i ~/.ssh/omnicom_deploy.pub deploy@ТВОЙ_IP
```

Проверь вход без пароля:

```bash
ssh -i ~/.ssh/omnicom_deploy deploy@ТВОЙ_IP
```

Приватный ключ понадобится для GitHub Secret (см. шаг 5).

---

## Шаг 4. Production `.env`

На основе `deploy/production.env.example` заполни реальные значения:

- `POSTGRES_PASSWORD` — сильный пароль
- `JWT_SECRET` — `openssl rand -hex 32`
- `SESSION_ENC_KEY` — `openssl rand -hex 32`
- `TELEGRAM_BOT_TOKEN` — от @BotFather
- `NEXT_PUBLIC_API_URL=https://omnicanal.storkyproduct.ru`
- `CORS_ORIGIN=https://omnicanal.storkyproduct.ru`
- `NPM_REGISTRY=https://registry.npmmirror.com` (для Москвы)

Положи файл **один раз на сервер** (CI/CD его не перезаписывает):

```bash
cd /opt/omnicom
cp deploy/production.env.example .env
nano .env   # заполни пароли, токен бота и т.д.
chmod 600 .env
```

Чтобы поменять секреты позже — правишь `.env` на сервере вручную и перезапускаешь:

```bash
docker compose -f docker-compose.yml up -d --build
```

---

## Шаг 5. Секреты в GitHub

Репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Пример | Описание |
|--------|--------|----------|
| `SSH_HOST` | `123.45.67.89` | IP сервера |
| `SSH_USER` | `deploy` | SSH-пользователь |
| `SSH_PRIVATE_KEY` | содержимое `omnicom_deploy` | Приватный ключ целиком |
| `SSH_PORT` | `22` | Порт SSH (если не 22) |
| `DEPLOY_PATH` | `/opt/omnicom` | Путь к проекту на сервере |

`.env` **не** хранится в GitHub — только на сервере в `/opt/omnicom/.env`.

---

## Шаг 6. Nginx (до SSL)

На сервере:

```bash
sudo mkdir -p /var/www/certbot
sudo cp /opt/omnicom/deploy/nginx/omnicanal.http-only.conf \
  /etc/nginx/sites-available/omnicanal
sudo ln -sf /etc/nginx/sites-available/omnicanal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Первый деплой вручную (или push в `main` после секретов):

```bash
cd /opt/omnicom
# положи .env или дождись GitHub Actions
docker compose -f docker-compose.yml up --build -d
```

Проверь: http://omnicanal.storkyproduct.ru

---

## Шаг 7. SSL через Certbot

Когда сайт открывается по HTTP:

```bash
sudo certbot --nginx -d omnicanal.storkyproduct.ru
```

Certbot сам добавит HTTPS и редирект с HTTP.

Проверь автообновление:

```bash
sudo certbot renew --dry-run
```

После SSL можно переключить на полный конфиг (если certbot не всё настроил):

```bash
sudo cp /opt/omnicom/deploy/nginx/omnicanal.storkyproduct.ru.conf \
  /etc/nginx/sites-available/omnicanal
sudo nginx -t && sudo systemctl reload nginx
```

---

## Шаг 8. Как работает CI/CD

При каждом **push в `main`**:

1. GitHub Actions подключается по SSH
2. `git pull` в `/opt/omnicom`
3. `docker compose build && up -d` (читает `.env` с сервера)
4. Проверяет `/health` и фронт

Ручной запуск: **Actions** → **Deploy to production** → **Run workflow**

---

## Шаг 9. Проверка после деплоя

- https://omnicanal.storkyproduct.ru — фронт
- https://omnicanal.storkyproduct.ru/health — API
- Страница «Бот» — статус **онлайн**
- Напиши боту в Telegram — диалог в инбоксе

Логи на сервере:

```bash
cd /opt/omnicom
docker compose -f docker-compose.yml logs -f api web
```

---

## Частые проблемы

| Симптом | Решение |
|---------|---------|
| Бот «запускается» долго | На сервере добавь `TELEGRAM_PROXY_URL` в `.env` и redeploy |
| 502 Bad Gateway | `docker compose ps` — api/web Up? `curl localhost:4000/health` |
| CORS ошибка | `CORS_ORIGIN` должен быть `https://omnicanal.storkyproduct.ru` |
| WebSocket не работает | Проверь nginx `location /socket.io/` |
| Долгий build | `NPM_REGISTRY=https://registry.npmmirror.com` в `.env` |
