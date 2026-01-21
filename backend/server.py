from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from estnltk import Text
import uvicorn

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local dev OK
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    text: str

class SentenceSplitRequest(BaseModel):
    text: str


NEGATION_WORDS = {
    "ei", "ära", "ärge", "ärgu",
    "mitte",
    "pole", "polnud", "poleks", "poldud", "polnuks",
    "polegi", "polnudki", "polekski",
}

# ----------------------------
# Morph helpers
# ----------------------------

# Canonical 14-case keys you want in the extension:
# nom gen par ill ine ela all ade abl tra ter ess abe kom
CASE_ALIASES = {
    "nom": {"n", "nom"},
    "gen": {"g", "gen"},
    "par": {"p", "par"},

    "ill": {"ill"},
    "ine": {"ine", "in"},      # some taggers use "in"
    "ela": {"ela", "el"},      # some taggers use "el"

    "all": {"all"},
    "ade": {"ade", "ad"},      # some taggers use "ad"
    "abl": {"abl"},

    "tra": {"tra", "tr"},      # some taggers use "tr"
    "ter": {"ter"},
    "ess": {"ess", "es"},      # some taggers use "es"
    "abe": {"abe", "ab"},      # some taggers use "ab"
    "kom": {"kom", "com"},     # UD uses Comitative=Com, some use kom
}

def extract_case_from_form(form: str) -> str | None:
    """
    EstNLTK 'form' is usually a space-separated set of tags.
    Example-ish: "sg g", "pl el", "sg ill", etc.
    We map multiple possible aliases into canonical keys (nom/gen/par/ill/.../kom).
    """
    if not form:
        return None

    parts = set(form.lower().strip().split())
    if not parts:
        return None

    # Check in a stable priority order
    order = ["nom","gen","par","ill","ine","ela","all","ade","abl","tra","ter","ess","abe","kom"]
    for canonical in order:
        if parts & CASE_ALIASES[canonical]:
            return canonical

    return None


def extract_number_from_form(form: str) -> str | None:
    """
    Returns "sg" / "pl" / None based on morph 'form'.
    """
    if not form:
        return None
    parts = form.lower().strip().split()
    if "sg" in parts:
        return "sg"
    if "pl" in parts:
        return "pl"
    return None


def detect_verb_form(token_text: str, pos: str, form: str, lemma: str) -> str | None:
    """
    Very light verb form detection.
    Returns: "ma" | "da" | "part" | None
    """
    if (pos or "").upper() != "V":
        return None

    w = (token_text or "").lower()
    lem = (lemma or "").lower()
    f = (form or "").lower()

    # Infinitives: prefer lemma endings, fallback to surface form
    if lem.endswith("ma") or w.endswith("ma"):
        return "ma"
    if lem.endswith("da") or w.endswith("da"):
        return "da"

    # Participle: cheap + common endings
    if w.endswith(("nud", "tud", "dud")):
        return "part"
    if len(w) > 3 and w.endswith("v"):
        return "part"

    # Optional: if form contains explicit hints
    if "part" in f or "ptcp" in f:
        return "part"

    return None


def first_morph_analysis(word_span):
    """
    Returns (pos, form, lemma) from the first available analysis,
    handling Span/annotations and other possible structures.
    """
    pos, form, lemma = "X", "", ""

    ma = None

    if hasattr(word_span, "morph_analysis"):
        ma = getattr(word_span, "morph_analysis")

    if ma is None:
        try:
            ma = word_span["morph_analysis"]
        except Exception:
            ma = None

    if ma is None:
        return pos, form, lemma

    # Typical: Span with .annotations
    if hasattr(ma, "annotations"):
        try:
            anns = ma.annotations or []
            if anns:
                a0 = anns[0]
                pos = a0.get("partofspeech") or a0.get("pos") or "X"
                form = a0.get("form") or ""
                lemma = a0.get("lemma") or ""
                return pos, form, lemma
        except Exception:
            return pos, form, lemma

    # List of dict analyses
    if isinstance(ma, list) and ma:
        a0 = ma[0]
        if isinstance(a0, dict):
            pos = a0.get("partofspeech") or a0.get("pos") or "X"
            form = a0.get("form") or ""
            lemma = a0.get("lemma") or ""
            return pos, form, lemma

    # Older style fields
    try:
        if hasattr(ma, "partofspeech") and hasattr(ma, "form") and hasattr(ma, "lemma"):
            pos = ma.partofspeech[0] if ma.partofspeech else "X"
            form = ma.form[0] if ma.form else ""
            lemma = ma.lemma[0] if ma.lemma else ""
    except Exception:
        pass

    return pos, form, lemma


# ----------------------------
# Sentence splitting endpoint
# ----------------------------
@app.post("/sentences")
def sentences(req: SentenceSplitRequest):
    raw = req.text or ""
    if raw == "":
        return {"sentences": []}

    try:
        t = Text(raw)

        try:
            t.tag_layer(["sentences"])
        except Exception:
            pass

        try:
            if hasattr(t, "layers") and ("sentences" in t.layers):
                out = []
                for i, s in enumerate(t["sentences"]):
                    start = int(s.start)
                    end = int(s.end)
                    out.append({
                        "sentence_index": i,
                        "start": start,
                        "end": end,
                        "text": raw[start:end],
                    })
                return {"sentences": out}
        except Exception:
            pass

        return {"sentences": [{
            "sentence_index": 0,
            "start": 0,
            "end": len(raw),
            "text": raw
        }]}

    except Exception as e:
        print(f"❌ sentence split error: {e}")
        return {"sentences": [], "error": str(e)}


# ----------------------------
# Analyze endpoint
# ----------------------------
@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    q = (req.text or "")
    if not q.strip():
        return {"tokens": []}

    try:
        t = Text(q)
        t.tag_layer(["words", "morph_analysis"])

        tokens = []
        for w in t["words"]:
            token_text = w.text
            token_lower = token_text.lower()

            pos, form, lemma = first_morph_analysis(w)

            case = extract_case_from_form(form)      # ✅ now 14 cases
            num = extract_number_from_form(form)
            vform = detect_verb_form(token_text, pos, form, lemma)

            is_neg = (token_lower in NEGATION_WORDS) or ((lemma or "").lower() in NEGATION_WORDS)

            tokens.append({
                "text": token_text,
                "start": int(w.start),
                "end": int(w.end),

                # Keep your existing fields
                "pos": pos,          # "S","V","A","D","P","K","J","N",...
                "case": case,        # "nom"/"gen"/"par"/"ela"/.../"kom"/None
                "num": num,          # "sg"/"pl"/None
                "vform": vform,      # "ma"/"da"/"part"/None
                "neg": bool(is_neg),

                # Debug helpers (uncomment temporarily if needed)
                #"form": form,
                #"lemma": lemma,
            })

        return {"tokens": tokens}

    except Exception as e:
        print(f"❌ analyze error: {e}")
        return {"tokens": [], "error": str(e)}


if __name__ == "__main__":
    # Note: module path should match the filename without ".py"
    # If your file is server.py, this is correct:
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)