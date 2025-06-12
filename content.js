console.log("version: 7");

// 
// Globals
// 

let originalLyricsLines = [];
let emptyLineIndices = [];
let translatedLineIndices = [];
let translationCompleted = false;
let currentTrackLabel = "";
let toggleState = false;

// 
// Utilities
// 

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const applyStoredStyles = async () => {
    const { fontSize, fontStyle } = await getTranslatedTextStyles();

    document.querySelectorAll(".translated-text").forEach(el => {
        el.style.fontSize = fontSize;

        if (fontStyle === "bold") {
            el.style.fontWeight = "bold";
            el.style.fontStyle = "normal";
        } else if (fontStyle === "italic") {
            el.style.fontWeight = "350";
            el.style.fontStyle = "italic";
        } else {
            el.style.fontWeight = "350";
            el.style.fontStyle = "normal";
        }
    });
};

// 
// Lyrics Parsing & Detection
// 

const isLyricsButtonActive = () => {
    const lyricsButton = document.querySelector("[data-testid='lyrics-button']");
    return lyricsButton?.dataset?.active === "true";
};

const extractLyricsFromDOM = () => {
    const elements = document.querySelectorAll('[data-testid="fullscreen-lyric"]');
    const lines = [];
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

// 
// Translation
// 

const fetchTranslation = async (text, source = "en", target, attempt = 1) => {
    if (!text) return "";

    const cacheKey = `translation-${source}-${target}-${text.slice(0, 100)}`;
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) return cached[cacheKey];

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const translated = data[0].map(segment => segment[0]).join("");
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
    const delimiter = "|||";
    const textToTranslate = linesToTranslate.map(line => line.text).join(` ${delimiter} `);

    const translatedText = await fetchTranslation(textToTranslate, sourceLang, targetLang);
    const translatedLines = translatedText.split(new RegExp(`\\s*\\|\\|\\|\\s*`, 'g'));

    const { fontSize, fontStyle } = await getTranslatedTextStyles();

    translatedLines.forEach((translated, i) => {
        const line = linesToTranslate[i];
        if (!line) return;

        const container = elements[line.index];
        if (!container || translatedLineIndices.includes(line.index)) return;

        const originalLineElement = container.querySelector("div");
        const div = document.createElement("div");

        div.classList.add("translated-text");
        // Just copy classes from original div
        if (originalLineElement) {
            div.className = `${originalLineElement.className} translated-text`;
        }

        // Apply styles from storage
        div.style.fontSize = fontSize;
        if (fontStyle === "bold") {
            div.style.fontWeight = "bold";
            div.style.fontStyle = "normal";
        } else if (fontStyle === "italic") {
            div.style.fontWeight = "350";
            div.style.fontStyle = "italic";
        } else {
            div.style.fontWeight = "350";
            div.style.fontStyle = "normal";
        }

        div.textContent = translated;
        container.appendChild(div);

        translatedLineIndices.push(line.index);
    });

    translationCompleted = true;
    console.log("✅ Translation complete");
};

// 
// Resetting
// 

const clearAllTranslations = () => {
    [...document.getElementsByClassName("translated-text")].forEach(el => el.remove());
};

const resetTranslationState = () => {
    originalLyricsLines = [];
    emptyLineIndices = [];
    translatedLineIndices = [];
    translationCompleted = false;
    clearAllTranslations();
};

// 
// Track Detection
// 

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

// 
// Storage Helpers
// 

const getUserToggleState = async () => {
    try {
        if (!chrome?.runtime?.id) {
            console.warn("⚠️ chrome.runtime not active");
            return true;
        }

        const response = await chrome.runtime.sendMessage({ type: "get-toggle-state" });
        return response?.isToggleChecked ?? true;
    } catch (error) {
        console.warn("Failed to retrieve toggle state:", error);
        return true;
    }
};

const getTargetLanguage = async () => {
    try {
        if (!chrome?.runtime?.id) return "en";

        const response = await chrome.runtime.sendMessage({ type: "get-target-language" });
        return response?.targetLang ?? "en";
    } catch (error) {
        console.warn("Failed to retrieve target language:", error);
        return "en";
    }
};

const getTranslatedTextStyles = async () => {
    try {
        if (!chrome?.runtime?.id) {
            return { fontSize: "25px", fontStyle: "italic" };
        }

        const response = await chrome.runtime.sendMessage({ type: "get-translated-styles" });
        return {
            fontSize: response?.fontSize ?? "25px",
            fontStyle: response?.fontStyle ?? "italic"
        };
    } catch (error) {
        console.warn("Failed to retrieve styles:", error);
        return { fontSize: "25px", fontStyle: "italic" };
    }
};

// 
// Storage Listener
// 

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === "language-changed") {
        if (!toggleState) return;
        console.log(`Received ${message.type} message, reprocessing lyrics...`);
        resetTranslationState();

        await waitForLyricsToLoad();
        setTimeout(() => handleLyricsProcessing(), 250);
    }
    if (message.type === 'style-updated') {
        applyStoredStyles();
    }

    if (message.type === "toggle-updated") {
        console.log("Toggle was changed. Reloading logic...");
        toggleState = await getUserToggleState();

        if (!toggleState) {
            console.log("Toggle is false");
            resetTranslationState();
            return;
        }

        console.log("Toggle is true");
    }
});

// 
// Mutation Observer
// 

let observer;

const observeLyricsDisplay = () => {
    observer = new MutationObserver(async () => {
        if (!chrome?.runtime?.id) {
            console.log("Chrome runtime not available - observer not starting");
            return;
        }
        toggleState = await getUserToggleState();
        if (!toggleState) return;

        const lyricsVisible = isLyricsButtonActive();
        const trackHasChanged = hasTrackChanged();

        if (lyricsVisible && (trackHasChanged || !translationCompleted)) {
            console.log("New track or lyrics activated, beginning translation...");
            resetTranslationState();

            const elements = await waitForLyricsToLoad();
            if (elements.length > 0) {
                handleLyricsProcessing();
            } else {
                console.warn("Lyrics did not load in time.");
            }
        }

        if (!lyricsVisible) {
            resetTranslationState();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
};


observeLyricsDisplay();