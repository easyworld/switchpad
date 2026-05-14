const METHOD_MAP = {
  1: 'TM_SQDIFF_NORMED',
  3: 'TM_CCORR_NORMED',
  5: 'TM_CCOEFF_NORMED'
};

let _cvReady = false;

self.onmessage = async function(e) {
  const msg = e.data;

  if (msg.type === 'init') {
    if (!_cvReady) {
      importScripts('https://docs.opencv.org/4.10.0/opencv.js');
      await new Promise(resolve => {
        if (typeof cv !== 'undefined' && cv.Mat) return resolve();
        const poll = setInterval(() => {
          if (typeof cv !== 'undefined' && cv.Mat) { clearInterval(poll); resolve(); }
        }, 50);
      });
      _cvReady = true;
    }
    self.postMessage({ type: 'ready', id: msg.id });
    return;
  }

  if (msg.type === 'match') {
    if (!_cvReady) {
      self.postMessage({ type: 'error', id: msg.id, message: 'OpenCV not ready' });
      return;
    }

    const t0 = performance.now();
    let srcMat = null, rangeMat = null, tmplMat = null, resultMat = null;

    try {
      const srcPixelData = new Uint8ClampedArray(msg.sourceBuffer);
      const imgData = { data: srcPixelData, width: msg.sourceWidth, height: msg.sourceHeight };
      srcMat = cv.matFromImageData(imgData);
      cv.cvtColor(srcMat, srcMat, cv.COLOR_RGBA2RGB);

      const lj = msg.labelJson;
      rangeMat = srcMat.roi(new cv.Rect(lj.RangeX, lj.RangeY, lj.RangeWidth, lj.RangeHeight));

      // Decode template PNG from base64 via cv.imdecode
      const binaryStr = atob(lj.ImgBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const rawMat = cv.matFromArray(1, bytes.length, cv.CV_8UC1, Array.from(bytes));
      tmplMat = cv.imdecode(rawMat, cv.IMREAD_COLOR);
      rawMat.delete();

      // Resize if needed
      const tw = lj.TargetWidth, th = lj.TargetHeight;
      if (tmplMat.cols !== tw || tmplMat.rows !== th) {
        const resized = new cv.Mat();
        cv.resize(tmplMat, resized, new cv.Size(tw, th));
        tmplMat.delete();
        tmplMat = resized;
      }

      // Template matching
      resultMat = new cv.Mat();
      const methodName = METHOD_MAP[lj.searchMethod] || 'TM_CCOEFF_NORMED';
      cv.matchTemplate(rangeMat, tmplMat, resultMat, cv[methodName]);

      const minMax = cv.minMaxLoc(resultMat);
      let score;
      if (lj.searchMethod === 1) {
        score = Math.round((1 - minMax.minVal) * 100);
      } else {
        score = Math.round(minMax.maxVal * 100);
      }
      score = Math.max(0, Math.min(100, score));

      self.postMessage({ type: 'result', id: msg.id, score, timeMs: Math.round(performance.now() - t0) });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: err.message });
    } finally {
      if (srcMat) srcMat.delete();
      if (rangeMat) rangeMat.delete();
      if (tmplMat) tmplMat.delete();
      if (resultMat) resultMat.delete();
    }
  }
};
