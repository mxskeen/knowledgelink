# syntax=docker/dockerfile:1

# ---------- Frontend Build ----------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# ---------- Backend Runtime ----------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y build-essential curl && rm -rf /var/lib/apt/lists/*

# Python deps via poetry export
COPY backend/pyproject.toml /app/backend/pyproject.toml
RUN pip install --no-cache-dir --upgrade pip poetry poetry-plugin-export && \
    cd /app/backend && poetry export -f requirements.txt --without-hashes -o /tmp/requirements.txt && \
    pip install --no-cache-dir -r /tmp/requirements.txt

# App code
COPY backend/ /app/backend/
COPY app.py /app/app.py

# Static assets from frontend export
COPY --from=frontend-builder /app/frontend/out/ /app/frontend_out/

EXPOSE 8000
ENV HOST=0.0.0.0 PORT=8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"] 