window.ConfigService = (() => {
  const STORAGE_KEY = 'switchpad-config';

  function getDefaultKeyMappings() {
    return {
      'KeyW': 'DpadUp', 'KeyS': 'DpadDown', 'KeyA': 'DpadLeft', 'KeyD': 'DpadRight',
      'KeyJ': 'A', 'KeyK': 'B', 'KeyU': 'X', 'KeyI': 'Y',
      'KeyQ': 'L', 'KeyE': 'R', 'KeyZ': 'ZL', 'KeyC': 'ZR',
      'Minus': 'Minus', 'Equal': 'Plus',
      'KeyH': 'Home', 'KeyP': 'Capture',
      'KeyF': 'LStick', 'KeyG': 'RStick',
      'ArrowUp': 'LStickUp', 'ArrowDown': 'LStickDown',
      'ArrowLeft': 'LStickLeft', 'ArrowRight': 'LStickRight'
    };
  }

  function createDefaultConfig() {
    return {
      baudRate: 115200,
      videoSourceId: '',
      audioDeviceId: '',
      wakeupCidr: '',
      keyMappings: getDefaultKeyMappings()
    };
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const mappings = parsed.keyMappings;
        const hasMappings = mappings && Object.keys(mappings).length > 0;
        return {
          baudRate: parsed.baudRate || 115200,
          videoSourceId: parsed.videoSourceId || '',
          audioDeviceId: parsed.audioDeviceId || '',
          wakeupCidr: parsed.wakeupCidr || '',
          keyMappings: hasMappings ? mappings : getDefaultKeyMappings()
        };
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    }
    return createDefaultConfig();
  }

  function saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  return { loadConfig, saveConfig, createDefaultConfig, getDefaultKeyMappings };
})();
