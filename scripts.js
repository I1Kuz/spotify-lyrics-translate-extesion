document.addEventListener("DOMContentLoaded", () => {

    // Lang
    const select = document.getElementById("target-lang");

    chrome.storage.local.get("targetLang", (data) => {
        if (data.targetLang) {
            select.value = data.targetLang;
        }
    });

    select.addEventListener("change", async (e) => {
        const newLang = e.target.value;
        const { targetLang: oldLang } = await chrome.storage.local.get("targetLang");
    
        console.log("🔤 Changing language from", oldLang, "to", newLang);
    
        if (newLang !== oldLang) {

            await chrome.storage.local.set({ targetLang: newLang });

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { type: "language-changed" });
            });
        }
    });

    // Toggle

    const toggle = document.getElementById("toggle-input");

    chrome.storage.local.get("isToggleChecked", (data) => {
        if (typeof data.isToggleChecked === "boolean") {
            toggle.checked = data.isToggleChecked;
        } else {
            toggle.checked = true; 
        }
    });

    toggle.addEventListener("change", async () => {
        const isChecked = toggle.checked;

        await chrome.storage.local.set({ isToggleChecked: isChecked });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: "toggle-updated" });
        });
    });


});
