chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "get-toggle-state") {
        chrome.storage.local.get("isToggleChecked", (result) => {
            sendResponse({ isToggleChecked: result.isToggleChecked });
        });
        return true;
    }

    if (message.type === "get-target-language") {
        chrome.storage.local.get("targetLang", (result) => {
            sendResponse({ targetLang: result.targetLang });
        });
        return true;
    }

    if (message.type === "get-translated-styles") {
        chrome.storage.local.get(["fontSize", "fontStyle"], (result) => {
            sendResponse({
                fontSize: result.fontSize,
                fontStyle: result.fontStyle
            });
        });
        return true;
    }
});

