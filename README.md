# Семейный банкинг в Moby — хакатон МТБанка

Детская карта и семейный пакет внутри приложения Moby: родитель управляет лимитами и категориями,
ребёнок платит, копит на цели, выполняет задания и просит деньги у родителя.

- `backend/` — FastAPI + SQLAlchemy + SQLite
- `frontend/` — React + Vite + Tailwind, интерфейс в стиле Moby
- `docs/api.md` — контракт API между ними

## Запуск (два окна PowerShell)

**1. Бэкенд**

```powershell
cd C:\Projects\MRK_H_26
venv\Scripts\activate              # окружение на Python 3.13
cd backend
pip install -r requirements.txt    # один раз
uvicorn app.main:app --reload
```

Проверка: http://localhost:8000/docs. При первом запуске база сама заполняется демо-семьёй
(мама, Миша 10 лет, Аня 15 лет). Сбросить демо-данные — кнопка внизу главной мамы или `POST /demo/reset`.

**2. Фронтенд**

```powershell
cd C:\Projects\MRK_H_26\frontend
npm install                        # один раз
copy .env.example .env             # один раз: VITE_API_URL=/api
npm run dev
```

Открыть http://localhost:5173. Фронт ходит на бэкенд через прокси Vite (`/api` → `:8000`),
поэтому CORS настраивать не нужно.

**Без бэкенда:** в `frontend/.env` оставить `VITE_API_URL=` пустым — заработает встроенный mock.

## Показать на телефоне

```powershell
npm run dev                        # в одной Wi-Fi сети: http://<IP-ноутбука>:5173
cloudflared tunnel --url http://localhost:5173   # или через туннель
```

Бэкенд при этом остаётся на ноутбуке: телефон обращается к фронту, а фронт через прокси — к бэку.

## Тесты бэкенда

```powershell
cd backend
pytest
```
