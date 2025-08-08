# KnowledgeLink

Personal AI-powered knowledge base.

- Next.js frontend (static export)
- FastAPI backend
- MongoDB Atlas with Vector Search
- Google OAuth 2.0
- Gemini for summaries and embeddings

## Environment
Create `.env` at repo root:
```
MONGODB_URI=...
MONGODB_DB_NAME=knowledgelink
MONGODB_VECTOR_INDEX=content_vector_index
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/callback
GEMINI_API_KEY=...
JWT_SECRET=...
SESSION_SECRET=...
```

## Run
- Build frontend: `cd frontend && npm install && npm run build`
- Start backend from repo root: `uvicorn app:app --reload`
- Open http://localhost:8000

## API
- POST `/api/links` { url }
- GET `/api/links`
- GET `/api/search?q=...`
- GET `/api/auth/login`, `/api/auth/me`, POST `/api/auth/logout` 
