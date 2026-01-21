Estonian Highlighter (Mode 1)

A Firefox browser extension that makes Estonian grammar visible while reading, designed especially for dyslexic and neurodivergent language learners.

This project overlays grammatical cues directly onto real web content, without breaking pages or slowing browsing.

# What this is (and is not)
    ✅ What it does

        Works on any Estonian webpage

        Highlights language features in-place, no page reload

        Fast, lightweight, and stable across modern websites

        Designed as a reading aid, not a full grammar parser

    ❌ What it deliberately does not do

        No dependency parsing

        No phrase trees or clause structures

        No sentence rewriting or simplification

        No cloud NLP or user tracking

        This is Mode 1 only: fast reading support.

Features (Mode 1 Scope)
Visual highlighting
Parts of speech
Nouns
Verbs
Adjectives
Adverbs
Cases (for nominals)
Nominative
Genitive
Partitive
Negation

ei, mitte, ära, pole, etc.

Interaction

Master toggle ON / OFF

Per-feature toggles (POS, cases, negation)

Highlights can be updated live without re-analysis

Clean removal (no page reload required)

Architecture Overview
Firefox Page
   │
   ▼
content.js  ←──────────── sidebar.js (UI + toggles)
   │
   ▼
background.js (message broker)
   │
   ▼
FastAPI backend (local)
   │
   ▼
EstNLTK morphological analysis

Why this architecture works
1. No DOM breakage

The extension never rewrites innerHTML

Only text nodes are split and wrapped

JavaScript frameworks (React/Vue/etc.) keep working

2. Offset-based NLP contract

Backend returns token offsets, not HTML

Frontend maps offsets to text nodes safely

No encoding or injection issues

3. Incremental rendering

Text nodes processed in small batches

Uses requestIdleCallback (or fallback)

Pages stay responsive

4. Lightweight NLP

Uses only EstNLTK:

words

morph_analysis

No syntax parsing → fast startup and response

Backend API
Endpoint

POST /analyze

Request
{
  "text": "Ma ei lähe täna poodi."
}

Response
{
  "tokens": [
    {
      "text": "Ma",
      "start": 0,
      "end": 2,
      "pos": "P",
      "case": "nom",
      "neg": false
    },
    {
      "text": "ei",
      "start": 3,
      "end": 5,
      "pos": "D",
      "case": null,
      "neg": true
    }
  ]
}


Returned data is intentionally minimal and stable.

Folder Structure
Estonian-Highlighter-Firefox_1/
├─ extension/        # Firefox WebExtension
│  ├─ content.js
│  ├─ background.js
│  ├─ sidebar.html
│  ├─ sidebar.js
│  ├─ styles.css
│  └─ manifest.json
│
├─ backend/          # Local NLP backend
│  └─ server.py
│
├─ venv/             # Python virtual environment (local)
└─ README.md

Installation (Local Development)
1. Backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn estnltk
cd backend
python server.py


Backend runs at:

http://127.0.0.1:8000


Leave this terminal open.

2. Firefox Extension

Open Firefox

Go to about:debugging

Select This Firefox

Click Load Temporary Add-on

Choose extension/manifest.json

Usage

Open any Estonian webpage

Open the extension sidebar

Toggle ON

Adjust which features are highlighted

Toggle OFF to cleanly remove highlights

Known Limitations (by design)

Shadow DOM and iframe content is not analyzed

Very large single text nodes (> ~2000 chars) are skipped

Negation detection is lexical, not syntactic

Accuracy depends on EstNLTK morphological tagging

These tradeoffs are intentional to preserve speed and stability.

Design Philosophy

This project treats reading as a sensory and cognitive activity.

Instead of:

simplifying text

rewriting sentences

forcing grammar drills

It reveals structure visually, letting the reader:

slow down

notice patterns

build intuition over time

Especially suited for:

dyslexic learners

autistic / ADHD learners

advanced second-language readers

Future Directions (out of scope for now)

Readability-based article extraction

Sentence-level chunking

Phrase capsules (NP/VP)

Offline packaging or native messaging host

UI presets for different learner profiles

Status

🧠 Experimental but functional
🚧 Active development
🎯 Mode 1 intentionally locked and stable