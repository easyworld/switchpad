window.ImgSearchDB = (() => {
  const DB_NAME = 'switchpad-imgsearch';
  const DB_VERSION = 1;
  const MAX_SCREENSHOTS = 50;

  let _db = null;

  function init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('screenshots')) {
          const ss = db.createObjectStore('screenshots', { keyPath: 'id', autoIncrement: true });
          ss.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('labels')) {
          db.createObjectStore('labels', { keyPath: 'name' });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function _tx(store, mode) {
    const tx = _db.transaction(store, mode);
    return tx.objectStore(store);
  }

  // ── Screenshots ──

  async function saveScreenshot(canvas) {
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const record = { blob, width: canvas.width, height: canvas.height, timestamp: Date.now() };
    const id = await new Promise((resolve, reject) => {
      const req = _tx('screenshots', 'readwrite').add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await _enforceScreenshotLimit();
    return id;
  }

  async function _enforceScreenshotLimit() {
    const all = await getAllScreenshots();
    if (all.length <= MAX_SCREENSHOTS) return;
    const excess = all.slice(MAX_SCREENSHOTS);
    const store = _tx('screenshots', 'readwrite');
    for (const item of excess) store.delete(item.id);
  }

  function getAllScreenshots() {
    return new Promise((resolve, reject) => {
      const req = _tx('screenshots', 'readonly').getAll();
      req.onsuccess = () => {
        const items = req.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function deleteScreenshot(id) {
    return new Promise((resolve, reject) => {
      const req = _tx('screenshots', 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function clearAllScreenshots() {
    return new Promise((resolve, reject) => {
      const req = _tx('screenshots', 'readwrite').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ── Labels ──

  function saveLabel(obj) {
    return new Promise((resolve, reject) => {
      const req = _tx('labels', 'readwrite').put(obj);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function getLabel(name) {
    return new Promise((resolve, reject) => {
      const req = _tx('labels', 'readonly').get(name);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function getAllLabels() {
    return new Promise((resolve, reject) => {
      const req = _tx('labels', 'readonly').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function deleteLabel(name) {
    return new Promise((resolve, reject) => {
      const req = _tx('labels', 'readwrite').delete(name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function clearAllLabels() {
    return new Promise((resolve, reject) => {
      const req = _tx('labels', 'readwrite').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  return {
    init,
    saveScreenshot, getAllScreenshots, deleteScreenshot, clearAllScreenshots,
    saveLabel, getLabel, getAllLabels, deleteLabel, clearAllLabels
  };
})();
