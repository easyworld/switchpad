window.ImgSearchUI = (() => {
  const $ = id => document.getElementById(id);

  let _isOpen = false;
  let _rafId = null;
  let _selectionMode = null; // null | 'range' | 'target'
  let _rangeRect = null;     // { x, y, w, h }
  let _targetRect = null;    // { x, y, w, h }
  let _zoom = 1;
  let _panX = 0, _panY = 0;
  let _loadedImage = null;   // Image object when a screenshot is loaded
  let _isDynamicTest = false;
  let _maxScore = 0;
  let _lastScore = 0;
  let _lastTimeMs = 0;
  let _fpsCounter = 0;
  let _fpsLast = 0;
  let _fpsDisplay = 0;
  let _isPanning = false;
  let _panStart = { x: 0, y: 0 };
  let _isSelecting = false;
  let _selStart = { x: 0, y: 0 };
  let _selCurrent = { x: 0, y: 0 };

  function init() {
    $('btn-img-search').addEventListener('click', open);
    $('btn-is-close').addEventListener('click', close);
    $('btn-is-screenshot').addEventListener('click', onScreenshot);
    $('btn-is-screenshot-history').addEventListener('click', toggleScreenshotPanel);
    $('btn-is-select-range').addEventListener('click', () => setSelectionMode('range'));
    $('btn-is-select-target').addEventListener('click', () => setSelectionMode('target'));
    $('btn-is-search-test').addEventListener('click', onSearchTest);
    $('btn-is-dynamic-test').addEventListener('click', toggleDynamicTest);
    $('btn-is-save-label').addEventListener('click', onSaveLabel);
    $('btn-is-reset-params').addEventListener('click', resetParams);
    $('btn-is-reset-target').addEventListener('click', () => { _targetRect = null; syncRectToInputs(); });
    $('btn-is-reset-range').addEventListener('click', () => { _rangeRect = null; syncRectToInputs(); });

    // Min update slider display
    $('is-min-update').addEventListener('input', (e) => {
      $('is-min-update-val').textContent = e.target.value;
    });

    // Section toggling
    document.querySelectorAll('.is-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.toggle;
        const body = $(targetId);
        header.classList.toggle('collapsed');
        body.classList.toggle('collapsed');
      });
    });

    // Canvas interactions
    const wrap = $('is-preview-area').querySelector('.is-canvas-wrap');
    wrap.addEventListener('mousedown', onCanvasMouseDown);
    wrap.addEventListener('mousemove', onCanvasMouseMove);
    wrap.addEventListener('mouseup', onCanvasMouseUp);
    wrap.addEventListener('wheel', onCanvasWheel, { passive: false });
    wrap.addEventListener('dblclick', onCanvasDblClick);
    wrap.addEventListener('contextmenu', e => e.preventDefault());

    // Position inputs sync
    ['is-tx', 'is-ty', 'is-tw', 'is-th', 'is-rx', 'is-ry', 'is-rw', 'is-rh'].forEach(id => {
      $(id).addEventListener('change', syncInputsToRect);
    });

    // Label management
    $('is-label-search').addEventListener('input', refreshLabelList);
    $('btn-is-import-label').addEventListener('click', () => $('is-import-file-input').click());
    $('is-import-file-input').addEventListener('change', onImportLabels);
    $('btn-is-export-zip').addEventListener('click', onExportZip);

    // Screenshot panel
    $('btn-is-ss-close').addEventListener('click', () => $('is-screenshot-panel').classList.add('hidden'));
    $('btn-is-ss-clear').addEventListener('click', onClearScreenshots);
    $('btn-is-ss-export-all').addEventListener('click', onExportAllScreenshots);

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _isOpen) close();
    });

    // Register label matcher with script engine
    window.ScriptEngine.setLabelMatcher(async (name) => {
      const video = $('video-el');
      if (!video.srcObject || video.readyState < 2) return 0;
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      const result = await window.ImgSearchEngine.matchLabelByName(name, c);
      return result.score;
    });
  }

  // ── Overlay lifecycle ──

  async function open() {
    await window.ImgSearchDB.init();
    _isOpen = true;
    _loadedImage = null;
    _zoom = 1;
    _panX = 0;
    _panY = 0;
    _maxScore = 0;

    $('video-container').style.display = 'none';
    $('img-search-overlay').classList.remove('hidden');

    // Resize canvases to match video dimensions
    const video = $('video-el');
    const preview = $('is-preview-canvas');
    const overlay = $('is-overlay-canvas');
    preview.width = video.videoWidth || 1920;
    preview.height = video.videoHeight || 1080;
    overlay.width = preview.width;
    overlay.height = preview.height;

    updateConnStatus();
    startRenderLoop();
    refreshLabelList();

    // Load OpenCV.js in background
    if (!window.ImgSearchEngine.isReady) {
      window.ImgSearchEngine.init().then(() => {
        showToast('OpenCV.js 加载完成');
      }).catch(() => {
        showToast('OpenCV.js 加载失败，搜图功能不可用', 'error');
      });
    }
  }

  function close() {
    _isOpen = false;
    _isDynamicTest = false;
    $('btn-is-dynamic-test').classList.remove('active');
    $('btn-is-dynamic-test').textContent = '动态测试';
    stopRenderLoop();

    $('img-search-overlay').classList.add('hidden');
    $('video-container').style.display = '';
    $('is-screenshot-panel').classList.add('hidden');
  }

  function startRenderLoop() {
    stopRenderLoop();
    _fpsLast = performance.now();
    _fpsCounter = 0;
    function loop() {
      renderFrame();
      _rafId = requestAnimationFrame(loop);
    }
    _rafId = requestAnimationFrame(loop);
  }

  function stopRenderLoop() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  // ── Rendering ──

  async function renderFrame() {
    const canvas = $('is-preview-canvas');
    const ctx = canvas.getContext('2d');
    const video = $('video-el');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw source image
    if (_loadedImage) {
      ctx.drawImage(_loadedImage, 0, 0, canvas.width, canvas.height);
    } else if (video.srcObject && video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    // Draw overlays
    drawOverlays();

    // Dynamic test
    if (_isDynamicTest && _rangeRect && _targetRect && window.ImgSearchEngine.isReady) {
      const method = parseInt($('is-search-method').value);
      const labelJson = buildLabelJson(method);
      if (labelJson) {
        const result = await window.ImgSearchEngine.matchLabel(canvas, labelJson);
        _lastScore = result.score;
        _lastTimeMs = result.timeMs;
        if (result.score > _maxScore) _maxScore = result.score;
        updateResultDisplay();
      }
    }

    // FPS
    _fpsCounter++;
    const now = performance.now();
    if (now - _fpsLast >= 1000) {
      _fpsDisplay = _fpsCounter;
      _fpsCounter = 0;
      _fpsLast = now;
      $('is-fps').textContent = _fpsDisplay + ' fps';
    }

    // Resolution display
    $('is-resolution').textContent = canvas.width + '×' + canvas.height;
  }

  function drawOverlays() {
    const overlay = $('is-overlay-canvas');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (_rangeRect) {
      drawRect(ctx, _rangeRect, '#ff3333', '搜索范围');
    }
    if (_targetRect) {
      drawRect(ctx, _targetRect, '#33ff33', '搜索目标');
    }

    // Selection in progress
    if (_isSelecting && _selectionMode) {
      const r = normalizeRect(_selStart.x, _selStart.y, _selCurrent.x, _selCurrent.y);
      const color = _selectionMode === 'range' ? 'rgba(255,51,51,0.4)' : 'rgba(51,255,51,0.4)';
      ctx.fillStyle = color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = _selectionMode === 'range' ? '#ff3333' : '#33ff33';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
  }

  function drawRect(ctx, r, color, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.font = '12px sans-serif';
    const text = `${label} ${r.w}×${r.h}`;
    const tw = ctx.measureText(text).width;
    const ty = r.y > 18 ? r.y - 4 : r.y + r.h + 14;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(r.x, ty - 12, tw + 8, 16);
    ctx.fillStyle = color;
    ctx.fillText(text, r.x + 4, ty);
  }

  // ── Canvas interactions ──

  function screenToImage(sx, sy) {
    const canvas = $('is-preview-canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.round((sx - rect.left) * scaleX),
      y: Math.round((sy - rect.top) * scaleY)
    };
  }

  function onCanvasMouseDown(e) {
    if (e.button === 0) {
      _isPanning = true;
      _panStart = { x: e.clientX, y: e.clientY };
    } else if (e.button === 2 && _selectionMode) {
      e.preventDefault();
      const pos = screenToImage(e.clientX, e.clientY);
      _isSelecting = true;
      _selStart = pos;
      _selCurrent = pos;
    }
  }

  function onCanvasMouseMove(e) {
    if (_isPanning) {
      _panX += e.clientX - _panStart.x;
      _panY += e.clientY - _panStart.y;
      _panStart = { x: e.clientX, y: e.clientY };
    }
    if (_isSelecting) {
      _selCurrent = screenToImage(e.clientX, e.clientY);
    }
  }

  function onCanvasMouseUp(e) {
    if (e.button === 0) {
      _isPanning = false;
    }
    if (e.button === 2 && _isSelecting) {
      _isSelecting = false;
      const r = normalizeRect(_selStart.x, _selStart.y, _selCurrent.x, _selCurrent.y);
      if (r.w > 2 && r.h > 2) {
        const canvas = $('is-preview-canvas');
        r.x = Math.max(0, r.x);
        r.y = Math.max(0, r.y);
        r.w = Math.min(r.w, canvas.width - r.x);
        r.h = Math.min(r.h, canvas.height - r.y);

        if (_selectionMode === 'range') {
          _rangeRect = r;
        } else {
          _targetRect = r;
        }
        syncRectToInputs();
        updateThumbnails();
      }
      setSelectionMode(null);
    }
  }

  function onCanvasWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    _zoom = Math.max(0.25, Math.min(8, _zoom * delta));
    const canvas = $('is-preview-canvas');
    canvas.style.transform = `scale(${_zoom}) translate(${_panX / _zoom}px, ${_panY / _zoom}px)`;
  }

  function onCanvasDblClick() {
    const canvas = $('is-preview-canvas');
    if (_zoom !== 1) {
      _zoom = 1; _panX = 0; _panY = 0;
      canvas.style.transform = '';
    } else {
      _zoom = 2;
      canvas.style.transform = 'scale(2)';
    }
  }

  function normalizeRect(x1, y1, x2, y2) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1)
    };
  }

  function setSelectionMode(mode) {
    _selectionMode = mode;
    $('btn-is-select-range').classList.toggle('active', mode === 'range');
    $('btn-is-select-target').classList.toggle('active', mode === 'target');
  }

  // ── Rect ↔ inputs sync ──

  function syncRectToInputs() {
    if (_targetRect) {
      $('is-tx').value = _targetRect.x;
      $('is-ty').value = _targetRect.y;
      $('is-tw').value = _targetRect.w;
      $('is-th').value = _targetRect.h;
    }
    if (_rangeRect) {
      $('is-rx').value = _rangeRect.x;
      $('is-ry').value = _rangeRect.y;
      $('is-rw').value = _rangeRect.w;
      $('is-rh').value = _rangeRect.h;
    }
  }

  function syncInputsToRect() {
    const tx = parseInt($('is-tx').value) || 0;
    const ty = parseInt($('is-ty').value) || 0;
    const tw = parseInt($('is-tw').value) || 0;
    const th = parseInt($('is-th').value) || 0;
    if (tw > 0 && th > 0) _targetRect = { x: tx, y: ty, w: tw, h: th };

    const rx = parseInt($('is-rx').value) || 0;
    const ry = parseInt($('is-ry').value) || 0;
    const rw = parseInt($('is-rw').value) || 0;
    const rh = parseInt($('is-rh').value) || 0;
    if (rw > 0 && rh > 0) _rangeRect = { x: rx, y: ry, w: rw, h: rh };

    updateThumbnails();
  }

  // ── Thumbnails ──

  function updateThumbnails() {
    const src = $('is-preview-canvas');

    if (_targetRect) {
      const tc = $('is-target-thumb');
      const ctx = tc.getContext('2d');
      ctx.clearRect(0, 0, tc.width, tc.height);
      ctx.drawImage(src, _targetRect.x, _targetRect.y, _targetRect.w, _targetRect.h, 0, 0, tc.width, tc.height);
    }

    if (_rangeRect) {
      const rc = $('is-range-thumb');
      const ctx = rc.getContext('2d');
      ctx.clearRect(0, 0, rc.width, rc.height);
      ctx.drawImage(src, _rangeRect.x, _rangeRect.y, _rangeRect.w, _rangeRect.h, 0, 0, rc.width, rc.height);
    }
  }

  // ── Screenshots ──

  async function onScreenshot() {
    const canvas = $('is-preview-canvas');
    const id = await window.ImgSearchDB.saveScreenshot(canvas);
    const all = await window.ImgSearchDB.getAllScreenshots();
    showToast(`截图已保存到截图历史（第 ${all.length} 张）`);
  }

  async function toggleScreenshotPanel() {
    const panel = $('is-screenshot-panel');
    if (!panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
      return;
    }
    await refreshScreenshotGrid();
    panel.classList.remove('hidden');
  }

  async function refreshScreenshotGrid() {
    const all = await window.ImgSearchDB.getAllScreenshots();
    $('is-ss-count').textContent = `共 ${all.length} 张`;

    const grid = $('is-ss-grid');
    grid.innerHTML = '';

    if (all.length === 0) {
      grid.innerHTML = '<div class="is-empty">暂无截图</div>';
      return;
    }

    for (let i = 0; i < all.length; i++) {
      const item = all[i];
      const url = URL.createObjectURL(item.blob);
      const date = new Date(item.timestamp);
      const dateStr = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

      const card = document.createElement('div');
      card.className = 'is-ss-card';
      card.innerHTML = `
        <img src="${url}" alt="screenshot">
        <div class="is-ss-card-info"><span>#${all.length - i}</span><span>${dateStr}</span></div>
        <div class="is-ss-card-actions">
          <button data-action="load" data-url="${url}">载入</button>
          <button data-action="download" data-url="${url}" data-name="screenshot_${item.id}.png">下载</button>
          <button data-action="delete" data-id="${item.id}">删除</button>
        </div>`;
      card.querySelector('[data-action="load"]').addEventListener('click', () => loadScreenshot(url));
      card.querySelector('[data-action="download"]').addEventListener('click', (e) => {
        const a = document.createElement('a');
        a.href = e.target.dataset.url;
        a.download = e.target.dataset.name;
        a.click();
      });
      card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
        await window.ImgSearchDB.deleteScreenshot(parseInt(e.target.dataset.id));
        refreshScreenshotGrid();
      });
      grid.appendChild(card);
    }
  }

  function loadScreenshot(url) {
    const img = new Image();
    img.onload = () => {
      _loadedImage = img;
      const canvas = $('is-preview-canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      $('is-overlay-canvas').width = img.naturalWidth;
      $('is-overlay-canvas').height = img.naturalHeight;
      _zoom = 1; _panX = 0; _panY = 0;
      canvas.style.transform = '';
      showToast('截图已载入预览');
    };
    img.src = url;
  }

  async function onClearScreenshots() {
    if (!confirm('确定清空所有截图？此操作不可撤销。')) return;
    await window.ImgSearchDB.clearAllScreenshots();
    await refreshScreenshotGrid();
    showToast('截图历史已清空');
  }

  async function onExportAllScreenshots() {
    const all = await window.ImgSearchDB.getAllScreenshots();
    if (all.length === 0) { showToast('无截图可导出', 'warn'); return; }
    if (typeof JSZip === 'undefined') { showToast('JSZip 未加载', 'error'); return; }
    const zip = new JSZip();
    for (const item of all) {
      zip.file(`screenshot_${item.id}.png`, item.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'screenshots.zip');
    showToast('截图已导出');
  }

  // ── Search test ──

  async function onSearchTest() {
    if (!window.ImgSearchEngine.isReady) { showToast('OpenCV.js 尚未加载完成', 'warn'); return; }
    if (!_rangeRect || !_targetRect) { showToast('请先圈选搜索范围和目标', 'warn'); return; }

    const canvas = $('is-preview-canvas');
    const method = parseInt($('is-search-method').value);
    const labelJson = buildLabelJson(method);
    if (!labelJson) return;

    const result = await window.ImgSearchEngine.matchLabel(canvas, labelJson);
    _lastScore = result.score;
    _lastTimeMs = result.timeMs;
    if (result.score > _maxScore) _maxScore = result.score;
    updateResultDisplay();
  }

  function toggleDynamicTest() {
    _isDynamicTest = !_isDynamicTest;
    const btn = $('btn-is-dynamic-test');
    btn.classList.toggle('active', _isDynamicTest);
    btn.textContent = _isDynamicTest ? '停止动态测试' : '动态测试';

    if (_isDynamicTest) {
      _maxScore = 0;
      // Disable conflicting buttons
      $('btn-is-save-label').disabled = true;
      $('btn-is-select-range').disabled = true;
      $('btn-is-select-target').disabled = true;
    } else {
      $('btn-is-save-label').disabled = false;
      $('btn-is-select-range').disabled = false;
      $('btn-is-select-target').disabled = false;
    }
  }

  function buildLabelJson(method) {
    if (!_rangeRect || !_targetRect) return null;

    // Extract target image as base64 PNG
    const canvas = $('is-preview-canvas');
    const tc = document.createElement('canvas');
    tc.width = _targetRect.w;
    tc.height = _targetRect.h;
    tc.getContext('2d').drawImage(canvas, _targetRect.x, _targetRect.y, _targetRect.w, _targetRect.h, 0, 0, tc.width, tc.height);
    const dataUrl = tc.toDataURL('image/png');
    const imgBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    return {
      searchMethod: method,
      ImgBase64: imgBase64,
      RangeX: _rangeRect.x,
      RangeY: _rangeRect.y,
      RangeWidth: _rangeRect.w,
      RangeHeight: _rangeRect.h,
      TargetX: _targetRect.x,
      TargetY: _targetRect.y,
      TargetWidth: _targetRect.w,
      TargetHeight: _targetRect.h
    };
  }

  function updateResultDisplay() {
    $('is-match-score').textContent = _lastScore + '%';
    $('is-match-time').textContent = _lastTimeMs + ' ms';
    $('is-max-score').textContent = _maxScore + '%';
    $('is-search-time').textContent = _lastTimeMs + ' ms';
    $('is-live-score').textContent = _lastScore + '%';
  }

  // ── Save / Load labels ──

  async function onSaveLabel() {
    if (window.ScriptEngine.isRunning) {
      showToast('脚本运行中禁止保存，请先停止脚本', 'error');
      return;
    }

    const name = $('is-label-name').value.trim();
    if (!name) { showToast('请输入标签名称', 'warn'); return; }
    if (!_rangeRect || !_targetRect) { showToast('请先圈选搜索范围和目标', 'warn'); return; }

    const method = parseInt($('is-search-method').value);
    const labelJson = buildLabelJson(method);
    if (!labelJson) return;

    const canvas = $('is-preview-canvas');

    // Check for existing label
    const existing = await window.ImgSearchDB.getLabel(name);
    if (existing && !confirm(`标签「${name}」已存在，是否覆盖？`)) return;

    const record = {
      name,
      fileName: name + '.IL',
      content: JSON.stringify(labelJson, null, 2),
      json: labelJson,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    await window.ImgSearchDB.saveLabel(record);
    showToast('标签已保存');
    await refreshLabelList();
  }

  function resetParams() {
    $('is-label-name').value = '';
    $('is-search-method').value = '5';
    $('is-min-update').value = '101';
    $('is-min-update-val').textContent = '101';
    _rangeRect = null;
    _targetRect = null;
    _maxScore = 0;
    _lastScore = 0;
    _lastTimeMs = 0;
    syncRectToInputs();
    $('is-match-score').textContent = '--';
    $('is-match-time').textContent = '--';
    $('is-max-score').textContent = '--';

    // Clear thumbnails
    ['is-target-thumb', 'is-range-thumb'].forEach(id => {
      const c = $(id);
      c.getContext('2d').clearRect(0, 0, c.width, c.height);
    });
  }

  function loadLabelToParams(label) {
    const j = label.json;
    $('is-label-name').value = label.name;
    $('is-search-method').value = j.searchMethod;

    _rangeRect = { x: j.RangeX, y: j.RangeY, w: j.RangeWidth, h: j.RangeHeight };
    _targetRect = { x: j.TargetX, y: j.TargetY, w: j.TargetWidth, h: j.TargetHeight };
    syncRectToInputs();

    // Clear loaded screenshot to use live video (or keep current)
    _loadedImage = null;
    updateThumbnails();
    showToast('标签已加载');
  }

  // ── Label list ──

  async function refreshLabelList() {
    const filter = ($('is-label-search').value || '').toLowerCase();
    const all = await window.ImgSearchDB.getAllLabels();
    const filtered = filter ? all.filter(l => l.name.toLowerCase().includes(filter)) : all;

    const list = $('is-label-list');
    list.innerHTML = '';

    if (filtered.length === 0) {
      list.innerHTML = '<div class="is-empty">暂无标签</div>';
      return;
    }

    for (const label of filtered) {
      const thumbSrc = 'data:image/png;base64,' + (label.json.ImgBase64 || '');
      const methodNames = { 1: '标准差', 3: '标准相关', 5: '标准相关系数' };

      const card = document.createElement('div');
      card.className = 'is-label-card';
      card.innerHTML = `
        <img class="is-label-thumb" src="${thumbSrc}" alt="${label.name}">
        <div class="is-label-info">
          <div class="is-label-name">${label.name}</div>
          <div class="is-label-meta">
            <span>${methodNames[label.json.searchMethod] || '未知'}</span>
          </div>
        </div>
        <div class="is-label-actions">
          <button data-action="load" title="加载">加载</button>
          <button data-action="export" title="导出">导出</button>
          <button data-action="delete" title="删除">删除</button>
        </div>`;

      card.querySelector('[data-action="load"]').addEventListener('click', (e) => {
        e.stopPropagation();
        loadLabelToParams(label);
      });
      card.querySelector('[data-action="export"]').addEventListener('click', (e) => {
        e.stopPropagation();
        exportSingleLabel(label);
      });
      card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`确定删除标签「${label.name}」？`)) return;
        await window.ImgSearchDB.deleteLabel(label.name);
        refreshLabelList();
      });
      card.addEventListener('dblclick', () => loadLabelToParams(label));

      list.appendChild(card);
    }
  }

  function exportSingleLabel(label) {
    const content = label.content || JSON.stringify(label.json, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    downloadBlob(blob, label.fileName);
    showToast('标签已导出');
  }

  // ── Import labels ──

  async function onImportLabels(e) {
    const files = e.target.files;
    if (!files.length) return;

    let imported = 0, skipped = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);

        if (!validateLabelJson(json)) { skipped++; continue; }
        if (json.searchMethod === 107) { skipped++; continue; }

        const name = file.name.replace(/\.[iI][lL]$/, '');
        const existing = await window.ImgSearchDB.getLabel(name);

        await window.ImgSearchDB.saveLabel({
          name,
          fileName: file.name,
          content: text,
          json,
          createdAt: existing ? existing.createdAt : Date.now(),
          updatedAt: Date.now()
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    showToast(`导入了 ${imported} 个标签${skipped > 0 ? '，跳过 ' + skipped + ' 个' : ''}`);
    await refreshLabelList();
    e.target.value = '';
  }

  function validateLabelJson(json) {
    const required = ['searchMethod', 'ImgBase64', 'RangeX', 'RangeY', 'RangeWidth', 'RangeHeight',
                      'TargetX', 'TargetY', 'TargetWidth', 'TargetHeight'];
    for (const key of required) {
      if (json[key] === undefined || json[key] === null) return false;
    }
    if (typeof json.searchMethod !== 'number') return false;
    if (typeof json.ImgBase64 !== 'string') return false;
    if (json.RangeWidth <= 0 || json.RangeHeight <= 0) return false;
    if (json.TargetWidth <= 0 || json.TargetHeight <= 0) return false;
    if (json.TargetWidth > json.RangeWidth || json.TargetHeight > json.RangeHeight) return false;
    return true;
  }

  // ── ZIP export ──

  async function onExportZip() {
    if (typeof JSZip === 'undefined') { showToast('JSZip 未加载', 'error'); return; }

    const zip = new JSZip();
    const scriptContent = $('script-editor').value || '';
    zip.file('main.ecs', scriptContent);

    const labels = await window.ImgSearchDB.getAllLabels();
    const folder = zip.folder('ImgLabel');
    for (const label of labels) {
      folder.file(label.fileName, label.content || JSON.stringify(label.json, null, 2));
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'switchpad-project.zip');
    showToast(`已导出 ${labels.length} 个标签`);
  }

  // ── Helpers ──

  function showToast(message, type = 'success', duration = 2000) {
    const container = $('is-toast-container');
    const toast = document.createElement('div');
    toast.className = `is-toast is-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function updateConnStatus() {
    const connected = window.SerialService.isConnected;
    $('is-conn-dot').className = 'is-dot' + (connected ? ' connected' : '');
    $('is-conn-text').textContent = connected ? '已连接' : '未连接';
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  return { init, open, close, refreshLabelList };
})();

document.addEventListener('DOMContentLoaded', window.ImgSearchUI.init);
