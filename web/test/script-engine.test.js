/**
 * Tests for ScriptEngine — 8 test cases covering 100% of language features.
 *
 * Run:  node test/script-engine.test.js
 */

// ── Mock browser globals ──
if (typeof window === 'undefined') globalThis.window = globalThis;
window.SwitchButton = {
  None: 0, Y: 1, B: 2, A: 3, X: 4,
  L: 5, R: 6, ZL: 7, ZR: 8,
  Minus: 9, Plus: 10,
  LStick: 11, RStick: 12,
  Home: 13, Capture: 14,
  DpadUp: 15, DpadDown: 16, DpadLeft: 17, DpadRight: 18,
  LStickUp: 19, LStickDown: 20, LStickLeft: 21, LStickRight: 22,
  RStickUp: 23, RStickDown: 24, RStickLeft: 25, RStickRight: 26
};

window.ProtocolHelper = (() => {
  const BTN = window.SwitchButton;
  const StickCenter = 128, StickMin = 0, StickMax = 255, HatCenter = 0x08;
  const ButtonMask = {
    [BTN.Y]: 0x0001, [BTN.B]: 0x0002, [BTN.A]: 0x0004, [BTN.X]: 0x0008,
    [BTN.L]: 0x0010, [BTN.R]: 0x0020, [BTN.ZL]: 0x0040, [BTN.ZR]: 0x0080,
    [BTN.Minus]: 0x0100, [BTN.Plus]: 0x0200,
    [BTN.LStick]: 0x0400, [BTN.RStick]: 0x0800,
    [BTN.Home]: 0x1000, [BTN.Capture]: 0x2000
  };
  let _buttons = 0, _hat = HatCenter;
  let _lx = StickCenter, _ly = StickCenter, _rx = StickCenter, _ry = StickCenter;
  let _dpadUp = false, _dpadDown = false, _dpadLeft = false, _dpadRight = false;
  let _lsUp = false, _lsDown = false, _lsLeft = false, _lsRight = false;
  let _rsUp = false, _rsDown = false, _rsLeft = false, _rsRight = false;
  function updateHat() {
    const u = _dpadUp, d = _dpadDown, l = _dpadLeft, r = _dpadRight;
    if (u && !d && !l && r)      _hat = 0x01;
    else if (!u && d && !l && r) _hat = 0x03;
    else if (!u && d && l && !r) _hat = 0x05;
    else if (u && !d && l && !r) _hat = 0x07;
    else if (u && !d && !l && !r) _hat = 0x00;
    else if (!u && !d && !l && r) _hat = 0x02;
    else if (!u && d && !l && !r) _hat = 0x04;
    else if (!u && !d && l && !r) _hat = 0x06;
    else _hat = HatCenter;
  }
  function updateLStick() {
    _lx = _lsLeft ? StickMin : (_lsRight ? StickMax : StickCenter);
    _ly = _lsUp ? StickMin : (_lsDown ? StickMax : StickCenter);
  }
  function updateRStick() {
    _rx = _rsLeft ? StickMin : (_rsRight ? StickMax : StickCenter);
    _ry = _rsUp ? StickMin : (_rsDown ? StickMax : StickCenter);
  }
  function getEncodedReport() {
    const raw = [(_buttons >> 8) & 0xFF, _buttons & 0xFF, _hat, _lx, _ly, _rx, _ry];
    const packet = []; let n = 0n, bits = 0;
    for (const b of raw) { n = (n << 8n) | BigInt(b); bits += 8; while (bits >= 7) { bits -= 7; packet.push(Number((n >> BigInt(bits)) & 0x7Fn)); n &= (1n << BigInt(bits)) - 1n; } }
    packet[packet.length - 1] |= 0x80;
    return new Uint8Array(packet);
  }
  function createButtonCommand(switchButton, pressed) {
    const mask = ButtonMask[switchButton];
    if (mask !== undefined) { if (pressed) _buttons |= mask; else _buttons &= ~mask & 0xFFFF; }
    else { switch (switchButton) { case BTN.DpadUp: _dpadUp = pressed; updateHat(); break; case BTN.DpadDown: _dpadDown = pressed; updateHat(); break; case BTN.DpadLeft: _dpadLeft = pressed; updateHat(); break; case BTN.DpadRight: _dpadRight = pressed; updateHat(); break; case BTN.LStickUp: _lsUp = pressed; updateLStick(); break; case BTN.LStickDown: _lsDown = pressed; updateLStick(); break; case BTN.LStickLeft: _lsLeft = pressed; updateLStick(); break; case BTN.LStickRight: _lsRight = pressed; updateLStick(); break; case BTN.RStickUp: _rsUp = pressed; updateRStick(); break; case BTN.RStickDown: _rsDown = pressed; updateRStick(); break; case BTN.RStickLeft: _rsLeft = pressed; updateRStick(); break; case BTN.RStickRight: _rsRight = pressed; updateRStick(); break; } }
    return getEncodedReport();
  }
  function reset() { _buttons = 0; _hat = HatCenter; _lx = _ly = _rx = _ry = StickCenter; _dpadUp = _dpadDown = _dpadLeft = _dpadRight = false; _lsUp = _lsDown = _lsLeft = _lsRight = false; _rsUp = _rsDown = _rsLeft = _rsRight = false; return getEncodedReport(); }
  function clampStick(v) { return Math.max(StickMin, Math.min(StickMax, Math.round(v))); }
  function setSticks(lx, ly, rx, ry) { _lx = clampStick(lx); _ly = clampStick(ly); _rx = clampStick(rx); _ry = clampStick(ry); _lsUp = _lsDown = _lsLeft = _lsRight = false; _rsUp = _rsDown = _rsLeft = _rsRight = false; return getEncodedReport(); }
  function resetSticks() { _lx = _ly = _rx = _ry = StickCenter; _lsUp = _lsDown = _lsLeft = _lsRight = false; _rsUp = _rsDown = _rsLeft = _rsRight = false; return getEncodedReport(); }
  return { createButtonCommand, reset, setSticks, resetSticks };
})();

