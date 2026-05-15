window.UI = (() => {
  const BTN = window.SwitchButton;

  // DOM refs
  const $ = id => document.getElementById(id);
  const videoEl = $('video-el');
  const serialHint = $('serial-hint');
  const btnSerial = $('btn-serial-connect');
  const selVideo = $('sel-video-source');
  const btnVideo = $('btn-video-start');
  const selAudio = $('sel-audio-device');
  const btnAudio = $('btn-audio-start');
  const btnKeymapping = $('btn-keymapping');
  const btnReload = $('btn-reload-config');
  const inputCidr = $('input-cidr');
  const btnWakeup = $('btn-wakeup');
  const btnWakeupHelp = $('btn-wakeup-help');
  const btnFullscreen = $('btn-fullscreen');
  const btnWakeupHelpClose = $('btn-wakeup-help-close');
  const btnScriptLoad = $('btn-script-load');
  const btnScriptRun = $('btn-script-run');
  const btnScriptStop = $('btn-script-stop');
  const btnScriptClear = $('btn-script-clear');
  const btnGuideClose = $('btn-guide-close');
  const btnScriptGuide = $('btn-script-guide');
  const scriptFileInput = $('script-file-input');
  const homeSerialDot = $('home-serial-dot');
  const homeSerialText = $('home-serial-text');
  const homeVideoDot = $('home-video-dot');
  const homeVideoText = $('home-video-text');
  const homeAudioDot = $('home-audio-dot');
  const homeAudioText = $('home-audio-text');
  const homeWakeupText = $('home-wakeup-text');
  const scriptEditor = $('script-editor');
  const scriptOutput = $('script-output');

  let _isFullscreen = false;
  let _isKeymappingOpen = false;
  let _isScriptPanelOpen = false;

  function init() {
    // Setup video element
    window.VideoService.setVideoElement(videoEl);

    // Status listeners
    window.SerialService.onStatusChange(onSerialStatus);
    window.VideoService.onStatusChange(onVideoStatus);
    window.AudioService.onStatusChange(onAudioStatus);
    window.GamepadService.onButtonStateChanged(onGamepadInput);

    // Button events
    btnSerial.addEventListener('click', onSerialClick);
    btnVideo.addEventListener('click', onVideoClick);
    btnAudio.addEventListener('click', onAudioClick);
    btnKeymapping.addEventListener('click', onKeymappingClick);
    btnReload.addEventListener('click', onReloadClick);
    btnWakeup.addEventListener('click', onWakeupClick);
    btnFullscreen.addEventListener('click', toggleFullscreen);
    btnScriptLoad.addEventListener('click', () => scriptFileInput.click());
    scriptFileInput.addEventListener('change', onScriptFileLoad);
    btnScriptRun.addEventListener('click', onScriptRun);
    btnScriptStop.addEventListener('click', onScriptStop);
    btnScriptClear.addEventListener('click', () => { scriptOutput.textContent = ''; });
    btnScriptGuide.addEventListener('click', (e) => { e.stopPropagation(); openScriptGuide(); });
    btnGuideClose.addEventListener('click', () => $('guide-overlay').classList.add('hidden'));
    $('guide-overlay').addEventListener('click', (e) => { if (e.target === $('guide-overlay')) $('guide-overlay').classList.add('hidden'); });

    // Wakeup help modal
    btnWakeupHelp.addEventListener('click', (e) => { e.stopPropagation(); $('wakeup-help-overlay').classList.remove('hidden'); });
    btnWakeupHelpClose.addEventListener('click', () => $('wakeup-help-overlay').classList.add('hidden'));
    $('wakeup-help-overlay').addEventListener('click', (e) => { if (e.target === $('wakeup-help-overlay')) $('wakeup-help-overlay').classList.add('hidden'); });

    // Script panel resizer
    initResizer();

    // Keyboard events
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Cleanup
    window.addEventListener('beforeunload', onBeforeUnload);

    // Fullscreen change
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        _isFullscreen = false;
        document.getElementById('app').classList.remove('fullscreen');
      }
    });

    // Load config and populate
    loadConfiguration();

    // Start gamepad polling
    window.GamepadService.start();

    // Set keymapping open state callback
    window.KeyMappingUI.onOpenChange(open => { _isKeymappingOpen = open; });
  }

  async function loadConfiguration() {
    const config = window.ConfigService.loadConfig();
    inputCidr.value = config.wakeupCidr || '';

    // Enumerate devices once (triggers getUserMedia permission)
    await refreshDevices();

    // Auto-start video
    if (config.videoSourceId) {
      if ([...selVideo.options].some(o => o.value === config.videoSourceId)) {
        selVideo.value = config.videoSourceId;
        window.VideoService.startCapture(config.videoSourceId);
      }
    }

    // Auto-start audio
    if (config.audioDeviceId) {
      if ([...selAudio.options].some(o => o.value === config.audioDeviceId)) {
        selAudio.value = config.audioDeviceId;
        window.AudioService.startCapture(config.audioDeviceId);
      }
    }
  }

  async function refreshDevices() {
    const videos = await window.VideoService.getAvailableDevices();
    selVideo.innerHTML = '<option value="">-- 选择设备 --</option>';
    videos.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label;
      selVideo.appendChild(opt);
    });

    const audios = await window.AudioService.getAvailableDevices();
    selAudio.innerHTML = '<option value="">-- 选择设备 --</option>';
    audios.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label;
      selAudio.appendChild(opt);
    });
  }

  // ── Status handlers ──

  function onSerialStatus(status) {
    const ok = status.includes('已连接');
    homeSerialDot.className = 'is-dot' + (ok ? ' connected' : '');
    homeSerialText.textContent = '串口 ' + status;
    btnSerial.textContent = ok ? '断开串口' : '连接串口';
    serialHint.style.display = ok ? 'none' : '';
  }

  function onVideoStatus(status) {
    const ok = status.includes('运行中');
    homeVideoDot.className = 'is-dot' + (ok ? ' connected' : '');
    homeVideoText.textContent = '视频 ' + status;
  }

  function onAudioStatus(status) {
    const ok = status.includes('运行中');
    homeAudioDot.className = 'is-dot' + (ok ? ' connected' : '');
    homeAudioText.textContent = '音频 ' + status;
  }

  // ── Button handlers ──

  async function onSerialClick() {
    if (window.SerialService.isConnected) {
      await window.SerialService.disconnect();
    } else {
      const config = window.ConfigService.loadConfig();
      const ok = await window.SerialService.connect(config.baudRate);
      if (ok) {
        window.SerialService.sendCommand(window.ProtocolHelper.reset());
        btnSerial.blur();
      }
    }
  }

  async function onVideoClick() {
    const deviceId = selVideo.value;
    if (!deviceId) return;
    window.VideoService.stopCapture();
    const ok = await window.VideoService.startCapture(deviceId);
    if (ok) {
      const config = window.ConfigService.loadConfig();
      config.videoSourceId = deviceId;
      window.ConfigService.saveConfig(config);
    }
  }

  async function onAudioClick() {
    const deviceId = selAudio.value;
    if (!deviceId) return;
    window.AudioService.stopCapture();
    const ok = await window.AudioService.startCapture(deviceId);
    if (ok) {
      const config = window.ConfigService.loadConfig();
      config.audioDeviceId = deviceId;
      window.ConfigService.saveConfig(config);
    }
  }

  function onKeymappingClick() {
    window.KeyMappingUI.openDialog();
  }

  function onReloadClick() {
    window.KeyMappingService.loadMappings();
    loadConfiguration();
  }

  async function onWakeupClick() {
    const cidr = inputCidr.value.trim();
    if (!cidr) {
      homeWakeupText.textContent = '请输入扫描范围';
      homeWakeupText.style.color = 'var(--accent-yellow)';
      return;
    }

    let ips;
    try {
      ips = window.WakeupService.expandCidr(cidr);
    } catch {
      homeWakeupText.textContent = 'CIDR 格式无效';
      homeWakeupText.style.color = 'var(--accent-yellow)';
      return;
    }

    const config = window.ConfigService.loadConfig();
    config.wakeupCidr = cidr;
    window.ConfigService.saveConfig(config);

    btnWakeup.disabled = true;
    btnWakeup.textContent = '扫描中...';
    homeWakeupText.textContent = `正在扫描 ${cidr}...`;
    homeWakeupText.style.color = 'var(--accent-yellow)';

    const found = await window.WakeupService.scanForNS2(ips);

    if (found.length > 0) {
      homeWakeupText.textContent = `唤醒 ${found.length} 台设备`;
      homeWakeupText.style.color = 'var(--accent-green)';
    } else {
      homeWakeupText.textContent = '未发现设备';
      homeWakeupText.style.color = 'var(--accent-red)';
    }

    btnWakeup.disabled = false;
    btnWakeup.textContent = '唤醒 NS2';
  }

  // ── Keyboard input ──

  function onKeyDown(e) {
    if (_isKeymappingOpen) return;
    if (_isScriptPanelOpen) return;
    if (e.isComposing) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Enter') {
      e.preventDefault();
      return;
    }

    if (!window.SerialService.isConnected) return;
    if (e.repeat) return;

    const btn = window.KeyMappingService.getSwitchButton(e.code);
    if (btn !== BTN.None) {
      e.preventDefault();
      const cmd = window.ProtocolHelper.createButtonCommand(btn, true);
      window.SerialService.sendCommand(cmd);
    }
  }

  function onKeyUp(e) {
    if (_isKeymappingOpen) return;
    if (_isScriptPanelOpen) return;
    if (e.isComposing) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Enter') {
      toggleFullscreen();
      e.preventDefault();
      return;
    }

    if (!window.SerialService.isConnected) return;

    const btn = window.KeyMappingService.getSwitchButton(e.code);
    if (btn !== BTN.None) {
      e.preventDefault();
      window.SerialService.sendCommand(window.ProtocolHelper.createButtonCommand(btn, false));
    }
  }

  // ── Gamepad input ──

  function onGamepadInput(button, pressed) {
    if (!window.SerialService.isConnected) return;
    window.SerialService.sendCommand(window.ProtocolHelper.createButtonCommand(button, pressed));
  }

  // ── Fullscreen ──

  function toggleFullscreen() {
    if (_isFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
      document.getElementById('app').classList.add('fullscreen');
      _isFullscreen = true;
    }
  }

  // ── Script panel ──

  function openScriptPanel() {
    document.getElementById('app').classList.add('script-open');
    document.getElementById('script-panel').classList.remove('hidden');
    _isScriptPanelOpen = true;
  }

  function closeScriptPanel() {
    if (window.ScriptEngine.isRunning) window.ScriptEngine.stop();
    document.getElementById('app').classList.remove('script-open');
    document.getElementById('script-panel').classList.add('hidden');
    _isScriptPanelOpen = false;
    btnScriptRun.disabled = false;
    btnScriptStop.disabled = true;
  }

  async function onScriptFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.zip')) {
      await loadZipProject(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => { scriptEditor.value = reader.result; };
      reader.readAsText(file);
    }
    scriptFileInput.value = '';
  }

  async function loadZipProject(file) {
    if (typeof JSZip === 'undefined') {
      scriptOutput.textContent += '[错误] JSZip 未加载，无法读取 ZIP\n';
      return;
    }

    try {
      const zip = await JSZip.loadAsync(file);

      // Load main.ecs
      const mainEcs = zip.file('main.ecs');
      if (mainEcs) {
        scriptEditor.value = await mainEcs.async('string');
      }

      // Load IL labels - clear existing first, then import
      const imgLabelDir = zip.folder('ImgLabel');
      let imported = 0, skipped = 0;
      await window.ImgSearchDB.init();
      await window.ImgSearchDB.clearAllLabels();

      if (imgLabelDir) {
        const promises = [];
        imgLabelDir.forEach((relativePath, zipEntry) => {
          if (zipEntry.dir) return;
          if (!relativePath.toLowerCase().endsWith('.il')) return;
          promises.push((async () => {
            try {
              const text = await zipEntry.async('string');
              const json = JSON.parse(text);
              const name = relativePath.replace(/\.[iI][lL]$/, '');
              await window.ImgSearchDB.saveLabel({
                name,
                fileName: name + '.IL',
                content: text,
                json,
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
              imported++;
            } catch {
              skipped++;
            }
          })());
        });
        await Promise.all(promises);
      }

      // Refresh label list if search console overlay is open
      if (window.ImgSearchUI && typeof window.ImgSearchUI.refreshLabelList === 'function') {
        await window.ImgSearchUI.refreshLabelList();
      }

      const msg = mainEcs
        ? `已加载 main.ecs${imported > 0 ? '，导入 ' + imported + ' 个标签' : ''}${skipped > 0 ? '，跳过 ' + skipped + ' 个' : ''}`
        : (imported > 0 ? `导入了 ${imported} 个标签` : 'ZIP 中未找到 main.ecs 或标签');
      scriptOutput.textContent += '[信息] ' + msg + '\n';
    } catch (e) {
      scriptOutput.textContent += '[错误] ZIP 读取失败: ' + e.message + '\n';
    }
  }

  async function onScriptRun() {
    const source = scriptEditor.value.trim();
    if (!source) return;

    if (!window.SerialService.isConnected) {
      scriptOutput.textContent = '[错误] 请先连接串口设备\n';
      return;
    }

    btnScriptRun.disabled = true;
    btnScriptStop.disabled = false;
    scriptOutput.textContent = '';

    try {
      const ast = window.ScriptEngine.loadScript(source);
      await window.ScriptEngine.run(ast, (text) => {
        scriptOutput.textContent += text;
        scriptOutput.scrollTop = scriptOutput.scrollHeight;
      });
    } catch (e) {
      scriptOutput.textContent += '[错误] ' + e.message + '\n';
    }

    btnScriptRun.disabled = false;
    btnScriptStop.disabled = true;
  }

  function onScriptStop() {
    window.ScriptEngine.stop();
  }

  const SCRIPT_GUIDE_CONTENT = `所有代码不区分大小写，支持前置后置空格，支持行内注释。

【注释】
语法：# 注释内容
（多写注释是个好习惯，尤其是分享脚本给别人的时候）

【输出】
语法：PRINT 输出内容
示例：PRINT 你好世界
示例：PRINT $1 (输出变量$1的值)
示例：PRINT 变量的值是 & $1 (输出文字和变量时使用&分割)
（联机模式专用，在控制台显示文字）

【消息推送】
语法：ALERT 输出内容
（联机模式专用，发送推送消息，基于推送加服务）
注意！需要先关注<pushplus推送加>小程序生成token
取得token后请在设置->推送设置页面配置，否则无法使用

【按键】
语法：键位 [持续时间(ms)|DOWN|UP]
（键位可以取A、B、X、Y、L、R、ZL、ZR、MINUS(-)、PLUS(+)、LCLICK(按左摇杆)、RCLICK(按右摇杆)、HOME(返回系统)、CAPTURE(截屏)、LEFT、RIGHT、UP、DOWN；持续时间省略则为默认50ms）
示例：A（按下A键50毫秒）
示例：HOME 1000（按下Home键1秒）
示例：LEFT DOWN（按住左十字键，需要手动用LEFT UP松开）

【摇杆】
语法：LS|RS 方向|角度 [, 持续时间(ms)]
语法：LS|RS RESET
（LS左摇杆，RS右摇杆；方向可取UP、DOWN、LEFT、RIGHT；角度可取0~360，以右侧为0度，逆时针旋转；持续时间省略则一直保持，直到用RESET恢复原位）
示例：RS UP,50（右摇杆上推50毫秒）
示例：RS DOWN,2000（右摇杆下推2秒）
示例：LS 135（左摇杆左上方向，保持不动）
示例：LS RESET（左摇杆恢复原位）

【等待】
语法：[WAIT] 等待时间(ms)
示例：WAIT 500

【循环】
语法：
FOR [循环次数]（循环次数可选，省略则无限循环）
...
NEXT

---------------- 进阶用法 ----------------

【常量和变量】
常量语法：常量名 = 常量表达式
说明：常量名以下划线"_"开头，可包含英文、数字或汉字，中间不能有空格，且名称本身区分大小写
！！注意：常量一旦被定义就不能再被修改！常用于定义特殊意义的字面量
示例：
_PI = 3

变量语法：变量名 = 表达式
说明：变量名以特殊符号"$"开头，由英文、数字、汉字或下划线（_）组成；其中$0常驻为0，无法修改。
变量取值范围为-32768至+32767（二字节）/-2147483648至+2147483647（四字节）

表达式为一般算术表达式。由数字、常量、变量或搜图变量组成
示例：
$sum = 1+2

【含变量的基础语句】
输出：PRINT 用&分隔的输出内容
（输出内容可以是多段，用&分隔；每段内容如果是变量和常量会取其值，否则会按原样输出，留空会输出一个空格；如果最后一段内容为"\\"则不换行，下一个Print会继续在本行输出）
按键：键位 变量名
（变量值作为持续时间，值<=0则不按键）
摇杆：LS|RS 方向|角度 变量名
（变量值作为持续时间，值<=0则不按键）
等待：WAIT 变量名
（变量值作为等待时间，值<=0则不等待）

【含变量的循环】
语法1：FOR 变量名
（变量值作为循环次数，值<=0则直接跳过循环；循环开始后修改变量的值不会影响循环）
语法2：FOR 循环变量 = 初始值|变量 TO 终止值|变量
（循环变量从初始值循环至终止值+1；循环开始后修改初始、终止变量不会影响循环）
循环控制：
BREAK [层数]（直接结束循环，层数>1可以一次结束多层循环）
CONTINUE [层数]（跳过剩余内容继续下一轮循环，层数>1可以跳出内层并继续外层循环）

示例：
$2 = 20
FOR $2                    # 循环20次
...
NEXT
FOR $1 = 5 TO $2    # 循环15次，$1分别取值5~19
...
NEXT

【条件分支】
语法：
IF 条件表达式1
...
ELIF 条件表达式2（可选）
...
ELSE（可选）
...
ENDIF
（满足条件时执行第一个语句块，否则执行第二个语句块；可用的比较运算符有==、<、>、<=、>=、!=）
示例：
# 求1~100中的所有质数
FOR $1 = 2 TO 100    # 待测试数字
    $5 = 1
    FOR $2 = 2 TO $1    # 可能的约数
        $3 = $1 % $2
        IF $3 == 0      # 找到一个约数，因此$1非质数
            $5 = 0
            BREAK
        ENDIF
    NEXT
    IF $5 == 1
        PRINT $1        # 打印
    ENDIF
NEXT

【函数定义】
语法：
FUNC 函数名  #函数名可以包含中文、英文或数字，但数字不能在开头
...语句  #函数中可以执行任意语句，也可以调用其他函数

RETURN # (可选)函数中可以随时使用RETURN语句退出当前函数

ENDFUNC # 没有RETURN则会根据实际语句运行到函数结束

！！注意：在函数中定义的常量只能在函数范围内使用，赋值的变量如果在函数外定义过则默认使用外部公共变量，否则属于函数内局部变量！！

调用语法：
CALL 函数名

示例：
FUNC loop ## <loop>函数会循环按A键3次
for 3
a
500
next
ENDFUNC ## 结束函数定义
## 在需要执行函数的地方写如下CALL语句
CALL loop

【运算符】
运算符和表达式是编程语言中用于执行各种操作的基本组成部分。

算术运算符：
运算符\t描述
+\t加法
-\t减法
*\t乘法
/\t除法
%\t取余（模运算）

关系运算符：
运算符\t描述
==\t等于
!=\t不等于
>\t大于
<\t小于
>=\t大于等于
<=\t小于等于

位运算符：
运算符\t描述
&\t按位与
|\t按位或
^\t按位异或
~\t按位取反
<<\t左移
>>\t右移

【内置函数】
获取从脚本运行开始到现在的毫秒数：$t = TIME()
取随机数：$r = RAND(变量)（生成一个随机数，取值范围为0~变量值-1）
蜂鸣(windows系统专属)：BEEP freq, duration（调用系统命令beep响铃，第一个参数范围值37-32767）

【搜图语法】
语法：@搜图标签
（@开头，搜索对应文件名标签所代表的图像，名称中不能有空格等特殊字符）

示例：
    # 搜索5号路蛋屋主人对应的图片
    $2 = @5号路蛋屋主人
    # 判断匹配度是否大于95
    IF $2 > 95
        PRINT $2 & 找到了
    ENDIF

【Amiibo切换】
语法： AMIIBO 序号(序号范围0-19)

示例：
# 循环切换amiibo
FOR $3 = 0 TO 20
    AMIIBO $3 # 从0-19号切换Amiibo
NEXT
# 切换固定amiibo序号
AMIIBO 3 # 激活3号amiibo

其他相关配置请查看搜图窗口中的帮助

<To Be Continued...>`;

  function openScriptGuide() {
    const pre = $('guide-content');
    if (!pre.textContent.trim()) {
      pre.textContent = SCRIPT_GUIDE_CONTENT;
    }
    $('guide-overlay').classList.remove('hidden');
  }

  function initResizer() {
    const resizer = $('script-resizer');
    const editorArea = $('script-editor-area');
    const outputArea = document.querySelector('.script-output-area');
    let startY, startEditorH, startOutputH;

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startY = e.clientY;
      startEditorH = editorArea.getBoundingClientRect().height;
      startOutputH = outputArea.getBoundingClientRect().height;
      resizer.classList.add('active');
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    });

    function onDrag(e) {
      const dy = e.clientY - startY;
      const newEH = Math.max(60, startEditorH + dy);
      const newOH = Math.max(60, startOutputH - dy);
      editorArea.style.flex = 'none';
      editorArea.style.height = newEH + 'px';
      outputArea.style.flex = 'none';
      outputArea.style.height = newOH + 'px';
    }

    function onDragEnd() {
      resizer.classList.remove('active');
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }

  // ── Cleanup ──

  async function onBeforeUnload() {
    window.GamepadService.stop();
    window.VideoService.stopCapture();
    window.AudioService.stopCapture();
    await window.SerialService.disconnect();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', window.UI.init);
