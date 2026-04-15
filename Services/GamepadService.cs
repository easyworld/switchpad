using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using SwitchPad.Models;

namespace SwitchPad.Services
{
    /// <summary>
    /// 通过 XInputGetStateEx（xinput1_4.dll 序号100）轮询 Xbox 手柄，
    /// 将手柄输入映射为 SwitchButton 并触发 ButtonStateChanged 事件。
    /// 使用序号100的扩展接口以访问 Guide（Xbox按钮，0x0400）和 Share（0x0800）位。
    /// </summary>
    public class GamepadService : IDisposable
    {
        // ── XInput 按键标志位 ──
        [Flags]
        private enum XButtons : ushort
        {
            DpadUp        = 0x0001,
            DpadDown      = 0x0002,
            DpadLeft      = 0x0004,
            DpadRight     = 0x0008,
            Start         = 0x0010,  // Menu 键 / NS2 "+"
            Back          = 0x0020,  // View 键 / NS2 "-"
            LeftThumb     = 0x0040,  // L3
            RightThumb    = 0x0080,  // R3
            LeftShoulder  = 0x0100,  // LB / NS2 L
            RightShoulder = 0x0200,  // RB / NS2 R
            Guide         = 0x0400,  // Xbox 按钮 / NS2 Home（需要 XInputGetStateEx）
            Share         = 0x0800,  // 共享键 / NS2 Capture（需要 XInputGetStateEx）
            A             = 0x1000,
            B             = 0x2000,
            X             = 0x4000,
            Y             = 0x8000,
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct XInputGamepad
        {
            public ushort wButtons;
            public byte   bLeftTrigger;
            public byte   bRightTrigger;
            public short  sThumbLX;
            public short  sThumbLY;
            public short  sThumbRX;
            public short  sThumbRY;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct XInputState
        {
            public uint         dwPacketNumber;
            public XInputGamepad Gamepad;
        }

        // XInputGetStateEx：可读取 Guide（Xbox键）和 Share 键，标准 XInputGetState 无法读取这两个键
        // 需要 Windows 8 及以上系统（xinput1_4.dll），通过序号100调用未公开导出函数
        [DllImport("xinput1_4.dll", EntryPoint = "#100")]
        private static extern uint XInputGetStateEx(uint dwUserIndex, out XInputState pState);

        // 模拟摇杆的死区阈值
        private const byte  TriggerThreshold = 30;    // 触发器：约12% 行程
        private const short StickThreshold   = 8000;  // 摇杆：约24% 满偏

        // Xbox 数字键 → SwitchButton 映射表
        private static readonly Dictionary<XButtons, SwitchButton> ButtonMap = new()
        {
            { XButtons.DpadUp,        SwitchButton.DpadUp    },
            { XButtons.DpadDown,      SwitchButton.DpadDown  },
            { XButtons.DpadLeft,      SwitchButton.DpadLeft  },
            { XButtons.DpadRight,     SwitchButton.DpadRight },
            { XButtons.Start,         SwitchButton.Plus      },  // Menu → +
            { XButtons.Back,          SwitchButton.Minus     },  // View → -
            { XButtons.LeftThumb,     SwitchButton.LStick    },  // L3
            { XButtons.RightThumb,    SwitchButton.RStick    },  // R3
            { XButtons.LeftShoulder,  SwitchButton.L         },  // LB → L
            { XButtons.RightShoulder, SwitchButton.R         },  // RB → R
            { XButtons.Guide,         SwitchButton.Home      },  // Xbox按钮 → Home
            { XButtons.Share,         SwitchButton.Capture   },  // 共享键 → Capture
            { XButtons.A,             SwitchButton.B         },  // Xbox A → NS2 B
            { XButtons.B,             SwitchButton.A         },  // Xbox B → NS2 A
            { XButtons.X,             SwitchButton.Y         },  // Xbox X → NS2 Y
            { XButtons.Y,             SwitchButton.X         },  // Xbox Y → NS2 X
        };

        private CancellationTokenSource? _cts;
        private Task? _pollTask;
        private bool _xinputAvailable = true;

        /// <summary>当手柄按键/摇杆状态改变时触发；bool 为 true 表示按下，false 表示释放。</summary>
        public event EventHandler<(SwitchButton button, bool pressed)>? ButtonStateChanged;

        public void Start()
        {
            if (_pollTask != null) return;
            _cts = new CancellationTokenSource();
            _pollTask = Task.Run(() => PollLoop(_cts.Token));
        }

        public void Stop()
        {
            _cts?.Cancel();
            _pollTask?.Wait(500);
            _pollTask = null;
            _cts?.Dispose();
            _cts = null;
        }

        private void PollLoop(CancellationToken token)
        {
            // 上一帧各槽位的输入状态
            ushort prevButtons = 0;
            bool prevLT = false, prevRT = false;
            bool prevLUp = false, prevLDown = false, prevLLeft = false, prevLRight = false;
            bool prevRUp = false, prevRDown = false, prevRLeft = false, prevRRight = false;
            int activeSlot = -1;

            while (!token.IsCancellationRequested)
            {
                if (!_xinputAvailable)
                {
                    Thread.Sleep(1000);
                    continue;
                }

                // 扫描最多4个槽位，取第一个已连接的手柄
                int newSlot = -1;
                try
                {
                    for (uint i = 0; i < 4; i++)
                    {
                        if (XInputGetStateEx(i, out _) == 0) { newSlot = (int)i; break; }
                    }
                }
                catch (DllNotFoundException)
                {
                    _xinputAvailable = false;
                    continue;
                }
                catch (Exception)
                {
                    Thread.Sleep(200);
                    continue;
                }

                // 手柄断开：释放所有当前按下的输入
                if (newSlot == -1 && activeSlot != -1)
                {
                    ReleaseAll(prevButtons, prevLT, prevRT,
                               prevLUp, prevLDown, prevLLeft, prevLRight,
                               prevRUp, prevRDown, prevRLeft, prevRRight);
                    prevButtons = 0;
                    prevLT = prevRT = false;
                    prevLUp = prevLDown = prevLLeft = prevLRight = false;
                    prevRUp = prevRDown = prevRLeft = prevRRight = false;
                    activeSlot = -1;
                }

                if (newSlot != -1)
                {
                    // 槽位切换时释放所有输入，避免按键残留
                    if (newSlot != activeSlot && activeSlot != -1)
                    {
                        ReleaseAll(prevButtons, prevLT, prevRT,
                                   prevLUp, prevLDown, prevLLeft, prevLRight,
                                   prevRUp, prevRDown, prevRLeft, prevRRight);
                        prevButtons = 0;
                        prevLT = prevRT = false;
                        prevLUp = prevLDown = prevLLeft = prevLRight = false;
                        prevRUp = prevRDown = prevRLeft = prevRRight = false;
                    }
                    activeSlot = newSlot;

                    XInputGetStateEx((uint)newSlot, out var state);
                    var g = state.Gamepad;

                    // ── 数字按键 ──
                    var curr = g.wButtons;
                    var changed = (ushort)(curr ^ prevButtons);
                    if (changed != 0)
                    {
                        foreach (var kv in ButtonMap)
                        {
                            var flag = (ushort)kv.Key;
                            if ((changed & flag) != 0)
                                Raise(kv.Value, (curr & flag) != 0);
                        }
                        prevButtons = curr;
                    }

                    // ── 左扳机 → ZL ──
                    bool lt = g.bLeftTrigger > TriggerThreshold;
                    if (lt != prevLT) { Raise(SwitchButton.ZL, lt); prevLT = lt; }

                    // ── 右扳机 → ZR ──
                    bool rt = g.bRightTrigger > TriggerThreshold;
                    if (rt != prevRT) { Raise(SwitchButton.ZR, rt); prevRT = rt; }

                    // ── 左摇杆方向 ──
                    bool lUp    = g.sThumbLY >  StickThreshold;
                    bool lDown  = g.sThumbLY < -StickThreshold;
                    bool lLeft  = g.sThumbLX < -StickThreshold;
                    bool lRight = g.sThumbLX >  StickThreshold;
                    if (lUp    != prevLUp)    { Raise(SwitchButton.LStickUp,    lUp);    prevLUp    = lUp;    }
                    if (lDown  != prevLDown)  { Raise(SwitchButton.LStickDown,  lDown);  prevLDown  = lDown;  }
                    if (lLeft  != prevLLeft)  { Raise(SwitchButton.LStickLeft,  lLeft);  prevLLeft  = lLeft;  }
                    if (lRight != prevLRight) { Raise(SwitchButton.LStickRight, lRight); prevLRight = lRight; }

                    // ── 右摇杆方向 ──
                    bool rUp    = g.sThumbRY >  StickThreshold;
                    bool rDown  = g.sThumbRY < -StickThreshold;
                    bool rLeft  = g.sThumbRX < -StickThreshold;
                    bool rRight = g.sThumbRX >  StickThreshold;
                    if (rUp    != prevRUp)    { Raise(SwitchButton.RStickUp,    rUp);    prevRUp    = rUp;    }
                    if (rDown  != prevRDown)  { Raise(SwitchButton.RStickDown,  rDown);  prevRDown  = rDown;  }
                    if (rLeft  != prevRLeft)  { Raise(SwitchButton.RStickLeft,  rLeft);  prevRLeft  = rLeft;  }
                    if (rRight != prevRRight) { Raise(SwitchButton.RStickRight, rRight); prevRRight = rRight; }
                }

                Thread.Sleep(16); // ~60 Hz
            }

            // 轮询结束时释放所有输入
            ReleaseAll(prevButtons, prevLT, prevRT,
                       prevLUp, prevLDown, prevLLeft, prevLRight,
                       prevRUp, prevRDown, prevRLeft, prevRRight);
        }

        private void Raise(SwitchButton button, bool pressed)
            => ButtonStateChanged?.Invoke(this, (button, pressed));

        private void ReleaseAll(
            ushort buttons,
            bool lt, bool rt,
            bool lUp, bool lDown, bool lLeft, bool lRight,
            bool rUp, bool rDown, bool rLeft, bool rRight)
        {
            foreach (var kv in ButtonMap)
            {
                if ((buttons & (ushort)kv.Key) != 0)
                    Raise(kv.Value, false);
            }
            if (lt)     Raise(SwitchButton.ZL,         false);
            if (rt)     Raise(SwitchButton.ZR,         false);
            if (lUp)    Raise(SwitchButton.LStickUp,   false);
            if (lDown)  Raise(SwitchButton.LStickDown, false);
            if (lLeft)  Raise(SwitchButton.LStickLeft, false);
            if (lRight) Raise(SwitchButton.LStickRight,false);
            if (rUp)    Raise(SwitchButton.RStickUp,   false);
            if (rDown)  Raise(SwitchButton.RStickDown, false);
            if (rLeft)  Raise(SwitchButton.RStickLeft, false);
            if (rRight) Raise(SwitchButton.RStickRight,false);
        }

        public void Dispose() => Stop();
    }
}
