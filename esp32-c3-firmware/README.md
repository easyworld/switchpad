# ESP32-C3 固件 - BLE 唤醒 via HTTP

## 功能说明

`ESP32C3_BLE_HTTP.ino` 运行在 **HW-466AB ESP32-C3 SuperMini** 开发板上，实现以下功能：

- 上电后连接指定 Wi-Fi
- 在局域网 80 端口启动 HTTP 服务器
- 收到 `GET /switch2/wakeup` 请求后，立即发出 1 秒 BLE 广播
- BLE 广播内容模拟 Joy-Con 2 的唤醒报文，用于远程唤醒 NS2
- 广播期间板载 LED（GPIO8）亮起，结束后熄灭
- 内置 180 秒看门狗，防止程序卡死

---

## 烧录前必须修改的配置

打开 `ESP32C3_BLE_HTTP.ino`，修改文件顶部的以下三项：

```cpp
const char* WIFI_SSID     = "你的Wi-Fi名称";
const char* WIFI_PASSWORD = "你的Wi-Fi密码";

const char* DEFAULT_BLE_MAC  = "e0:ef:bf:2a:f3:9f";  // 你的 Joy-Con 2 MAC 地址
const char* DEFAULT_BLE_DATA = "0201061BFF...";        // 你的 Joy-Con 2 BLE 广播报文
```

BLE MAC 地址和广播报文可用手机蓝牙抓包工具（如 **nRF Connect**）扫描 Joy-Con 2 后获取。

---

## 安装 Arduino IDE

1. 前往 [https://www.arduino.cc/en/software](https://www.arduino.cc/en/software) 下载 **Arduino IDE 2.x**，安装后打开

2. 添加 ESP32 开发板支持：
   - 菜单 → **文件 → 首选项**
   - 在"其他开发板管理器网址"中填入：
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - 点击确定

3. 安装 ESP32 支持包：
   - 菜单 → **工具 → 开发板 → 开发板管理器**
   - 搜索 `esp32`，找到 **esp32 by Espressif Systems**，安装 **3.3.7** 版本

---

## 编译

1. 用 Arduino IDE 打开 `ESP32C3_BLE_HTTP.ino`

2. 选择开发板：
   - 菜单 → **工具 → 开发板 → esp32 → ESP32C3 Dev Module**

3. 修改好 Wi-Fi 和 BLE 配置后，点击左上角 **✓（验证/编译）** 按钮，确认编译通过无报错

---

## 烧录

1. 用 USB 数据线将 ESP32-C3 SuperMini 连接到电脑

2. 选择串口：
   - 菜单 → **工具 → 端口** → 选择对应的 COM 口（Windows 设备管理器中可查看）

3. 配置烧录参数（**工具**菜单）：

   | 选项 | 值 |
   |------|----|
   | Upload Speed | 921600 |
   | USB CDC On Boot | Enabled |
   | Flash Size | 4MB (32Mb) |
   | Partition Scheme | Default 4MB with spiffs |

4. 点击 **→（上传）** 按钮开始烧录，等待提示 `Done uploading`

> 如果烧录失败提示连接超时，按住开发板上的 **BOOT 键** 再点上传，松开 BOOT 键后烧录会自动开始。

---

## 验证运行

烧录完成后打开 **工具 → 串口监视器**（波特率 115200），应看到类似输出：

```
ESP32C3 BLE Wake-up via HTTP
✅ Watchdog initialized
Connecting to WiFi......
✅ WiFi connected!
📶 IP Address: 192.168.3.xxx
🚀 HTTP server started on port 80
   Endpoint: GET /switch2/wakeup
```

记录打印的 IP 地址，在 SwitchPad 的"设备唤醒"中填入对应的 CIDR（如 `192.168.3.0/24`）即可使用。

---

## 依赖库

以下库均为 ESP32 Arduino 支持包内置，无需单独安装：

- `WiFi.h`
- `WebServer.h`
- `BLEDevice.h` / `BLEAdvertising.h`
- `esp_task_wdt.h`
