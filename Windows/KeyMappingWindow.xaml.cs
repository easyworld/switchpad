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

        public KeyMappingWindow(KeyMappingService keyMappingService)
        {
            InitializeComponent();
            _keyMappingService = keyMappingService;

            this.KeyDown += Window_KeyDown;
            this.Loaded += Window_Loaded;
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            // Map button controls
            _buttonControls[SwitchButton.DpadUp] = BtnDpadUp;
            _buttonControls[SwitchButton.DpadDown] = BtnDpadDown;
            _buttonControls[SwitchButton.DpadLeft] = BtnDpadLeft;
            _buttonControls[SwitchButton.DpadRight] = BtnDpadRight;
            _buttonControls[SwitchButton.A] = BtnA;
            _buttonControls[SwitchButton.B] = BtnB;
            _buttonControls[SwitchButton.X] = BtnX;
            _buttonControls[SwitchButton.Y] = BtnY;
            _buttonControls[SwitchButton.L] = BtnL;
            _buttonControls[SwitchButton.R] = BtnR;
            _buttonControls[SwitchButton.ZL] = BtnZL;
            _buttonControls[SwitchButton.ZR] = BtnZR;
            _buttonControls[SwitchButton.Minus] = BtnMinus;
            _buttonControls[SwitchButton.Plus] = BtnPlus;
            _buttonControls[SwitchButton.Home] = BtnHome;
            _buttonControls[SwitchButton.Capture] = BtnCapture;
            _buttonControls[SwitchButton.LStick] = BtnLStick;
            _buttonControls[SwitchButton.RStick] = BtnRStick;
            _buttonControls[SwitchButton.LStickUp] = BtnLStickUp;
            _buttonControls[SwitchButton.LStickDown] = BtnLStickDown;
            _buttonControls[SwitchButton.LStickLeft] = BtnLStickLeft;
            _buttonControls[SwitchButton.LStickRight] = BtnLStickRight;
            _buttonControls[SwitchButton.RStickUp] = BtnRStickUp;
            _buttonControls[SwitchButton.RStickDown] = BtnRStickDown;
            _buttonControls[SwitchButton.RStickLeft] = BtnRStickLeft;
            _buttonControls[SwitchButton.RStickRight] = BtnRStickRight;

            LoadCurrentMappings();
            UpdateAllButtonDisplays();
        }

        private void LoadCurrentMappings()
        {
            _tempMappings.Clear();
            var mappings = _keyMappingService.GetAllMappings();

            foreach (var mapping in mappings)
            {
                _tempMappings[mapping.Value] = mapping.Key;
            }
        }

        private void ButtonMapping_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button button && button.Tag is string tagStr)
            {
                if (Enum.TryParse<SwitchButton>(tagStr, out var switchButton))
                {
                    _currentEditingButton = switchButton;

                    // Highlight selected button
                    ResetAllButtonHighlights();
                    HighlightButton(button);

                    var currentKey = _tempMappings.ContainsKey(switchButton)
                        ? _tempMappings[switchButton].ToString()
                        : "未配置";

                    TxtMappingInfo.Text = $"正在配置: {GetButtonDisplayName(switchButton)}";
                    TxtCurrentKey.Text = $"当前映射: {currentKey} | 请按下键盘按键...";
                    TxtCurrentKey.Foreground = new SolidColorBrush(Color.FromRgb(0, 123, 255));
                }
            }
        }

        private void Window_KeyDown(object sender, KeyEventArgs e)
        {
            if (_currentEditingButton == null) return;

            var key = e.Key == Key.System ? e.SystemKey : e.Key;

            // Ignore modifier keys alone
            if (key == Key.LeftCtrl || key == Key.RightCtrl ||
                key == Key.LeftAlt || key == Key.RightAlt ||
                key == Key.LeftShift || key == Key.RightShift ||
                key == Key.LWin || key == Key.RWin)
            {
                return;
            }

            // Remove old mapping if exists
            var oldButton = _tempMappings.FirstOrDefault(x => x.Value == key).Key;
            if (oldButton != SwitchButton.None && oldButton != _currentEditingButton)
            {
                _tempMappings.Remove(oldButton);
                UpdateButtonDisplay(oldButton);
            }

            // Set new mapping
            _tempMappings[_currentEditingButton.Value] = key;

            TxtMappingInfo.Text = $"✓ {GetButtonDisplayName(_currentEditingButton.Value)} 已映射到 {key}";
            TxtCurrentKey.Text = "点击其他按键继续配置，或点击保存";
            TxtCurrentKey.Foreground = new SolidColorBrush(Color.FromRgb(40, 167, 69));

            UpdateButtonDisplay(_currentEditingButton.Value);
            ResetAllButtonHighlights();

            _currentEditingButton = null;
            e.Handled = true;
        }

        private void UpdateButtonDisplay(SwitchButton button)
        {
            if (!_buttonControls.ContainsKey(button)) return;

            var btnControl = _buttonControls[button];
            var originalContent = GetButtonDisplayName(button);

            if (_tempMappings.ContainsKey(button))
            {
                var key = _tempMappings[button];
                var stackPanel = new StackPanel();

                var btnText = new TextBlock
                {
                    Text = originalContent,
                    FontSize = 14,
                    FontWeight = FontWeights.Bold,
                    HorizontalAlignment = HorizontalAlignment.Center
                };

                var keyText = new TextBlock
                {
                    Text = key.ToString(),
                    FontSize = 10,
                    Foreground = new SolidColorBrush(Color.FromRgb(144, 238, 144)),
                    HorizontalAlignment = HorizontalAlignment.Center,
                    Margin = new Thickness(0, 2, 0, 0)
                };

                stackPanel.Children.Add(btnText);
                stackPanel.Children.Add(keyText);
                btnControl.Content = stackPanel;
            }
            else
            {
                btnControl.Content = originalContent;
            }
        }

        private void UpdateAllButtonDisplays()
        {
            foreach (var button in _buttonControls.Keys)
            {
                UpdateButtonDisplay(button);
            }
        }

        private void HighlightButton(Button button)
        {
            var originalBg = button.Background;
            button.Background = new SolidColorBrush(Color.FromRgb(255, 193, 7));
            button.BorderBrush = new SolidColorBrush(Color.FromRgb(255, 152, 0));
            button.BorderThickness = new Thickness(3);
        }

        private void ResetAllButtonHighlights()
        {
            foreach (var btn in _buttonControls.Values)
            {
                // Reset to original colors based on button type
                if (btn == BtnA)
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(50, 205, 50));
                    btn.BorderBrush = new SolidColorBrush(Color.FromRgb(34, 139, 34));
                }
                else if (btn == BtnB)
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(220, 20, 60));
                    btn.BorderBrush = new SolidColorBrush(Color.FromRgb(139, 0, 0));
                }
                else if (btn == BtnX)
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(30, 144, 255));
                    btn.BorderBrush = new SolidColorBrush(Color.FromRgb(0, 102, 204));
                }
                else if (btn == BtnY)
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(255, 215, 0));
                    btn.BorderBrush = new SolidColorBrush(Color.FromRgb(255, 165, 0));
                }
                else if (btn == BtnHome || btn == BtnCapture)
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(74, 74, 74));
                    btn.BorderBrush = new SolidColorBrush(Color.FromRgb(102, 102, 102));
                }
                else
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(44, 44, 44));
                    btn.BorderBrush = new SolidColorBrush(Color.FromRgb(68, 68, 68));
                }
                btn.BorderThickness = new Thickness(2);
            }
        }

        private string GetButtonDisplayName(SwitchButton button)
        {
            return button switch
            {
                SwitchButton.DpadUp => "↑",
                SwitchButton.DpadDown => "↓",
                SwitchButton.DpadLeft => "←",
                SwitchButton.DpadRight => "→",
                SwitchButton.A => "A",
                SwitchButton.B => "B",
                SwitchButton.X => "X",
                SwitchButton.Y => "Y",
                SwitchButton.L => "L",
                SwitchButton.R => "R",
                SwitchButton.ZL => "ZL",
                SwitchButton.ZR => "ZR",
                SwitchButton.Minus => "-",
                SwitchButton.Plus => "+",
                SwitchButton.Home => "🏠",
                SwitchButton.Capture => "📷",
                SwitchButton.LStick => "L3",
                SwitchButton.RStick => "R3",
                SwitchButton.LStickUp => "↑",
                SwitchButton.LStickDown => "↓",
                SwitchButton.LStickLeft => "←",
                SwitchButton.LStickRight => "→",
                SwitchButton.RStickUp => "↑",
                SwitchButton.RStickDown => "↓",
                SwitchButton.RStickLeft => "←",
                SwitchButton.RStickRight => "→",
                _ => button.ToString()
            };
        }

        private void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            foreach (var mapping in _tempMappings)
            {
                _keyMappingService.SaveMapping(mapping.Value, mapping.Key);
            }

            MessageBox.Show("按键映射已保存！", "成功", MessageBoxButton.OK, MessageBoxImage.Information);
            this.Close();
        }

        private void ResetButton_Click(object sender, RoutedEventArgs e)
        {
            var result = MessageBox.Show(
                "确定要重置为默认按键映射吗？",
                "确认重置",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question
            );

            if (result == MessageBoxResult.Yes)
            {
                _tempMappings.Clear();
                _tempMappings[SwitchButton.DpadUp] = Key.W;
                _tempMappings[SwitchButton.DpadDown] = Key.S;
                _tempMappings[SwitchButton.DpadLeft] = Key.A;
                _tempMappings[SwitchButton.DpadRight] = Key.D;
                _tempMappings[SwitchButton.A] = Key.J;
                _tempMappings[SwitchButton.B] = Key.K;
                _tempMappings[SwitchButton.X] = Key.U;
                _tempMappings[SwitchButton.Y] = Key.I;
                _tempMappings[SwitchButton.L] = Key.Q;
                _tempMappings[SwitchButton.R] = Key.E;
                _tempMappings[SwitchButton.ZL] = Key.Z;
                _tempMappings[SwitchButton.ZR] = Key.C;
                _tempMappings[SwitchButton.Minus] = Key.OemMinus;
                _tempMappings[SwitchButton.Plus] = Key.OemPlus;
                _tempMappings[SwitchButton.Home] = Key.H;
                _tempMappings[SwitchButton.Capture] = Key.P;
                _tempMappings[SwitchButton.LStick] = Key.F;
                _tempMappings[SwitchButton.RStick] = Key.G;
                _tempMappings[SwitchButton.LStickUp] = Key.Up;
                _tempMappings[SwitchButton.LStickDown] = Key.Down;
                _tempMappings[SwitchButton.LStickLeft] = Key.Left;
                _tempMappings[SwitchButton.LStickRight] = Key.Right;
                _tempMappings[SwitchButton.RStickUp] = Key.I;
                _tempMappings[SwitchButton.RStickDown] = Key.K;
                _tempMappings[SwitchButton.RStickLeft] = Key.J;
                _tempMappings[SwitchButton.RStickRight] = Key.L;

                UpdateAllButtonDisplays();
                TxtMappingInfo.Text = "已重置为默认配置";
                TxtCurrentKey.Text = "点击保存按钮应用更改";
            }
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }
    }
}
