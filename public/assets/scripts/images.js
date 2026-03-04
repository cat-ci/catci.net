const formatTestImages = {
  avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAFwAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAH21kYXQSAAoIGAAOSAhoNCAyCR/wAABAAACvsA==',
  webp: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEADMDOJaQAA3AA/uuuAAA='
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


async function loadImagesAndAnimate() {
  if (window.__cwImagesAnimated) return;
  window.__cwImagesAnimated = true;

  const bestFormat = await detectBestFormat();
  console.log('Detected best format:', bestFormat);

  const elements = document.querySelectorAll('[cw-image]');
  const missingKeys = [];
  const activeObjectURLs = new Set();

  function normalizeKey(rawKey) {
    const lastDot = rawKey.lastIndexOf('.');
    if (lastDot > 0) return rawKey.substring(0, lastDot).toLowerCase();
    return rawKey.toLowerCase();
  }

  const cacheResults = await Promise.all(
    Array.from(elements).map(async (el) => {
      const rawKey = el.getAttribute('cw-image');
      const key = normalizeKey(rawKey);
      const blob = await getCachedImage(key);
      return { el, key, blob };
    })
  );

  for (const r of cacheResults) {
    if (!r.blob) missingKeys.push(r.key);
  }

  let fileMap = {};
  if (missingKeys.length > 0) {
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

  for (const { el, key, blob } of cacheResults) {
    if (el.dataset.cwAnimated === 'true') continue;

    let dataUrl = null;
    let imgBlob = blob;

    if (!imgBlob && fileMap[key]) {
      imgBlob = await fileMap[key].async('blob');
      await cacheImage(key, imgBlob);
    }

    if (imgBlob) {
      dataUrl = URL.createObjectURL(imgBlob);
      activeObjectURLs.add(dataUrl);
    }

    if (!dataUrl) continue;

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
        svg.addEventListener('transitionend', () => {
          svg.remove();
        }, { once: true });
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