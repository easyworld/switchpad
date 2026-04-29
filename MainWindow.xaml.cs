using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using SwitchPad.Services;
using SwitchPad.Models;
using SwitchPad.Windows;

namespace SwitchPad
{
    public partial class MainWindow : Window
    {
        private readonly VideoService _videoService;
        private readonly AudioService _audioService;
        private readonly SerialService _serialService;
        private readonly ConfigService _configService;
        private readonly KeyMappingService _keyMappingService;
        private readonly GamepadService _gamepadService;
        private readonly ProtocolHelper _protocolHelper = new();

        private bool _isFullscreen = false;
        private double _prevLeft, _prevTop, _prevWidth, _prevHeight;
        private WindowState _prevWindowState;
        private DateTime _dialogClosedAt = DateTime.MinValue;

        public MainWindow()
        {
            InitializeComponent();

            _configService = new ConfigService();
            _videoService = new VideoService();
            _audioService = new AudioService();
            _serialService = new SerialService();
            _keyMappingService = new KeyMappingService(_configService);
            _gamepadService = new GamepadService();

            _videoService.FrameReceived += OnFrameReceived;
            _videoService.StatusChanged += OnVideoStatusChanged;
            _audioService.StatusChanged += OnAudioStatusChanged;
            _serialService.StatusChanged += OnSerialStatusChanged;
            _gamepadService.ButtonStateChanged += OnGamepadButtonStateChanged;

            this.KeyDown += MainWindow_KeyDown;
            this.KeyUp += MainWindow_KeyUp;
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            InputMethod.Current.ImeState = InputMethodState.Off;

            LoadConfiguration();
            RefreshSerialPorts();
            RefreshVideoSources();
            RefreshAudioDevices();
            _gamepadService.Start();
        }

        private void LoadConfiguration()
        {
            var config = _configService.LoadConfig();

            // Auto-connect to saved serial port
            if (!string.IsNullOrEmpty(config.SerialPort))
            {
                SerialPortComboBox.SelectedItem = config.SerialPort;
                if (_serialService.Connect(config.SerialPort, config.BaudRate))
                {
                    _serialService.SendCommand(_protocolHelper.Reset());
                    ConnectButton.Content = "断开";
                }
            }

            // Auto-connect to saved video source（异步启动，避免阻塞 UI 线程）
            if (config.VideoSourceIndex >= 0)
            {
                var index = config.VideoSourceIndex;
                Task.Run(() => _videoService.StartCapture(index));
            }

            // Auto-start audio
            if (config.AudioDeviceIndex >= 0)
            {
                var audioIndex = config.AudioDeviceIndex;
                Task.Run(() => _audioService.StartCapture(audioIndex));
            }

            // Load wakeup CIDR
            WakeupCidrTextBox.Text = config.WakeupCidr;
        }

        private void RefreshSerialPorts()
        {
            var ports = _serialService.GetAvailablePorts();
            SerialPortComboBox.ItemsSource = ports;

            var config = _configService.LoadConfig();
            if (!string.IsNullOrEmpty(config.SerialPort) && ports.Contains(config.SerialPort))
            {
                SerialPortComboBox.SelectedItem = config.SerialPort;
            }
        }

        private void RefreshAudioDevices()
        {
            var devices = _audioService.GetAvailableDevices();
            AudioDeviceComboBox.ItemsSource = devices;

            var config = _configService.LoadConfig();
            if (config.AudioDeviceIndex >= 0 && config.AudioDeviceIndex < devices.Count)
            {
                AudioDeviceComboBox.SelectedIndex = config.AudioDeviceIndex;
            }
        }

