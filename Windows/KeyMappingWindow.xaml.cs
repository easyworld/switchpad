using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using SwitchPad.Models;
using SwitchPad.Services;

namespace SwitchPad.Windows
{
    public partial class KeyMappingWindow : Window
    {
        private readonly KeyMappingService _keyMappingService;
        private readonly Dictionary<SwitchButton, Button> _buttonControls = new();
        private SwitchButton? _currentEditingButton = null;
        private readonly Dictionary<SwitchButton, Key> _tempMappings = new();

        // Store each button's original background so we can restore it
        private readonly Dictionary<Button, Brush> _originalBackgrounds = new();

        public KeyMappingWindow(KeyMappingService keyMappingService)
        {
            InitializeComponent();
            _keyMappingService = keyMappingService;

            this.KeyDown += Window_KeyDown;
            this.Loaded += Window_Loaded;
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            _buttonControls[SwitchButton.DpadUp]    = BtnDpadUp;
            _buttonControls[SwitchButton.DpadDown]  = BtnDpadDown;
            _buttonControls[SwitchButton.DpadLeft]  = BtnDpadLeft;
            _buttonControls[SwitchButton.DpadRight] = BtnDpadRight;
            _buttonControls[SwitchButton.A]         = BtnA;
            _buttonControls[SwitchButton.B]         = BtnB;
            _buttonControls[SwitchButton.X]         = BtnX;
            _buttonControls[SwitchButton.Y]         = BtnY;
            _buttonControls[SwitchButton.L]         = BtnL;
            _buttonControls[SwitchButton.R]         = BtnR;
            _buttonControls[SwitchButton.ZL]        = BtnZL;
            _buttonControls[SwitchButton.ZR]        = BtnZR;
            _buttonControls[SwitchButton.Minus]     = BtnMinus;
            _buttonControls[SwitchButton.Plus]      = BtnPlus;
            _buttonControls[SwitchButton.Home]      = BtnHome;
            _buttonControls[SwitchButton.Capture]   = BtnCapture;
            _buttonControls[SwitchButton.LStick]    = BtnLStick;
            _buttonControls[SwitchButton.RStick]    = BtnRStick;
            _buttonControls[SwitchButton.LStickUp]  = BtnLStickUp;
            _buttonControls[SwitchButton.LStickDown]  = BtnLStickDown;
            _buttonControls[SwitchButton.LStickLeft]  = BtnLStickLeft;
            _buttonControls[SwitchButton.LStickRight] = BtnLStickRight;
            _buttonControls[SwitchButton.RStickUp]  = BtnRStickUp;
            _buttonControls[SwitchButton.RStickDown]  = BtnRStickDown;
            _buttonControls[SwitchButton.RStickLeft]  = BtnRStickLeft;
            _buttonControls[SwitchButton.RStickRight] = BtnRStickRight;

            // Save original backgrounds for highlight reset
            foreach (var (btn, ctrl) in _buttonControls)
                _originalBackgrounds[ctrl] = ctrl.Background;

            LoadCurrentMappings();
            UpdateAllButtonDisplays();
        }

        private void LoadCurrentMappings()
        {
            _tempMappings.Clear();
            foreach (var mapping in _keyMappingService.GetAllMappings())
                _tempMappings[mapping.Value] = mapping.Key;
        }

