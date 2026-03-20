#!/bin/bash
# Скрипт подготовки и запуска переноса данных из дампа WP в PostgreSQL

echo "=== 1. Проверка наличия дампа ==="
if [ -z "$(ls -A ./dumps/*.sql 2>/dev/null)" ]; then
    echo "❌ В папке backend/dumps/ не найдено SQL-даймпов."
    echo "Положите ваш wp-dump.sql (выгрузку WordPress) в папку backend/dumps/ и повторите запуск."
    exit 1
fi
echo "✓ Дамп найден."

echo "=== 2. Запуск временного MySQL и API ==="
docker-compose up -d wp-mysql postgres redis
echo "Ожидание инициализации MySQL (загрузки дампа)..."
sleep 15 # даем время на импорт, если дамп большой, может потребоваться больше

echo "=== 3. Запуск скриптов миграции в API-контейнере ==="
cd api
npm install

echo "-> Миграция пользователей..."
WP_DB_URL="mysql://wordpress:wordpress@127.0.0.1:3376/wp-app" npx ts-node scripts/migrate-users.ts
echo "-> Миграция объектов недвижимости..."
WP_DB_URL="mysql://wordpress:wordpress@127.0.0.1:3376/wp-app" npx ts-node scripts/migrate.ts
echo "-> Миграция коллекций..."
WP_DB_URL="mysql://wordpress:wordpress@127.0.0.1:3376/wp-app" npx ts-node scripts/migrate-collections.ts

echo "=== Миграция завершена! ==="
echo "Теперь вы можете остановить wp-mysql (docker-compose stop wp-mysql), так как данные перенесены в PostgreSQL."
