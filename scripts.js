document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("target-lang");

    chrome.storage.local.get("targetLang", (data) => {
        if (data.targetLang) {
            select.value = data.targetLang;
        }
    });

    select.addEventListener("change", async (e) => {
        await chrome.storage.local.set({ targetLang: e.target.value });

        // delete old translate
        [...document.getElementsByClassName("translated-text")].forEach(n => n.remove());

        // send message to content.js, if it is already loaded
        chrome.runtime.sendMessage({ action: "reloadTranslations" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Ошибка отправки сообщения:", chrome.runtime.lastError.message);
            } else {
                console.log("Сообщение успешно отправлено.");
            }
        });
    });
});
