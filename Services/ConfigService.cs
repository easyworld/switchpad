using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using SwitchPad.Models;

namespace SwitchPad.Services
{
    public class ConfigService
    {
        private readonly string _configPath;
        private const string ConfigFileName = "config.json";

        public ConfigService()
        {
            var appDataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "SwitchPad"
            );
            Directory.CreateDirectory(appDataPath);
            _configPath = Path.Combine(appDataPath, ConfigFileName);
        }

        public AppConfig LoadConfig()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    var json = File.ReadAllText(_configPath);
                    return JsonConvert.DeserializeObject<AppConfig>(json) ?? CreateDefaultConfig();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"加载配置失败: {ex.Message}");
            }

            return CreateDefaultConfig();
        }

        public void SaveConfig(AppConfig config)
        {
            try
            {
                var json = JsonConvert.SerializeObject(config, Formatting.Indented);
                File.WriteAllText(_configPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"保存配置失败: {ex.Message}");
            }
        }

        private AppConfig CreateDefaultConfig()
        {
            var config = new AppConfig
            {
                BaudRate = 115200,
                KeyMappings = GetDefaultKeyMappings()
            };
            SaveConfig(config);
            return config;
        }

        private Dictionary<string, string> GetDefaultKeyMappings()
        {
            return new Dictionary<string, string>
            {
                { "W", "DpadUp" },
                { "S", "DpadDown" },
                { "A", "DpadLeft" },
                { "D", "DpadRight" },
                { "J", "A" },
                { "K", "B" },
                { "U", "X" },
                { "I", "Y" },
                { "Q", "L" },
                { "E", "R" },
                { "Z", "ZL" },
                { "C", "ZR" },
                { "OemMinus", "Minus" },
                { "OemPlus", "Plus" },
                { "H", "Home" },
                { "P", "Capture" },
                { "F", "LStick" },
                { "G", "RStick" }
            };
        }
    }
}
