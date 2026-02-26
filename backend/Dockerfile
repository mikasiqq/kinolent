# ── Кинолент Backend ─────────────────────────────────────────────────────────
# Multi-stage build: slim Python image с зависимостями для scipy/numpy/pulp.
#
# Сборка:  docker build -t kinolent-backend .
# Запуск:  docker run -p 8000:8000 kinolent-backend
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# Системные зависимости для scipy/numpy
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Зависимости (кэшируются отдельно от кода)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Код приложения
COPY . .

# Порт API
EXPOSE 8000

# Запуск
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
