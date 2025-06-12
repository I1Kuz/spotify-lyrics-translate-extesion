document.addEventListener("DOMContentLoaded", () => {

    const notifyActiveTab = (message) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, message);
            }
        });
    };

    // ==== Language ====
    const LanguageSelect = document.getElementById("target-lang");

    chrome.storage.local.get("targetLang", ({ targetLang }) => {
        if (targetLang) {
            LanguageSelect.value = targetLang;
        }
    });

    LanguageSelect.addEventListener("change", async (e) => {
        const newLang = e.target.value;
        const { targetLang: oldLang } = await chrome.storage.local.get("targetLang");

        if (newLang !== oldLang) {
            console.log("🔤 Changing language from", oldLang, "to", newLang);
            await chrome.storage.local.set({ targetLang: newLang });
            notifyActiveTab({ type: "language-changed" });
        }
    });

    // ==== Toggle ====
    const toggle = document.getElementById("toggle-input");

    chrome.storage.local.get("isToggleChecked", ({ isToggleChecked }) => {
        toggle.checked = typeof isToggleChecked === "boolean" ? isToggleChecked : true;
    });

    toggle.addEventListener("change", async () => {
        await chrome.storage.local.set({ isToggleChecked: toggle.checked });
        notifyActiveTab({ type: "toggle-updated" });
    });

    // ==== UI Settings ====
    const settings_btn = document.getElementById('settings-btn');
    const back_btn = document.getElementById('back-btn');
    const mainPage = document.querySelector('.main-page-wrapper');
    const settingsPage = document.querySelector('.settings-page-wrapper');

    settings_btn.addEventListener("click", () => {
        mainPage.classList.toggle("visible");
        settingsPage.classList.toggle("visible");
    });

    back_btn.addEventListener("click", () => {
        mainPage.classList.toggle("visible");
        settingsPage.classList.toggle("visible");
    });

    // ==== Fonts ====
    const fontSizeSelect = document.getElementById('font-size');
    const fontStyleSelect = document.getElementById('font-style');

    chrome.storage.local.get("fontSize", ({ fontSize }) => {
        if (fontSize) {
            fontSizeSelect.value = fontSize;
        }
    });

    chrome.storage.local.get("fontStyle", ({ fontStyle }) => {
        if (fontStyle) {
            fontStyleSelect .value = fontStyle;
        }
    });

    fontSizeSelect.addEventListener('change', () => {
        const newSize = fontSizeSelect.value;
        chrome.storage.local.set({ fontSize: newSize });
        notifyActiveTab({ type: "style-updated" });
    });

    fontStyleSelect.addEventListener('change', () => {
        const newStyle = fontStyleSelect.value;
        chrome.storage.local.set({ fontStyle: newStyle });
        notifyActiveTab({ type: "style-updated" });
    });

});
