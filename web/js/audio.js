window.AudioService = (() => {
  let _stream = null;
  let _audioEl = null;
  let _isRunning = false;
  const _listeners = [];

  function _emit(status) {
    _listeners.forEach(fn => fn(status));
  }

  async function getAvailableDevices() {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (tempStream) tempStream.getTracks().forEach(t => t.stop());
      return devices.filter(d => d.kind === 'audioinput').map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Audio ${d.deviceId.slice(0, 8)}`
      }));
    } catch {
      return [];
    }
  }

  async function startCapture(deviceId) {
    stopCapture();
    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        }
      });
      _audioEl = document.createElement('audio');
      _audioEl.srcObject = _stream;
      _audioEl.play();
      _isRunning = true;
      _emit('运行中');
      return true;
    } catch (e) {
      console.error('Audio capture error:', e);
      _emit('启动失败: ' + e.message);
      return false;
    }
  }

  function stopCapture() {
    if (_audioEl) {
      _audioEl.pause();
      _audioEl.srcObject = null;
      _audioEl = null;
    }
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    _isRunning = false;
    _emit('未启动');
  }

  function onStatusChange(fn) {
    _listeners.push(fn);
    return () => {
      const i = _listeners.indexOf(fn);
      if (i >= 0) _listeners.splice(i, 1);
    };
  }

  return { getAvailableDevices, startCapture, stopCapture, onStatusChange };
})();
