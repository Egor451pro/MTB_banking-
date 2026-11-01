[33mcommit 820907a233e11fb198097db6568e78e66bfe0463[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Wed Oct 21 08:09:11 2026 +0000

    Демо-QR для оплаты через КРОК
    
    Пять кодов магазинов, которые читает камера в экране оплаты.
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit c74e3fb595d55a822e84d101b56149671130be0b[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Wed Oct 21 08:04:15 2026 +0000

    Камера в оплате по QR
    
    Видоискатель показывает живую камеру и читает QR через BarcodeDetector
    или jsQR с CDN. Если доступа нет, остаются демо-коды на кассе.
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 9cd088fa959144ddd96f4df2cbfa4a026fe56d54[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Wed Oct 21 07:54:37 2026 +0000

    Оплата по QR через КРОК для ребёнка: сканер, подтверждение, те же лимиты и запрос родителю
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit dbf3fed398332a26d2db507b10f124ec286aebf9[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Wed Oct 21 07:29:03 2026 +0000

    Переход Moby → «Семья» как открытие приложения: вкладка растёт в экран, Moby уходит назад
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit fd5d4f45ed5101fb46055e6eb8239f1ec243f46b[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 22:45:12 2026 +0000

    Уборка: удалены неиспользуемые explainers.tsx, заготовки видео и служебный промпт
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 3ddb3f7d6b105316975702926c8f662a783c06a7[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 22:41:40 2026 +0000

    Экономика: стоимость разработки по ролям и окупаемость на 8 лет
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit c8812ef1d5845d857495d00253debe79d6451633[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 22:31:49 2026 +0000

    Экономика: модель с допущениями, LTV и сценариями на 3 года
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 18ccb5f9a4d1c9488fb65e5015d89d33da5ffdf3[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 22:22:47 2026 +0000

    Услуги: синяя липкая кнопка «Оформить детский пакет»
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 32434b7cef3c55106234ce1408943277fa419dc6[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 22:20:20 2026 +0000

    Главная родителя: вернул последние операции детей
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 591f63ab264d576014641a89d1deb1ba7c9bc5a1[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 22:17:28 2026 +0000

    Интеграция в Moby и упрощённый интерфейс
    
    - родитель после входа видит главную Moby, вкладка «Семья» открывает наш раздел с анимацией
    - родитель: главная только с решениями и детьми, «Дети» — один список вместо подвкладок
    - ребёнок: Главная, Копилка, Бобёр, Задания (с уроками), Я
    - одна система прогресса: уровень = плотина бобра, XP не показываем
    - симулятор покупки вынесен в демо-панель; цвета Moby следуют теме
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit a1659d5171b291a974754704f0ecf68b36d6e4ab[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:57:35 2026 +0000

    Бобёр: закрытая плотина на время стройки и раскрытие по кнопке; без эмодзи и конфетти; тряска без тёмных краёв; перед уровнем кладём ровно сколько нужно
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 2ebccb8acb18fedccf05c385937116d76c1e7e06[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:48:49 2026 +0000

    Бобёр: профессионально вырезанные спрайты (малыш, малыш-строитель, подросток, подросток-строитель, машет)
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit c440cd163299c1fa04b2f5c28e524f6d1c01721c[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:43:13 2026 +0000

    Бобёр: строитель-подросток для 14–17
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit c4c2c561d072206bf74de3ea44e31f11edb449d9[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:42:11 2026 +0000

    Бобёр: строитель только при переходе на новый уровень, плотина достраивается 9 секунд; аккуратный вырез спрайтов
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 8d32c19aafb42f4b0d8cfabddbf087979b5221ec[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:34:57 2026 +0000

    Бобёр-строитель: один спрайт в каске и жилете для всех возрастов
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 093e5f889ab974e506c4fab36c9099d894f7aef8[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:33:37 2026 +0000

    Бобёр: фаза стройки — каска, реплики, рабочая анимация; спрайты строителя подхватятся автоматически
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 5c634c1a5cad018c4d21910dc2ca7f11114e96a7[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:29:09 2026 +0000

    Кнопка «Сбросить демо» вынесена из экрана родителя в верхнюю панель; сброс чистит прогресс бобра
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit c1281b570872dc6a5e8df10bbe2bdc6a52206986[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:26:33 2026 +0000

    Бобёр: анимация стройки — прыжок, полёт бревна, шлепок, +1, конфетти на новом уровне
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 27574cc08706483c22e2a8419198b1b88a1d9fc7[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:25:55 2026 +0000

    Бобёр: анимация стройки — прыжок, полёт бревна, шлепок, +1, конфетти на новом уровне
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit befa1b92b14059ce5bf07a784a1100611d704555[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:20:58 2026 +0000

    Бобёр: подросток 14–17 видит свой спрайт, на новом уровне малыш машет
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 00506e9096d4a9edf8f2deef3a0fa22b31ef25e5[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 21:16:31 2026 +0000

    Вкладка «Бобёр»: питомец строит плотину из брёвен, 4 уровня
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit f718b27233b36076735f67f049e94637e97b7eb3[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 20:36:44 2026 +0000

    Фирменные шрифты Moby: TikTok Sans для акцентов, Inter для текста
    
    - заменён Onest на пару из брендбука Moby
    - TikTok Sans: заголовки (h1–h3), крупные суммы и баллы, баннер «Детская карта»
    - Inter: основной текст интерфейса
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit b9beba9230a20d4452ed15ce270aa4af6768ad42[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 20:58:08 2026 +0300

    feat(frontend): add themed dark mode and iPhone status bar glass
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 4ec0e5db245ec39126a329e3f65ae2bda1c5810c[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 20:24:42 2026 +0300

    fix(frontend): pin PostCSS Tailwind in Vite so styles load after branch switches
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 0069155edcf9b26d241b67d3cecf8ff9cdcdbcd4[m
Author: Egorka9ije <syrankovegor@gmail.com>
Date:   Tue Oct 20 20:20:47 2026 +0300

    убрал баг dynamic island

[33mcommit dde6f25ebab48fb686de180b1def4a3e5e7be4e6[m
Merge: 28f15e6 0e07ec5
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 20:07:28 2026 +0300

    Merge remote-tracking branch 'origin/feature/backCursor'
    
    # Conflicts:
    #       frontend/src/App.tsx

[33mcommit 28f15e62ac78cdb7a537ac6ce8bbd16ea7099042[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 20:05:57 2026 +0300

    Fix merge conflict markers in App.tsx

[33mcommit 0e07ec53d13e760ae55ca6019c18066b492b382c[m[33m ([m[1;31morigin/feature/backCursor[m[33m, [m[1;32mfeature/backCursor[m[33m)[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 20:04:02 2026 +0300

    normal screen

[33mcommit aff3f34f429a95b5f92ed7da9b6b64d6ae170c88[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 19:55:58 2026 +0300

    feat(frontend): add iPhone 17 chrome with live time and Dynamic Island animation
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 9401d36fc71868c8f73344c1032c127446e602fc[m
Merge: 502a187 9287a5f
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 19:48:58 2026 +0300

    Merge branch 'feature/backCursor'

[33mcommit 9287a5f3067b7415ad20042c611178b789deb82a[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 19:42:48 2026 +0300

    add login

[33mcommit 502a18703b611430f434f234fd53f9a1115a9202[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 16:12:29 2026 +0000

    Бонус родителя без верхнего лимита (убран месячный лимит 10 BYN)
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 9e24efc1312b142605136742c37496dd98874459[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 16:07:20 2026 +0000

    Подтверждение бонуса: порог по размеру взноса (больше 10 BYN), а не по размеру бонуса
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 9128cabfc01cbbd499cbc69141a820debdba36af[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 16:03:28 2026 +0000

    Типы: PendingBonus, BonusDecision, DepositResult.bonus_pending_cents
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 25264a16859f8c7fb1c472cf0dc7018b92f1a7f5[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 16:02:36 2026 +0000

    Плашка о бонусе от родителя и подтверждение крупного бонуса (от 10 BYN)
    
    - фронт: баннер «Поступил бонус от родителя» / «Бонус ждёт родителя», блок «Подтвердить бонус» у родителя, бейдж во вкладке «Запросы», вариант +50%
    - бэк: GoalBonus.status (pending/credited/rejected), GET /bonuses/pending, POST /bonuses/{id}/approve|reject
    - mock и тесты обновлены, docs/api.md
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 24de8b70a50407e5cac1a51a31ac2fef15aec767[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 15:58:50 2026 +0000

    Бонус родителя к накоплениям: начисляется сразу при взносе в цель
    
    - бэк: таблица goal_bonuses, лимит бонуса 10 BYN в месяц на ребёнка, расчёт в deposit_to_goal
    - API: bonus_cents в целях и ответе взноса, bonus_month_cap/left в списке целей
    - фронт: превью бонуса в окне взноса, бейдж «Получено бонусов», заметка у родителя, mock
    - тесты: backend/tests/test_goal_bonus.py, docs/api.md
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 153899425b00d99bbe434ca6d67bb61251e11cc8[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 15:30:49 2026 +0000

    Docs: concrete 14 and 18 bridges for the beaver concept
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 5e6a2619bd9c81a7164ddcf8afcde8d7d842cc6a[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 15:25:37 2026 +0000

    Add smooth animations: screen fade, staggered cards, sheet slide, toasts, progress, count-up
    
    - screens fade in, cards rise one by one (backwards fill, no lingering layers)
    - bottom sheet slides up/down, only the dim fades; keeps content while closing
    - toast drop-in/out, active tab pop, sliding segmented pill
    - progress bars and level ring grow from 0, balances count up to new value
    - prefers-reduced-motion disables motion
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit d70c0f4d844a801cf69a36626a14994aebb522e4[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 14:40:46 2026 +0000

    Docs: full beaver pet concept
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 72dc099e79262ed2687cab526a231388481a2f4d[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 14:31:59 2026 +0000

    Remove lesson videos; fix frame height on phones; add switch role to toggles
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 8d83fe0006090b9fc4e7e8c1c41356a711227646[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 14:07:50 2026 +0000

    Add animated SVG explainer for lesson 5 (fallback when no mp4)
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit d197ca6246dc57670fc45f03d7a4a5e556d4a8f5[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 13:33:27 2026 +0000

    Docs: scripts for four more lesson videos
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 3fadabbf67b33b3c73c96ed7f5cdd2e12adb4bb4[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 13:21:13 2026 +0000

    Backend: lesson videos and lesson 5 in seed; test for video field
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 7727d3932727648d3faef6acf323fd3b399b7041[m
Merge: ac200d1 43c0230
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 13:19:09 2026 +0000

    Merge backend v2 (feature/backCursor) into main

[33mcommit ac200d10be974d3366f16b7331ce9bc44eacb72b[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 13:17:43 2026 +0000

    Add video lessons: player with fallback, contextual nudges, scripts
    
    - Lesson.video (mp4 in public/videos), player with placeholder if file is missing
    - new lesson 5 "Деньги закончились", nudges after decline, in goals, before online payments
    - docs/video-scripts.md: storyboards and generation prompts
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 43c0230f7fd7de30222689bdde9a071c3dfc2f73[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:14:55 2026 +0300

    fix(seed): avoid emoji in seed logs so POST /demo/reset works on Windows
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 9e666ee9ae39ab2bc6cd80764a6f92d3a09ecd80[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:08:20 2026 +0300

    feat(family): require age-based consents and keep partner offers off by default
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 42678cb7ff7eb338b90ceed68486dcc4807f07c7[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:07:52 2026 +0300

    seed: add Anya pending clothing purchase for parent confirmation demo
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 08b3ff1913e7c2bd065791b07da16d42ec79e4f4[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:07:38 2026 +0300

    feat(cards): add reissue endpoint that keeps balance and activates the card
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 931ae6ee948c1e7b5588073b6ff49b0be4dffad1[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:07:01 2026 +0300

    feat(loyalty): add points, partner offers and cashback on approved payments
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit a4193281f12a62ef678c978c0278da61ffd88c67[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:06:10 2026 +0300

    feat(lessons): add financial literacy lessons with one-time XP and points reward
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 8706f513ce25a9a59ed24465e7f59494918c0328[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:05:22 2026 +0300

    feat(allowance): add pocket money settings and demo payout
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 3f4875a0d25a8fc7f5638b1292c13f6316ad50f8[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:04:43 2026 +0300

    feat(permissions): store child rights in consents and add product_access requests
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit b2954602fb9924154fa240e8c632617a182f3510[m
Author: Egor451pro <egorprozorovich@gmail.com>
Date:   Tue Oct 20 16:03:10 2026 +0300

    feat(purchases): add pending list and parent approve/decline with live card checks
    
    Co-authored-by: Cursor <cursoragent@cursor.com>

[33mcommit 6c78b35334db95f5229afb696e773c6bdf37b9e9[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 12:52:34 2026 +0000

    Align product with Belarus law: consents by age, age locks, legal notes
    
    - Package: contract by parent for 7-13 (art. 27 Civil Code), parent's written consent for 14-17 (art. 25)
    - Required personal data consent (Law 99-Z) and teen consent for parent's access to operations
    - Online payments and virtual card locked under 14; partner offers off by default
    - 18+ category covers alcohol, tobacco, gambling; transition at 18 only by client's choice
    - docs/legal.md with sources and open questions for MTBank lawyers
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit de017b69f288ad1ae8f0ebc5cc23ea6b4c7f630e[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 12:48:53 2026 +0000

    Add TZ features to frontend and mock: purchase approval, allowance, permissions, lessons, loyalty
    
    - Parent confirms large online purchases (Requests tab, home banner, nav badge)
    - Pocket money: amount, period, pay now
    - Child rights in Moby with age locks; child can request product access
    - Financial literacy lessons with quiz and XP/points rewards; parent sees progress
    - Loyalty: cashback points, partner offers, promo codes
    - Lost card: reissue; family activity feed; products showcase
    - docs/api.md v2 contract and backend prompt
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 4cfa3d516f3d5c515b35b9061cf0d006094dad9a[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 12:16:58 2026 +0000

    Wire frontend to backend: Vite /api proxy, auto-seed, open CORS
    
    - Vite dev server proxies /api to the backend on :8000 (works from phone and tunnel)
    - Backend seeds the demo family on first start when the DB is empty
    - CORS origins configurable, all allowed by default (no cookie auth)
    - Root README with run instructions
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit d002de5c2980f2efd1880ea25cac6f33907538f5[m
Merge: 7da71d3 1c03cd9
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 12:15:44 2026 +0000

    Merge backend (feature/backCursor) into main
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M1XSwMj8R5CDu19Xm8ysCf

[33mcommit 7da71d3f219080dcb60cba2fef809877d2e4c760[m
Author: Mioryyy <mioryyy67@gmail.com>
Date:   Tue Oct 20 12:13:54 2026 +0000

    Frontend: Moby-style UI
    
    - Blue gradient header with rounded bottom, gray background, flat white cards
    - Bottom nav with pill on active tab, blue line icons
    - Balance c