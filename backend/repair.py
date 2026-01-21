import sys
import stanza
from estnltk import Text
from estnltk.downloader import download

print("--- 🧠 NEURAL BRAIN REPAIR ---")

# 1. CHECK FOR THE HIDDEN HALF
try:
    # We try to import the neural package explicitly
    import estnltk_neural
    print(f"✅ EstNLTK-Neural Found: v{estnltk_neural.__version__}")
except ImportError:
    print("❌ EstNLTK-Neural is MISSING. Run: pip install estnltk-neural==1.7.4")
    sys.exit(1)

# 2. IMPORT THE TAGGER
# The Stanza tagger lives inside the neural package
print("\n⚙️  Locating Syntax Tagger...")
try:
    from estnltk_neural.taggers import StanzaSyntaxTagger
    print("✅ Tagger found in 'estnltk_neural'!")
except ImportError:
    try:
        # Fallback: Sometimes it merges into the main namespace
        from estnltk.taggers import StanzaSyntaxTagger
        print("✅ Tagger found in 'estnltk' (Namespace merged)!")
    except ImportError:
        print("❌ Could not find StanzaSyntaxTagger in either package.")
        sys.exit(1)

# 3. DOWNLOAD MODELS
print("\n⬇️  Checking Models...")
try:
    # The neural package often needs its own downloader or uses the main one
    download('stanza_syntax')
    stanza.download('et') 
    print("✅ Models checked.")
except Exception as e:
    print(f"⚠️ Model check warning: {e}")

# 4. RUN REAL TEST
print("\n🧪 Running Neural Test...")
try:
    # Initialize
    tagger = StanzaSyntaxTagger(output_layer='syntax')
    
    # Create Text
    text = Text('Suur koer jooksis aias.')
    text.tag_layer(['morph_analysis']) # Morph comes first
    
    # Apply Syntax
    tagger.tag(text)
    
    # Verify
    if 'syntax' in text.layers:
        print("✅ SUCCESS! Syntax layer created.")
        print(f"   Logic: {text.sentences[0].words[0].text} -> {text.sentences[0].words[0].syntax.deprel}")
    else:
        print("❌ FAILURE: Layer created but empty.")

except Exception as e:
    print(f"❌ Test Failed: {e}")