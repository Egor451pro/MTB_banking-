# API: семейный банкинг в Moby

Контракт между фронтом (D1) и бэкендом (D2). Меняем только через PR, который смотрят оба.
Swagger FastAPI (`/docs`) должен совпадать с этим файлом.

## Общие правила

- Базовый адрес: `http://localhost:8000`. JSON, UTF-8.
- Деньги: целое число в копейках (`amount_cents`), валюта всегда BYN. 3 BYN = `300`. В рубли переводит только фронт.
- Даты: ISO 8601 (`2026-10-20T12:00:00+03:00`), день рождения: `2012-05-14`.
- Идентификаторы: целые числа.
- Авторизации нет. Фронт шлёт заголовок `X-User-Id: <id пользователя>`, роль берётся из БД.
  Демо-пользователи после seed: `1` мама (parent), `2` Миша 10 лет (child), `3` Аня 15 лет (child).
- Ошибки: статус 4xx и тело `{"error": "<code>", "message": "<текст для человека>"}`.
  Коды: `forbidden` (403, не ваша роль или не ваша семья), `not_found` (404), `validation_error` (422), `conflict` (409).

## Справочники

| Что | Значения |
| --- | --- |
| `age_group` | `7-13`, `14-17` (считается от `birth_date`, не хранится) |
| `category` | `food`, `transport`, `games`, `subscriptions`, `shopping`, `entertainment`, `education`, `adult18` |
| `period` | `day`, `week`, `month` (границы по Europe/Minsk) |
| `decline_reason` | `card_blocked`, `category_blocked`, `online_not_allowed`, `insufficient_funds`, `limit_exceeded` |
| статус платежа | `approved`, `declined`, `pending` (ждёт родителя) |
| `type` запроса | `money`, `limit_increase`, `category_unlock` |
| статус запроса | `pending`, `approved`, `rejected` |
| статус задания | `new`, `done`, `confirmed`, `rejected` |

`adult18` и азартные игры запрещены банком всегда: родитель не может их открыть.

---

## Пользователь и семья

### GET /me
Кто я. Роль и данные текущего пользователя.

```json
{"id": 2, "role": "child", "name": "Миша", "family_id": 1, "birth_date": "2016-03-02", "age_group": "7-13"}
```

### GET /family
Только parent. Семья и дети с короткой сводкой, для главной экрана родителя.

```json
{
  "family": {"id": 1, "name": "Семья Ивановых", "plan": "basic"},
  "children": [
    {
      "id": 2, "name": "Миша", "age_group": "7-13",
      "card": {"id": 10, "last4": "4412", "balance_cents": 1250, "status": "active"},
      "pending_requests": 1,
      "level": 2
    }
  ]
}
```

### POST /family/package
Только parent. Оформление пакета: создаёт ребёнка, карту и согласия.

Запрос:
```json
{
  "child_name": "Миша",
  "child_birth_date": "2016-03-02",
  "consents": ["card_issue", "moby_access"]
}
```
Для `14-17` можно ещё `"online_payments"`. Для `7-13` онлайн-платежи не разрешены по умолчанию.

Ответ `201`:
```json
{"child_id": 2, "card_id": 10, "age_group": "7-13", "consents": ["card_issue", "moby_access"]}
```
Ошибки: `validation_error`, если возраст не 7–17 (для 18+ и до 7 пакет не выпускаем).

---

## Ребёнок и карта

### GET /children/{id}
Parent своей семьи или сам ребёнок. Всё для главного экрана.

```json
{
  "id": 2, "name": "Миша", "age_group": "7-13",
  "card": {"id": 10, "last4": "4412", "balance_cents": 1250, "status": "active"},
  "limits_today": {"limit_cents": 1000, "spent_cents": 300, "left_cents": 700},
  "level": {"level": 2, "xp": 140, "xp_to_next": 60},
  "permissions": {"online_payments": false}
}
```

### POST /children/{id}/topup
Только parent. Пополнить карту ребёнка.

Запрос: `{"amount_cents": 2000}`
Ответ: `{"balance_cents": 3250}`

### POST /cards/{id}/block и POST /cards/{id}/unblock
Только parent. Ответ: `{"id": 10, "status": "blocked"}` (или `"active"`).

---

## Лимиты

### GET /children/{id}/limits
```json
{
  "items": [
    {"id": 1, "category": null, "period": "day", "amount_cents": 1000, "is_blocked": false},
    {"id": 2, "category": "games", "period": "day", "amount_cents": 0, "is_blocked": true}
  ]
}
```
`category: null` значит общий лимит на все траты.

