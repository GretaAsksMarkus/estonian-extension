from flask import Flask, request, jsonify
from flask_cors import CORS
from estnltk import Text
import sys

# i am doing a change hehe

app = Flask(__name__)
CORS(app)

def get_safe_value(word, attr_name):
    try:
        val = getattr(word, attr_name, None)
        if val is None: return ""
        if isinstance(val, list): return " ".join([str(v) for v in val])
        return str(val)
    except:
        return ""

def analyze_text(input_text):
    print(f"Analyzing {len(input_text)} chars...", file=sys.stderr)
    try:
        text = Text(input_text)
        text.tag_layer()
    except Exception as e:
        print(f"EstNLTK Init Error: {e}", file=sys.stderr)
        return []

    # Filter out pure noise (punctuation, single letters)
    STOP_WORDS = {'on', 'ole', 'oli', 'olnud', 'ja', 'ning', 'või', 'aga', 'ei'}

    response_data = []

    for sentence in text.sentences:
        sentence_data = []
        for word in sentence.words:
            try:
                pos_tag = get_safe_value(word, 'partofspeech')
                form    = get_safe_value(word, 'form')
                
                category = "other"
                clean_text = word.text.lower().strip()

                # backend/app.py

                if clean_text not in STOP_WORDS:
                    
                    # 1. VERBS (Green)
                    if 'V' in pos_tag: 
                        category = "verb"

                    # 2. ADJECTIVES (Moved UP to prioritize over Proper Nouns)
                    # This fixes "Kodumaiste" being marked as a Name
                    elif 'A' in pos_tag or 'C' in pos_tag or 'U' in pos_tag:
                        category = "adj"
                    
                    # 3. PROPER NOUNS (Names)
                    elif 'H' in pos_tag: 
                        category = "proper_noun"

                    # 4. COMMON NOUNS
                    elif 'S' in pos_tag: 
                        if len(word.text) > 1:
                            category = "noun"

                    # 5. PRONOUNS
                    elif 'P' in pos_tag:
                        category = "pronoun"
                    
                    # 6. ADVERBS
                    elif 'D' in pos_tag:
                        category = "adverb"

                sentence_data.append({
                    "text": word.text,
                    "category": category,
                    "case": None,
                    "compounds": [] 
                })

            except Exception as e:
                sentence_data.append({"text": word.text, "category": "other", "case": None, "compounds": []})
        
        response_data.append(sentence_data)

    return response_data

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    if not data or 'text' not in data: return jsonify({"error": "No text"}), 400
    try:
        results = analyze_text(data['text'])
        return jsonify({"sentences": results})
    except Exception as e:
        print(f"CRITICAL: {e}", file=sys.stderr)
        return jsonify({"sentences": []})

if __name__ == '__main__':
    print("🇪🇪 Estonian Engine (Design System 2.0) Starting...")
    app.run(debug=True, port=5000)