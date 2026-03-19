/**
 * ESP32C3 BLE Wake-up via HTTP
 * - Connects to WiFi using user-defined credentials
 * - Provides HTTP server on port 80
 * - GET /switch2/wakeup triggers BLE advertising for 1 second
 * 适配 ESP32 Arduino 3.3.7 + HW-466AB ESP32-C3 SuperMini
 */

#include <WiFi.h>
#include <WebServer.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEAdvertising.h>
#include <esp_mac.h>
#include "esp_system.h"
#include "esp_task_wdt.h"

// ********************* 需要修改的配置部分 **********************
const char* WIFI_SSID     = "?????";       // 替换为你的Wi-Fi名称
const char* WIFI_PASSWORD = "???????";   // 替换为你的Wi-Fi密码

const char* DEFAULT_BLE_MAC  = "e0:ef:bf:2a:f3:9f";// 抓自己joycon2的mac地址
const char* DEFAULT_BLE_DATA = "0201061BFF53050100037E05662000018125B3540548C80F00000000000000"; // 抓自己joycon2的报文
// ************************************************************

// 引脚定义 - HW-466AB ESP32-C3 SuperMini 板载LED是GPIO8（低电平点亮）
#define LED_PIN 8

// 配置常量
#define WDT_TIMEOUT_SECONDS  180
#define BLE_ADVERTISING_DURATION 1000  // BLE广告持续时间1秒

// 定义设备名称
#define DEVICE_NAME "ESP32C3_BLE_Beacon"

// BLE缓冲区（从默认值初始化）
char ble_mac_buf[19] = "";
char ble_data_buf[65] = "";

// BLE相关变量
BLEAdvertising *pAdvertising = nullptr;
bool bleInitialized = false;
unsigned long bleAdvertisingStart = 0;

// HTTP服务器
WebServer server(80);

// 默认BLE广播数据（fallback）
static uint8_t wake_adv_data[] = {
    // Flags (0x02, 0x01, 0x06)
    0x02, 0x01, 0x06,
    // Manufacturer Specific Data: length=27 (0x1B), type=0xFF
    0x1B, 0xFF,
    // Payload (26 bytes)
    0x53, 0x05, 0x01, 0x00, 0x03, 0x7e, 0x05, 0x66, 0x20, 0x00, 0x01, 0x81,
    // Host address (6 bytes, will be filled at runtime in reverse order)
    0x09, 0x17, 0x15, 0x8C, 0x81, 0x80,
    // Remaining bytes
    0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
};

// 函数声明
String hexToBytes(const String& hex);  // 修改返回类型为Arduino String
void initBLE();
void startBLEAdvertising();
void stopBLEAdvertising();
void handleBLEAdvertising();
void handleWakeup();
void handleNotFound();

// ===================== setup =====================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nESP32C3 BLE Wake-up via HTTP");

  // GPIO初始化 - 初始灭灯（高电平）
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);

  // 看门狗初始化 - 适配新版ESP32 Arduino API
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT_SECONDS * 1000,  // 超时时间（毫秒）
    .idle_core_mask = (1 << 0),               // 监控核心0
    .trigger_panic = true                     // 超时触发panic
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  Serial.println("✅ Watchdog initialized");

  // 初始化BLE缓冲区
  strncpy(ble_mac_buf, DEFAULT_BLE_MAC, sizeof(ble_mac_buf) - 1);
  ble_mac_buf[sizeof(ble_mac_buf) - 1] = '\0';
  strncpy(ble_data_buf, DEFAULT_BLE_DATA, sizeof(ble_data_buf) - 1);
  ble_data_buf[sizeof(ble_data_buf) - 1] = '\0';

  // 连接WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset();
  }
  Serial.println();
  Serial.println("✅ WiFi connected!");
  Serial.print("📶 IP Address: ");
  Serial.println(WiFi.localIP());

  // HTTP路由注册
  server.on("/switch2/wakeup", HTTP_GET, handleWakeup);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("🚀 HTTP server started on port 80");
  Serial.println("   Endpoint: GET /switch2/wakeup");
}

// ===================== loop =====================
void loop() {
  esp_task_wdt_reset();
  server.handleClient();
  handleBLEAdvertising();
  delay(10);
}

