const formatTestImages = {
  avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAFwAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAH21kYXQSAAoIGAAOSAhoNCAyCR/wAABAAACvsA==',
  webp: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEADMDOJaQAA3AA/uuuAAA=',
};

function testFormat(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0 && img.height >= 0);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function detectBestFormat() {
  const supportsAvif = await testFormat(formatTestImages.avif);
  if (supportsAvif) return 'avif';
  const supportsWebp = await testFormat(formatTestImages.webp);
  if (supportsWebp) return 'webp';
  return 'png';
}

const DB_NAME = 'cwImageCacheDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let openDBHandle = null;

function openDB() {
  if (openDBHandle) return Promise.resolve(openDBHandle);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      openDBHandle = request.result;
      window.addEventListener('beforeunload', () => {
        try {
          openDBHandle.close();
          openDBHandle = null;
        } catch (e) {}
      });
      resolve(openDBHandle);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getCachedImage(name) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(name);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Cache read failed:', err);
    return null;
  }
}

async function cacheImage(name, blob) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to cache', name, err);
  }
}

// Fetch raw text from all <style> tags and <link rel="stylesheet"> files.
// CORS-blocked external sheets are skipped gracefully.
async function fetchAllCSSTexts() {
  const texts = [];

  for (const tag of document.querySelectorAll('style')) {
    texts.push(tag.textContent || '');
  }

  const linkFetches = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]')
  ).map(async (link) => {
    try {
      const res = await fetch(link.href);
      if (res.ok) return await res.text();
      console.warn('CSS fetch non-ok:', link.href, res.status);
    } catch (e) {
      console.warn('CSS fetch failed (likely CORS):', link.href, e);
    }
    return '';
  });

  const fetched = await Promise.all(linkFetches);
  texts.push(...fetched);

  return texts;
}

// Scan raw CSS text for /*cw-image: "filename";*/ comments inside rules.
// Handles loose spacing, missing quotes, either quote style.
// Returns [{ selector, imageName }]
function parseCSSForCWImages(cssText) {
  const results = [];
  const commentRegex = /\/\*[\s\S]*?\*\//g;
  let match;

  while ((match = commentRegex.exec(cssText)) !== null) {
    const commentText = match[0];
    if (!/cw-image/i.test(commentText)) continue;

    const valueMatch =
      /cw-image\s*:\s*["']?\s*([^"';\s*\/]+)\s*["']?/i.exec(commentText);
    if (!valueMatch) continue;

    const imageName = valueMatch[1].trim();
    if (!imageName) continue;

    const commentStart = match.index;

    // Walk back to find the { that opens the containing rule
    let braceDepth = 0;
    let ruleOpenBrace = -1;
    for (let i = commentStart - 1; i >= 0; i--) {
      const ch = cssText[i];
      if (ch === '}') {
        braceDepth++;
      } else if (ch === '{') {
        if (braceDepth === 0) {
          ruleOpenBrace = i;
          break;
        }
        braceDepth--;
      }
    }
    if (ruleOpenBrace === -1) continue;

    // Walk back from { to find selector start
    let selectorStart = 0;
    for (let i = ruleOpenBrace - 1; i >= 0; i--) {
      const ch = cssText[i];
      if (ch === '}' || ch === '{') {
        selectorStart = i + 1;
        break;
      }
    }

    const selector = cssText
      .substring(selectorStart, ruleOpenBrace)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    if (!selector || selector.startsWith('@')) continue;

    results.push({ selector, imageName });
  }

  return results;
}

// The single injected <style> element we accumulate all generated rules into.
// Created once, appended to <head>, updated as blobs are resolved.
let cwStyleSheet = null;

function ensureCWStyleSheet() {
  if (cwStyleSheet) return cwStyleSheet;
  cwStyleSheet = document.createElement('style');
  cwStyleSheet.id = 'cw-generated-styles';
  document.head.appendChild(cwStyleSheet);
  return cwStyleSheet;
}

function injectBackgroundRule(selector, objectURL) {
  const sheet = ensureCWStyleSheet();
  // Append the rule as text — works for any selector including pseudo-elements
  sheet.textContent += `${selector}{background-image:url("${objectURL}");}\n`;
}

