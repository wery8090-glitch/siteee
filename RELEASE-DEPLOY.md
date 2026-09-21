# CHROMA — финальный релиз сайта

Этот архив уже содержит последнюю проверенную версию сайта, новый Admin Control Room, систему кодов, роли и Supp-panel.

## Быстрый upload в Vercel

1. Создайте новый Project в Vercel и импортируйте этот репозиторий/архив.
2. Укажите **Root Directory** как корень проекта, где находятся `package.json`, `vercel.json`, `api/` и `client/`.
3. Build Command: `pnpm build:vercel`.
4. Output Directory: `public`.
5. Install Command: `pnpm install --frozen-lockfile`.
6. После добавления переменных нажмите Deploy/Redeploy. Конфигурация уже находится в `vercel.json`, поэтому при запуске `vercel` вручную дополнительные параметры не нужны.

## Обязательные Environment Variables

Добавьте в Vercel Production и Preview:

```text
DATABASE_URL=<MySQL/TiDB connection string для Drizzle таблиц>
JWT_SECRET=<длинная случайная строка>
OWNER_OPEN_ID=<UUID аккаунта владельца Supabase>
OWNER_NAME=<имя владельца>
APP_URL=<production URL сайта>
VITE_SUPABASE_URL=https://rsbcqzeyiazogktztubu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_URL=https://rsbcqzeyiazogktztubu.supabase.co
SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_SECRET_KEY=<Supabase secret/service key только server-side>
SUPABASE_JWKS_URL=https://rsbcqzeyiazogktztubu.supabase.co/auth/v1/.well-known/jwks.json
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
VITE_APP_ID=<Manus OAuth app id>
```

**SUPABASE_SECRET_KEY и DATABASE_URL нельзя добавлять в frontend-переменные `VITE_*`.**

## Что проверить после deploy

Откройте:

- `/api/loader/health` — должен вернуть JSON с `ok: true`.
- `/login` — вход через Supabase.
- `/dashboard/subscription` — активация кода.
- `/admin` — новый Control Room для Developer/Admin.
- `/support/panel` — Supp-panel для staff.

## Первый Developer

Значение `OWNER_OPEN_ID` должно совпадать с UUID пользователя Supabase. При синхронизации профиля этот аккаунт получает роль `developer`. Если профиль уже существует, роль можно проверить в таблице `profiles` и через страницу `/admin/users`.

## Система кодов

В Control Room откройте вкладку **Коды доступа**. Можно выбрать `base`, `premium`, `premium_beta`, `tester` или `media`, указать число активаций и дату окончания. Формат может быть стандартным `CHROMA-XXXXX-XXXXX-XXXXX` или собственным, например `FREEKEY`. Открытый код показывается один раз; сервер хранит hash.

## Последняя локальная проверка

- `pnpm check` — успешно.
- Тесты authorization/config/logout — 5/5 успешно.
- `pnpm build` — успешно.
- `git diff --check` — успешно.
- Финальный локальный commit: `7109ecf`.

Если проект импортируется из GitHub, используйте commit `7109ecf` или более новый commit из ветки `main`.
