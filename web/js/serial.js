window.SerialService = (() => {
  let _port = null;
  let _reader = null;
  let _isConnected = false;
  let _closed = true;
  let _handshakeResolver = null;
  const _listeners = [];

  function _emit(status) {
    _listeners.forEach(fn => fn(status));
  }

  function _on(fn) { _listeners.push(fn); }
  function _off(fn) { const i = _listeners.indexOf(fn); if (i >= 0) _listeners.splice(i, 1); }

  async function connect(baudRate = 115200) {
    try {
      if (_port) await disconnect();

      _port = await navigator.serial.requestPort();
      await _port.open({ baudRate });
      _closed = false;
      _isConnected = false;

      _emit('正在握手...');

      const writer = _port.writable.getWriter();
      try {
        await writer.write(new Uint8Array([0xA5, 0xA5, 0x81]));
      } finally {
        writer.releaseLock();
      }

      const handshakeOk = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          _handshakeResolver = null;
          resolve(false);
        }, 2000);
        _handshakeResolver = (ok) => {
          clearTimeout(timer);
          _handshakeResolver = null;
          resolve(ok);
        };
        _readLoop().catch(reject);
      });

      if (handshakeOk) {
        _isConnected = true;
        _emit('已连接');
        return true;
      } else {
        console.log('Handshake timeout');
        await _tryResetDeviceState();
        await _doClose();
        _emit('设备验证失败');
        return false;
      }
    } catch (e) {
      console.error('Serial connect error:', e);
      _emit('连接失败: ' + e.message);
      await _doClose();
      return false;
    }
  }

  async function _readLoop() {
    _reader = _port.readable.getReader();
    try {
      while (!_closed) {
        const { value, done } = await _reader.read();
        if (done) break;
        if (!value) continue;

        if (_handshakeResolver && value.includes(0x80)) {
          const resolver = _handshakeResolver;
          _handshakeResolver = null;
          resolver(true);
        }
      }
    } catch (e) {
      if (e.name !== 'NetworkError' && e.name !== 'AbortError') {
        console.error('Serial read error:', e);
      }
    } finally {
      try { _reader.releaseLock(); } catch {}
      _reader = null;
      if (_isConnected) {
        _isConnected = false;
        _emit('连接断开');
      }
    }
  }

  async function _tryResetDeviceState() {
    try {
      if (!_port || _closed || !_port.writable) return;
      const writer = _port.writable.getWriter();
      try {
        const hello = new Uint8Array([0xA5, 0xA5, 0x81]);
        for (let i = 0; i < 3; i++) {
          await writer.write(hello);
          await new Promise(r => setTimeout(r, 20));
        }
      } finally {
        writer.releaseLock();
      }
    } catch (e) { /* ignore */ }
  }

  async function _doClose() {
    _closed = true;
    _handshakeResolver = null;
    // Cancel reader first to unlock the stream, then close port
    if (_reader) {
      try { await _reader.cancel(); } catch {}
      try { _reader.releaseLock(); } catch {}
      _reader = null;
    }
    try { if (_port) await _port.close(); } catch {}
    _port = null;
  }

  async function disconnect() {
    if (_isConnected && _port?.writable && !_closed) {
      await _tryResetDeviceState();
    }
    _isConnected = false;
    await _doClose();
    _emit('未连接');
  }

  async function sendCommand(data) {
    if (!_port?.writable || !_isConnected || _closed) {
      console.warn('[serial] send skipped: writable=%s connected=%s closed=%s',
        !!_port?.writable, _isConnected, _closed);
      return;
    }
    const writer = _port.writable.getWriter();
    try {
      await writer.write(data);
      console.log('[serial] sent', [...data].map(b => b.toString(16).padStart(2, '0')).join(' '));
    } catch (e) {
      console.error('[serial] send error:', e);
    } finally {
      writer.releaseLock();
    }
  }

  function onStatusChange(fn) { _on(fn); return () => _off(fn); }

  return {
    get isConnected() { return _isConnected; },
    connect, disconnect, sendCommand, onStatusChange
  };
})();