        private void AudioStartButton_Click(object sender, RoutedEventArgs e)
        {
            var selectedIndex = AudioDeviceComboBox.SelectedIndex;
            if (selectedIndex >= 0)
            {
                _audioService.StopCapture();
                _audioService.StartCapture(selectedIndex);

                var config = _configService.LoadConfig();
                config.AudioDeviceIndex = selectedIndex;
                _configService.SaveConfig(config);
            }
            else
            {
                MessageBox.Show("请选择音频设备", "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void RefreshVideoSources()
        {
            var sources = _videoService.GetAvailableDevices();
            VideoSourceComboBox.ItemsSource = sources;

            var config = _configService.LoadConfig();
            if (config.VideoSourceIndex >= 0 && config.VideoSourceIndex < sources.Count)
            {
                VideoSourceComboBox.SelectedIndex = config.VideoSourceIndex;
            }
        }

        private void ConnectButton_Click(object sender, RoutedEventArgs e)
        {
            if (_serialService.IsConnected)
            {
                _serialService.Disconnect();
                ConnectButton.Content = "连接";
            }
            else
            {
                var selectedPort = SerialPortComboBox.SelectedItem as string;
                if (!string.IsNullOrEmpty(selectedPort))
                {
                    var config = _configService.LoadConfig();
                    if (_serialService.Connect(selectedPort, config.BaudRate))
                    {
                        config.SerialPort = selectedPort;
                        _configService.SaveConfig(config);
                        ConnectButton.Content = "断开";
                        // 连接成功后发送空闲状态，初始化设备控制器状态
                        _serialService.SendCommand(_protocolHelper.Reset());
                    }
                }
                else
                {
                    MessageBox.Show("请选择串口设备", "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
        }

        private void VideoSourceButton_Click(object sender, RoutedEventArgs e)
        {
            var selectedIndex = VideoSourceComboBox.SelectedIndex;
            if (selectedIndex >= 0)
            {
                _videoService.StopCapture();
                _videoService.StartCapture(selectedIndex);

                var config = _configService.LoadConfig();
                config.VideoSourceIndex = selectedIndex;
                _configService.SaveConfig(config);
            }
            else
            {
                MessageBox.Show("请选择视频采集源", "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void KeyMappingButton_Click(object sender, RoutedEventArgs e)
        {
            var mappingWindow = new KeyMappingWindow(_keyMappingService);
            mappingWindow.Owner = this;
            mappingWindow.ShowDialog();
            _dialogClosedAt = DateTime.UtcNow;
            Keyboard.ClearFocus();
            this.Focus();
        }

        private void ReloadConfigButton_Click(object sender, RoutedEventArgs e)
        {
            LoadConfiguration();
            MessageBox.Show("配置已重新加载", "提示", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void ToggleFullscreen()
        {
            if (_isFullscreen)
            {
                this.WindowStyle = WindowStyle.SingleBorderWindow;
                this.WindowState = _prevWindowState;
                this.Left = _prevLeft;
                this.Top = _prevTop;
                this.Width = _prevWidth;
                this.Height = _prevHeight;
                ControlPanel.Visibility = Visibility.Visible;
                _isFullscreen = false;
            }
            else
            {
                _prevLeft = this.Left;
                _prevTop = this.Top;
                _prevWidth = this.Width;
                _prevHeight = this.Height;
                _prevWindowState = this.WindowState;
                this.WindowStyle = WindowStyle.None;
                this.WindowState = WindowState.Maximized;
                ControlPanel.Visibility = Visibility.Collapsed;
                _isFullscreen = true;
            }
        }

        private void MainWindow_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                e.Handled = true;
                return;
            }

            if (!_serialService.IsConnected) return;

            var switchButton = _keyMappingService.GetSwitchButton(e.Key);
            if (switchButton != SwitchButton.None)
            {
                var command = _protocolHelper.CreateButtonCommand(switchButton, true);
                _serialService.SendCommand(command);
            }
        }

        private void MainWindow_KeyUp(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                ToggleFullscreen();
                e.Handled = true;
                return;
            }

            if (!_serialService.IsConnected) return;

            var switchButton = _keyMappingService.GetSwitchButton(e.Key);
            if (switchButton != SwitchButton.None)
            {
                var command = _protocolHelper.CreateButtonCommand(switchButton, false);
                _serialService.SendCommand(command);
            }
        }

        private void OnGamepadButtonStateChanged(object? sender, (SwitchButton button, bool pressed) e)
        {
            // 调度到 UI 线程，与键盘处理共用同一 ProtocolHelper 实例时保证线程安全
            Dispatcher.BeginInvoke(() =>
            {
                if (!_serialService.IsConnected) return;
                var command = _protocolHelper.CreateButtonCommand(e.button, e.pressed);
                _serialService.SendCommand(command);
            });
        }

        private void OnFrameReceived(object? sender, BitmapSource bitmap)
        {
            Dispatcher.Invoke(() =>
            {
                VideoImage.Source = bitmap;
            });
        }

        private void OnAudioStatusChanged(object? sender, string status)
        {
            Dispatcher.Invoke(() =>
            {
                AudioStatusText.Text = status;
                AudioStatusText.Foreground = status.Contains("运行中") ?
                    System.Windows.Media.Brushes.Green : System.Windows.Media.Brushes.Red;
            });
        }

        private void OnVideoStatusChanged(object? sender, string status)
        {
            Dispatcher.Invoke(() =>
            {
                VideoStatusText.Text = status;
                VideoStatusText.Foreground = status.Contains("运行中") ?
                    System.Windows.Media.Brushes.Green : System.Windows.Media.Brushes.Red;
            });
        }

        private void OnSerialStatusChanged(object? sender, string status)
        {
            Dispatcher.Invoke(() =>
            {
                SerialStatusText.Text = status;
                SerialStatusText.Foreground = status.Contains("已连接") ?
                    System.Windows.Media.Brushes.Green : System.Windows.Media.Brushes.Red;
            });
        }

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            _gamepadService.Dispose();
            _videoService.StopCapture();
            _audioService.StopCapture();
            _serialService.Disconnect();
        }

        private async void WakeupButton_Click(object sender, RoutedEventArgs e)
        {
            var cidr = WakeupCidrTextBox.Text.Trim();
            if (string.IsNullOrEmpty(cidr))
            {
                MessageBox.Show("请在输入框中填写扫描范围，例如：192.168.3.0/24", "请配置唤醒 IP",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            List<string> ips;
            try
            {
                ips = ExpandCidr(cidr);
            }
            catch
            {
                MessageBox.Show("CIDR 格式无效，请使用正确格式，例如：192.168.3.0/24", "格式错误",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // 保存 CIDR 配置
            var config = _configService.LoadConfig();
            config.WakeupCidr = cidr;
            _configService.SaveConfig(config);

            WakeupButton.IsEnabled = false;
            WakeupButton.Content = "扫描中...";
            WakeupStatusText.Text = $"正在扫描 {cidr}...";
            WakeupStatusText.Foreground = System.Windows.Media.Brushes.Gray;

            var found = await ScanForNS2(ips);

            if (found.Count > 0)
            {
                WakeupStatusText.Text = $"已唤醒 {found.Count} 台设备";
                WakeupStatusText.Foreground = System.Windows.Media.Brushes.Green;
                //var detail = string.Join("\n", found.Select(r => $"  {r.ip}  ({r.status})"));
                //MessageBox.Show($"找到 {found.Count} 台在线设备：\n{detail}", "唤醒完成",
                //    MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                WakeupStatusText.Text = "未发现在线设备";
                WakeupStatusText.Foreground = System.Windows.Media.Brushes.Red;
                MessageBox.Show("未发现任何在线设备", "唤醒结果",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
            }

            WakeupButton.IsEnabled = true;
            WakeupButton.Content = "唤醒 NS2";
        }

        private static List<string> ExpandCidr(string cidr)
        {
            var parts = cidr.Trim().Split('/');
            if (parts.Length != 2) throw new FormatException();
            var baseBytes = IPAddress.Parse(parts[0]).GetAddressBytes();
            int prefix = int.Parse(parts[1]);
            if (prefix < 0 || prefix > 32) throw new FormatException();
            uint ip = (uint)(baseBytes[0] << 24 | baseBytes[1] << 16 | baseBytes[2] << 8 | baseBytes[3]);
            uint mask = prefix == 0 ? 0u : 0xFFFFFFFF << (32 - prefix);
            uint network = ip & mask;
            uint broadcast = network | ~mask;
            var result = new List<string>();
            for (uint i = network + 2; i < broadcast; i++)
                result.Add($"{(i >> 24) & 0xFF}.{(i >> 16) & 0xFF}.{(i >> 8) & 0xFF}.{i & 0xFF}");
            return result;
        }

        private static async Task<List<(string ip, string status)>> ScanForNS2(List<string> ips)
        {
            const string path        = "/switch2/wakeup";
            const int    timeoutMs   = 500;
            const int    maxParallel = 50;

            using var http      = new HttpClient { Timeout = TimeSpan.FromMilliseconds(timeoutMs) };
            using var semaphore = new SemaphoreSlim(maxParallel);
            var bag             = new System.Collections.Concurrent.ConcurrentBag<(string, string)>();

            var tasks = ips.Select(async ip =>
            {
                await semaphore.WaitAsync();
                try
                {
                    try
                    {
                        var resp = await http.GetAsync($"http://{ip}{path}");
                        bag.Add((ip, $"状态码 {(int)resp.StatusCode}"));
                    }
                    catch { /* 超时或无响应，忽略 */ }
                }
                finally { semaphore.Release(); }
            });

            await Task.WhenAll(tasks);
            return bag.OrderBy(r => r.Item1,
                StringComparer.OrdinalIgnoreCase).ToList();
        }
    }
}
