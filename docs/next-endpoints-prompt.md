# Промпт для Cursor: следующие эндпоинты бэкенда

Контекст: ты дорабатываешь FastAPI-бэкенд `backend/` хакатонного проекта
"Семейный банкинг в Moby". Уже реализованы `GET /me`, `GET /family`,
`GET /children/{id}`, и весь блок `goals` (`GET /children/{id}/goals`,
`POST /goals`, `POST /goals/{id}/deposit`, `PUT /goals/{id}/bonus`).
Пиши новый код в том же стиле: роутер тонкий, логика — в
`app/services/*_service.py`, Pydantic-схемы — в `app/schemas/*.py`,
доступ — через `app/deps.py` (`get_current_user`, `require_parent`,
`require_child`, `check_family_access`). Ошибки просто кидай как
`HTTPException(status_code=..., detail={"error": "...", "message": "..."})`
— единый формат ответа уже настроен централизованно в `main.py`.

Контракт — `docs/api.md`, обязателен один в один (пути, тела запросов,
коды ошибок), потому что фронтенд (`frontend/src/api/real.ts`) уже
написан под него. Эталонная бизнес-логика — `frontend/src/api/mock.ts`
(особенно порядок правил в функции `decide` для оплаты).

Деньги — всегда `int` в копейках (`*_cents`). Возраст считается из
`birth_date`, не хранится отдельно. Пользователь — из заголовка
`X-User-Id`.

## Известный баг, почини сразу

В `app/services/user_service.py`, функция `get_child_profile`, подсчёт
трат за сегодня сравнивает aware-datetime (`Europe/Minsk`) с полем
`Transaction.created_at`, которое хранится как наивный UTC
(`datetime.utcnow()`). Сравнение будет врать на границе суток. Исправь:
переведи `start_of_day` в наивный UTC перед запросом:
```python
start_of_day_utc = start_of_day.astimezone(pytz.utc).replace(tzinfo=None)
```
и используй его в фильтре. Добавь тест: транзакция, созданная в 23:30
по Минску вчера (= 20:30 UTC), не должна попадать в "сегодня" по Минску
после полуночи.

## Реализуй по порядку, отдельными коммитами

1. **Лимиты (limits)**
   - `GET /children/{id}/limits` → `{"items": [...]}`
   - `PUT /children/{id}/limits` (полная замена списка)
   - Модель `Limit` уже есть в `app/models/models.py`.
   - Категория `adult18` — всегда заблокирована, запрети её разблокировку
     на уровне бэкенда (403 `forbidden`), не полагайся только на фронт.

2. **Оплата (payments) — самое важное для демо**
   - `POST /payments/simulate`
   - Порядок проверок строго как в `docs/api.md` и `mock.ts` (функция
     `decide`): card_blocked → category_blocked → online_not_allowed →
     insufficient_funds → limit_exceeded → pending (крупный онлайн) →
     approved.
   - При `approved` — списать с карты и создать `Transaction`
     (используй ту же функцию расчёта "трат за сегодня", что в п.0,
     после исправления бага).

3. **Запросы ребёнка (requests)**
   - `POST /requests`, `GET /requests`, `POST /requests/{id}/approve`,
     `POST /requests/{id}/reject`
   - `approve` должен применять эффект запроса (пополнить карту, поднять
     лимит, разблокировать категорию, кроме `adult18`) — как в `mock.ts`.

4. **Задания (tasks)**
   - `POST /tasks`, `GET /tasks`, `POST /tasks/{id}/done`,
     `POST /tasks/{id}/confirm`, `POST /tasks/{id}/reject`
   - `confirm` → выплатить `reward_cents` на карту и начислить
     `xp_reward` ребёнку (поле `User.xp` уже есть, уровень считается
     через `UserService.calculate_level`, он уже написан).

5. **Транзакции и выпуск пакета**
   - `GET /children/{id}/transactions`
   - `POST /family/package` (оформление нового ребёнка: имя, дата
     рождения, согласия — создаёт `User`, `Account`, базовые `Limit`,
     `Consent`)
   - `POST /demo/reset` (пересеять демо-данные по аналогии с
     `python -m app.seed`, но доступно по HTTP)

## Не делай (пока)

`GET /children/{id}/level` эндпоинт из `api.md` с полями `unlocked`,
`next_unlocks`, `suggestion` и `POST /children/{id}/level/suggestion/accept`
— **не реализуй**, мы пересматриваем эту механику (возможно, уберём
автоматические предложения системы совсем). `level` (level/xp/xp_to_next)
уже и так отдаётся внутри `GET /children/{id}` — этого пока достаточно.

## Проверка после каждого пункта
- В `frontend/.env` указать `VITE_API_URL=http://localhost:8000`,
  открыть соответствующий экран во фронте — он должен перестать падать
  с 404.
- Тесты по образцу `backend/tests/test_goals.py`.
