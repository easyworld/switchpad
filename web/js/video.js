window.VideoService = (() => {
  let _stream = null;
  let _videoEl = null;
  const _listeners = [];

  function _emit(status) {
    _listeners.forEach(fn => fn(status));
  }

  function setVideoElement(el) {
    _videoEl = el;
  }

  async function getAvailableDevices() {
    try {
      // Need to request temporary access to get labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (tempStream) tempStream.getTracks().forEach(t => t.stop());
      return devices.filter(d => d.kind === 'videoinput').map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 8)}`
      }));
    } catch {
      return [];
    }
  }

  async function startCapture(deviceId) {
    stopCapture();
    try {
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      _stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (_videoEl) {
        _videoEl.srcObject = _stream;
        await _videoEl.play();
      }
      _emit('运行中');
      return true;
    } catch (e) {
      console.error('Video capture error:', e);
      _emit('启动失败: ' + e.message);
      return false;
    }
  }

  function stopCapture() {
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    if (_videoEl) {
      _videoEl.srcObject = null;
    }
    _emit('未连接');
  }

  function onStatusChange(fn) {
    _listeners.push(fn);
    return () => {
      const i = _listeners.indexOf(fn);
      if (i >= 0) _listeners.splice(i, 1);
    };
  }

  return { setVideoElement, getAvailableDevices, startCapture, stopCapture, onStatusChange };
})();
