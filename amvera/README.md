# UTRET на Amvera

В проекте выбираем «Приложение» и ветку `amvera`. В корне уже есть Dockerfile и amvera.yaml. Next.js слушает порт 3000, а запросы `/api/*` передаёт FastAPI внутри того же контейнера.

## Переменные проекта

| Имя | Что указать |
| --- | --- |
| `DEMO_PASSWORD` | Секрет. Пароль для новых демо-аккаунтов без своего секрета, включая `staff`. Минимум 12 символов. |
| `STUDENT1`, `STUDENT2`, `STUDENT3` | Секреты запуска. Отдельные пароли для `student1`, `student2`, `student3` длиной от 12 до 128 символов. |
| `LLM_API_KEY` | Секрет. Ключ Polza AI для Кометы. |
| `PUBLIC_ORIGIN` | HTTPS-адрес проекта Amvera без пути и завершающего слэша. |
| `LLM_MODEL` | Укажите модель из настроек Polza AI, если она отличается от deepseek/deepseek-v4.1-flash-1017. |

При запуске с `DEMO_SEED=true` сервер применяет заданные секреты `STUDENT1`, `STUDENT2` и `STUDENT3` к новым и существующим аккаунтам. При смене пароля студенту нужно войти снова. Профиль и заявки сохраняются.

SQLite хранится в `/data/campus.sqlite3` на постоянном диске. Используйте одну реплику приложения.

После запуска проверьте `/`, `/lks` и `/api/health`. Сборка содержит справочные выдержки по документам РЭУ. Для актуализации индекса запустите `python -m campus.rea_documents` из каталога `/app/backend` в работающем контейнере.

[Загрузка проекта](https://docs.amvera.ru/applications/quick-start.html) · [Переменные и секреты](https://docs.amvera.ru/applications/configuration/variables.html) · [SQLite на постоянном диске](https://docs.amvera.ru/databases/sqlite.html)
