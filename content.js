// content.js
// Author:
// Author URI: https://
// Author Github URI: https://www.github.com/
// Project Repository URI: https://github.com/
// Description: Handles all the webpage level activities (e.g. manipulating page data, etc.)
// License: MIT

var lyrics = []; // original rows
var emptyRowsIndices = []; // contain indeces of empty rows

const getTargetLang = () => {
    return new Promise((resolve) => {
        chrome.storage.local.get("targetLang", (data) => {
            // console.log("Данные из storage:", data);
            resolve(data.targetLang || "en"); // "en" by default
        });
    });
};

const getSourceLang = () => {
    return "en"
}

const waitForLyrics = async (timeout = 5000) => {
    return new Promise((resolve) => {
        const startTime = Date.now();

        const checkLyrics = () => {
            let elements = document.querySelectorAll('[data-testid="fullscreen-lyric"]');
            if (elements.length > 0 || Date.now() - startTime > timeout) {
                resolve(elements);
            } else {
                requestAnimationFrame(checkLyrics);
            }
        };

        checkLyrics();
    });
};

const getOriginalLyrics = () => {
    let lyrics_tmp = [];
    let elements = document.querySelectorAll('[data-testid="fullscreen-lyric"]');

    emptyRowsIndices = [];

    elements.forEach((element, i) => {
        let row = element.textContent.trim();
        if (row !== "♪" && row !== "") {
            lyrics_tmp.push({ text: row, index: i });
        } else {
            emptyRowsIndices.push(i);
        }
    });

    return { lyrics_tmp, elements };
};

const translateLine = async (line, source = "en", target) => {
    if (!line) return "";

    const cacheKey = `translation-${source}-${target}-${line}`;
    const cachedTranslation = await chrome.storage.local.get(cacheKey);

    if (cachedTranslation[cacheKey]) {
        return cachedTranslation[cacheKey];
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(line)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const translation = data[0].map(sentence => sentence[0]).join(" ");
        await chrome.storage.local.set({ [cacheKey]: translation });
        return translation;
    } catch (error) {
        console.error("Ошибка перевода:", error);
        return "Cannot translate...";
    }
};

// add translate below original text
const addTranslation = async (elements, originalLyrics) => {
    for (let i = 0; i < originalLyrics.length; i++) {
        let { text, index } = originalLyrics[i];

        if (!elements[index].dataset.translated) {
            let translatedText = document.createElement("div");
            translatedText.classList.add("translated-text");
            translatedText.id = 'translated-text';
            
            let target = await getTargetLang();
            let source = await getSourceLang();
            let translatedLine = await translateLine(text, source, target);

            translatedText.textContent = translatedLine;

            elements[index].appendChild(translatedText);
            elements[index].dataset.translated = "true"; // Mark, that row already translated
            console.log("Перевод всех строк выполнен.");
        }
    }
    
};

const removeTranslations = () => {
    [...document.getElementsByClassName("translated-text")].forEach(n => n.remove());
}

const checkLyricsChange = (old_lyrics, new_lyrics) => {
    return JSON.stringify(old_lyrics.map(l => l.text)) !== JSON.stringify(new_lyrics.map(l => l.text))
};

// main lyrics processing foo
const processLyrics = async (force) => {
    let elements = await waitForLyrics();
    let { lyrics_tmp, elements: lyricElements } = getOriginalLyrics();

    if (await checkLyricsChange(lyrics_tmp, lyrics) || force) {
        lyrics = lyrics_tmp;

        await addTranslation(lyricElements, lyrics);
    }
};

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.action === "reloadTranslations") {
//         console.log("🔄 Получено сообщение: reloadTranslations");
        
//         // Удаляем старый перевод
//         [...document.getElementsByClassName("translated-text")].forEach(n => n.remove());
        
//         // Очистка кеша перевода
//         lyrics = [];
//         emptyRowsIndices = [];

//         // Перезапускаем процесс перевода
//         processLyrics(force = true); 
//         console.log("Перевод выполнен")

//         sendResponse({ status: "success" });
//     }
// });

chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "local" && changes.targetLang) {
        console.log("🌍 Язык изменён, перезапускаем перевод...");

        // Получаем новый язык
        const newLang = await getTargetLang();
        console.log(`🎯 Новый язык: ${newLang}`);

        // Очищаем старые данные
        lyrics = [];
        emptyRowsIndices = [];
        removeTranslations();

        // Ждём 100 мс, чтобы браузер успел обновить локальное хранилище
        setTimeout(() => processLyrics(true), 100);
    }
});


// start text processing
window.onload = () => {
    processLyrics();
};
