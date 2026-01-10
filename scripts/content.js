// scripts/content.js

console.log("🇪🇪 Estonian Extension Ready.");

// --- GLOBAL STATE ---
let analyzedData = null; // Store data to avoid re-fetching

// --- 1. LISTEN FOR MESSAGES FROM SIDE PANEL ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ANALYZE_PAGE") {
        analyzePage();
    } else if (request.action === "ACTIVATE_READING_MODE") {
        startReadingMode();
    } else if (request.action === "UPDATE_TOGGLES") {
        updateVisuals(request.toggles);
    }
});

// --- 2. THE MAIN ANALYSIS FUNCTION (THE RELAY FIX) ---
async function analyzePage() {
    // A. Collect text
    const elements = document.querySelectorAll('p, li, h1, h2, h3, blockquote');
    
    let textsToAnalyze = [];
    elements.forEach(el => {
        if (el.innerText.trim().length > 0) {
            textsToAnalyze.push(el.innerText);
        }
    });

    // Join with separator
    const fullText = textsToAnalyze.join("\n\n|||\n\n");
    console.log("Sending text to Background Relay...");

    // B. Send message to background.js (Fixes Mixed Content Error)
    chrome.runtime.sendMessage(
        { action: "FETCH_ANALYSIS", text: fullText },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error("Runtime Error:", chrome.runtime.lastError);
                return;
            }

            if (response && response.success) {
                console.log("Received analysis from Relay!", response.data);
                analyzedData = response.data; // Save for Reading Mode
                
                // C. Paint the DOM
                applyHighlights(elements, response.data.sentences);
            } else {
                console.error("Relay Connection Failed:", response ? response.error : "Unknown");
                alert("Could not connect to Estonian Engine. Is 'app.py' running?");
            }
        }
    );
}

// --- 3. THE PAINTER (MERGED & FIXED) ---
// scripts/content.js (Update this function)

// scripts/content.js

function applyHighlights(elements, sentData) {
    console.log("Painting safe...");

    // 1. Create a queue of analyzed words from Python
    let tokenQueue = [];
    if (sentData && sentData.length) {
        sentData.forEach(sentence => {
            sentence.forEach(word => tokenQueue.push(word));
        });
    }

    // 2. Iterate through the actual page elements
    elements.forEach(el => {
        const originalText = el.innerText;
        if (!originalText.trim()) return;

        // CRITICAL FIX: Split by keeping delimiters (spaces/punctuation) 
        // This ensures we never lose spaces or formatting.
        const parts = originalText.split(/(\s+|[.,;?!"])/);
        
        let newHTML = "";

        parts.forEach(part => {
            // A. If it's just whitespace or empty, keep it and move on
            if (!part.trim()) {
                newHTML += part;
                return;
            }

            // B. Check if this DOM word matches the next Python word
            let matchFound = false;

            if (tokenQueue.length > 0) {
                const candidate = tokenQueue[0];
                
                // Fuzzy Check: Does the DOM text contain the analyzed root?
                // (e.g. DOM: "jookseb," | Python: "jookseb") -> Match!
                if (part.toLowerCase().includes(candidate.text.toLowerCase())) {
                    
                    // --- DETERMINE CLASS ---
                    let classes = [];
                    // Adjectives (Purple)
                    if (candidate.category === "adj") classes.push("est-adj");
                    // Verbs (Green)
                    else if (candidate.category === "verb") classes.push("est-verb");
                    // Nouns (Blue)
                    else if (candidate.category === "noun") classes.push("est-noun");
                    // Proper Nouns
                    else if (candidate.category === "proper_noun") classes.push("est-proper-noun");
                    // Adverbs
                    else if (candidate.category === "adverb") classes.push("est-adverb");
                    // Pronouns
                    else if (candidate.category === "pronoun") classes.push("est-pronoun");
                    
                    // Cases
                    if (candidate.case === "gen") classes.push("est-case-gen");
                    if (candidate.case === "part") classes.push("est-case-part");

                    // --- BUILD HTML ---
                    // We wrap the ORIGINAL DOM text (part) to preserve punctuation
                    if (classes.length > 0) {
                        let content = part;
                        // Add Compound Dot if needed
                        if (candidate.compounds && candidate.compounds.length > 0) {
                            content = `<span class="est-compound-dot">●</span>` + content;
                        }
                        newHTML += `<span class="${classes.join(' ')}">${content}</span>`;
                    } else {
                        newHTML += part;
                    }

                    // Remove the used token from the queue
                    tokenQueue.shift();
                    matchFound = true;
                }
            }

            // C. FALLBACK: If no match, just print the original text.
            // This guarantees words will NEVER disappear again.
            if (!matchFound) {
                newHTML += part;
            }
        });

        // Only update if we actually built something
        if (newHTML.length > 0) {
            el.innerHTML = newHTML;
        }
    });
    
    console.log("Painting complete.");
}

// --- 4. TOGGLE VISIBILITY ---
function updateVisuals(toggles) {
    // This toggles classes on the BODY, allowing CSS to hide/show things globally
    document.body.classList.toggle('hide-verbs', !toggles.verbs);
    document.body.classList.toggle('hide-nouns', !toggles.nouns);
    // document.body.classList.toggle('hide-cases', !toggles.cases); 
}

// --- 5. READING MODE (NHS STYLE) ---
function startReadingMode() {
    if (!analyzedData) {
        alert("Please analyze the page first!");
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'est-reader-overlay';

    const nav = document.createElement('div');
    nav.id = 'est-reader-nav';
    nav.innerHTML = "<h3>Contents</h3><ul id='est-nav-list'></ul>";

    const content = document.createElement('div');
    content.id = 'est-reader-content';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'est-reader-close';
    closeBtn.innerText = "Exit Reading Mode";
    closeBtn.style.marginBottom = "20px";
    closeBtn.onclick = () => overlay.remove();
    content.appendChild(closeBtn);

    let sentenceBuffer = [];
    let sectionCount = 1;

    analyzedData.sentences.forEach((sentenceData) => {
        // Reconstruct sentence string
        const sentenceText = sentenceData.map(w => w.text).join(' ');
        sentenceBuffer.push(sentenceText);

        if (sentenceBuffer.length === 3) {
            renderSection(content, nav, sentenceBuffer, sectionCount);
            sentenceBuffer = [];
            sectionCount++;
        }
    });

    if (sentenceBuffer.length > 0) {
        renderSection(content, nav, sentenceBuffer, sectionCount);
    }

    overlay.appendChild(nav);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

function renderSection(container, nav, sentences, index) {
    const section = document.createElement('div');
    section.className = 'est-reader-section';
    section.id = `section-${index}`;

    const label = document.createElement('span');
    label.className = 'est-section-label';
    label.innerText = index;
    section.appendChild(label);

    sentences.forEach(s => {
        const p = document.createElement('span');
        p.className = 'est-reader-line';
        p.innerText = s;
        section.appendChild(p);
    });

    container.appendChild(section);

    const navItem = document.createElement('li');
    navItem.innerHTML = `<a href="#section-${index}">Section ${index}</a>`;
    nav.querySelector('ul').appendChild(navItem);
}