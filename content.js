// content.js
// Author: Ivan Kuznetsov
// Author URI: https://
// Author Github URI: https://www.github.com/I1Kuz
// Project Repository URI: https://github.com/I1Kuz/spotify-lyrics-translate-extesion
// Description: Handles all the webpage level activities (e.g. manipulating page data, etc.)
// License: MIT

console.log("version: 6")

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 Globals
// ─────────────────────────────────────────────────────────────────────────────

let originalLyricsLines = []; // all lyrics lines except empty ones
let emptyLineIndices = []; // indices of empty or ignored rows (e.g., "♪")
let translatedLineIndices = []; // indices of translated lines
let translationCompleted = false; // whether current lyrics have been translated
let currentTrackLabel = ""; // formatted string like "Artist, Artist* - Song"
let toggleState = false;

// ─────────────────────────────────────────────────────────────────────────────
// 🔁 Utilities
// ─────────────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const chunkArray = (array, size) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 Lyrics Parsing & Detection
// ─────────────────────────────────────────────────────────────────────────────

const isLyricsButtonActive = () => {
    const lyricsButton = document.querySelector("[data-testid='lyrics-button']");
    if (!lyricsButton) return false;
    return lyricsButton.dataset?.active === "true";
};

const extractLyricsFromDOM = () => {
    let elements = document.querySelectorAll('[data-testid="fullscreen-lyric"]');
    let lines = [];
    emptyLineIndices = [];

    elements.forEach((el, i) => {
        const text = el.textContent.trim();
        if (text && text !== "♪") {
            lines.push({ text, index: i });
        } else {
            emptyLineIndices.push(i);
        }
    });

    return { lines, elements };
};

const detectLanguage = async (text) => {
    return new Promise((resolve, reject) => {
        chrome.i18n.detectLanguage(text, (result) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else if (result?.languages?.length > 0) resolve(result.languages[0].language);
            else resolve(undefined);
        });
    });
};

const detectSourceLanguage = async () => {
    const { lines } = extractLyricsFromDOM();
    const combinedText = lines.map(line => line.text).join(" ");
    return await detectLanguage(combinedText);
};

