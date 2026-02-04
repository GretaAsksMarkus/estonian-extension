console.log("✋ Estonian Highlighter content.js loaded (Mode 1)");

let IS_ACTIVE = false;
let IS_RUNNING = false;

const HIGHLIGHT_SPAN_CLASS = "esthl";
const BATCH_SIZE = 20;

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT",
  "TEXTAREA", "INPUT", "SELECT", "OPTION",
  "CODE", "PRE", "KBD", "SAMP",
]);

// -------------------------
// Normalizers (critical)
// -------------------------
function normalizePos(tok) {
  // Prefer UD upos if present; else your pos
  const raw = (tok.upos || tok.pos || "").toString().toUpperCase();

  // UD -> your internal letters
  if (raw === "NOUN" || raw === "PROPN") return "S";
  if (raw === "VERB" || raw === "AUX") return "V";
  if (raw === "ADJ") return "A";
  if (raw === "ADV") return "D";
  if (raw === "PRON" || raw === "DET") return "P";
  if (raw === "ADP" || raw === "POSTP" || raw === "PREP") return "K";
  if (raw === "CCONJ" || raw === "SCONJ") return "J";
  if (raw === "NUM") return "N";

  // Already in your tagset?
  if (["S","V","A","D","P","K","J","N","ADV"].includes(raw)) return raw === "ADV" ? "D" : raw;

  return "X";
}

function normalizeCase(tok) {
  // Supports tok.case (your backend), or UD feats Case=Ela, etc.
  const raw =
    tok.case ||
    tok.Case ||
    tok.feats?.Case ||
    tok.morph?.Case ||
    "";

  if (!raw) return "";

  const key = raw.toString().trim();
  const up = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();

  const map = {
    Nom: "nom",
    Gen: "gen",
    Par: "par",
    Ill: "ill",
    Ine: "ine",
    Ela: "ela",
    All: "all",
    Ade: "ade",
    Abl: "abl",
    Tra: "tra",
    Ter: "ter",
    Ess: "ess",
    Abe: "abe",
    Com: "kom", // UD uses Com
    Kom: "kom",
  };

  return map[up] || key.toLowerCase();
}

// -------------------------
// Settings coming from sidebar
// -------------------------
let SETTINGS = {
  // core POS toggles
  noun: true,      // S
  verb: true,      // V
  adj: true,       // A
  adv: true,       // D
  negation: true,

  // cases (14)
  nom: true,
  gen: true,
  par: true,
  ill: false,
  ine: false,
  ela: false,
  all: false,
  ade: false,
  abl: false,
  tra: false,
  ter: false,
  ess: false,
  abe: false,
  kom: false,

  // POS extras
  pron: false,     // P
  adp: false,      // K
  conj: false,     // J
  num: false,      // N

  // form toggles
  number: false,
  v_ma: false,
  v_da: false,
  v_part: false,

  // Reading Mode fine-tuning (driven by sidebar)
  rm_line: "medium",     // small | medium | large
  rm_letter: "medium",   // tight | medium | wide
  rm_chunk: "medium",    // off | small | medium | large (we use 3 options in UI)
  rm_width: "medium",    // wide | medium | narrow
};