// SerialService mock: isConnected = false so button/stick commands silently skip
window.SerialService = {
  isConnected: false,
  _sent: [],
  sendCommand(data) { this._sent.push(data); }
};

// ── Load the engine ──
require('../js/script-engine.js');
const { loadScript, run } = window.ScriptEngine;

// ── Test helpers ──
let passed = 0, failed = 0, total = 0;

function assert(condition, message) {
  total++;
  if (condition) { passed++; }
  else { failed++; console.log(`  FAIL: ${message}`); }
}

function assertIncludes(actual, expected, label) {
  assert(actual.includes(expected), `${label}: expected "${expected}" in output, got:\n${actual}`);
}

function assertNotIncludes(actual, expected, label) {
  assert(!actual.includes(expected), `${label}: did NOT expect "${expected}" in output`);
}

/**
 * Run a script and return the full captured output string.
 */
async function runScript(source) {
  const lines = [];
  const ast = loadScript(source);
  await run(ast, (text) => lines.push(text));
  return lines.join('');
}

// ═══════════════════════════════════════════════
//  TC01 — Comments, PRINT, case-insensitive, spaces
// ═══════════════════════════════════════════════
async function testTC01() {
  console.log('--- TC01: Comments, PRINT, case-insensitive, spaces ---');
  const source = [
    '# 这是行首注释',
    '  PRINT 你好世界    # 行内注释',
    '  print 大小写不敏感   # 关键字小写也合法',
    '  $计数 = 42         # 变量名含中文',
    '  PRINT 变量的值是 & $计数',
    '  PRINT 不换行输出 \\',
    '  PRINT 续行',
  ].join('\n');

  const out = await runScript(source);

  assertIncludes(out, '你好世界',      'TC01-print1');
  assertIncludes(out, '大小写不敏感',   'TC01-case-insensitive');
  assertIncludes(out, '变量的值是 42',  'TC01-print-var');
  // The no-newline \ suppresses newline; next PRINT continues on same line (no space)
  assertIncludes(out, '不换行输出续行', 'TC01-no-newline');
}

// ═══════════════════════════════════════════════
//  TC02 — Buttons, sticks, WAIT (skip serial)
// ═══════════════════════════════════════════════
async function testTC02() {
  console.log('--- TC02: Buttons, sticks, WAIT (parse-only, serial disconnected) ---');
  // Since SerialService.isConnected is false, button/stick statements silently skip.
  // We just verify the script parses and runs without errors.
  const source = [
    'A                   # default 50ms',
    'A 200               # specified duration',
    'HOME 1000           # special key',
    'MINUS               # alias key',
    'ZL                  # two-letter key',
    'LCLICK              # long alias key',
    'LEFT DOWN           # hold',
    '  WAIT 100',
    'LEFT UP             # release',
    '$dur = 300',
    'A $dur              # variable duration',
    'RS UP,50            # stick direction+duration',
    'RS 135              # stick angle hold',
    'RS UP,$dur          # stick+variable duration',
    'LS RESET            # stick reset',
    'WAIT 500',
    'WAIT $dur           # variable wait',
  ].join('\n');

  // Should parse & run without throwing (buttons/sticks silently skip when disconnected)
  let error = null;
  try {
    const ast = loadScript(source);
    await run(ast, () => {});
  } catch (e) {
    error = e;
  }
  assert(error === null, `TC02 should run without error, got: ${error?.message}`);
}

