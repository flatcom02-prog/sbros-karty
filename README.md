# Сбрось карты

Веб-игра на русской колоде 36 карт (правила «сбрось карты») — Vite + React + TypeScript, PWA-скелет, боты и онлайн-лобби по WebSocket.

## Запуск

```bash
npm install
npm run start          # фронт (Vite :5173) + WS-сервер (:3080)
```

Или раздельно:

```bash
npm run server         # WebSocket — ws://localhost:3080
npm run dev            # UI — http://localhost:5173
```

Только боты (без сервера): достаточно `npm run dev`.

Сборка:

```bash
npm run build
npm run preview
```

Проверка правил:

```bash
npx tsx scripts/smoke-rules.ts
```

## Режимы

1. **Боты** — 1–3 бота, правила в общем модуле `src/game/`, ходы ботов на клиенте.
2. **Онлайн** — комната с кодом (2–4 игрока), сервер `server/index.ts` хранит состояние и применяет те же правила из `src/game/`.

## Структура

```
src/game/          # общая логика (колода, правила, бот)
src/components/    # UI (меню, стол, лобби)
src/hooks/         # useBotGame / useOnlineGame
server/            # Node + ws лобби и партия
```

## Правила (кратко)

- 36 карт; стартер случайный; раздача от стартера по 4, у последнего в круге 3 — «4-я» открывается со спецэффектом.
- Ход: та же масть или достоинство; **дама** — на любую + выбор масти.
- **9**: сразу закрыть (ещё 9 / масть этой 9 / дама); цепочка 9; иначе взять → пас.
- **6**: следующему +2 (стек шестёрок до 8); **7**: +1 без стека; **туз**: пропуск.
- После **«Взять карту»** можно сходить, если карта/рука позволяет; иначе **Пас**.
- Пустая колода: сброс (кроме верхней) → новая колода. Боты: пауза 800–1500 мс.
- Цель раунда — пустая рука; очки за остаток; **>125** — проигрыш матча; **ровно 125 → 0**.
- Сброс последней картой-дамой: **−20** (−40 если пиковая).
- Очки карт: 6–10 номинал; В 2; Д 3; К 4; Т 11.

## Прод (один порт)

```bash
npm run build
PORT=3080 npm run start:prod   # раздаёт dist/ + WebSocket
```

Клиент в проде подключается к `wss://` того же хоста. Опционально: `VITE_WS_URL=wss://...` при сборке.

### Стабильный хост (Fly.io) — URL не меняется

Целевой адрес: **https://sbros-karty.fly.dev** (UI + WSS same origin).

```bash
export FLY_API_TOKEN=...   # https://fly.io/user/personal_access_tokens
./scripts/deploy-fly.sh    # или: fly deploy --ha=false --remote-only
```

Повторные деплои с тем же app name `sbros-karty` оставляют URL прежним. Конфиги: `Dockerfile`, `fly.toml` (fallback: `render.yaml`).

### Interim (устаревший постоянный вариант)

`*.trycloudflare.com` **obsolete** как постоянный хост — только пока нет `FLY_API_TOKEN`:

```bash
./scripts/tunnel-up.sh
```

Live / как зайти: `docs/sbros-karty-play.md`. Handoff: `internal/card-game-stable-host.md`.

## Производственный деплой — TODO

- [x] Один процесс: статика `dist/` + WS на одном `PORT`.
- [x] HTTPS / WSS через tunnel (эфемерный; **не** постоянный хост).
- [x] Fly/Render конфиги + `deploy-fly.sh` (ждём токен).
- [ ] Первый `fly deploy` → постоянный `sbros-karty.fly.dev`.
- [ ] Комнаты с TTL, лимиты, анти-абуз кодов.
- [ ] Реконнект по `playerId` + токену.
- [ ] PNG/иконки PWA 192/512.
- [ ] CI-тесты правил, баланс бота.