// -------------------------
// Reading Mode helpers
// -------------------------
function applyReadingModeSettings() {
  const root = document.documentElement;
  const body = document.body;

  // Line-height
  const lineMap = { small: 1.75, medium: 2.2, large: 2.6 };
  const letterMap = { small: 0, medium: 0.02, large: 0.04 }; // em
  const widthMap = { wide: 90, medium: 72, narrow: 60 }; // ch

  const chunkKey = (SETTINGS.rm_chunk || "medium").toLowerCase();
  const lineKey = (SETTINGS.rm_line || "medium").toLowerCase();
  const letterKey = (SETTINGS.rm_letter || "medium").toLowerCase();
  const widthKey = (SETTINGS.rm_width || "medium").toLowerCase();

  // chunking: either off or controlled heights
  root.dataset.estChunking = chunkKey === "off" ? "off" : "on";
  if (body) body.dataset.estChunking = root.dataset.estChunking;

  // Set CSS variables (defined in styles.css :root)
  root.style.setProperty("--est-rm-line-height", String(lineMap[lineKey] ?? 2.2));
  root.style.setProperty("--est-rm-letter-spacing", `${letterMap[letterKey] ?? 0.02}em`);
  root.style.setProperty("--est-rm-max-width", `${widthMap[widthKey] ?? 72}ch`);

  // Gap presets: 3 UI options (small / medium / large) + off
  const gapPresets = {
    small: { gap: "1.1em", wide: "2.2em" },
    medium: { gap: "2em", wide: "4em" },
    large: { gap: "3em", wide: "6em" },
  };
  if (chunkKey !== "off") {
    const p = gapPresets[chunkKey] || gapPresets.medium;
    root.style.setProperty("--est-rm-gap", p.gap);
    root.style.setProperty("--est-rm-gap-wide", p.wide);
  }
}

// -------------------------
// Case number helpers
// -------------------------
const CASE_ORDER = [
  "nom","gen","par","ill","ine","ela","all","ade","abl","tra","ter","ess","abe","kom"
];

function syncCaseNumberClasses() {
  const root = document.documentElement;
  for (const c of CASE_ORDER) {
    root.classList.toggle(`est-case-num-${c}`, !!SETTINGS[c]);
  }
}

// -------------------------
// Messaging from Sidebar
// -------------------------
browser.runtime.onMessage.addListener((message) => {
  if (!message?.action) return;

  if (message.action === "ANALYZE_PAGE") {
    IS_ACTIVE = true;
    SETTINGS = { ...SETTINGS, ...(message.settings || {}) };
    syncGlobalModeClasses();
    startHighlight();
    return;
  }

  if (message.action === "STOP_ANALYSIS") {
    IS_ACTIVE = false;
    IS_RUNNING = false;
    removeHighlights();
    // Remove global UI classes so the page returns to normal.
    const html = document.documentElement;
    for (const c of [
      "nom","gen","par","ill","ine","ela","all","ade","abl","tra","ter","ess","abe","kom"
    ]) {
      html.classList.remove(`est-case-num-${c}`);
    }
    sendStatus("OFF — highlights removed.");
    return;
  }

  if (message.action === "UPDATE_VISUALS") {
    SETTINGS = { ...SETTINGS, ...(message.settings || {}) };
    syncGlobalModeClasses();
    refreshHighlightClasses();
    return;
  }

  if (message.action === "TOGGLE_READING_MODE") {
    const on = !!message.on;
    document.documentElement.classList.toggle("est-reading-mode", on);
    document.body?.classList.toggle("est-reading-mode", on);

    // Apply the current tuning whenever reading mode is toggled.
    applyReadingModeTuning();

    sendStatus(on ? "Reading mode: ON" : "Reading mode: OFF");
    return;
  }

  if (message.action === "UPDATE_READING_MODE_SETTINGS") {
    SETTINGS = { ...SETTINGS, ...(message.settings || {}) };
    applyReadingModeTuning();
    return;
  }
});

