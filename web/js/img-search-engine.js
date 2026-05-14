window.ImgSearchEngine = (() => {
  let _worker = null;
  let _ready = false;
  let _initPromise = null;
  let _nextId = 0;
  const _pending = new Map();

  function _handleMessage(e) {
    const msg = e.data;
    const pending = _pending.get(msg.id);
    if (!pending) return;
    _pending.delete(msg.id);

    if (msg.type === 'ready') {
      _ready = true;
      pending.resolve();
    } else if (msg.type === 'result') {
      pending.resolve({ score: msg.score, timeMs: msg.timeMs });
    } else if (msg.type === 'error') {
      pending.reject(new Error(msg.message));
    }
  }

  function _handleError(err) {
    console.error('Worker error:', err);
    for (const [, p] of _pending) p.reject(new Error('Worker error'));
    _pending.clear();
  }

  async function init() {
    if (_ready) return;
    if (_initPromise) return _initPromise;

    _initPromise = new Promise((resolve, reject) => {
      _worker = new Worker('js/img-search-worker.js');
      _worker.onmessage = _handleMessage;
      _worker.onerror = (err) => { _handleError(err); reject(new Error('Worker initialization failed')); };

      const id = _nextId++;
      _pending.set(id, { resolve, reject });
      _worker.postMessage({ type: 'init', id });
    });

    try {
      await _initPromise;
    } catch (e) {
      _initPromise = null;
      throw e;
    }
  }

  async function matchLabel(sourceCanvas, labelJson) {
    if (!_ready) return { score: -1, timeMs: 0 };

    return new Promise((resolve, reject) => {
      const ctx = sourceCanvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const buffer = imgData.data.buffer;
      const id = _nextId++;
      _pending.set(id, { resolve, reject });

      _worker.postMessage({
        type: 'match',
        id,
        sourceWidth: sourceCanvas.width,
        sourceHeight: sourceCanvas.height,
        sourceBuffer: buffer,
        labelJson
      }, [buffer]);
    });
  }

  async function matchLabelByName(labelName, previewCanvas) {
    const label = await window.ImgSearchDB.getLabel(labelName);
    if (!label) return { score: 0, timeMs: 0 };
    return matchLabel(previewCanvas, label.json);
  }

  return {
    init,
    matchLabel,
    matchLabelByName,
    get isReady() { return _ready; }
  };
})();
