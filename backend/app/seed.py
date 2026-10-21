"""
Скрипт инициализации демо-данных для базы данных.
Создает семью с мамой, Мишей (10 лет) и Аней (15 лет), карты, лимиты и транзакции.
Поддерживает повторный запуск (очищает данные перед заполнением).
"""
import asyncio
import sys
from datetime import datetime, timedelta, date
from sqlalchemy import delete
import pytz

def _log(msg: str) -> None:
    try:
        print(msg)
    except UnicodeEncodeError:
        encoding = getattr(sys.stdout, "encoding", None) or "cp1251"
        print(msg.encode(encoding, errors="replace").decode(encoding, errors="replace"))

from app.db import AsyncSessionLocal, Base, engine
from app.models import (
    Family, User, UserRole, Account, AccountType, AccountStatus,
    Limit, LimitPeriod, Transaction, TransactionDirection, TransactionStatus,
    Consent, Goal, GoalBonus, GoalStatus, Task, TaskStatus, AccessRequest, RequestStatus, RequestType,
    Allowance, Lesson, LessonProgress,
)


async def clear_all_tables(session):
    """Очищает все таблицы перед заполнением"""
    _log("Очистка таблиц...")
    
    # Порядок важен из-за внешних ключей
    await session.execute(delete(LessonProgress))
    await session.execute(delete(Lesson))
    await session.execute(delete(AccessRequest))
    await session.execute(delete(Task))
    await session.execute(delete(GoalBonus))
    await session.execute(delete(Goal))
    await session.execute(delete(Transaction))
    await session.execute(delete(Limit))
    await session.execute(delete(Consent))
    await session.execute(delete(Allowance))
    await session.execute(delete(Account))
    await session.execute(delete(User))
    await session.execute(delete(Family))
    
    await session.commit()
    _log("Таблицы очищены")


