# Промпт для Cursor: следующие эндпоинты бэкенда

Контекст: ты дорабатываешь FastAPI-бэкенд `backend/` хакатонного проекта
"Семейный банкинг в Moby". Уже реализованы `GET /me`, `GET /family`,
`GET /children/{id}` в `app/routers/user.py` и `app/routers/family.py`,
по образцу которых нужно писать новый код (тот же стиль: роутер тонкий,
логика — в `app/services/*_service.py`, валидация и сериализация — в
`app/schemas/*.py`, доступ проверяется через `app/deps.py`).

Полный контракт — `docs/api.md`. Он обязателен: пути, тела запросов, коды
ошибок `{"error", "message"}` должны совпадать с ним один в один, потому
что фронтенд (`frontend/src/api/real.ts`) уже написан под этот контракт.
Эталонная бизнес-логика (особенно порядок правил при оплате) есть в
`frontend/src/api/mock.ts` — подглядывай туда, если неясно, как должна
вести себя проверка.

Деньги — всегда `int` в копейках (поля `*_cents`). Возраст считается из
`birth_date`, не хранится отдельно. Пользователь определяется по заголовку
`X-User-Id` (см. `get_current_user` в `deps.py`).

## Реализуй по порядку, отдельными коммитами

1. **Цели (goals)**
   - `GET /children/{id}/goals` → `{"items": [...]}`
   - `POST /goals` (ребёнок создаёт цель)
   - `POST /goals/{id}/deposit` (списать с карты, добавить в `saved_cents`,
     если `saved_cents >= target_cents` → статус `done`)
   - `PUT /goals/{id}/bonus` (родитель задаёт `parent_bonus_percent`)
   - Модель `Goal` уже есть в `app/models/models.py`.

2. **Уровень доверия (level)**
   - `GET /children/{id}/level` → `{level, xp, xp_to_next, unlocked, next_unlocks, suggestion}`
   - `POST /children/{id}/level/suggestion/accept`
   - Пороги XP и список разблокировок — придумай по аналогии с mock.ts
     (`XP_STEPS`, `UNLOCKS`), согласуй текст с фронтом при необходимости.

3. **Лимиты (limits)**
   - `GET /children/{id}/limits` → `{"items": [...]}`
   - `PUT /children/{id}/limits` (полная замена списка)
   - Модель `Limit` уже есть. Категория `adult18` — всегда заблокирована,
     запрети её разблокировку на уровне бэкенда (403), не только на фронте.

4. **Оплата (payments) — самое важное для демо**
   - `POST /payments/simulate`
   - Порядок проверок строго как в `docs/api.md` и `mock.ts` функция `decide`:
     card_blocked → category_blocked → online_not_allowed →
     insufficient_funds → limit_exceeded → pending (крупный онлайн) → approved
   - При approved — списать с карты и создать `Transaction`.

5. **Запросы ребёнка (requests)**
   - `POST /requests`, `GET /requests`, `POST /requests/{id}/approve`,
     `POST /requests/{id}/reject`
   - `approve` должен применять эффект запроса (пополнить, поднять лимит,
     разблокировать категорию) — как в `mock.ts`.

6. **Задания (tasks)**
   - `POST /tasks`, `GET /tasks`, `POST /tasks/{id}/done`,
     `POST /tasks/{id}/confirm`, `POST /tasks/{id}/reject`
   - `confirm` → выплатить `reward_cents` на карту и начислить `xp_reward`
     ребёнку, пересчитать уровень.

7. **Транзакции и выпуск пакета**
   - `GET /children/{id}/transactions`
   - `POST /family/package` (оформление нового ребёнка в пакет)
   - `POST /demo/reset` (пересеять демо-данные, как `python -m app.seed`,
     но доступно по HTTP для демонстрации)

## Проверка после каждого пункта
- В `frontend/.env` указать `VITE_API_URL=http://localhost:8000` и открыть
  соответствующий экран во фронте — он должен перестать падать с 404.
- Писать тесты по образцу `backend/tests/test_children.py`.
