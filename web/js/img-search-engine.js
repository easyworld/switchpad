window.ImgSearchEngine = (() => {
  let _cvReady = false;
  let _cvLoading = false;

  const METHOD_MAP = {
    1: 'TM_SQDIFF_NORMED',
    3: 'TM_CCORR_NORMED',
    5: 'TM_CCOEFF_NORMED'
  };

  async function init() {
    if (_cvReady) return;
    if (_cvLoading) {
      await _waitForCV();
      return;
    }
    _cvLoading = true;

    if (typeof cv !== 'undefined' && cv.Mat) {
      _cvReady = true;
      _cvLoading = false;
      return;
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.10.0/opencv.js';
      script.async = true;
      const onReady = () => { _cvReady = true; _cvLoading = false; resolve(); };
      script.onload = () => {
        if (typeof cv !== 'undefined') {
          if (cv.onRuntimeInitialized !== undefined) {
            cv.onRuntimeInitialized = onReady;
          } else if (cv.Mat) {
            onReady();
          } else {
            const poll = setInterval(() => {
              if (cv.Mat) { clearInterval(poll); onReady(); }
            }, 100);
          }
        } else {
          reject(new Error('OpenCV.js load failed'));
        }
      };
      script.onerror = () => { _cvLoading = false; reject(new Error('Failed to load OpenCV.js')); };
      document.head.appendChild(script);
    });
  }

  function _waitForCV() {
    return new Promise(resolve => {
      const poll = setInterval(() => {
        if (_cvReady) { clearInterval(poll); resolve(); }
      }, 100);
    });
  }

  function _decodeBase64ToCanvas(base64) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = 'data:image/png;base64,' + base64;
    });
  }

  function _canvasToMat(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mat = cv.matFromImageData(imgData);
    cv.cvtColor(mat, mat, cv.COLOR_RGBA2RGB);
    return mat;
  }

  async function matchLabel(sourceCanvas, labelJson) {
    if (!_cvReady) return { score: -1, timeMs: 0 };

    const t0 = performance.now();
    let srcMat = null, rangeMat = null, tmplCanvas = null, tmplMat = null, resultMat = null;

    try {
      srcMat = _canvasToMat(sourceCanvas);

      const rx = labelJson.RangeX, ry = labelJson.RangeY;
      const rw = labelJson.RangeWidth, rh = labelJson.RangeHeight;
      rangeMat = srcMat.roi(new cv.Rect(rx, ry, rw, rh));

      tmplCanvas = await _decodeBase64ToCanvas(labelJson.ImgBase64);
      tmplMat = _canvasToMat(tmplCanvas);

      // Resize template to match TargetWidth/TargetHeight if needed
      const tw = labelJson.TargetWidth, th = labelJson.TargetHeight;
      if (tmplMat.cols !== tw || tmplMat.rows !== th) {
        const resized = new cv.Mat();
        cv.resize(tmplMat, resized, new cv.Size(tw, th));
        tmplMat.delete();
        tmplMat = resized;
      }

      resultMat = new cv.Mat();
      const methodName = METHOD_MAP[labelJson.searchMethod] || 'TM_CCOEFF_NORMED';
      const method = cv[methodName];
      cv.matchTemplate(rangeMat, tmplMat, resultMat, method);

      let score;
      const minMax = cv.minMaxLoc(resultMat);
      if (labelJson.searchMethod === 1) {
        score = Math.round((1 - minMax.minVal) * 100);
      } else {
        score = Math.round(minMax.maxVal * 100);
      }
      score = Math.max(0, Math.min(100, score));

      const timeMs = performance.now() - t0;
      return { score, timeMs: Math.round(timeMs) };
    } catch (e) {
      console.error('matchLabel error:', e);
      return { score: -1, timeMs: 0 };
    } finally {
      if (srcMat) srcMat.delete();
      if (rangeMat) rangeMat.delete();
      if (tmplMat) tmplMat.delete();
      if (resultMat) resultMat.delete();
    }
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
    get isReady() { return _cvReady; }
  };
})();
