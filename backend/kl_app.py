import os
import json
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from jose import jwt, JWTError
from authlib.integrations.starlette_client import OAuth
import google.generativeai as genai
import trafilatura
import requests
from bs4 import BeautifulSoup
from motor.motor_asyncio import AsyncIOMotorClient

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("DATABASE_URL")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "knowledgelink")
MONGODB_VECTOR_INDEX = os.getenv("MONGODB_VECTOR_INDEX", "content_vector_index")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
SESSION_SECRET = os.getenv("SESSION_SECRET", JWT_SECRET)
JWT_EXPIRES_SECONDS = int(os.getenv("JWT_EXPIRES_SECONDS", str(7 * 24 * 3600)))
FRONTEND_STATIC_DIR = os.getenv("FRONTEND_STATIC_DIR", "/app/frontend_out")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="KnowledgeLink API")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax", https_only=False)

mongo_client: Optional[AsyncIOMotorClient] = AsyncIOMotorClient(MONGODB_URI) if MONGODB_URI else None
db = mongo_client[MONGODB_DB_NAME] if mongo_client is not None else None
links_col = db["links"] if db is not None else None
users_col = db["users"] if db is not None else None

oauth = OAuth()
oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

COOKIE_NAME = "kl_auth"
ALGO = "HS256"

def create_jwt(payload: dict) -> str:
    to_encode = {**payload, "exp": datetime.utcnow() + timedelta(seconds=JWT_EXPIRES_SECONDS)}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGO)

def verify_jwt(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[ALGO])
    except JWTError:
        return None

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = verify_jwt(token)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid token")
    return data

class LinkCreate(BaseModel):
    url: str

def _fallback_extract_html_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for s in soup(["script", "style", "noscript"]):
        s.decompose()
    main = soup.find("article") or soup.find("main") or soup.find("div", class_="post-content") or soup.find("div", role="main")
    return (main.get_text("\n", strip=True) if main else soup.get_text("\n", strip=True))

def extract_main_text_and_title(url: str) -> tuple[str, str]:
    content_text = ""
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            extracted = trafilatura.extract(downloaded)
            if extracted:
                content_text = extracted
    except Exception:
        pass
    title = ""
    html = None
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")
        t = soup.find("title")
        if t and t.text:
            title = t.text.strip()
        if not content_text and html:
            content_text = _fallback_extract_html_text(html)
            if not content_text:
                og = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "description"})
                if og and og.get("content"):
                    content_text = og["content"].strip()
    except Exception:
        pass
    return content_text or "", title

def generate_summary(text: str) -> str:
    if not GEMINI_API_KEY:
        return ""
    try:
        r = genai.GenerativeModel("gemini-2.5-flash").generate_content(
            "Summarize the following web page content in 5-7 concise bullet points.\n\n" + text[:6000]
        )
        return (r.text or "").strip()
    except Exception:
        return ""

def embed_text(text: str) -> List[float]:
    if not GEMINI_API_KEY:
        return []
    try:
        r = genai.embed_content(model="text-embedding-004", content=text[:7000])
        vec = r.get("embedding") or r.get("data", [{}])[0].get("embedding")
        return list(map(float, vec)) if vec else []
    except Exception:
        return []

def favicon_for(url: str) -> str:
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc
        if host:
            return f"https://www.google.com/s2/favicons?domain={host}&sz=64"
    except Exception:
        return ""
    return ""

api = APIRouter(prefix="/api")

@api.get("/health")
async def health():
    return {"status": "ok", "mongo": db is not None, "gemini": bool(GEMINI_API_KEY), "time": datetime.utcnow().isoformat()}

@api.get("/auth/login")
async def auth_login(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    redirect_uri = GOOGLE_REDIRECT_URI or str(request.url_for("auth_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri)

@api.get("/auth/callback")
async def auth_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or oauth.google.parse_id_token(request, token)
    if not userinfo:
        raise HTTPException(status_code=400, detail="Failed to retrieve user info")
    sub = userinfo.get("sub") or userinfo.get("id")
    email = userinfo.get("email")
    name = userinfo.get("name") or email
    if users_col is not None:
        await users_col.update_one({"sub": sub}, {"$set": {"sub": sub, "email": email, "name": name, "updatedAt": datetime.utcnow()}}, upsert=True)
    jwt_token = create_jwt({"sub": sub, "email": email, "name": name})
    resp = RedirectResponse(url="/")
    resp.set_cookie(COOKIE_NAME, jwt_token, httponly=True, secure=False, samesite="lax", max_age=JWT_EXPIRES_SECONDS, path="/")
    return resp

@api.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return {"user": user}

@api.post("/auth/logout")
async def auth_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE_NAME, path="/")
    return resp

@api.post("/links")
async def create_link(payload: LinkCreate, user=Depends(get_current_user)):
    if links_col is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    content, title = extract_main_text_and_title(url)
    if not content or len(content.strip()) < 80:
        raise HTTPException(status_code=422, detail="Failed to extract sufficient content from the URL")
    summary = generate_summary(content)
    embedding = embed_text(content)
    doc = {"userId": user["sub"], "url": url, "title": title or url, "summary": summary, "content_embedding": embedding, "favicon": favicon_for(url), "createdAt": datetime.utcnow()}
    res = await links_col.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    doc.pop("content_embedding", None)
    return doc

@api.get("/links")
async def list_links(user=Depends(get_current_user)):
    if links_col is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    cursor = links_col.find({"userId": user["sub"]}, {"content_embedding": 0}).sort("createdAt", -1)
    items = []
    async for d in cursor:
        d["id"] = str(d.pop("_id"))
        items.append(d)
    return {"links": items}

@api.get("/search")
async def search_links(q: str, user=Depends(get_current_user)):
    if links_col is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    if not q:
        return {"links": []}
    query_vec = embed_text(q)
    if not query_vec:
        return {"links": []}
    pipeline = [
        {"$vectorSearch": {"index": MONGODB_VECTOR_INDEX, "path": "content_embedding", "queryVector": query_vec, "numCandidates": 200, "limit": 10, "filter": {"userId": user["sub"]}}},
        {"$project": {"content_embedding": 0}},
    ]
    results = []
    async for d in links_col.aggregate(pipeline):
        d["id"] = str(d.pop("_id"))
        results.append(d)
    return {"links": results}

app.include_router(api)

if os.path.isdir(FRONTEND_STATIC_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_STATIC_DIR, html=True), name="static") 