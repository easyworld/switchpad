# SwitchPad - Nintendo Switch 2 远程控制程序

基于 C# WPF 开发的 Nintendo Switch 2 远程控制桌面应用程序，通过采集卡获取游戏画面与音频，通过串口向兼容 EasyCon 协议的单片机下发按键指令。

## 运行截图
![switchpad_screenshot](https://github.com/user-attachments/assets/61e76a29-9842-4cd5-b63a-52bf9a2ab188)

## 架构图
![switchpad_arch](https://github.com/user-attachments/assets/af224498-2f5d-4d18-b75f-52fba9343ec3)

## 功能特性

### 视频采集与显示
- 自动检测并列出所有可用的视频采集设备（采集卡、摄像头）
- 通过 DirectShow 后端以 1920×1080 采集游戏画面
- 支持 16:9 画面比例自适应缩放，无拉伸变形
- 采集源与配置持久化保存，下次启动自动恢复

### 音频直通
- 自动列出所有 Windows 音频输入设备
- 以 48000 Hz 立体声从采集卡音频输入实时采集并播放到扬声器
- 低延迟缓冲（50 ms 采集 / 100 ms 播放）
- 音频设备选择持久化保存，下次启动自动恢复

### 串口通讯控制
- 自动扫描并列出所有可用 COM 端口
- 兼容 EasyCon 协议：握手（`0xA5 0xA5 0x81` → `0x80`）、7 位打包编码报文
- 连接后自动发送 Reset 报文初始化设备状态
- 断开时自动向设备发送重置命令，避免影响其他程序的后续握手

### 按键映射配置
- 支持 NS2 全量按键自定义键盘映射
- 可视化配置窗口，配置即时生效
- 支持的按键：
  - 功能键：A / B / X / Y、- / +、Home、截图
  - 肩键：L / R / ZL / ZR
  - 十字键：上 / 下 / 左 / 右
  - 摇杆方向：左摇杆 / 右摇杆（8 方向）
  - 摇杆按键：L3 / R3

### NS2 设备唤醒
- 并发扫描局域网 `192.168.3.2–254`
- 对每个 IP 发送 `GET /switch2/wakeup`，超时 500 ms
- 显示所有有 HTTP 响应的在线设备及状态码

### 其他
- 启动时自动将输入法切换为英文，避免按键被输入法拦截

## 系统要求

- Windows 10 / 11
- .NET 8.0 Runtime
- 视频采集设备（采集卡）
- 兼容 EasyCon 协议的单片机控制器
- eps32-c3和定制固件（见esp32-c3-firmware文件夹里的ESP32C3_BLE_HTTP.ino）

## 安装与运行

### 从源码构建

```bash
git clone <repository-url>
cd switchpad
dotnet restore
dotnet build
dotnet run
```

### 发布为独立可执行文件

```bash
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
# 输出：bin/Release/net8.0-windows/win-x64/publish/SwitchPad.exe
```

## 使用说明

### 1. 配置视频采集源
1. 在"视频采集源"下拉框中选择采集卡设备
2. 点击"切换采集源"，画面自动显示在主窗口

### 2. 配置音频
1. 在"音频设备"下拉框中选择采集卡对应的音频输入设备
2. 点击"启动音频"，游戏声音即从扬声器输出

### 3. 连接串口设备
1. 在"串口设备"下拉框中选择对应 COM 端口
2. 点击"连接"，程序自动完成 EasyCon 握手验证

### 4. 自定义按键映射
1. 点击"自定义按键映射"
2. 在弹出窗口中为每个 NS2 按键选择对应的键盘按键
3. 保存后立即生效

### 5. 开始游戏
配置完成后直接使用键盘控制 NS2，所有配置自动保存。

## 配置文件

路径：`%AppData%\SwitchPad\config.json`

```json
{
  "SerialPort": "COM3",
  "BaudRate": 115200,
  "VideoSourceIndex": 0,
  "AudioDeviceIndex": 0,
  "KeyMappings": {
    "W": "DpadUp",
    "S": "DpadDown",
    "A": "DpadLeft",
    "D": "DpadRight",
    "J": "A",
    "K": "B",
    "U": "X",
    "I": "Y",
    "Q": "L",
    "E": "R",
    "Z": "ZL",
    "C": "ZR",
    "OemMinus": "Minus",
    "OemPlus": "Plus",
    "H": "Home",
    "P": "Capture",
    "F": "LStick",
    "G": "RStick"
  }
}
```

## 技术架构

| 层次 | 技术 |
|------|------|
| 框架 | .NET 8.0 + WPF |
| 视频采集 | OpenCvSharp4（DirectShow 后端）+ DirectShowLib |
| 音频采集/播放 | NAudio（WaveInEvent + WaveOutEvent） |
| 串口通讯 | System.IO.Ports |
| 配置管理 | Newtonsoft.Json |

## 项目结构

```
SwitchPad/
├── Models/
│   ├── AppConfig.cs          # 应用配置（串口、视频、音频、按键映射）
│   └── SwitchButton.cs       # NS2 按键枚举
├── Services/
│   ├── VideoService.cs       # 视频采集服务（OpenCV + DirectShow）
│   ├── AudioService.cs       # 音频采集与播放服务（NAudio）
│   ├── SerialService.cs      # 串口通讯服务（EasyCon 握手 + 读取循环）
│   ├── ConfigService.cs      # 配置读写服务
│   ├── KeyMappingService.cs  # 按键映射管理
│   └── ProtocolHelper.cs     # EasyCon 报文编码（7位打包）
├── Windows/
│   └── KeyMappingWindow.xaml # 按键配置窗口
├── MainWindow.xaml           # 主窗口
└── App.xaml                  # 应用入口
```

## 协议说明

### EasyCon 握手

| 方向 | 字节 | 含义 |
|------|------|------|
| 发送 | `A5 A5 81` | Ready + Ready + Hello |
| 接收 | `80` | Hello 响应（握手成功） |

### 控制报文（7位打包编码）

原始 7 字节：`Button(2B big-endian)` + `HAT(1B)` + `LX` + `LY` + `RX` + `RY`

每 7 位打包为 1 字节，共输出 8 字节，最后字节 bit7=1 作为结束标志。

### 按键 Bitmask

| 按键 | Mask | 按键 | Mask |
|------|------|------|------|
| Y | 0x0001 | Minus | 0x0100 |
| B | 0x0002 | Plus | 0x0200 |
| A | 0x0004 | L3 | 0x0400 |
| X | 0x0008 | R3 | 0x0800 |
| L | 0x0010 | Home | 0x1000 |
| R | 0x0020 | Capture | 0x2000 |
| ZL | 0x0040 | | |
| ZR | 0x0080 | | |

## 常见问题

**Q: 视频画面无法显示？**
检查采集卡是否正确连接，DirectShow 驱动是否安装，尝试更换采集源。

**Q: 有画面但没声音？**
在"音频设备"中选择采集卡对应的音频输入设备，点击"启动音频"。

**Q: 串口连接失败 / 握手超时？**
确认单片机已连接，COM 端口号正确，固件兼容 EasyCon 协议（握手字节 `A5 A5 81` → 响应 `80`）。

**Q: 按键无响应？**
确保串口已成功连接（状态显示绿色），检查按键映射配置是否正确，确认窗口处于焦点状态。

**Q: 输入法拦截按键？**
程序启动时会自动关闭 IME 转换，如仍有问题请手动切换到英文输入法。

## 许可证

MIT License
