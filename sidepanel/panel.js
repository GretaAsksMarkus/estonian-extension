// sidepanel/panel.js

document.getElementById('analyze-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) chrome.tabs.sendMessage(tab.id, { action: "ANALYZE_PAGE" });
});

// List of all toggle IDs
const toggleIds = [
    'toggle-proper', 
    'toggle-nouns', 
    'toggle-pronouns', 
    'toggle-verbs', 
    'toggle-adverbs'
];

// Add listener to ALL toggles
toggleIds.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('change', sendToggleState);
    }
});

function sendToggleState() {
    const toggles = {
        proper: document.getElementById('toggle-proper').checked,
        nouns: document.getElementById('toggle-nouns').checked,
        pronouns: document.getElementById('toggle-pronouns').checked,
        verbs: document.getElementById('toggle-verbs').checked,
        adverbs: document.getElementById('toggle-adverbs').checked
    };

    // Send to content script to update CSS classes
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: "UPDATE_TOGGLES", 
                toggles: toggles 
            });
        }
    });
}