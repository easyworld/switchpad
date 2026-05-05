window.SwitchButton = {
  None: 0, Y: 1, B: 2, A: 3, X: 4,
  L: 5, R: 6, ZL: 7, ZR: 8,
  Minus: 9, Plus: 10,
  LStick: 11, RStick: 12,
  Home: 13, Capture: 14,
  DpadUp: 15, DpadDown: 16, DpadLeft: 17, DpadRight: 18,
  LStickUp: 19, LStickDown: 20, LStickLeft: 21, LStickRight: 22,
  RStickUp: 23, RStickDown: 24, RStickLeft: 25, RStickRight: 26
};

window.ProtocolHelper = (() => {
  const BTN = window.SwitchButton;
  const StickCenter = 128, StickMin = 0, StickMax = 255, HatCenter = 0x08;

  const ButtonMask = {
    [BTN.Y]: 0x0001, [BTN.B]: 0x0002, [BTN.A]: 0x0004, [BTN.X]: 0x0008,
    [BTN.L]: 0x0010, [BTN.R]: 0x0020, [BTN.ZL]: 0x0040, [BTN.ZR]: 0x0080,
    [BTN.Minus]: 0x0100, [BTN.Plus]: 0x0200,
    [BTN.LStick]: 0x0400, [BTN.RStick]: 0x0800,
    [BTN.Home]: 0x1000, [BTN.Capture]: 0x2000
  };

  let _buttons = 0;
  let _hat = HatCenter;
  let _lx = StickCenter, _ly = StickCenter;
  let _rx = StickCenter, _ry = StickCenter;
  let _dpadUp = false, _dpadDown = false, _dpadLeft = false, _dpadRight = false;
  let _lsUp = false, _lsDown = false, _lsLeft = false, _lsRight = false;
  let _rsUp = false, _rsDown = false, _rsLeft = false, _rsRight = false;

  function updateHat() {
    const u = _dpadUp, d = _dpadDown, l = _dpadLeft, r = _dpadRight;
    if (u && !d && !l && r)     _hat = 0x01;
    else if (!u && d && !l && r)  _hat = 0x03;
    else if (!u && d && l && !r)  _hat = 0x05;
    else if (u && !d && l && !r)  _hat = 0x07;
    else if (u && !d && !l && !r) _hat = 0x00;
    else if (!u && !d && !l && r) _hat = 0x02;
    else if (!u && d && !l && !r) _hat = 0x04;
    else if (!u && !d && l && !r) _hat = 0x06;
    else _hat = HatCenter;
  }

  function updateLStick() {
    _lx = _lsLeft ? StickMin : (_lsRight ? StickMax : StickCenter);
    _ly = _lsUp ? StickMin : (_lsDown ? StickMax : StickCenter);
  }

  function updateRStick() {
    _rx = _rsLeft ? StickMin : (_rsRight ? StickMax : StickCenter);
    _ry = _rsUp ? StickMin : (_rsDown ? StickMax : StickCenter);
  }

  function getEncodedReport() {
    const raw = [
      (_buttons >> 8) & 0xFF,
      _buttons & 0xFF,
      _hat, _lx, _ly, _rx, _ry
    ];
    const packet = [];
    let n = 0n;
    let bits = 0;
    for (const b of raw) {
      n = (n << 8n) | BigInt(b);
      bits += 8;
      while (bits >= 7) {
        bits -= 7;
        packet.push(Number((n >> BigInt(bits)) & 0x7Fn));
        n &= (1n << BigInt(bits)) - 1n;
      }
    }
    packet[packet.length - 1] |= 0x80;
    return new Uint8Array(packet);
  }

  function createButtonCommand(switchButton, pressed) {
    const mask = ButtonMask[switchButton];
    if (mask !== undefined) {
      if (pressed) _buttons |= mask;
      else _buttons &= ~mask & 0xFFFF;
    } else {
      switch (switchButton) {
        case BTN.DpadUp:    _dpadUp = pressed; updateHat(); break;
        case BTN.DpadDown:  _dpadDown = pressed; updateHat(); break;
        case BTN.DpadLeft:  _dpadLeft = pressed; updateHat(); break;
        case BTN.DpadRight: _dpadRight = pressed; updateHat(); break;
        case BTN.LStickUp:    _lsUp = pressed; updateLStick(); break;
        case BTN.LStickDown:  _lsDown = pressed; updateLStick(); break;
        case BTN.LStickLeft:  _lsLeft = pressed; updateLStick(); break;
        case BTN.LStickRight: _lsRight = pressed; updateLStick(); break;
        case BTN.RStickUp:    _rsUp = pressed; updateRStick(); break;
        case BTN.RStickDown:  _rsDown = pressed; updateRStick(); break;
        case BTN.RStickLeft:  _rsLeft = pressed; updateRStick(); break;
        case BTN.RStickRight: _rsRight = pressed; updateRStick(); break;
      }
    }
    return getEncodedReport();
  }

  function reset() {
    _buttons = 0; _hat = HatCenter;
    _lx = _ly = _rx = _ry = StickCenter;
    _dpadUp = _dpadDown = _dpadLeft = _dpadRight = false;
    _lsUp = _lsDown = _lsLeft = _lsRight = false;
    _rsUp = _rsDown = _rsLeft = _rsRight = false;
    return getEncodedReport();
  }

  function clampStick(v) {
    return Math.max(StickMin, Math.min(StickMax, Math.round(v)));
  }

  function setSticks(lx, ly, rx, ry) {
    _lx = clampStick(lx); _ly = clampStick(ly);
    _rx = clampStick(rx); _ry = clampStick(ry);
    _lsUp = _lsDown = _lsLeft = _lsRight = false;
    _rsUp = _rsDown = _rsLeft = _rsRight = false;
    return getEncodedReport();
  }

  function resetSticks() {
    _lx = _ly = _rx = _ry = StickCenter;
    _lsUp = _lsDown = _lsLeft = _lsRight = false;
    _rsUp = _rsDown = _rsLeft = _rsRight = false;
    return getEncodedReport();
  }

  return { createButtonCommand, reset, setSticks, resetSticks };
})();