### PUT /children/{id}/limits
Только parent. Заменяет весь список лимитов ребёнка.

Запрос:
```json
{
  "items": [
    {"category": null, "period": "day", "amount_cents": 1500, "is_blocked": false},
    {"category": "games", "period": "day", "amount_cents": 0, "is_blocked": true}
  ]
}
```
Ответ: тот же формат, что у GET. Попытка открыть `adult18` даёт `forbidden`.

---

## Платежи (симулятор)

### POST /payments/simulate
Ребёнок «платит в магазине». Реального процессинга нет, проверяются правила банка и родителя.

Запрос:
```json
{
  "card_id": 10,
  "amount_cents": 300,
  "category": "food",
  "merchant": "Столовая школы",
  "is_online": false
}
```

Ответ `200` (любой исход возвращается как 200, исход в поле `status`):
```json
{
  "transaction_id": 55,
  "status": "approved",
  "decline_reason": null,
  "balance_cents": 950,
  "message": "Оплата прошла"
}
```
Отказ:
```json
{
  "transaction_id": 56, "status": "declined", "decline_reason": "category_blocked",
  "balance_cents": 950, "message": "Родитель запретил категорию «Игры»"
}
```
Ожидание родителя (`pending`): `"status": "pending"`, `decline_reason: null`, баланс не списан.
Порядок проверок и причины отказа описаны в плане разработки (раздел «База данных»).

### GET /children/{id}/transactions?limit=20
Новые сверху.

```json
{
  "items": [
    {"id": 55, "amount_cents": 300, "direction": "out", "category": "food",
     "merchant": "Столовая школы", "status": "approved", "decline_reason": null,
     "created_at": "2026-10-20T12:10:00+03:00"}
  ]
}
```

---

## Запросы ребёнка родителю

### POST /requests
Только child.

Запрос (деньги):
```json
{"type": "money", "amount_cents": 500, "comment": "На экскурсию"}
```
Запрос (лимит): `{"type": "limit_increase", "amount_cents": 2000, "comment": ""}`
Запрос (категория): `{"type": "category_unlock", "category": "subscriptions", "comment": ""}`

Ответ `201`: `{"id": 7, "status": "pending"}`

### GET /requests?status=pending
Parent: запросы всех своих детей. Child: только свои.

```json
{
  "items": [
    {"id": 7, "child_id": 2, "child_name": "Миша", "type": "money",
     "amount_cents": 500, "category": null, "comment": "На экскурсию",
     "status": "pending", "created_at": "2026-10-20T12:20:00+03:00"}
  ]
}
```

### POST /requests/{id}/approve и POST /requests/{id}/reject
Только parent. Approve сам применяет эффект: `money` пополняет карту, `limit_increase` меняет общий лимит, `category_unlock` снимает запрет категории.

Ответ: `{"id": 7, "status": "approved"}`

---

## Цели и копилка

### POST /goals
Только child.
Запрос: `{"title": "Велосипед", "target_cents": 30000}`
Ответ `201`: `{"id": 4, "title": "Велосипед", "target_cents": 30000, "saved_cents": 0, "status": "active"}`

### GET /children/{id}/goals
```json
{"items": [{"id": 4, "title": "Велосипед", "target_cents": 30000, "saved_cents": 5000,
            "parent_bonus_percent": 10, "status": "active"}]}
```

### POST /goals/{id}/deposit
Только child. Перекладывает деньги с карты в цель.
Запрос: `{"amount_cents": 1000}`
Ответ: `{"saved_cents": 6000, "card_balance_cents": 2250, "status": "active"}`

### PUT /goals/{id}/bonus
Только parent. Процент, который родитель добавляет к накоплениям: `{"parent_bonus_percent": 10}`.

---

## Задания

### POST /tasks
Только parent.
Запрос: `{"assigned_to": 2, "title": "Убрать в комнате", "reward_cents": 200, "xp_reward": 30, "due_date": "2026-10-22"}`
Ответ `201`: `{"id": 9, "status": "new"}`

### GET /tasks?child_id=2
Parent видит задания своих детей, child только свои.

```json
{"items": [{"id": 9, "assigned_to": 2, "title": "Убрать в комнате", "reward_cents": 200,
            "xp_reward": 30, "status": "new", "due_date": "2026-10-22"}]}
```

