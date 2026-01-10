// background.js

// 1. Side Panel Setup
// Allows users to open the side panel by clicking the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));


// 2. The API Proxy (The Bridge between HTTPS and HTTP)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "FETCH_ANALYSIS") {
    
    // The Background script is allowed to talk to HTTP (localhost)
    fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: request.text })
    })
    .then(response => response.json())
    .then(data => {
      // Send the successful data back to content.js
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      console.error("Background Fetch Error:", error);
      // Send the error message back to content.js
      sendResponse({ success: false, error: error.message });
    });

    // CRITICAL: Return true to tell Chrome "I will send a response asynchronously"
    return true; 
  }
});