// ═══════════════════════════════════════════════
//  TC03 — Constants and arithmetic operators
// ═══════════════════════════════════════════════
async function testTC03() {
  console.log('--- TC03: Constants and arithmetic operators ---');
  const source = [
    '_PI = 3',
    '$1 = 1 + 2 * _PI',   // 1+6=7
    '$2 = 10 / 3',              // 3
    '$3 = 10 % 3',              // 1
    '$4 = 5 - 3',               // 2
    'PRINT 加乘 & $1',
    'PRINT 除 & $2',
    'PRINT 余 & $3',
    'PRINT 减 & $4',
  ].join('\n');

  const out = await runScript(source);
  assertIncludes(out, '加乘 7',  'TC03-add-mul');
  assertIncludes(out, '除 3',     'TC03-div');
  assertIncludes(out, '余 1',     'TC03-mod');
  assertIncludes(out, '减 2',     'TC03-sub');
}

// ═══════════════════════════════════════════════
//  TC04 — IF / ELIF / ELSE / comparison operators
// ═══════════════════════════════════════════════
async function testTC04() {
  console.log('--- TC04: IF / ELIF / ELSE / comparisons ---');
  const source = [
    '$1 = 5',
    'IF $1 == 5',
    '  PRINT 等于5',
    'ELIF $1 > 10',
    '  PRINT 大于10',
    'ELSE',
    '  PRINT 其他值',
    'ENDIF',
    '',
    'IF $1 != 3',
    '  PRINT 不等于3',
    'ENDIF',
    'IF $1 >= 5',
    '  PRINT 大于等于5',
    'ENDIF',
    'IF $1 <= 5',
    '  PRINT 小于等于5',
    'ENDIF',
    'IF $1 < 6',
    '  PRINT 小于6',
    'ENDIF',
  ].join('\n');

  const out = await runScript(source);
  // PRINT joins adjacent tokens (STRING + NUMBER) with a space
  assertIncludes(out, '等于 5',      'TC04-if-true');
  assertNotIncludes(out, '大于 10',  'TC04-elif-skipped');
  assertNotIncludes(out, '其他值',  'TC04-else-skipped');
  assertIncludes(out, '不等于 3',    'TC04-neq');
  assertIncludes(out, '大于等于 5',  'TC04-gte');
  assertIncludes(out, '小于等于 5',  'TC04-lte');
  assertIncludes(out, '小于 6',      'TC04-lt');
}