async def seed_data(eng=None, maker=None):
    """Наполняет БД демо-данными. eng/maker — база конкретной демо-песочницы, по умолчанию общая app.db"""
    eng = eng or engine
    maker = maker or AsyncSessionLocal
    _log("Начинаем заполнение базы данных...")
    
    # Пересоздаём схему: seed полностью заменяет данные, так подхватываются новые колонки.
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    async with maker() as session:
        # Очищаем таблицы
        await clear_all_tables(session)
        
        # 1. Создаем семью
        _log("Создаем семью...")
        family = Family(
            id=1,
            name="Семья Ивановых",
            plan="basic"
        )
        session.add(family)
        await session.flush()
        
        # 2. Создаем пользователей
        _log("Создаем пользователей...")
        
        # Мама (parent, id=1)
        mama = User(
            id=1,
            family_id=family.id,
            role=UserRole.PARENT,
            name="Мама",
            birth_date=date(1988, 4, 10),
            xp=0,
            level=1,
            points=1250
        )
        session.add(mama)
        
        # Миша (child, id=2, 10 лет)
        misha = User(
            id=2,
            family_id=family.id,
            role=UserRole.CHILD,
            name="Миша",
            birth_date=date(2016, 3, 2),
            xp=100,
            level=2,
            points=340
        )
        session.add(misha)
        
        # Аня (child, id=3, 15 лет)
        anya = User(
            id=3,
            family_id=family.id,
            role=UserRole.CHILD,
            name="Аня",
            birth_date=date(2011, 6, 20),
            xp=260,
            level=3,
            points=820
        )
        session.add(anya)
        
        await session.flush()
        
        # 3. Создаем согласия (consents)
        _log("Создаем согласия...")
        
        # Для Миши (7-13 лет) — без онлайн-платежей; права: goals, partner_offers
        session.add(Consent(child_id=misha.id, consent_type="card_issue"))
        session.add(Consent(child_id=misha.id, consent_type="moby_access"))
        session.add(Consent(child_id=misha.id, consent_type="personal_data"))
        session.add(Consent(child_id=misha.id, consent_type="goals"))
        session.add(Consent(child_id=misha.id, consent_type="partner_offers"))
        
        # Для Ани (14-17 лет): online_payments, goals, savings, partner_offers
        session.add(Consent(child_id=anya.id, consent_type="card_issue"))
        session.add(Consent(child_id=anya.id, consent_type="moby_access"))
        session.add(Consent(child_id=anya.id, consent_type="personal_data"))
        session.add(Consent(child_id=anya.id, consent_type="teen_info_sharing"))
        session.add(Consent(child_id=anya.id, consent_type="online_payments"))
        session.add(Consent(child_id=anya.id, consent_type="goals"))
        session.add(Consent(child_id=anya.id, consent_type="savings"))
        session.add(Consent(child_id=anya.id, consent_type="virtual_card"))
        session.add(Consent(child_id=anya.id, consent_type="partner_offers"))
        
        # 3b. Карманные деньги: Миша 10 BYN/неделя, Аня 20 BYN/неделя
        _log("Создаём карманные деньги...")
        session.add(Allowance(child_id=misha.id, amount_cents=1000, period="week", active=True))
        session.add(Allowance(child_id=anya.id, amount_cents=2000, period="week", active=True))

        # 4. Создаем карты
        _log("Создаем карты...")
        
        misha_card = Account(
            id=10,
            owner_id=misha.id,
            type=AccountType.CARD,
            balance_cents=1250,  # 12.50 BYN
            currency="BYN",
            status=AccountStatus.ACTIVE,
            card_last4="4412"
        )
        session.add(misha_card)
        
        anya_card = Account(
            id=11,
            owner_id=anya.id,
            type=AccountType.CARD,
            balance_cents=4300,  # 43.00 BYN
            currency="BYN",
            status=AccountStatus.ACTIVE,
            card_last4="7781"
        )
        session.add(anya_card)
        
        await session.flush()
        
        # 5. Создаем лимиты
        _log("Создаем лимиты...")
        
        # Лимиты для Миши
        session.add(Limit(
            child_id=misha.id,
            category=None,  # Общий лимит
            period=LimitPeriod.DAY,
            amount_cents=1000,  # 10 BYN в день
            is_blocked=False
        ))
        session.add(Limit(
            child_id=misha.id,
            category="games",
            period=LimitPeriod.DAY,
            amount_cents=0,
            is_blocked=True  # Игры запрещены
        ))
        session.add(Limit(
            child_id=misha.id,
            category="subscriptions",
            period=LimitPeriod.DAY,
            amount_cents=0,
            is_blocked=True  # Подписки запрещены
        ))
        
        # Лимиты для Ани
        session.add(Limit(
            child_id=anya.id,
            category=None,  # Общий лимит
            period=LimitPeriod.DAY,
            amount_cents=2500,  # 25 BYN в день
            is_blocked=False
        ))
        session.add(Limit(
            child_id=anya.id,
            category="games",
            period=LimitPeriod.DAY,
            amount_cents=0,
            is_blocked=True  # Игры запрещены
        ))
        
        # 6. Создаем транзакции
        _log("Создаем транзакции...")
        
        minsk_tz = pytz.timezone("Europe/Minsk")
        now = datetime.now(minsk_tz)
        
        def minutes_ago(minutes: int) -> datetime:
            return now - timedelta(minutes=minutes)
        
        # Транзакции для Миши
        transactions_misha = [
            # Пополнение от родителя
            Transaction(
                account_id=misha_card.id,
                amount_cents=2000,
                direction=TransactionDirection.IN,
                category=None,
                merchant="Пополнение от родителя",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
                created_at=minutes_ago(60 * 26)
            ),
            # Оплата в столовой
            Transaction(
                account_id=misha_card.id,
                amount_cents=300,
                direction=TransactionDirection.OUT,
                category="food",
                merchant="Столовая школы",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
                created_at=minutes_ago(60 * 25)
            ),
            # Оплата автобуса
            Transaction(
                account_id=misha_card.id,
                amount_cents=120,
                direction=TransactionDirection.OUT,
                category="transport",
                merchant="Автобус",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
                created_at=minutes_ago(60 * 24)
            ),
            # Попытка купить игру (отказ)
            Transaction(
                account_id=misha_card.id,
                amount_cents=1500,
                direction=TransactionDirection.OUT,
                category="games",
                merchant="Игровой магазин",
                is_online=False,
                status=TransactionStatus.DECLINED,
                decline_reason="category_blocked",
                created_at=minutes_ago(60 * 5)
            ),
            # Еще пара операций
            Transaction(
                account_id=misha_card.id,
                amount_cents=150,
                direction=TransactionDirection.OUT,
                category="food",
                merchant="Магазин у школы",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
                created_at=minutes_ago(60 * 3)
            ),
            Transaction(
                account_id=misha_card.id,
                amount_cents=180,
                direction=TransactionDirection.OUT,
                category="transport",
                merchant="Автобус",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
                created_at=minutes_ago(60 * 2)
            ),
        ]
        
        # Транзакции для Ани
        transactions_anya = [
            # Пополнение
            Transaction(
                account_id=anya_card.id,
                amount_cents=5000,
                direction=TransactionDirection.IN,
                category=None,
                merchant="Пополнение от родителя",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
                created_at=minutes_ago(60 * 20)
            ),
            # Покупка в кофейне
            Transaction(
                account_id=anya_card.id,
                amount_cents=500,
                direction=TransactionDirection.OUT,
                category="food",
                merchant="Кофейня",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
                created_at=minutes_ago(60 * 3)
            ),
            # Покупка канцелярии
            Transaction(
                account_id=anya_card.id,
                amount_cents=200,
                direction=TransactionDirection.OUT,
                category="education",
                merchant="Книжный магазин",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
                created_at=minutes_ago(60 * 1)
            ),
            # Крупная онлайн-покупка ждёт подтверждения мамы (демо «Запросы»)
            Transaction(
                account_id=anya_card.id,
                amount_cents=2500,
                direction=TransactionDirection.OUT,
                category="shopping",
                merchant="Магазин одежды",
                is_online=True,
                status=TransactionStatus.PENDING,
                decline_reason=None,
                created_at=minutes_ago(40)
            ),
        ]
        
        for tx in transactions_misha + transactions_anya:
            session.add(tx)
        
        # 7. Создаем цели (goals)
        _log("Создаем цели...")
        
        session.add(Goal(
            child_id=misha.id,
            title="Велосипед",
            target_cents=30000,  # 300 BYN
            saved_cents=5000,    # 50 BYN накоплено
            parent_bonus_percent=10,
            status=GoalStatus.ACTIVE
        ))
        
        # 8. Создаем задания (tasks)
        _log("Создаем задания...")
        
        session.add(Task(
            assigned_to=misha.id,
            title="Убрать в комнате",
            reward_cents=200,
            xp_reward=30,
            status=TaskStatus.NEW,
            due_date=None
        ))
        
        session.add(Task(
            assigned_to=misha.id,
            title="Вынести мусор",
            reward_cents=100,
            xp_reward=15,
            status=TaskStatus.DONE,
            due_date=None
        ))
        
        # 9. Создаем запросы (access_requests)
        _log("Создаем запросы...")
        
        session.add(AccessRequest(
            child_id=misha.id,
            type=RequestType.MONEY,
            amount_cents=500,
            category=None,
            comment="На экскурсию",
            status=RequestStatus.PENDING,
            created_at=minutes_ago(20)
        ))

        # 10. Уроки финансовой грамотности (как LESSONS в mock.ts)
        _log("Создаём уроки...")
        lessons = [
            Lesson(
                id=1,
                title="Что такое бюджет",
                description="Как распределить карманные деньги на неделю",
                content=[
                    "Бюджет — это план: сколько денег есть и на что их потратить.",
                    "Если разделить деньги на дни недели, их хватит до следующих карманных.",
                ],
                question="У тебя 10 BYN на неделю. Как поступить разумнее?",
                options=["Потратить всё в понедельник", "Разделить на каждый день", "Отдать другу на хранение"],
                answer_index=1,
                explanation="По 1–2 BYN в день — и денег хватит на всю неделю.",
                xp_reward=20,
                points_reward=50,
            ),
            Lesson(
                id=2,
                title="Как копить на цель",
                description="Считаем, сколько недель копить на мечту",
                content=[
                    "Цель — это сумма и срок. Чем больше откладываешь, тем быстрее её достигнешь.",
                    "Родитель может добавить бонус к накоплениям — так копится быстрее.",
                ],
                question="Велосипед стоит 300 BYN, ты откладываешь 10 BYN в неделю. Сколько недель копить?",
                options=["10 недель", "30 недель", "300 недель"],
                answer_index=1,
                explanation="300 ÷ 10 = 30 недель. С бонусом родителя получится быстрее.",
                xp_reward=20,
                points_reward=50,
            ),
            Lesson(
                id=3,
                title="Осторожно, мошенники",
                description="Почему код из СМС нельзя называть никому",
                content=[
                    "Мошенники обещают призы и просят код из СМС или данные карты.",
                    "Банк никогда не спрашивает код. Если просят — это обман.",
                ],
                question="Тебе пишут: «Назови код из СМС и получишь приз». Что делать?",
                options=["Назвать код", "Никому не сообщать и рассказать родителю", "Переслать сообщение другу"],
                answer_index=1,
                explanation="Код из СМС — ключ к твоим деньгам. Не сообщай его никому и покажи сообщение родителю.",
                xp_reward=30,
                points_reward=80,
            ),
            Lesson(
                id=4,
                title="Импульсивные покупки",
                description="Правило суток перед покупкой",
                content=[
                    "Иногда хочется купить что-то прямо сейчас, а через день желание проходит.",
                    "Подожди сутки перед крупной покупкой — так тратишь только на то, что действительно нужно.",
                ],
                question="Хочешь игру за 15 BYN прямо сейчас. Что поможет решить?",
                options=["Купить сразу", "Подождать сутки и подумать", "Занять деньги у друга"],
                answer_index=1,
                explanation="Если через сутки игра всё ещё нужна — можно копить или попросить родителя.",
                xp_reward=20,
                points_reward=50,
            ),
            Lesson(
                id=5,
                title="Деньги закончились: что делать",
                description="Почему не хватило и как попросить у родителя",
                content=[
                    "Покупку могут отклонить, если на карте мало денег или закончился дневной лимит.",
                    "Это не ошибка. Можно подождать до завтра или отправить родителю запрос — он решит, что делать.",
                ],
                question="Покупку отклонили: не хватило денег. Что разумнее сделать?",
                options=["Попросить у друга карту", "Подождать или отправить запрос родителю", "Ничего, просто обидеться"],
                answer_index=1,
                explanation="Запрос родителю в приложении — спокойный и честный способ. Решение всегда за ним.",
                xp_reward=20,
                points_reward=50,
            ),
        ]
        for lesson in lessons:
            session.add(lesson)

        session.add(LessonProgress(user_id=anya.id, lesson_id=1, completed=True, completed_at=minutes_ago(120)))
        session.add(LessonProgress(user_id=anya.id, lesson_id=3, completed=True, completed_at=minutes_ago(90)))
        
        # Коммитим все изменения
        await session.commit()
        
        _log("База данных успешно заполнена!")
        _log("\nСозданные данные:")
        _log(f"   - Семья: {family.name}")
        _log(f"   - Пользователи: Мама (id=1), Миша (id=2), Аня (id=3)")
        _log(f"   - Карты: 2 шт")
        _log(f"   - Лимиты: 5 шт")
        _log(f"   - Транзакции: {len(transactions_misha) + len(transactions_anya)} шт")
        _log(f"   - Цели: 1 шт")
        _log(f"   - Задания: 2 шт")
        _log(f"   - Запросы: 1 шт")
        _log(f"   - Уроки: {len(lessons)} шт")


if __name__ == "__main__":
    asyncio.run(seed_data())