const waitForLyricsToLoad = async (timeout = 5000) => {
    const start = Date.now();
    return new Promise(resolve => {
        const poll = () => {
            const elements = document.querySelectorAll('[data-testid="fullscreen-lyric"]');
            if (elements.length > 0 || Date.now() - start > timeout) {
                resolve(elements);
            } else {
                requestAnimationFrame(poll);
            }
        };
        poll();
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// 🌐 Translation
// ─────────────────────────────────────────────────────────────────────────────

const fetchTranslation = async (text, source = "en", target, attempt = 1) => {
    if (!text) return "";

    const cacheKey = `translation-${source}-${target}-${text}`;
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) return cached[cacheKey];

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const translated = data[0].map(segment => segment[0]).join(" ");
        await chrome.storage.local.set({ [cacheKey]: translated });
        return translated;
    } catch (err) {
        console.warn(`Attempt ${attempt} failed:`, err.message);
        if (attempt < 3) {
            await delay(1000 * attempt);
            return await fetchTranslation(text, source, target, attempt + 1);
        }
        return "Cannot translate...";
    }
};

const injectTranslatedLyrics = async (elements, originalLines) => {
    const targetLang = await getTargetLanguage();
    const sourceLang = await detectSourceLanguage();

    const linesToTranslate = originalLines.filter(line => !translatedLineIndices.includes(line.index));
    const chunks = chunkArray(linesToTranslate, 5);
    const translatedMap = {};

    for (const chunk of chunks) {
        const translatedTexts = await Promise.all(chunk.map(({ text }) => fetchTranslation(text, sourceLang, targetLang)));
        chunk.forEach((line, i) => {
            translatedMap[line.index] = translatedTexts[i];
            translatedLineIndices.push(line.index);
        });
        await delay(500);
    }

    Object.entries(translatedMap).forEach(([indexStr, translated]) => {
        const index = parseInt(indexStr);
        const container = elements[index];
        if (!container) return;

        if (!container.querySelector(".translated-text")) {
            const div = document.createElement("div");
            div.classList.add("translated-text");
            div.textContent = translated;
            container.appendChild(div);
        }
    });

    translationCompleted = true;
    console.log("✅ Translation complete");
};

const clearAllTranslations = () => {
    [...document.getElementsByClassName("translated-text")].forEach(el => el.remove());
};

// ─────────────────────────────────────────────────────────────────────────────
// 🧹 Resetting
// ─────────────────────────────────────────────────────────────────────────────

const resetTranslationState = () => {
    originalLyricsLines = [];
    emptyLineIndices = [];
    translatedLineIndices = [];
    translationCompleted = false;
    clearAllTranslations();
};

// ─────────────────────────────────────────────────────────────────────────────
// 🎵 Track Detection
// ─────────────────────────────────────────────────────────────────────────────

const getNowPlayingTrackLabel = () => {
    const widget = document.querySelector('[data-testid="now-playing-widget"]');
    if (!widget) return null;

    const songNode = widget.querySelector('a[data-testid="context-item-link"]');
    const artistNodes = widget.querySelectorAll('a[data-testid="context-item-info-artist"]');

    if (!songNode || artistNodes.length === 0) return null;

    const song = songNode.textContent.trim();
    const artists = Array.from(artistNodes).map(a => a.textContent.trim()).join(", ");
    return `${artists} - ${song}`;
};

const hasTrackChanged = () => {
    const newTrack = getNowPlayingTrackLabel();
    if (!newTrack) return false;

    if (newTrack !== currentTrackLabel) {
        currentTrackLabel = newTrack;
        return true;
    }
    return false;
};

const handleLyricsProcessing = async () => {
    const { lines, elements } = extractLyricsFromDOM();
    await injectTranslatedLyrics(elements, lines);
};

// ─────────────────────────────────────────────────────────────────────────────
// 📦 Storage Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getUserToggleState = async () => {
    try {
        const { isToggleChecked } = await chrome.storage.local.get("isToggleChecked");
        return isToggleChecked ?? true;
    } catch (error) {
        console.error("Failed to retrieve toggle state:", error);
        return true;
    }
};

const getTargetLanguage = async () => {
    try {
        const { targetLang } = await chrome.storage.local.get("targetLang");
        return targetLang || "en";
    } catch (error) {
        console.error("Failed to retrieve target language:", error);
        return "en";
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔄 Storage Listener
// ─────────────────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === "language-changed") {
        if (!toggleState) return;
        console.log(`📩 Received ${message.type} message, reprocessing lyrics...`);
        resetTranslationState();

        await waitForLyricsToLoad();
        setTimeout(() => handleLyricsProcessing(), 250);
    }

    if (message.type === "toggle-updated") {
        console.log("🔘 Toggle was changed. Reloading logic...");
        toggleState = await getUserToggleState();

        if (!toggleState) {
            console.log("🔘 Toggle is false");
            resetTranslationState();
            return;
        }

        console.log("🔘 Toggle is true");
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 👁️ Mutation Observer
// ─────────────────────────────────────────────────────────────────────────────

let observer;

const observeLyricsDisplay = () => {
    observer = new MutationObserver(async () => {
        toggleState = await getUserToggleState();

        if(!toggleState) {return}

        const lyricsVisible = isLyricsButtonActive();
        const trackHasChanged = hasTrackChanged();

        if (lyricsVisible && (trackHasChanged || !translationCompleted)) {
            console.log("🎶 New track or lyrics activated, beginning translation...");
            resetTranslationState();

            const elements = await waitForLyricsToLoad();
            if (elements.length > 0) {
                handleLyricsProcessing();
            } else {
                console.warn("❌ Lyrics did not load in time.");
            }
        }

        if (!lyricsVisible) {
            resetTranslationState();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
};


observeLyricsDisplay();