        private void ButtonMapping_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button button && button.Tag is string tagStr &&
                Enum.TryParse<SwitchButton>(tagStr, out var switchButton))
            {
                _currentEditingButton = switchButton;
                ResetAllButtonHighlights();
                HighlightButton(button);

                var currentKey = _tempMappings.TryGetValue(switchButton, out var k) ? k.ToString() : "未配置";
                TxtMappingInfo.Text = $"正在配置: {GetButtonDisplayName(switchButton)}";
                TxtCurrentKey.Text = $"当前: {currentKey}  |  请按下键盘按键...";
                TxtCurrentKey.Foreground = new SolidColorBrush(Color.FromRgb(100, 180, 255));
            }
        }

        private void Window_KeyDown(object sender, KeyEventArgs e)
        {
            if (_currentEditingButton == null) return;

            var key = e.Key == Key.System ? e.SystemKey : e.Key;

            if (key is Key.LeftCtrl or Key.RightCtrl or
                Key.LeftAlt or Key.RightAlt or
                Key.LeftShift or Key.RightShift or
                Key.LWin or Key.RWin)
                return;

            // Remove existing mapping for this key if it's on a different button
            var oldButton = _tempMappings.FirstOrDefault(x => x.Value == key).Key;
            if (oldButton != SwitchButton.None && oldButton != _currentEditingButton)
            {
                _tempMappings.Remove(oldButton);
                UpdateButtonDisplay(oldButton);
            }

            _tempMappings[_currentEditingButton.Value] = key;

            TxtMappingInfo.Text = $"✓ {GetButtonDisplayName(_currentEditingButton.Value)} → {key}";
            TxtCurrentKey.Text = "点击其他按键继续配置，或点击保存";
            TxtCurrentKey.Foreground = new SolidColorBrush(Color.FromRgb(80, 200, 120));

            UpdateButtonDisplay(_currentEditingButton.Value);
            ResetAllButtonHighlights();
            _currentEditingButton = null;
            e.Handled = true;
        }

        private void UpdateButtonDisplay(SwitchButton button)
        {
            if (!_buttonControls.TryGetValue(button, out var btnControl)) return;

            var label = GetButtonDisplayName(button);

            if (_tempMappings.TryGetValue(button, out var key))
            {
                var panel = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center };
                panel.Children.Add(new TextBlock
                {
                    Text = label,
                    FontSize = 7,
                    FontWeight = FontWeights.Bold,
                    Foreground = new SolidColorBrush(Color.FromArgb(180, 255, 255, 255)),
                    HorizontalAlignment = HorizontalAlignment.Center
                });
                panel.Children.Add(new TextBlock
                {
                    Text = KeyShortName(key),
                    FontSize = 12,
                    FontWeight = FontWeights.Bold,
                    Foreground = new SolidColorBrush(Color.FromRgb(255, 240, 100)),
                    HorizontalAlignment = HorizontalAlignment.Center,
                    Margin = new Thickness(0, 1, 0, 0)
                });
                btnControl.Content = panel;
            }
            else
            {
                btnControl.Content = label;
            }
        }

        /// <summary>Shorten long key names so they fit inside small circles.</summary>
        private static string KeyShortName(Key key) => key switch
        {
            Key.Space       => "Spc",
            Key.Return      => "Ent",
            Key.Escape      => "Esc",
            Key.Back        => "BS",
            Key.Tab         => "Tab",
            Key.Left        => "◄",
            Key.Right       => "►",
            Key.Up          => "▲",
            Key.Down        => "▼",
            Key.LeftShift or Key.RightShift   => "Shft",
            Key.LeftCtrl  or Key.RightCtrl    => "Ctrl",
            Key.LeftAlt   or Key.RightAlt     => "Alt",
            Key.OemMinus    => "-",
            Key.OemPlus     => "=",
            Key.Delete      => "Del",
            Key.Insert      => "Ins",
            Key.Home        => "Hm",
            Key.End         => "End",
            Key.PageUp      => "PgU",
            Key.PageDown    => "PgD",
            _ => key.ToString().Length <= 4 ? key.ToString() : key.ToString()[..4]
        };

        private void UpdateAllButtonDisplays()
        {
            foreach (var button in _buttonControls.Keys)
                UpdateButtonDisplay(button);
        }

        private void HighlightButton(Button button)
        {
            button.Background = new SolidColorBrush(Color.FromArgb(210, 255, 193, 7));
            button.Foreground = new SolidColorBrush(Colors.Black);
        }

        private void ResetAllButtonHighlights()
        {
            foreach (var (btn, ctrl) in _buttonControls)
            {
                if (_originalBackgrounds.TryGetValue(ctrl, out var orig))
                    ctrl.Background = orig;
                ctrl.Foreground = new SolidColorBrush(Colors.White);
                // Y button label is yellow
                if (ctrl == BtnY)
                    ctrl.Foreground = new SolidColorBrush(Color.FromRgb(255, 255, 0));
            }
        }

        private string GetButtonDisplayName(SwitchButton button) => button switch
        {
            SwitchButton.DpadUp    => "↑",
            SwitchButton.DpadDown  => "↓",
            SwitchButton.DpadLeft  => "←",
            SwitchButton.DpadRight => "→",
            SwitchButton.A         => "A",
            SwitchButton.B         => "B",
            SwitchButton.X         => "X",
            SwitchButton.Y         => "Y",
            SwitchButton.L         => "L",
            SwitchButton.R         => "R",
            SwitchButton.ZL        => "ZL",
            SwitchButton.ZR        => "ZR",
            SwitchButton.Minus     => "-",
            SwitchButton.Plus      => "+",
            SwitchButton.Home      => "🏠",
            SwitchButton.Capture   => "📷",
            SwitchButton.LStick    => "L3",
            SwitchButton.RStick    => "R3",
            SwitchButton.LStickUp  => "↑",
            SwitchButton.LStickDown => "↓",
            SwitchButton.LStickLeft => "←",
            SwitchButton.LStickRight => "→",
            SwitchButton.RStickUp  => "↑",
            SwitchButton.RStickDown => "↓",
            SwitchButton.RStickLeft => "←",
            SwitchButton.RStickRight => "→",
            _ => button.ToString()
        };

        private void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            foreach (var mapping in _tempMappings)
                _keyMappingService.SaveMapping(mapping.Value, mapping.Key);

            MessageBox.Show("按键映射已保存！", "成功", MessageBoxButton.OK, MessageBoxImage.Information);
            this.Close();
        }

        private void ResetButton_Click(object sender, RoutedEventArgs e)
        {
            var result = MessageBox.Show("确定要重置为默认按键映射吗？", "确认重置",
                MessageBoxButton.YesNo, MessageBoxImage.Question);

            if (result != MessageBoxResult.Yes) return;

            _tempMappings.Clear();
            _tempMappings[SwitchButton.DpadUp]    = Key.W;
            _tempMappings[SwitchButton.DpadDown]  = Key.S;
            _tempMappings[SwitchButton.DpadLeft]  = Key.A;
            _tempMappings[SwitchButton.DpadRight] = Key.D;
            _tempMappings[SwitchButton.A]         = Key.J;
            _tempMappings[SwitchButton.B]         = Key.K;
            _tempMappings[SwitchButton.X]         = Key.U;
            _tempMappings[SwitchButton.Y]         = Key.I;
            _tempMappings[SwitchButton.L]         = Key.Q;
            _tempMappings[SwitchButton.R]         = Key.E;
            _tempMappings[SwitchButton.ZL]        = Key.Z;
            _tempMappings[SwitchButton.ZR]        = Key.C;
            _tempMappings[SwitchButton.Minus]     = Key.OemMinus;
            _tempMappings[SwitchButton.Plus]      = Key.OemPlus;
            _tempMappings[SwitchButton.Home]      = Key.H;
            _tempMappings[SwitchButton.Capture]   = Key.P;
            _tempMappings[SwitchButton.LStick]    = Key.F;
            _tempMappings[SwitchButton.RStick]    = Key.G;
            _tempMappings[SwitchButton.LStickUp]  = Key.Up;
            _tempMappings[SwitchButton.LStickDown]  = Key.Down;
            _tempMappings[SwitchButton.LStickLeft]  = Key.Left;
            _tempMappings[SwitchButton.LStickRight] = Key.Right;
            _tempMappings[SwitchButton.RStickUp]  = Key.I;
            _tempMappings[SwitchButton.RStickDown]  = Key.K;
            _tempMappings[SwitchButton.RStickLeft]  = Key.J;
            _tempMappings[SwitchButton.RStickRight] = Key.L;

            UpdateAllButtonDisplays();
            TxtMappingInfo.Text = "已重置为默认配置";
            TxtCurrentKey.Text = "点击保存按钮应用更改";
            TxtCurrentKey.Foreground = new SolidColorBrush(Color.FromRgb(170, 170, 170));
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e) => this.Close();
    }
}