// ===================== HTTP handlers =====================

// GET /switch2/wakeup → 触发BLE广播
void handleWakeup() {
  Serial.println("📡 HTTP GET /switch2/wakeup received");
  if (!bleInitialized) {
    initBLE();
  }
  startBLEAdvertising();
  server.send(200, "application/json", "{\"status\":\"ok\"}");
}

// 404 handler
void handleNotFound() {
  server.send(404, "text/plain", "Not Found");
}

// ===================== BLE functions =====================

// 初始化BLE
void initBLE() {
  if (bleInitialized) return;

  Serial.println("Initializing BLE...");

  // 解析并设置自定义BLE MAC地址（末字节减2，与BT MAC偏移对齐）
  uint8_t customMAC[6];
  sscanf(ble_mac_buf, "%hhx:%hhx:%hhx:%hhx:%hhx:%hhx",
         &customMAC[0], &customMAC[1], &customMAC[2],
         &customMAC[3], &customMAC[4], &customMAC[5]);
  customMAC[5] = customMAC[5] - 2;

  if (esp_base_mac_addr_set(customMAC) == ESP_OK) {
    Serial.println("Custom MAC address set successfully");
  } else {
    Serial.println("Failed to set custom MAC address");
  }

  // 打印实际BLE MAC
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_BT);
  Serial.printf("BLE MAC Address: %02X:%02X:%02X:%02X:%02X:%02X\n",
                mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

  // 初始化BLE设备
  BLEDevice::init(DEVICE_NAME);

  // 获取广告对象
  pAdvertising = BLEDevice::getAdvertising();

  // 设置广播参数（非连接广播）- 适配新版宏定义
  pAdvertising->setMinInterval(0x0020);
  pAdvertising->setMaxInterval(0x0040);
  pAdvertising->setAdvertisementType(0);

  bleInitialized = true;
  Serial.println("BLE initialized");
}

// 开始BLE广播
void startBLEAdvertising() {
  if (!bleInitialized) {
    initBLE();
  }

  Serial.println("Starting BLE advertising for 1 second...");

  // 停止当前广播（如果正在运行）
  pAdvertising->stop();

  // 构建广播数据
  BLEAdvertisementData oAdvertisementData = BLEAdvertisementData();

  if (strlen(ble_data_buf) > 0) {
    // 使用配置的十六进制字符串数据 - 转为Arduino String
    String hexData = hexToBytes(String(ble_data_buf));
    oAdvertisementData.addData(hexData);
    Serial.println("BLE Beacon started with configured data: " + String(ble_data_buf));
  } else {
    // 使用预定义的wake_adv_data数组作为原始广播数据
    String advertDataString((char*)wake_adv_data, sizeof(wake_adv_data));
    oAdvertisementData.addData(advertDataString);
    Serial.println("BLE Beacon started with predefined data...");
  }

  pAdvertising->setAdvertisementData(oAdvertisementData);
  pAdvertising->start();

  // 记录广播开始时间，LED亮起（低电平）
  bleAdvertisingStart = millis();
  digitalWrite(LED_PIN, LOW);
}

// 停止BLE广播
void stopBLEAdvertising() {
  if (bleInitialized && pAdvertising) {
    pAdvertising->stop();
    Serial.println("BLE advertising stopped");
  }
  bleAdvertisingStart = 0;
  // LED熄灭（高电平）
  digitalWrite(LED_PIN, HIGH);
}

// 处理BLE广告持续时间（在loop中调用）
void handleBLEAdvertising() {
  if (bleAdvertisingStart > 0 &&
      (millis() - bleAdvertisingStart >= BLE_ADVERTISING_DURATION)) {
    stopBLEAdvertising();
  }
}

// ===================== Utility =====================

// 将十六进制字符串转换为字节数组（返回Arduino String类型）
String hexToBytes(const String& hex) {
  String result = "";
  for (unsigned int i = 0; i < hex.length(); i += 2) {
    String byteStr = hex.substring(i, i + 2);
    char byte = (char)strtol(byteStr.c_str(), NULL, 16);
    result += byte;
  }
  return result;
}