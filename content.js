// content.js
// Author:
// Author URI: https://
// Author Github URI: https://www.github.com/
// Project Repository URI: https://github.com/
// Description: Handles all the webpage level activities (e.g. manipulating page data, etc.)
// License: MIT



var lyrics = []; // original rows
var emptyRowsIndices = []; // contain indeces of empty rows

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

const getTargetLang = () => {
    return new Promise((resolve) => {
        chrome.storage.local.get("targetLang", (data) => {
            console.log("Данные из storage:", data);
            resolve(data.targetLang || "en"); // "en" by default
        });
    });
};

getTargetLang().then((lang) => console.log("Выбранный язык:", lang));

// add translate below original text
const addTranslation = async (elements, originalLyrics) => {
    for (let i = 0; i < originalLyrics.length; i++) {
        let { text, index } = originalLyrics[i];

        if (!elements[index].dataset.translated) {
            let translatedText = document.createElement("div");
            translatedText.classList.add("translated-text")
            translatedText.id = 'translated-text'

            let targetLang = await getTargetLang();
            let translatedLine = await translateLine(text, "en", targetLang);
            // console.log(`Translate: "${text}" -> "${translatedLine}"`);

            translatedText.textContent = translatedLine;

            elements[index].appendChild(translatedText);
            elements[index].dataset.translated = "true"; // Mark, that row already translated
        }
    }
};

// main lyrics processing foo
const processLyrics = async () => {
    let elements = await waitForLyrics();
    let { lyrics_tmp, elements: lyricElements } = getOriginalLyrics();

    if (JSON.stringify(lyrics_tmp.map(l => l.text)) !== JSON.stringify(lyrics.map(l => l.text))) {
        lyrics = lyrics_tmp;
        await addTranslation(lyricElements, lyrics);
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reloadTranslations") {
        console.log("Translate reload...");
        processLyrics(); // reload translate
        sendResponse({ success: true });
    }
});

// changes in DOM spectator lol 
const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;

    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.matches('[data-testid="fullscreen-lyric"]') && !node.dataset.translated) {
                shouldUpdate = true;
            }
        });
    });

    if (shouldUpdate) {
        processLyrics();
    }
});

// start text processing
window.onload = () => {
    processLyrics();
    observer.observe(document.body, { childList: true, subtree: true });
};
