# Промпт для Cursor: функции из ТЗ (v2)

Контекст: FastAPI-бэкенд `backend/` проекта «Семейный банкинг в Moby». Все эндпоинты из основной
части `docs/api.md` уже реализованы. Добавь функции из раздела
**«Дополнение: функции из ТЗ (v2)»** в конце `docs/api.md` — пути, тела и ответы один в один.
Фронт уже вызывает их (`frontend/src/api/real.ts`), эталон логики — `frontend/src/api/mock.ts`
(ищи по названиям методов: approvePurchase, getAllowance, getPermissions, answerLesson, getLoyalty, reissueCard).

Стиль как в существующем коде: роутер тонкий, логика в `app/services/*_service.py`, схемы в
`app/schemas/*.py`, доступ через `app/deps.py`, ошибки `HTTPException(detail={"error","message"})`,
`created_at` отдавать с UTC (как уже сделано в `TransactionItem`). Деньги — копейки.

## По порядку, отдельными коммитами, с тестами

1. **Подтверждение покупок**: `GET /purchases/pending`, `POST /transactions/{id}/approve`, `/decline`.
   При approve заново проверить блокировку карты и баланс.
2. **Права ребёнка**: `GET/PUT /children/{id}/permissions` (хранить в `consents`).
   Переведи правило `online_not_allowed` в `PaymentService` на право `online_payments`.
   `POST /goals` → 403, если право `goals` выключено. Новый тип запроса `product_access`
   с полем `permission` (добавь колонку в `AccessRequest`), approve включает право.
   Сид: Миша — goals, partner_offers; Аня — online_payments, goals, savings, partner_offers.
3. **Карманные деньги**: `GET/PUT /children/{id}/allowance`, `POST /children/{id}/allowance/pay`.
   Новая таблица `allowances(child_id, amount_cents, period, active)`. Сид: Миша 10 BYN/неделя, Аня 20 BYN/неделя.
4. **Уроки**: `GET /lessons`, `POST /lessons/{id}/answer`. Модели `Lesson`, `LessonProgress` уже есть —
   добавь в `Lesson` поля `content` (JSON-список абзацев), `question`, `options` (JSON), `answer_index`,
   `explanation`, `points_reward`. Сид — 4 урока из `LESSONS` в `mock.ts`; у Ани пройдены уроки 1 и 3.
5. **Лояльность**: `GET /loyalty`, `POST /loyalty/offers/{id}/redeem`. Баллы в `User.points`
   (сид: мама 1250, Миша 340, Аня 820). Кешбэк начислять в `PaymentService` при `approved`
   и при подтверждении pending-покупки. Партнёры и кешбэк-категории — константы, как в `mock.ts`.
6. **Перевыпуск карты**: `POST /cards/{id}/reissue`.
7. Сид: добавь Ане pending-покупку «Магазин одежды», 25 BYN, shopping, онлайн, 40 минут назад —
   она нужна для демо подтверждения.

## Проверка
`pytest`, затем фронт с `VITE_API_URL=/api`: Мама → «Запросы» → подтвердить покупку Ани;
Миша → «Награды» → пройти урок → вырос XP и баллы; Мама → Миша → «Права» → выключить «Цели» →
у Миши на вкладке «Цели» появляется «Попросить доступ».
