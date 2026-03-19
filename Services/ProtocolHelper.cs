using SwitchPad.Models;
using System.Collections.Generic;

namespace SwitchPad.Services
{
    /// <summary>
    /// 维护控制器完整状态，并按照 EasyCon 协议（7位打包编码）序列化报文。
    /// 报文结构：Button(2B big-endian) + HAT(1B) + LX + LY + RX + RY = 7字节
    /// 编码后输出 8 字节，最后一字节 bit7=1 作为结束标志。
    /// </summary>
    public class ProtocolHelper
    {
        // ── 按键状态（bitmask，与 EasyCon SwitchCommand.cs 一致） ──
        private ushort _buttons = 0;

        // ── HAT（十字键）状态 ──
        private bool _dpadUp, _dpadDown, _dpadLeft, _dpadRight;
        private byte _hat = HatCenter;

        // ── 摇杆状态 ──
        private bool _lstickUp, _lstickDown, _lstickLeft, _lstickRight;
        private bool _rstickUp, _rstickDown, _rstickLeft, _rstickRight;
        private byte _lx = StickCenter, _ly = StickCenter;
        private byte _rx = StickCenter, _ry = StickCenter;

        private const byte StickCenter = 128;
        private const byte StickMin    = 0;
        private const byte StickMax    = 255;
        private const byte HatCenter   = 0x08;

        // ── 按键 bitmask（与 EasyCon SwitchCommand.cs 完全一致） ──
        private static readonly Dictionary<SwitchButton, ushort> ButtonMask = new()
        {
            { SwitchButton.Y,       0x0001 },
            { SwitchButton.B,       0x0002 },
            { SwitchButton.A,       0x0004 },
            { SwitchButton.X,       0x0008 },
            { SwitchButton.L,       0x0010 },
            { SwitchButton.R,       0x0020 },
            { SwitchButton.ZL,      0x0040 },
            { SwitchButton.ZR,      0x0080 },
            { SwitchButton.Minus,   0x0100 },
            { SwitchButton.Plus,    0x0200 },
            { SwitchButton.LStick,  0x0400 }, // 左摇杆按下
            { SwitchButton.RStick,  0x0800 }, // 右摇杆按下
            { SwitchButton.Home,    0x1000 },
            { SwitchButton.Capture, 0x2000 },
        };

        /// <summary>
        /// 根据按键按下/释放更新控制器状态，返回编码后的完整状态报文。
        /// </summary>
        public byte[] CreateButtonCommand(SwitchButton button, bool pressed)
        {
            if (ButtonMask.TryGetValue(button, out var mask))
            {
                if (pressed) _buttons |= mask;
                else         _buttons &= (ushort)~mask;
            }
            else
            {
                switch (button)
                {
                    // ── HAT ──
                    case SwitchButton.DpadUp:    _dpadUp    = pressed; UpdateHat();    break;
                    case SwitchButton.DpadDown:  _dpadDown  = pressed; UpdateHat();    break;
                    case SwitchButton.DpadLeft:  _dpadLeft  = pressed; UpdateHat();    break;
                    case SwitchButton.DpadRight: _dpadRight = pressed; UpdateHat();    break;
                    // ── 左摇杆方向 ──
                    case SwitchButton.LStickUp:    _lstickUp    = pressed; UpdateLStick(); break;
                    case SwitchButton.LStickDown:  _lstickDown  = pressed; UpdateLStick(); break;
                    case SwitchButton.LStickLeft:  _lstickLeft  = pressed; UpdateLStick(); break;
                    case SwitchButton.LStickRight: _lstickRight = pressed; UpdateLStick(); break;
                    // ── 右摇杆方向 ──
                    case SwitchButton.RStickUp:    _rstickUp    = pressed; UpdateRStick(); break;
                    case SwitchButton.RStickDown:  _rstickDown  = pressed; UpdateRStick(); break;
                    case SwitchButton.RStickLeft:  _rstickLeft  = pressed; UpdateRStick(); break;
                    case SwitchButton.RStickRight: _rstickRight = pressed; UpdateRStick(); break;
                }
            }

            return GetEncodedReport();
        }

        /// <summary>
        /// 重置所有控制器状态并返回空闲报文（连接后发送以初始化设备状态）。
        /// </summary>
        public byte[] Reset()
        {
            _buttons = 0;
            _hat = HatCenter;
            _lx = _ly = _rx = _ry = StickCenter;
            _dpadUp = _dpadDown = _dpadLeft = _dpadRight = false;
            _lstickUp = _lstickDown = _lstickLeft = _lstickRight = false;
            _rstickUp = _rstickDown = _rstickLeft = _rstickRight = false;
            return GetEncodedReport();
        }

        // ── 内部：HAT 值计算（支持斜向） ──
        private void UpdateHat()
        {
            _hat = (_dpadUp, _dpadDown, _dpadLeft, _dpadRight) switch
            {
                (true,  false, false, true)  => 0x01, // TOP_RIGHT
                (false, true,  false, true)  => 0x03, // BOTTOM_RIGHT
                (false, true,  true,  false) => 0x05, // BOTTOM_LEFT
                (true,  false, true,  false) => 0x07, // TOP_LEFT
                (true,  false, false, false) => 0x00, // TOP
                (false, false, false, true)  => 0x02, // RIGHT
                (false, true,  false, false) => 0x04, // BOTTOM
                (false, false, true,  false) => 0x06, // LEFT
                _                           => HatCenter,
            };
        }

        private void UpdateLStick()
        {
            _lx = _lstickLeft ? StickMin : (_lstickRight ? StickMax : StickCenter);
            _ly = _lstickUp   ? StickMin : (_lstickDown  ? StickMax : StickCenter);
        }

        private void UpdateRStick()
        {
            _rx = _rstickLeft ? StickMin : (_rstickRight ? StickMax : StickCenter);
            _ry = _rstickUp   ? StickMin : (_rstickDown  ? StickMax : StickCenter);
        }

        // ── 内部：7位打包编码（与 EasyCon SwitchReport.GetBytes() 完全一致） ──
        private byte[] GetEncodedReport()
        {
            // 7字节原始数据：Button(2B big-endian) + HAT + LX + LY + RX + RY
            byte[] raw =
            {
                (byte)(_buttons >> 8),
                (byte)(_buttons & 0xFF),
                _hat, _lx, _ly, _rx, _ry
            };

            // 7字节 × 8位 = 56位，每7位输出1字节 → 共8字节
            var packet = new List<byte>(8);
            long n = 0;
            int bits = 0;
            foreach (var b in raw)
            {
                n = (n << 8) | b;
                bits += 8;
                while (bits >= 7)
                {
                    bits -= 7;
                    packet.Add((byte)(n >> bits));
                    n &= (1 << bits) - 1;
                }
            }
            packet[^1] |= 0x80; // 最后字节 bit7=1 作为结束标志

            return [.. packet];
        }
    }
}
