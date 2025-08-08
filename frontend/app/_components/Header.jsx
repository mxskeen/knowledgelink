"use client";
import React, { useEffect, useState } from 'react';
import { Button } from "../../components/ui/button";
import { getApiUrl, API_CONFIG } from "../../lib/config";

export default function Header() {
  const [user, setUser] = useState(null);

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
  const logout = async () => { await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH_LOGOUT), { method: 'POST', credentials: 'include' }); setUser(null); };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-5xl mx-auto flex items-center justify-end p-3 sm:p-4">
        {user ? (
          <Button variant="outline" onClick={logout}>Sign out</Button>
        ) : (
          <Button onClick={login}>Sign in with Google</Button>
        )}
      </div>
    </header>
  );
} 