function applyReadingModeTuning() {
  const html = document.documentElement;

  // Chunking is controlled with data attribute (CSS handles show/hide)
  const chunk = (SETTINGS.rm_chunk || "medium").toLowerCase();
  html.dataset.estChunking = chunk;
  document.body?.setAttribute("data-est-chunking", chunk);

  // Line spacing
  const lineMap = { small: 1.6, medium: 2.1, large: 2.5 };
  const letterMap = { tight: "0em", medium: "0.02em", wide: "0.04em" };
  const widthMap = { wide: "90ch", medium: "72ch", narrow: "60ch" };

  // Chunk sizes (only matter when chunking isn't off)
  const gapMap = {
    small: { gap: "1.2em", wide: "2.4em" },
    medium: { gap: "2em", wide: "4em" },
    large: { gap: "3em", wide: "6em" },
    off: { gap: "0em", wide: "0em" },
  };

  const line = lineMap[(SETTINGS.rm_line || "medium").toLowerCase()] ?? lineMap.medium;
  const letter = letterMap[(SETTINGS.rm_letter || "medium").toLowerCase()] ?? letterMap.medium;
  const width = widthMap[(SETTINGS.rm_width || "medium").toLowerCase()] ?? widthMap.medium;
  const gaps = gapMap[chunk] ?? gapMap.medium;

  html.style.setProperty("--est-rm-line-height", String(line));
  html.style.setProperty("--est-rm-letter-spacing", String(letter));
  html.style.setProperty("--est-rm-max-width", String(width));
  html.style.setProperty("--est-rm-gap", String(gaps.gap));
  html.style.setProperty("--est-rm-gap-wide", String(gaps.wide));
}

function syncGlobalModeClasses() {
  // Show case numbers per-case when the case toggle is ON.
  // (This is what makes "(2)" appear next to a word when Gen is enabled.)
  const html = document.documentElement;
  const cases = [
    "nom","gen","par","ill","ine","ela","all","ade","abl","tra","ter","ess","abe","kom"
  ];
  for (const c of cases) {
    html.classList.toggle(`est-case-num-${c}`, !!SETTINGS[c]);
  }
}

function sendStatus(text, error = false) {
  browser.runtime.sendMessage({
    action: "STATUS_UPDATE",
    text,
    error,
  }).catch(() => {});
}

// -------------------------
// Main entry
// -------------------------
async function startHighlight() {
  if (IS_RUNNING) return;
  IS_RUNNING = true;

  sendStatus("Scanning visible text…");

  try {
    const nodes = collectTextNodes(document.body);
    sendStatus(`Found ${nodes.length} text nodes… analyzing…`);

    let i = 0;
    while (IS_ACTIVE && i < nodes.length) {
      const slice = nodes.slice(i, i + BATCH_SIZE);
      await processBatch(slice);
      i += BATCH_SIZE;
      await idle();
    }

    if (IS_ACTIVE) sendStatus("Done ✅");
  } catch (e) {
    console.error(e);
    sendStatus(`Error: ${String(e)}`, true);
  } finally {
    IS_RUNNING = false;
  }
}

function collectTextNodes(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node?.nodeValue) return NodeFilter.FILTER_REJECT;

        const text = node.nodeValue;
        if (!shouldAnalyzeText(text)) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest("[contenteditable='true']")) return NodeFilter.FILTER_REJECT;

        // Skip anything inside our own spans
        if (parent.closest(`.${HIGHLIGHT_SPAN_CLASS}`)) return NodeFilter.FILTER_REJECT;
        if (parent.classList?.contains(HIGHLIGHT_SPAN_CLASS)) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  const out = [];
  let n;
  while ((n = walker.nextNode())) out.push(n);
  return out;
}

/**
 * IMPORTANT FIX:
 * - Previously required length>=20 and a space → single-word nodes were never analyzed.
 * - Now we allow short nodes too, but still avoid junk.
 */
function shouldAnalyzeText(raw) {
  const t = (raw || "").trim();
  if (!t) return false;

  // Skip very long blocks (performance)
  if (t.length > 5000) return false;

  // Must have at least 2 letters (avoid pure punctuation)
  const letters = t.match(/[A-Za-zÄÖÜÕäöüõŠšŽž]/g)?.length || 0;
  if (letters < 2) return false;

  return true;
}

