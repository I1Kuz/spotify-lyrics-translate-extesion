document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("target-lang");

    chrome.storage.local.get("targetLang", (data) => {
        if (data.targetLang) {
            select.value = data.targetLang;
        }
    });

    select.addEventListener("change", async (e) => {
        await chrome.storage.local.set({ targetLang: e.target.value });
        // Отправляем сообщение в content.js
        // chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        //     if (tabs[0]?.id) {
        //         chrome.tabs.sendMessage(tabs[0].id, { action: "reloadTranslations" }, (response) => {
        //             if (chrome.runtime.lastError) {
        //                 console.error("Ошибка отправки сообщения:", chrome.runtime.lastError.message);
        //             } else {
        //                 console.log("Сообщение успешно отправлено.");
        //             }
        //         });
        //     }
        // });
    });
});
