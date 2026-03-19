using System;
using System.Collections.Generic;
using System.Windows.Input;
using SwitchPad.Models;

namespace SwitchPad.Services
{
    public class KeyMappingService
    {
        private readonly ConfigService _configService;
        private Dictionary<Key, SwitchButton> _keyMappings;

        public KeyMappingService(ConfigService configService)
        {
            _configService = configService;
            _keyMappings = new Dictionary<Key, SwitchButton>();
            LoadMappings();
        }

        public void LoadMappings()
        {
            _keyMappings.Clear();
            var config = _configService.LoadConfig();

            foreach (var mapping in config.KeyMappings)
            {
                if (Enum.TryParse<Key>(mapping.Key, out var key) &&
                    Enum.TryParse<SwitchButton>(mapping.Value, out var button))
                {
                    _keyMappings[key] = button;
                }
            }
        }

        public void SaveMapping(Key key, SwitchButton button)
        {
            _keyMappings[key] = button;

            var config = _configService.LoadConfig();
            config.KeyMappings[key.ToString()] = button.ToString();
            _configService.SaveConfig(config);
        }

        public SwitchButton GetSwitchButton(Key key)
        {
            return _keyMappings.TryGetValue(key, out var button) ? button : SwitchButton.None;
        }

        public Dictionary<Key, SwitchButton> GetAllMappings()
        {
            return new Dictionary<Key, SwitchButton>(_keyMappings);
        }
    }
}