// -------------------------
// Analyze + wrap a batch
// -------------------------
async function processBatch(textNodes) {
  for (const node of textNodes) {
    if (!IS_ACTIVE) return;
    if (!node?.isConnected) continue;
    if (!node.nodeValue) continue;

    const original = node.nodeValue;
    if (!original.trim()) continue;

    const result = await browser.runtime.sendMessage({
      type: "ANALYZE_TEXT",
      text: original,
    });

    if (!result) continue;

    if (result?.error) {
      console.warn("Backend error:", result.error);
      sendStatus(`Backend error: ${result.error}`, true);
      continue;
    }

    if (!Array.isArray(result.tokens)) continue;

    // Sentence splitting (optional)
    let sentences = [];
    try {
      const sentRes = await browser.runtime.sendMessage({
        type: "SPLIT_SENTENCES",
        text: original,
      });
      sentences = sentRes?.sentences || [];
    } catch {
      sentences = [];
    }

    wrapTextNode(node, result.tokens, sentences);
  }
}

// -------------------------
// Wrapping logic (NO innerHTML)
// -------------------------
function wrapTextNode(textNode, tokens, sentences) {
  const text = textNode.nodeValue;
  if (!text) return;

    // sentence end offsets (server-provided preferred; fallback to regex if missing)
  let sentenceEnds = (sentences || [])
    .map(s => Number(s.end))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= text.length)
    .sort((a, b) => a - b);

  // Fallback: detect sentence ends inside this text node
  if (!sentenceEnds.length) {
    const reEnd = /[.!?]+(?=\\s|$)/g;
    const ends = [];
    let m;
    while ((m = reEnd.exec(text)) !== null) {
      ends.push(m.index + m[0].length);
    }
    sentenceEnds = ends;
  }

  let sentenceCount = 0;
  let endIdx = 0;

  function appendTextWithGaps(frag, start, end) {
    if (end <= start) return;

    if (!sentenceEnds.length) {
      frag.appendChild(document.createTextNode(text.slice(start, end)));
      return;
    }

    let local = start;
    while (endIdx < sentenceEnds.length && sentenceEnds[endIdx] <= end) {
      const se = sentenceEnds[endIdx];

      if (se > local) frag.appendChild(document.createTextNode(text.slice(local, se)));

      sentenceCount++;
      const gap = document.createElement("span");
      gap.className = "est-sentence-gap";
      if (sentenceCount % 3 === 0) gap.classList.add("wide");
      frag.appendChild(gap);

      local = se;
      endIdx++;
    }

    if (local < end) frag.appendChild(document.createTextNode(text.slice(local, end)));
  }

  // Normalize all tokens (wrap everything so toggles can reveal new categories without re-running)
  const highlightTokens = (tokens || [])
    .map(t => ({
      ...t,
      _posN: normalizePos(t),
      _caseN: normalizeCase(t),
    }))
    .sort((a, b) => a.start - b.start);

  // Validate offsets
  const safe = [];
  for (const t of highlightTokens) {
    if (
      typeof t.start === "number" &&
      typeof t.end === "number" &&
      t.start >= 0 &&
      t.end > t.start &&
      t.end <= text.length
    ) safe.push(t);
  }

  const frag = document.createDocumentFragment();

  if (!safe.length) {
    appendTextWithGaps(frag, 0, text.length);
  } else {
    let cursor = 0;

    for (const tok of safe) {
      if (tok.start < cursor) continue;

      appendTextWithGaps(frag, cursor, tok.start);

      const span = document.createElement("span");
      span.classList.add(HIGHLIGHT_SPAN_CLASS);

      // store normalized features
      span.dataset.pos = tok._posN || "X";
      span.dataset.case = tok._caseN || "";
      span.dataset.neg = tok.neg ? "1" : "0";
      span.dataset.num = tok.num || "";
      span.dataset.vform = tok.vform || "";

      applyClasses(span);

      span.textContent = text.slice(tok.start, tok.end);
      frag.appendChild(span);

      cursor = tok.end;
    }

    appendTextWithGaps(frag, cursor, text.length);
  }

  const parent = textNode.parentNode;
  if (!parent) return;

  parent.insertBefore(frag, textNode);
  parent.removeChild(textNode);
}

