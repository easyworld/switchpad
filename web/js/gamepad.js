window.GamepadService = (() => {
  const BTN = window.SwitchButton;
  const TRIGGER_THRESHOLD = 30 / 255;   // ~12%
  const STICK_THRESHOLD = 8000 / 32767; // ~24%

  // Chrome Gamepad API standard mapping indices
  // buttons[0]=A, [1]=B, [2]=X, [3]=Y, [4]=LB, [5]=RB,
  // [6]=LT, [7]=RT, [8]=Back, [9]=Start, [10]=L3, [11]=R3,
  // [12]=DUp, [13]=DDown, [14]=DLeft, [15]=DRight, [16]=Guide/Home
  // axes[0]=LX, [1]=LY, [2]=RX, [3]=RY

  const BUTTON_MAP = [
    // Xbox button index → SwitchButton (cross-layout: A↔B, X↔Y)
    [12, BTN.DpadUp],    [13, BTN.DpadDown],  [14, BTN.DpadLeft],  [15, BTN.DpadRight],
    [9,  BTN.Plus],      [8,  BTN.Minus],
    [10, BTN.LStick],    [11, BTN.RStick],
    [4,  BTN.L],         [5,  BTN.R],
    [16, BTN.Home],      // Guide → Home
    // Cross-layout face buttons: Xbox A→Switch B, B→A, X→Y, Y→X
    [0,  BTN.B],         // Xbox A
    [1,  BTN.A],         // Xbox B
    [2,  BTN.Y],         // Xbox X
    [3,  BTN.X],         // Xbox Y
  ];

  const _listeners = [];
  let _interval = null;
  let _activeGamepadIndex = -1;

  let prevButtons = [];
  let prevLT = false, prevRT = false;
  let prevLUp = false, prevLDown = false, prevLLeft = false, prevLRight = false;
  let prevRUp = false, prevRDown = false, prevRLeft = false, prevRRight = false;

  function _emit(button, pressed) {
    _listeners.forEach(fn => fn(button, pressed));
  }

  function _releaseAll() {
    for (let i = 0; i < prevButtons.length; i++) {
      if (prevButtons[i]) _emit(BTN[i], false);
    }
    if (prevLT) _emit(BTN.ZL, false);
    if (prevRT) _emit(BTN.ZR, false);
    if (prevLUp) _emit(BTN.LStickUp, false);
    if (prevLDown) _emit(BTN.LStickDown, false);
    if (prevLLeft) _emit(BTN.LStickLeft, false);
    if (prevLRight) _emit(BTN.LStickRight, false);
    if (prevRUp) _emit(BTN.RStickUp, false);
    if (prevRDown) _emit(BTN.RStickDown, false);
    if (prevRLeft) _emit(BTN.RStickLeft, false);
    if (prevRRight) _emit(BTN.RStickRight, false);

    prevButtons = [];
    prevLT = prevRT = false;
    prevLUp = prevLDown = prevLLeft = prevLRight = false;
    prevRUp = prevRDown = prevRLeft = prevRRight = false;
  }

  function _poll() {
    const gamepads = navigator.getGamepads();
    let newSlot = -1;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) { newSlot = i; break; }
    }

    if (newSlot === -1 && _activeGamepadIndex !== -1) {
      _releaseAll();
      _activeGamepadIndex = -1;
      return;
    }

    if (newSlot !== -1) {
      if (newSlot !== _activeGamepadIndex && _activeGamepadIndex !== -1) {
        _releaseAll();
      }
      _activeGamepadIndex = newSlot;

      const gp = gamepads[newSlot];
      if (!gp || gp.mapping !== 'standard') return;

      // Buttons
      const currButtons = gp.buttons.map(b => b.pressed);
      for (const [idx, switchBtn] of BUTTON_MAP) {
        const curr = currButtons[idx] || false;
        const prev = prevButtons[idx] || false;
        if (curr !== prev) _emit(switchBtn, curr);
      }
      prevButtons = currButtons;

      // Triggers (buttons[6]=LT, buttons[7]=RT)
      const lt = (gp.buttons[6]?.value || 0) > TRIGGER_THRESHOLD;
      const rt = (gp.buttons[7]?.value || 0) > TRIGGER_THRESHOLD;
      if (lt !== prevLT) { _emit(BTN.ZL, lt); prevLT = lt; }
      if (rt !== prevRT) { _emit(BTN.ZR, rt); prevRT = rt; }

      // Left stick
      const lUp = gp.axes[1] < -STICK_THRESHOLD;
      const lDown = gp.axes[1] > STICK_THRESHOLD;
      const lLeft = gp.axes[0] < -STICK_THRESHOLD;
      const lRight = gp.axes[0] > STICK_THRESHOLD;
      if (lUp !== prevLUp) { _emit(BTN.LStickUp, lUp); prevLUp = lUp; }
      if (lDown !== prevLDown) { _emit(BTN.LStickDown, lDown); prevLDown = lDown; }
      if (lLeft !== prevLLeft) { _emit(BTN.LStickLeft, lLeft); prevLLeft = lLeft; }
      if (lRight !== prevLRight) { _emit(BTN.LStickRight, lRight); prevLRight = lRight; }

      // Right stick
      const rUp = gp.axes[3] < -STICK_THRESHOLD;
      const rDown = gp.axes[3] > STICK_THRESHOLD;
      const rLeft = gp.axes[2] < -STICK_THRESHOLD;
      const rRight = gp.axes[2] > STICK_THRESHOLD;
      if (rUp !== prevRUp) { _emit(BTN.RStickUp, rUp); prevRUp = rUp; }
      if (rDown !== prevRDown) { _emit(BTN.RStickDown, rDown); prevRDown = rDown; }
      if (rLeft !== prevRLeft) { _emit(BTN.RStickLeft, rLeft); prevRLeft = rLeft; }
      if (rRight !== prevRRight) { _emit(BTN.RStickRight, rRight); prevRRight = rRight; }
    }
  }

  function start() {
    if (_interval) return;
    _interval = setInterval(_poll, 16);
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    _releaseAll();
    _activeGamepadIndex = -1;
  }

  function onButtonStateChanged(fn) {
    _listeners.push(fn);
    return () => {
      const i = _listeners.indexOf(fn);
      if (i >= 0) _listeners.splice(i, 1);
    };
  }

  return { start, stop, onButtonStateChanged };
})();