### POST /tasks/{id}/done
Только child. Ответ: `{"id": 9, "status": "done"}`

### POST /tasks/{id}/confirm и POST /tasks/{id}/reject
Только parent. При confirm: деньги за задание идут на карту ребёнка (платит родитель), ребёнку начисляется XP, уровень пересчитывается.
Ответ confirm: `{"id": 9, "status": "confirmed", "balance_cents": 1450, "xp": 170, "level": 2}`

---

## Уровни доверия

### GET /children/{id}/level
```json
{
  "level": 2,
  "xp": 140,
  "xp_to_next": 60,
  "unlocked": ["day_limit_up_to_15_byn"],
  "next_unlocks": ["category_subscriptions", "online_payments_with_confirmation"],
  "suggestion": {
    "id": "s-2-3",
    "text": "Миша достиг уровня 3. Разрешить подписки до 5 BYN в месяц?",
    "action": "category_unlock",
    "category": "subscriptions"
  }
}
```
`suggestion` равен `null`, если предложений нет. Видит и ребёнок (без кнопок), и родитель.

### POST /children/{id}/level/suggestion/accept
Только parent. Применяет предложение из `suggestion` (меняет лимиты или права).
Ответ: `{"applied": true}`

---

## Служебное

### POST /demo/reset
Возвращает демо-данные в исходное состояние (мама, Миша, Аня, история операций). Нужно перед защитой.
Ответ: `{"status": "ok"}`

### GET /health
Ответ: `{"status": "ok"}`

---

## Сценарий демо и эндпоинты

| Шаг | Кто | Вызовы |
| --- | --- | --- |
| 1. Родитель пополняет карту, ставит лимит, запрещает «Игры» | parent | `POST /children/2/topup`, `PUT /children/2/limits` |
| 2. Ребёнок платит в столовой (ок) и пытается купить игру (отказ) | child | `POST /payments/simulate` ×2 |
| 3. Ребёнок просит поднять лимит, родитель одобряет | child, parent | `POST /requests`, `POST /requests/7/approve` |
| 4. Ребёнок делает задание, родитель подтверждает, растёт уровень | child, parent | `POST /tasks/9/done`, `POST /tasks/9/confirm`, `GET /children/2/level` |

---

## Дополнение: функции из ТЗ (v2)

Всё ниже уже работает во фронте на mock (`frontend/src/api/mock.ts`) — это эталон поведения.

### Подтверждение покупок родителем
Крупная онлайн-покупка (> 20 BYN) получает статус `pending` и ждёт родителя.

`GET /purchases/pending` — parent: покупки детей своей семьи, child: свои.
```json
{"items": [{"id": 6, "amount_cents": 2500, "direction": "out", "category": "shopping", "merchant": "Магазин одежды",
  "status": "pending", "decline_reason": null, "created_at": "2026-10-20T12:07:00+00:00", "child_id": 3, "child_name": "Аня"}]}
```

`POST /transactions/{id}/approve` — parent. Перед списанием заново проверить карту и баланс:
карта заблокирована → `declined` + `card_blocked`; не хватает денег → `declined` + `insufficient_funds`;
иначе списать, начислить кешбэк баллами, статус `approved`.
`POST /transactions/{id}/decline` — parent, статус `declined`.
Ответ обоих: `{"id": 6, "status": "approved", "balance_cents": 1800, "message": "Покупка подтверждена"}`.
Если операция не `pending` → 409 `conflict`.

### Карманные деньги
`GET /children/{id}/allowance` → `{"amount_cents": 1000, "period": "week", "active": true, "next_date": "2026-10-26"}`
(`period`: `day` | `week`; `next_date` — завтра или ближайший понедельник, `null` если выключено).
`PUT /children/{id}/allowance` — parent, тело `{"amount_cents": 1000, "period": "week", "active": true}`; при `active` сумма > 0.
`POST /children/{id}/allowance/pay` — parent, демо «выплатить сейчас»: пополнить карту, операция `in` с merchant «Карманные деньги». Ответ `{"balance_cents": 2250}`.

### Права ребёнка в Moby
Ключи: `online_payments`, `goals`, `virtual_card`, `savings`, `partner_offers`.

`GET /children/{id}/permissions`
```json
{"items": [{"key": "online_payments", "enabled": false, "locked_reason": "Доступно с 14 лет"},
           {"key": "goals", "enabled": true, "locked_reason": null}]}
```
`online_payments` для 7–13 лет всегда `enabled: false` с `locked_reason`.
`PUT /children/{id}/permissions` — parent, тело `{"items": [{"key": "goals", "enabled": false}]}` (меняются только переданные ключи).
Включить право с `locked_reason` → 403.