// ═══════════════════════════════════════════════
//  TC05 — Loops, BREAK, CONTINUE (with levels)
// ═══════════════════════════════════════════════
async function testTC05() {
  console.log('--- TC05: Loops, BREAK, CONTINUE ---');

  // Sub-test A: fixed count loop
  const srcA = [
    'FOR 3',
    '  PRINT 固定循环',
    'NEXT',
  ].join('\n');
  const outA = await runScript(srcA);
  const countA = (outA.match(/固定循环/g) || []).length;
  assert(countA === 3, `TC05a: fixed loop should print 3 times, got ${countA}`);

  // Sub-test B: variable count loop (modify inside doesn't affect count)
  const srcB = [
    '$次数 = 2',
    'FOR $次数',
    '  $次数 = 0',
    '  PRINT 变量循环',
    'NEXT',
  ].join('\n');
  const outB = await runScript(srcB);
  const countB = (outB.match(/变量循环/g) || []).length;
  assert(countB === 2, `TC05b: variable loop should print 2 times, got ${countB}`);

  // Sub-test C: FOR..TO.. with CONTINUE
  const srcC = [
    'FOR $1 = 1 TO 4',
    '  IF $1 == 3',
    '    CONTINUE',
    '  ENDIF',
    '  PRINT $1',
    'NEXT',
  ].join('\n');
  const outC = await runScript(srcC);
  assertIncludes(outC, '1', 'TC05c-to-print1');
  assertIncludes(outC, '2', 'TC05c-to-print2');
  assertNotIncludes(outC, '3', 'TC05c-to-skip3');
  assertIncludes(outC, '4', 'TC05c-to-print4');

  // Sub-test D: infinite FOR with BREAK
  const srcD = [
    'FOR',
    '  $2 = $2 + 1',
    '  IF $2 == 2',
    '    BREAK',
    '  ENDIF',
    '  PRINT 循环体',
    'NEXT',
  ].join('\n');
  const outD = await runScript(srcD);
  const countD = (outD.match(/循环体/g) || []).length;
  assert(countD === 1, `TC05d: infinite FOR with BREAK should body once, got ${countD}`);

  // Sub-test E: BREAK 2 (break out of 2 nested loops)
  const srcE = [
    'FOR 3',
    '  FOR 2',
    '    PRINT 内层',
    '    BREAK 2',
    '  NEXT',
    '  PRINT 不执行外层',
    'NEXT',
  ].join('\n');
  const outE = await runScript(srcE);
  const countE = (outE.match(/内层/g) || []).length;
  assert(countE === 1, `TC05e: BREAK 2 should execute inner body once, got ${countE}`);
  assertNotIncludes(outE, '不执行外层', 'TC05e: outer body should not execute after BREAK 2');

  // Sub-test F: CONTINUE 2 (continue outer loop)
  const srcF = [
    'FOR 3',
    '  FOR 2',
    '    PRINT 内c',
    '    CONTINUE 2',
    '    PRINT 不执行内层',
    '  NEXT',
    '  PRINT 不执行外层',
    'NEXT',
  ].join('\n');
  const outF = await runScript(srcF);
  // "内c" tokenizes as STRING("内") + STRING("c"), PRINT joins with space → "内 c"
  const countF = (outF.match(/内 c/g) || []).length;
  assert(countF === 3, `TC05f: CONTINUE 2 should execute inner 3 times, got ${countF}`);
  assertNotIncludes(outF, '不执行内层', 'TC05f: inner body after CONTINUE 2 should skip');
  assertNotIncludes(outF, '不执行外层', 'TC05f: outer body after CONTINUE 2 should skip');
}

// ═══════════════════════════════════════════════
//  TC06 — Bitwise operators & built-in functions
// ═══════════════════════════════════════════════
async function testTC06() {
  console.log('--- TC06: Bitwise operators & built-in functions ---');
  const source = [
    '$1 = 5 & 3',           // 1
    '$2 = 5 | 3',           // 7
    '$3 = 5 ^ 3',           // 6
    '$4 = ~5',              // -6
    '$5 = 1 << 4',          // 16
    '$6 = 16 >> 2',         // 4
    'PRINT bitand & $1',
    'PRINT bitor & $2',
    'PRINT bitxor & $3',
    'PRINT bitnot & $4',
    'PRINT shl & $5',
    'PRINT shr & $6',
    '$t = TIME()',
    '$r = RAND(10)',
    'PRINT tval & $t',
    'PRINT rval & $r',
  ].join('\n');

  const out = await runScript(source);
  assertIncludes(out, 'bitand 1',    'TC06-bitand');
  assertIncludes(out, 'bitor 7',     'TC06-bitor');
  assertIncludes(out, 'bitxor 6',    'TC06-bitxor');
  assertIncludes(out, 'bitnot -6',   'TC06-bitnot');
  assertIncludes(out, 'shl 16',      'TC06-shl');
  assertIncludes(out, 'shr 4',       'TC06-shr');

  // TIME() should output a number >= 0
  const timeMatch = out.match(/tval (-?\d+)/);
  assert(timeMatch !== null && parseInt(timeMatch[1]) >= 0, 'TC06-time');

  // RAND(10) should output a number 0-9
  const randMatch = out.match(/rval (-?\d+)/);
  assert(randMatch !== null, 'TC06-rand-exists');
  if (randMatch) {
    const rv = parseInt(randMatch[1]);
    assert(rv >= 0 && rv <= 9, `TC06-rand-range: got ${rv}`);
  }
}

