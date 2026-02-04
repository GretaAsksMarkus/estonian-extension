import estnltk
import os
import pkgutil

print(f"🔎 EstNLTK Version: {estnltk.__version__}")
print(f"📂 Location: {os.path.dirname(estnltk.__file__)}")

print("\nScanning 'estnltk.taggers' for syntax modules...")
taggers_path = os.path.join(os.path.dirname(estnltk.__file__), 'taggers')

if os.path.exists(taggers_path):
    submodules = [name for _, name, _ in pkgutil.iter_modules([taggers_path])]
    print(f"   Found submodules: {submodules}")
    
    if 'syntax' in submodules:
        print("   ✅ 'syntax' folder exists!")
    else:
        print("   ❌ 'syntax' folder is MISSING. This is the problem.")
else:
    print("❌ 'taggers' folder is missing!")