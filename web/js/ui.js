window.UI = (() => {
  const BTN = window.SwitchButton;

  // DOM refs
  const $ = id => document.getElementById(id);
  const videoEl = $('video-el');
  const serialHint = $('serial-hint');
  const btnSerial = $('btn-serial-connect');
  const selVideo = $('sel-video-source');
  const btnVideo = $('btn-video-start');
  const selAudio = $('sel-audio-device');
  const btnAudio = $('btn-audio-start');
  const btnKeymapping = $('btn-keymapping');
  const btnReload = $('btn-reload-config');
  const inputCidr = $('input-cidr');
  const btnWakeup = $('btn-wakeup');
  const btnWakeupHelp = $('btn-wakeup-help');
  const btnFullscreen = $('btn-fullscreen');
  const btnWakeupHelpClose = $('btn-wakeup-help-close');
  const btnScriptLoad = $('btn-script-load');
  const btnScriptRun = $('btn-script-run');
  const btnScriptStop = $('btn-script-stop');
  const btnScriptClear = $('btn-script-clear');
  const btnGuideClose = $('btn-guide-close');
  const btnScriptGuide = $('btn-script-guide');
  const scriptFileInput = $('script-file-input');
  const homeSerialDot = $('home-serial-dot');
  const homeSerialText = $('home-serial-text');
  const homeVideoDot = $('home-video-dot');
  const homeVideoText = $('home-video-text');
  const homeAudioDot = $('home-audio-dot');
  const homeAudioText = $('home-audio-text');
  const homeWakeupText = $('home-wakeup-text');
  const scriptEditor = $('script-editor');
  const scriptOutput = $('script-output');

  let _isFullscreen = false;
  let _isKeymappingOpen = false;
  let _isScriptPanelOpen = false;

  function init() {
    // Setup video element
    window.VideoService.setVideoElement(videoEl);

    // Status listeners
    window.SerialService.onStatusChange(onSerialStatus);
    window.VideoService.onStatusChange(onVideoStatus);
    window.AudioService.onStatusChange(onAudioStatus);
    window.GamepadService.onButtonStateChanged(onGamepadInput);

    // Button events
    btnSerial.addEventListener('click', onSerialClick);
    btnVideo.addEventListener('click', onVideoClick);
    btnAudio.addEventListener('click', onAudioClick);
    btnKeymapping.addEventListener('click', onKeymappingClick);
    btnReload.addEventListener('click', onReloadClick);
    btnWakeup.addEventListener('click', onWakeupClick);
    btnFullscreen.addEventListener('click', toggleFullscreen);
    btnScriptLoad.addEventListener('click', () => scriptFileInput.click());
    scriptFileInput.addEventListener('change', onScriptFileLoad);
    btnScriptRun.addEventListener('click', onScriptRun);
    btnScriptStop.addEventListener('click', onScriptStop);
    btnScriptClear.addEventListener('click', () => { scriptOutput.textContent = ''; });
    btnScriptGuide.addEventListener('click', (e) => { e.stopPropagation(); openScriptGuide(); });
    btnGuideClose.addEventListener('click', () => $('guide-overlay').classList.add('hidden'));
    $('guide-overlay').addEventListener('click', (e) => { if (e.target === $('guide-overlay')) $('guide-overlay').classList.add('hidden'); });

    // Wakeup help modal
    btnWakeupHelp.addEventListener('click', (e) => { e.stopPropagation(); $('wakeup-help-overlay').classList.remove('hidden'); });
    btnWakeupHelpClose.addEventListener('click', () => $('wakeup-help-overlay').classList.add('hidden'));
    $('wakeup-help-overlay').addEventListener('click', (e) => { if (e.target === $('wakeup-help-overlay')) $('wakeup-help-overlay').classList.add('hidden'); });

    // Script panel resizer
    initResizer();

    // Keyboard events
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Cleanup
    window.addEventListener('beforeunload', onBeforeUnload);

    // Fullscreen change
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        _isFullscreen = false;
        document.getElementById('app').classList.remove('fullscreen');
      }
    });

    // Load config and populate
    loadConfiguration();

    // Start gamepad polling
    window.GamepadService.start();

    // Set keymapping open state callback
    window.KeyMappingUI.onOpenChange(open => { _isKeymappingOpen = open; });
  }

  async function loadConfiguration() {
    const config = window.ConfigService.loadConfig();
    inputCidr.value = config.wakeupCidr || '';

    // Enumerate devices once (triggers getUserMedia permission)
    await refreshDevices();

    // Auto-start video
    if (config.videoSourceId) {
      if ([...selVideo.options].some(o => o.value === config.videoSourceId)) {
        selVideo.value = config.videoSourceId;
        window.VideoService.startCapture(config.videoSourceId);
      }
    }

    // Auto-start audio
    if (config.audioDeviceId) {
      if ([...selAudio.options].some(o => o.value === config.audioDeviceId)) {
        selAudio.value = config.audioDeviceId;
        window.AudioService.startCapture(config.audioDeviceId);
      }
    }
  }

  async function refreshDevices() {
    const videos = await window.VideoService.getAvailableDevices();
    selVideo.innerHTML = '<option value="">-- 选择设备 --</option>';
    videos.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label;
      selVideo.appendChild(opt);
    });

    const audios = await window.AudioService.getAvailableDevices();
    selAudio.innerHTML = '<option value="">-- 选择设备 --</option>';
    audios.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label;
      selAudio.appendChild(opt);
    });
  }

  // ── Status handlers ──

  function onSerialStatus(status) {
    const ok = status.includes('已连接');
    homeSerialDot.className = 'is-dot' + (ok ? ' connected' : '');
    homeSerialText.textContent = '串口 ' + status;
    btnSerial.textContent = ok ? '断开串口' : '连接串口';
    serialHint.style.display = ok ? 'none' : '';
  }

  function onVideoStatus(status) {
    const ok = status.includes('运行中');
    homeVideoDot.className = 'is-dot' + (ok ? ' connected' : '');
    homeVideoText.textContent = '视频 ' + status;
  }

  function onAudioStatus(status) {
    const ok = status.includes('运行中');
    homeAudioDot.className = 'is-dot' + (ok ? ' connected' : '');
    homeAudioText.textContent = '音频 ' + status;
  }

  // ── Button handlers ──

  async function onSerialClick() {
    if (window.SerialService.isConnected) {
      await window.SerialService.disconnect();
    } else {
      const config = window.ConfigService.loadConfig();
      const ok = await window.SerialService.connect(config.baudRate);
      if (ok) {
        window.SerialService.sendCommand(window.ProtocolHelper.reset());
        btnSerial.blur();
      }
    }
  }

  async function onVideoClick() {
    const deviceId = selVideo.value;
    if (!deviceId) return;
    window.VideoService.stopCapture();
    const ok = await window.VideoService.startCapture(deviceId);
    if (ok) {
      const config = window.ConfigService.loadConfig();
      config.videoSourceId = deviceId;
      window.ConfigService.saveConfig(config);
    }
  }

  async function onAudioClick() {
    const deviceId = selAudio.value;
    if (!deviceId) return;
    window.AudioService.stopCapture();
    const ok = await window.AudioService.startCapture(deviceId);
    if (ok) {
      const config = window.ConfigService.loadConfig();
      config.audioDeviceId = deviceId;
      window.ConfigService.saveConfig(config);
    }
  }

  function onKeymappingClick() {
    window.KeyMappingUI.openDialog();
  }

  function onReloadClick() {
    window.KeyMappingService.loadMappings();
    loadConfiguration();
  }

  async function onWakeupClick() {
    const cidr = inputCidr.value.trim();
    if (!cidr) {
      homeWakeupText.textContent = '请输入扫描范围';
      homeWakeupText.style.color = 'var(--accent-yellow)';
      return;
    }

    let ips;
    try {
      ips = window.WakeupService.expandCidr(cidr);
    } catch {
      homeWakeupText.textContent = 'CIDR 格式无效';
      homeWakeupText.style.color = 'var(--accent-yellow)';
      return;
    }

    const config = window.ConfigService.loadConfig();
    config.wakeupCidr = cidr;
    window.ConfigService.saveConfig(config);

    btnWakeup.disabled = true;
    btnWakeup.textContent = '扫描中...';
    homeWakeupText.textContent = `正在扫描 ${cidr}...`;
    homeWakeupText.style.color = 'var(--accent-yellow)';

    const found = await window.WakeupService.scanForNS2(ips);

    if (found.length > 0) {
      homeWakeupText.textContent = `唤醒 ${found.length} 台设备`;
      homeWakeupText.style.color = 'var(--accent-green)';
    } else {
      homeWakeupText.textContent = '未发现设备';
      homeWakeupText.style.color = 'var(--accent-red)';
    }

    btnWakeup.disabled = false;
    btnWakeup.textContent = '唤醒 NS2';
  }

  // ── Keyboard input ──

  function onKeyDown(e) {
    if (_isKeymappingOpen) return;
    if (_isScriptPanelOpen) return;
    if (e.isComposing) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Enter') {
      e.preventDefault();
      return;
    }

    if (!window.SerialService.isConnected) return;
    if (e.repeat) return;

    const btn = window.KeyMappingService.getSwitchButton(e.code);
    if (btn !== BTN.None) {
      e.preventDefault();
      const cmd = window.ProtocolHelper.createButtonCommand(btn, true);
      window.SerialService.sendCommand(cmd);
    }
  }

  function onKeyUp(e) {
    if (_isKeymappingOpen) return;
    if (_isScriptPanelOpen) return;
    if (e.isComposing) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Enter') {
      toggleFullscreen();
      e.preventDefault();
      return;
    }

    if (!window.SerialService.isConnected) return;

    const btn = window.KeyMappingService.getSwitchButton(e.code);
    if (btn !== BTN.None) {
      e.preventDefault();
      window.SerialService.sendCommand(window.ProtocolHelper.createButtonCommand(btn, false));
    }
  }

  // ── Gamepad input ──

  function onGamepadInput(button, pressed) {
    if (!window.SerialService.isConnected) return;
    window.SerialService.sendCommand(window.ProtocolHelper.createButtonCommand(button, pressed));
  }

  // ── Fullscreen ──

  function toggleFullscreen() {
    if (_isFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
      document.getElementById('app').classList.add('fullscreen');
      _isFullscreen = true;
    }
  }

  // ── Script panel ──

  function openScriptPanel() {
    document.getElementById('app').classList.add('script-open');
    document.getElementById('script-panel').classList.remove('hidden');
    _isScriptPanelOpen = true;
  }

  function closeScriptPanel() {
    if (window.ScriptEngine.isRunning) window.ScriptEngine.stop();
    document.getElementById('app').classList.remove('script-open');
    document.getElementById('script-panel').classList.add('hidden');
    _isScriptPanelOpen = false;
    btnScriptRun.disabled = false;
    btnScriptStop.disabled = true;
  }

  async function onScriptFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.zip')) {
      await loadZipProject(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => { scriptEditor.value = reader.result; };
      reader.readAsText(file);
    }
    scriptFileInput.value = '';
  }

  async function loadZipProject(file) {
    if (typeof JSZip === 'undefined') {
      scriptOutput.textContent += '[错误] JSZip 未加载，无法读取 ZIP\n';
      return;
    }

    try {
      const zip = await JSZip.loadAsync(file);

      // Load main.ecs
      const mainEcs = zip.file('main.ecs');
      if (mainEcs) {
        scriptEditor.value = await mainEcs.async('string');
      }

      // Load IL labels - clear existing first, then import
      const imgLabelDir = zip.folder('ImgLabel');
      let imported = 0, skipped = 0;
      await window.ImgSearchDB.init();
      await window.ImgSearchDB.clearAllLabels();

      if (imgLabelDir) {
        const promises = [];
        imgLabelDir.forEach((relativePath, zipEntry) => {
          if (zipEntry.dir) return;
          if (!relativePath.toLowerCase().endsWith('.il')) return;
          promises.push((async () => {
            try {
              const text = await zipEntry.async('string');
              const json = JSON.parse(text);
              const name = relativePath.replace(/\.[iI][lL]$/, '');
              await window.ImgSearchDB.saveLabel({
                name,
                fileName: name + '.IL',
                content: text,
                json,
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
              imported++;
            } catch {
              skipped++;
            }
          })());
        });
        await Promise.all(promises);
      }

      // Refresh label list if search console overlay is open
      if (window.ImgSearchUI && typeof window.ImgSearchUI.refreshLabelList === 'function') {
        await window.ImgSearchUI.refreshLabelList();
      }

      const msg = mainEcs
        ? `已加载 main.ecs${imported > 0 ? '，导入 ' + imported + ' 个标签' : ''}${skipped > 0 ? '，跳过 ' + skipped + ' 个' : ''}`
        : (imported > 0 ? `导入了 ${imported} 个标签` : 'ZIP 中未找到 main.ecs 或标签');
      scriptOutput.textContent += '[信息] ' + msg + '\n';
    } catch (e) {
      scriptOutput.textContent += '[错误] ZIP 读取失败: ' + e.message + '\n';
    }
  }

  async function onScriptRun() {
    const source = scriptEditor.value.trim();
    if (!source) return;

    if (!window.SerialService.isConnected) {
      scriptOutput.textContent = '[错误] 请先连接串口设备\n';
      return;
    }

    btnScriptRun.disabled = true;
    btnScriptStop.disabled = false;
    scriptOutput.textContent = '';

    try {
      const ast = window.ScriptEngine.loadScript(source);
      await window.ScriptEngine.run(ast, (text) => {
        scriptOutput.textContent += text;
        scriptOutput.scrollTop = scriptOutput.scrollHeight;
      });
    } catch (e) {
      scriptOutput.textContent += '[错误] ' + e.message + '\n';
    }

    btnScriptRun.disabled = false;
    btnScriptStop.disabled = true;
  }

  function onScriptStop() {
    window.ScriptEngine.stop();
  }

  function openScriptGuide() {
    const pre = $('guide-content');
    if (!pre.textContent.trim()) {
      fetch('脚本指南.txt').then(r => r.text()).then(text => {
        pre.textContent = text;
        $('guide-overlay').classList.remove('hidden');
      }).catch(() => {
        pre.textContent = '无法加载脚本指南文件';
        $('guide-overlay').classList.remove('hidden');
      });
    } else {
      $('guide-overlay').classList.remove('hidden');
    }
  }

  function initResizer() {
    const resizer = $('script-resizer');
    const editorArea = $('script-editor-area');
    const outputArea = document.querySelector('.script-output-area');
    let startY, startEditorH, startOutputH;

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startY = e.clientY;
      startEditorH = editorArea.getBoundingClientRect().height;
      startOutputH = outputArea.getBoundingClientRect().height;
      resizer.classList.add('active');
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    });

    function onDrag(e) {
      const dy = e.clientY - startY;
      const newEH = Math.max(60, startEditorH + dy);
      const newOH = Math.max(60, startOutputH - dy);
      editorArea.style.flex = 'none';
      editorArea.style.height = newEH + 'px';
      outputArea.style.flex = 'none';
      outputArea.style.height = newOH + 'px';
    }

    function onDragEnd() {
      resizer.classList.remove('active');
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }

  // ── Cleanup ──

  async function onBeforeUnload() {
    window.GamepadService.stop();
    window.VideoService.stopCapture();
    window.AudioService.stopCapture();
    await window.SerialService.disconnect();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', window.UI.init);