// ═══════════════════════════════════════════════
//  TC07 — Functions: definition, call, RETURN,
//         global/local variables, function-scoped constants
// ═══════════════════════════════════════════════
async function testTC07() {
  console.log('--- TC07: Functions ---');
  const source = [
    '$全局 = 100',
    'FUNC 测试函数',
    '  _内部常 = 7',
    '  $全局 = 1',
    '  $局部 = 50',
    '  PRINT 函数内全局 & $全局',
    '  PRINT 函数内局部 & $局部',
    '  PRINT 函数内常量 & _内部常',
    '  RETURN',
    '  PRINT 不执行',
    'ENDFUNC',
    'CALL 测试函数',
    'PRINT 函数外全局 & $全局',
  ].join('\n');

  const out = await runScript(source);
  assertIncludes(out, '函数内全局 1',   'TC07-func-modify-global');
  assertIncludes(out, '函数内局部 50',   'TC07-func-local');
  assertIncludes(out, '函数内常量 7',    'TC07-func-const');
  assertIncludes(out, '函数外全局 1',    'TC07-global-modified');
  assertNotIncludes(out, '不执行',        'TC07-return-skips');
}

// ═══════════════════════════════════════════════
//  TC08 — Edge cases: $0 immutable, constant re-assign,
//         variable<=0 skip, ALERT
// ═══════════════════════════════════════════════
async function testTC08() {
  console.log('--- TC08: Edge cases ---');

  // Sub-test A: $0 immutable
  const srcA = [
    '$0 = 999',
    'PRINT $0',
  ].join('\n');
  const outA = await runScript(srcA);
  assertIncludes(outA, '0',     'TC08a-$0-immutable');
  assertNotIncludes(outA, '999', 'TC08a-$0-no-999');

  // Sub-test B: constant re-assignment should error
  const srcB = [
    '_C = 10',
    '_C = 20',
    'PRINT _C',
  ].join('\n');
  const outB = await runScript(srcB);
  assertIncludes(outB, '[错误]', 'TC08b-constant-reassign-error');

  // Sub-test C: variable <= 0 skips button/wait/loop
  const srcC = [
    '$neg = -1',
    'A $neg',
    'RS UP,$neg',
    'WAIT $neg',
    '$zero = 0',
    'FOR $zero',
    '  PRINT 不应执行',
    'NEXT',
    'PRINT 跳过完成',
  ].join('\n');
  const outC = await runScript(srcC);
  assertNotIncludes(outC, '不应执行', 'TC08c-loop-skip');
  assertIncludes(outC, '跳过完成',    'TC08c-after-skip');

  // Sub-test D: ALERT output format
  const srcD = [
    'ALERT 推送测试消息',
  ].join('\n');
  const outD = await runScript(srcD);
  assertIncludes(outD, '[通知] 推送测试消息', 'TC08d-alert');
}

// ═══════════════════════════════════════════════
//  TC09 — Label reference (@name) with mock matcher
// ═══════════════════════════════════════════════
async function testTC09() {
  console.log('--- TC09: Label reference (@name) ---');

  // Register mock label matcher
  window.ScriptEngine.setLabelMatcher(async (name) => {
    if (name === '测试标签') return 97;
    if (name === '零标签') return 0;
    return 50;
  });

  // Sub-test A: basic assignment and IF with label
  const srcA = [
    '$r = @测试标签',
    'IF $r > 95',
    '  PRINT 找到目标',
    'ENDIF',
    'PRINT 匹配度 & $r',
  ].join('\n');
  const outA = await runScript(srcA);
  assertIncludes(outA, '找到目标',  'TC09a-label-if-true');
  assertIncludes(outA, '匹配度 97', 'TC09a-label-value');

  // Sub-test B: label returning 0 should not trigger IF
  const srcB = [
    '$r = @零标签',
    'IF $r > 0',
    '  PRINT 不应出现',
    'ENDIF',
    'PRINT 零匹配 & $r',
  ].join('\n');
  const outB = await runScript(srcB);
  assertNotIncludes(outB, '不应出现', 'TC09b-label-zero-if-false');
  assertIncludes(outB, '零匹配 0', 'TC09b-label-zero-value');

  // Sub-test C: label in arithmetic expression
  const srcC = [
    '$r = @测试标签 + 3',
    'PRINT 运算结果 & $r',
  ].join('\n');
  const outC = await runScript(srcC);
  assertIncludes(outC, '运算结果 100', 'TC09c-label-arithmetic');
}

// ═══════════════════════════════════════════════
//  Runner
// ═══════════════════════════════════════════════
async function main() {
  console.log('=== ScriptEngine Test Suite ===\n');

  await testTC01();
  await testTC02();
  await testTC03();
  await testTC04();
  await testTC05();
  await testTC06();
  await testTC07();
  await testTC08();
  await testTC09();

  console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
