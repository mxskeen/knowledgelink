"use client";
import React, { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import CardSpotlight from '../../components/ui/CardSpotlight';
import { getApiUrl, fetchWithRetry, API_CONFIG } from "../../lib/config";

function isUrl(text) {
  try { const u = new URL(text); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.test(text); }
}

function ChatInputBox() {
  const [user, setUser] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [links, setLinks] = useState([]); // transient display only

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH_ME), { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          setUser(data.user);
        }
      } catch {}
    })();
  }, []);

  const login = () => { window.location.href = getApiUrl(API_CONFIG.ENDPOINTS.AUTH_LOGIN); };
  const logout = async () => { await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH_LOGOUT), { method: 'POST', credentials: 'include' }); setUser(null); setLinks([]); setSearchResults([]); };

  const submit = async () => {
    const value = inputValue.trim();
    if (!value) return;
    setLoading(true);
    try {
      if (isUrl(value)) {
        if (!user) return login();
        const r = await fetchWithRetry(getApiUrl(API_CONFIG.ENDPOINTS.LINKS), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ url: value })
        });
        const created = await r.json();
        setInputValue("");
        setSearchResults([]);
        setLinks(created ? [created] : []); // show only the newly added link
      } else {
        const apiUrl = `${getApiUrl(API_CONFIG.ENDPOINTS.SEARCH)}?q=${encodeURIComponent(value)}`;
        const response = await fetchWithRetry(apiUrl, { credentials: 'include' });
        const data = await response.json();
        setLinks([]);
        setSearchResults(data.links || []);
      }
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const onKeyDown = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">KnowledgeLink</h1>
        <div>
          {user ? (
            <Button variant="outline" onClick={logout}>Sign out</Button>
          ) : (
            <Button onClick={login}>Sign in with Google</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Paste a URL to save, or ask a question to search"
          className="flex-1 border rounded px-3 py-2"
        />
        <Button onClick={submit} disabled={loading || !inputValue}>
          <Search className="mr-2 h-4 w-4" /> Go
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Working...</div>}

      <div className="grid grid-cols-1 gap-4">
        {(searchResults.length ? searchResults : links).map((link) => (
          <CardSpotlight key={link.id || link.url} className="p-4">
            <div className="flex items-start gap-3">
              {link.favicon && <img src={link.favicon} alt="icon" width={24} height={24} />}
              <div>
                <a className="font-medium" href={link.url} target="_blank" rel="noreferrer">{link.title || link.url}</a>
                <div className="text-sm text-muted-foreground break-words">{link.url}</div>
              </div>
            </div>
            {link.summary && (
              <div className="mt-2 text-sm">
                <ReactMarkdown>{link.summary}</ReactMarkdown>
              </div>
            )}
          </CardSpotlight>
        ))}
      </div>
    </div>
  );
}

export default ChatInputBox;