async function loadImagesAndAnimate() {
  if (window.__cwImagesAnimated) return;
  window.__cwImagesAnimated = true;

  const bestFormat = await detectBestFormat();
  console.log('Detected best format:', bestFormat);

  const activeObjectURLs = new Set();

  function normalizeKey(rawKey) {
    const lastDot = rawKey.lastIndexOf('.');
    if (lastDot > 0) return rawKey.substring(0, lastDot).toLowerCase();
    return rawKey.toLowerCase();
  }

  // --- Attribute-based images ([cw-image="..."]) ---
  const elements = document.querySelectorAll('[cw-image]');

  const cacheResults = await Promise.all(
    Array.from(elements).map(async (el) => {
      const rawKey = el.getAttribute('cw-image');
      const key = normalizeKey(rawKey);
      const blob = await getCachedImage(key);
      return { el, key, blob };
    })
  );

  // --- CSS comment-based images ---
  const cssTexts = await fetchAllCSSTexts();
  const cssMappings = cssTexts.flatMap((text) => parseCSSForCWImages(text));

  // Deduplicate selector+imageName pairs across sheets
  const seen = new Set();
  const uniqueMappings = cssMappings.filter(({ selector, imageName }) => {
    const id = `${selector}||${imageName}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const cssCacheResults = await Promise.all(
    uniqueMappings.map(async ({ selector, imageName }) => {
      const key = normalizeKey(imageName);
      const blob = await getCachedImage(key);
      return { selector, key, blob };
    })
  );

  // --- Collect all missing keys across both sources ---
  const missingKeySet = new Set();
  for (const r of cacheResults) {
    if (!r.blob) missingKeySet.add(r.key);
  }
  for (const r of cssCacheResults) {
    if (!r.blob) missingKeySet.add(r.key);
  }

  let fileMap = {};

  if (missingKeySet.size > 0) {
    console.log('Missing images, fetching ZIP...');
    const zipPath = `./assets/${bestFormat}-images.zip`;
    try {
      const res = await fetch(zipPath);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        for (const [filename, file] of Object.entries(zip.files)) {
          if (!file.dir) {
            const name = normalizeKey(filename.split('/').pop());
            fileMap[name] = file;
          }
        }
      } else {
        console.warn('ZIP fetch failed with status', res.status);
      }
    } catch (err) {
      console.warn('ZIP load failed:', err);
    }
  } else {
    console.log('All images were already cached.');
  }

  // --- Apply attribute-based images ---
  for (const { el, key, blob } of cacheResults) {
    if (el.dataset.cwAnimated === 'true') continue;

    let imgBlob = blob;
    if (!imgBlob && fileMap[key]) {
      imgBlob = await fileMap[key].async('blob');
      await cacheImage(key, imgBlob);
    }
    if (!imgBlob) continue;

    const dataUrl = URL.createObjectURL(imgBlob);
    activeObjectURLs.add(dataUrl);

    const img = document.createElement('img');
    img.src = dataUrl;
    img.loading = 'lazy';
    const altText = el.getAttribute('cw-alt');
    img.alt = altText || key;

    el.appendChild(img);
    el.dataset.cwAnimated = 'true';

    requestAnimationFrame(() => {
      img.classList.add('fade-in');
      const svg = el.querySelector('svg');
      if (svg) {
        svg.classList.add('fade-out');
        svg.addEventListener('transitionend', () => svg.remove(), {
          once: true,
        });
      }
    });

    img.addEventListener('load', () => {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(dataUrl);
          activeObjectURLs.delete(dataUrl);
        } catch (e) {}
      }, 5000);
    });
  }

  // --- Apply CSS comment-based background images via injected <style> ---
  for (const { selector, key, blob } of cssCacheResults) {
    let imgBlob = blob;
    if (!imgBlob && fileMap[key]) {
      imgBlob = await fileMap[key].async('blob');
      await cacheImage(key, imgBlob);
    }
    if (!imgBlob) {
      console.warn('cw-image CSS: no blob resolved for key:', key);
      continue;
    }

    const objectURL = URL.createObjectURL(imgBlob);
    activeObjectURLs.add(objectURL);

    // Inject into the shared <style> tag — works for pseudo-elements too
    injectBackgroundRule(selector, objectURL);
  }

  // --- Cleanup on unload ---
  window.addEventListener('beforeunload', () => {
    for (const url of activeObjectURLs) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    }
    activeObjectURLs.clear();

    if (openDBHandle) {
      try {
        openDBHandle.close();
      } catch (e) {}
      openDBHandle = null;
    }
  });
}

document.addEventListener('DOMContentLoaded', loadImagesAndAnimate);