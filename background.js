// Listen for the command keyboard shortcut
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-outline") {
    // Check if the content script is already injected
    // We send a message and see if we get a response or an error
    chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script likely not injected yet, or tab not ready
        console.log("Outline script not ready or injected, injecting now.");
        injectContentScript(tab);
      } else {
        // Content script is there, just tell it to toggle
        console.log("Outline script already injected, sending toggle command.");
        chrome.tabs.sendMessage(tab.id, { action: "toggleOutline" });
      }
    });
  }
});

function injectContentScript(tab) {
  if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file'))) {
      chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content_script.js']
      }, (injectionResults) => {
          if (chrome.runtime.lastError || !injectionResults || injectionResults.length === 0) {
              console.error('Script injection failed:', chrome.runtime.lastError);
              return;
          }
          // After injecting, send the command to show the outline
          // Add a small delay to ensure the script is ready to listen
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: "toggleOutline" });
          }, 100); // 100ms delay
      });

      chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["outline.css"]
      }, () => {
        if (chrome.runtime.lastError) {
            console.error('CSS injection failed:', chrome.runtime.lastError);
        }
      });
  } else {
      console.log("Cannot inject script into this URL:", tab.url);
  }
}
