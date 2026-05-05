window.KeyMappingService = (() => {
  const BTN = window.SwitchButton;
  let _codeToButton = {};

  function loadMappings() {
    _codeToButton = {};
    const config = window.ConfigService.loadConfig();
    const mappings = config.keyMappings || {};
    for (const [code, btnName] of Object.entries(mappings)) {
      if (BTN[btnName] !== undefined) {
        _codeToButton[code] = BTN[btnName];
      }
    }
  }

  function saveMapping(code, switchButton) {
    _codeToButton[code] = switchButton;
    const config = window.ConfigService.loadConfig();
    config.keyMappings[code] = Object.entries(BTN).find(([, v]) => v === switchButton)?.[0] || '';
    window.ConfigService.saveConfig(config);
  }

  function saveAllMappings(map) {
    // map: { code: switchButtonValue, ... }
    const config = window.ConfigService.loadConfig();
    config.keyMappings = {};
    _codeToButton = {};
    for (const [code, btnVal] of Object.entries(map)) {
      const val = Number(btnVal);
      const btnName = Object.entries(BTN).find(([, v]) => v === val)?.[0] || '';
      _codeToButton[code] = val;
      config.keyMappings[code] = btnName;
    }
    window.ConfigService.saveConfig(config);
  }

  function getSwitchButton(code) {
    return _codeToButton[code] ?? BTN.None;
  }

  function getAllMappings() {
    return { ..._codeToButton };
  }

  loadMappings();

  return { loadMappings, saveMapping, saveAllMappings, getSwitchButton, getAllMappings };
})();
