// background.js — calls local FastAPI backend (Mode 1 + sentence splitting)

browser.runtime.onMessage.addListener(async (msg) => {
  if (!msg?.type) return;

  if (msg.type === "ANALYZE_TEXT") {
    try {
      const res = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.text }),
      });

      if (!res.ok) return { tokens: [], error: `Backend HTTP ${res.status}` };
      return await res.json();
    } catch (e) {
      return { tokens: [], error: `Fetch failed: ${String(e)}` };
    }
  }

  if (msg.type === "SPLIT_SENTENCES") {
    try {
      const res = await fetch("http://127.0.0.1:8000/sentences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.text }),
      });

      if (!res.ok) return { sentences: [], error: `Backend HTTP ${res.status}` };
      return await res.json();
    } catch (e) {
      return { sentences: [], error: `Fetch failed: ${String(e)}` };
    }
  }
});