// -------------------------
// Token-level highlight decision
// -------------------------
function shouldHighlightToken(t) {
  const pos = (t._posN || t.pos || "").toUpperCase();
  const isNeg = !!t.neg;

  if (isNeg && SETTINGS.negation) return true;

  if (pos === "S" && SETTINGS.noun) return true;
  if (pos === "V" && SETTINGS.verb) return true;
  if (pos === "A" && SETTINGS.adj) return true;
  if (pos === "D" && SETTINGS.adv) return true;

  if (pos === "P" && SETTINGS.pron) return true;
  if (pos === "K" && SETTINGS.adp) return true;
  if (pos === "J" && SETTINGS.conj) return true;
  if (pos === "N" && SETTINGS.num) return true;

  return false;
}

// -------------------------
// Apply CSS classes
// -------------------------
function applyClasses(span) {
  // Remove known classes
  span.classList.remove(
    "est-noun-base", "est-verb-base", "est-adj-base", "est-adv-base",
    "est-pron-base", "est-adp-base", "est-conj-base", "est-num-base",
    "est-num-sg", "est-num-pl",
    "est-v-ma", "est-v-da", "est-v-part",
    "est-negation"
  );

  // Remove any previous case class est-case-*
  for (const c of [
    "nom","gen","par","ill","ine","ela","all","ade","abl","tra","ter","ess","abe","kom"
  ]) {
    span.classList.remove(`est-case-${c}`);
  }

  const pos = (span.dataset.pos || "").toUpperCase();
  const cas = (span.dataset.case || "").toLowerCase();
  const neg = span.dataset.neg === "1";
  const num = (span.dataset.num || "").toLowerCase();
  const vform = (span.dataset.vform || "").toLowerCase();

  // POS
  if (pos === "S" && SETTINGS.noun) span.classList.add("est-noun-base");
  if (pos === "V" && SETTINGS.verb) span.classList.add("est-verb-base");
  if (pos === "A" && SETTINGS.adj) span.classList.add("est-adj-base");
  if (pos === "D" && SETTINGS.adv) span.classList.add("est-adv-base");

  if (pos === "P" && SETTINGS.pron) span.classList.add("est-pron-base");
  if (pos === "K" && SETTINGS.adp) span.classList.add("est-adp-base");
  if (pos === "J" && SETTINGS.conj) span.classList.add("est-conj-base");
  if (pos === "N" && SETTINGS.num) span.classList.add("est-num-base");

  // Negation
  if (neg && SETTINGS.negation) span.classList.add("est-negation");

  // ✅ 14 cases (new system)
  if (cas && SETTINGS[cas]) {
    span.classList.add(`est-case-${cas}`);
  }

  // Number markers
  if (SETTINGS.number && num === "sg") span.classList.add("est-num-sg");
  if (SETTINGS.number && num === "pl") span.classList.add("est-num-pl");

  // Verb form markers
  if (SETTINGS.v_ma && vform === "ma") span.classList.add("est-v-ma");
  if (SETTINGS.v_da && vform === "da") span.classList.add("est-v-da");
  if (SETTINGS.v_part && vform === "part") span.classList.add("est-v-part");
}

function refreshHighlightClasses() {
  const spans = document.querySelectorAll(`span.${HIGHLIGHT_SPAN_CLASS}`);
  spans.forEach(applyClasses);
}

function removeHighlights() {
  const spans = Array.from(document.querySelectorAll(`span.${HIGHLIGHT_SPAN_CLASS}`));
  for (const span of spans) {
    const parent = span.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(span.textContent || ""), span);
    parent.normalize();
  }

  const gaps = Array.from(document.querySelectorAll("span.est-sentence-gap"));
  for (const g of gaps) g.remove();
}

function idle() {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => resolve(), { timeout: 200 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}