Права влияют на логику:
- `online_payments` — правило `online_not_allowed` в `/payments/simulate` (вместо согласия из пакета);
- `goals` выключено → `POST /goals` отвечает 403 «Цели выключены родителем — попроси доступ»;
- `partner_offers` выключено → в `GET /loyalty` у ребёнка пустой `offers`, `redeem` → 403.

Хранить можно в таблице `consents` (`consent_type` = ключ права): право включено ⇔ строка есть.

Новый тип запроса: `POST /requests` с `{"type": "product_access", "permission": "savings", "comment": "..."}`.
В `GET /requests` у элементов появляется поле `permission`. `approve` включает право (если оно не закрыто по возрасту).

### Уроки финансовой грамотности
`GET /lessons` (child — свой прогресс; parent — `?child_id=2`)
```json
{"items": [{"id": 1, "title": "Что такое бюджет", "description": "...", "content": ["абзац", "абзац"],
  "question": "У тебя 10 BYN на неделю...", "options": ["...", "...", "..."], "xp_reward": 20, "points_reward": 50, "completed": false}]}
```
Правильный ответ в ответе API не отдаётся.
`POST /lessons/{id}/answer` — child, тело `{"option_index": 1}`.
Ответ: `{"correct": true, "explanation": "...", "xp": 120, "level": 3, "points": 390}`.
Награда (XP + баллы) начисляется один раз — за первый правильный ответ. 4 урока — в `LESSONS` в `mock.ts`.

### Программа лояльности (1 балл = 1 копейка)
`GET /loyalty` — свои баллы; parent может `?child_id=2`.
```json
{"points": 340, "cashback": [{"category": "education", "percent": 5}],
 "offers": [{"id": 2, "partner": "Книжный магазин", "title": "Скидка 10% на книги", "description": "...", "audience": "child", "points_cost": 150}]}
```
Кешбэк начисляется ребёнку при одобренной покупке: `floor(amount_cents * percent / 100)` баллов.
Категории: education 5%, transport 3%, food 2%, entertainment 2%.
`offers`: ребёнку — `child` и `family`, родителю — `parent` и `family`.
`POST /loyalty/offers/{id}/redeem` — списать `points_cost`, ответ `{"points": 190, "code": "MT-21234"}`; не хватает баллов → 422.
Баллы хранить в `User.points` (поле уже есть).

### Потеря карты
`POST /cards/{id}/reissue` — parent: перевыпуск (новые `last4`, статус `active`, баланс сохраняется).
Ответ `{"id": 1, "last4": "5821", "status": "active"}`.

### Уровни
`GET /children/{id}/level` и `/level/suggestion/accept` фронт больше не использует — уровень берётся из `GET /children/{id}`.

### Правовые правила (см. docs/legal.md)
- `POST /family/package`: обязательные согласия `card_issue`, `moby_access`, `personal_data`; для 14–17 ещё `teen_info_sharing`.
  Нет обязательного согласия → 422. `online_payments` для 7–13 → 422.
- Права: `online_payments` и `virtual_card` для 7–13 лет закрыты (`locked_reason: "Доступно с 14 лет"`).
- `partner_offers` у нового ребёнка по умолчанию выключено — включает родитель.

## Бонус родителя к накоплениям

Родитель ставит процент в `PUT /goals/{id}/bonus` (0–100). Бонус начисляется **сразу при каждом взносе** `POST /goals/{id}/deposit`: `взнос × процент / 100`, с округлением вниз.

- Бонус входит в `saved_cents` цели, с карты ребёнка списывается только сам взнос.
- Лимит бонуса: 10 BYN (1000 копеек) в месяц на ребёнка, месяц считается по Минску. Когда лимит исчерпан, бонус равен 0, взнос проходит как обычно.
- Ответ на взнос: `bonus_cents` (бонус за этот взнос) и `bonus_left_cents` (остаток лимита месяца).
- `GET /children/{id}/goals`: у каждой цели `bonus_cents` (сколько бонуса уже внутри накоплений), а в корне `bonus_month_cap_cents` и `bonus_month_left_cents`.
- Бонус называется «бонус родителя к накоплениям», а не процентом по вкладу: это подарок родителя, а не продукт банка.
