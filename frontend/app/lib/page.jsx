"use client";
import React, { useEffect, useState } from "react";
import { getApiUrl, fetchWithRetry, API_CONFIG } from "../../lib/config";
import CardSpotlight from "../../components/ui/CardSpotlight";
import ReactMarkdown from "react-markdown";

export const dynamic = "error";

export default function LibraryPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithRetry(getApiUrl(API_CONFIG.ENDPOINTS.LINKS), { credentials: 'include' });
        const data = await r.json();
        setLinks(data.links || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Library</h1>
      {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
      <div className="grid grid-cols-1 gap-4">
        {links.map((link) => (
          <CardSpotlight key={link.id} className="p-4">
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