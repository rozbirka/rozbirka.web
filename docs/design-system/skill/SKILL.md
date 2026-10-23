---
name: rozbirka-prototype
description: Робить HTML-прототипи екранів кабінету Rozbirka (CRM/ERP для розбірок), що виглядають і поводяться як реальний застосунок. Використовуй для будь-якого екрана, фічі, стану чи компонента Rozbirka.
---

# Скіл: прототип Rozbirka

## Коли вмикати
Будь-яка задача про UI Rozbirka: новий екран, зміна екрана, новий стан, компонент, друкована форма.

## Кроки
1. Прочитай `CLAUDE.md` у корені пакета: порядок читання, жорсткі правила, self-check.
2. Відкрий сторінку модуля у `v2/modules/` (зміст — `v2/modules/Index.dc.html`). Новий модуль — скопіюй `10 Автомобілі.dc.html` або `11 Запчастини.dc.html` і заміни розділи; зміни в наявному модулі — лише в його файлі.
3. Візьми тексти з репо: `src/cabinet/<module>/*messages.ts` (uk). Ключі запиши в `<Feature>.STATES.md`.
4. Розмічай тільки класами `v2/kit.css`. Якщо класу немає, знайди еталон у `v2/components/` і запитай, перш ніж розширювати кіт.
5. Опиши всі стани: таблиця «id → умова в коді → компоненти → рядки». Додай фічу в `manifest.json`.
6. Запусти `check/visual_check.py` і пройди self-check.

## Шаблон HTML
```html
<!doctype html><html lang="uk"><head><meta charset="utf-8">
<link rel="stylesheet" href="v2/tokens.css"><link rel="stylesheet" href="v2/kit.css">
<link rel="stylesheet" href="https://unpkg.com/lucide-static@0.460.0/font/lucide.css"></head>
<body class="rz" data-theme="dark" data-density="compact">
<div class="rz-app"><nav class="rz-sidebar">…</nav><div class="rz-main">
<header class="rz-topbar"><nav class="rz-crumbs">…</nav><div class="rz-topbar__actions">…</div></header>
<main class="rz-page">…</main></div></div></body></html>
```

## Не роби
- hex, нових шрифтів, радіусів, тіней;
- вигаданих рядків без позначки;
- одного «Недоступно» замість окремих станів «немає прав», «тариф», «ліміт», «підписка»;
- кольорового друку;
- змін у репо `rozbirka.web`.
