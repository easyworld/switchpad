using System.Collections.Generic;

namespace SwitchPad.Models
{
    public class AppConfig
    {
        public string SerialPort { get; set; } = string.Empty;
        public int BaudRate { get; set; } = 115200;
        public int VideoSourceIndex { get; set; } = -1;
        public int AudioDeviceIndex { get; set; } = -1;
        public string WakeupCidr { get; set; } = string.Empty;
        public Dictionary<string, string> KeyMappings { get; set; } = new();
    }
}
