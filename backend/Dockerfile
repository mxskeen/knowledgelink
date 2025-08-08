# syntax=docker/dockerfile:1

# ---------- Frontend Build ----------
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm ci || npm install
RUN npm run build

# ---------- Backend Build ----------
FROM python:3.12-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y build-essential curl && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/pyproject.toml ./backend/pyproject.toml
RUN pip install --upgrade pip poetry && \
    cd backend && poetry export -f requirements.txt --without-hashes -o /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# App code
COPY backend/ ./backend/
COPY app.py ./app.py

# Copy frontend export
COPY --from=frontend-builder /app/frontend/out/ /app/frontend_out/

EXPOSE 8000

ENV HOST=0.0.0.0 PORT=8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
