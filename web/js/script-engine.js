window.ScriptEngine = (() => {
  const BTN = window.SwitchButton;

  // ── Button name → SwitchButton mapping ──
  const SCRIPT_BUTTON_MAP = {
    'A': BTN.A, 'B': BTN.B, 'X': BTN.X, 'Y': BTN.Y,
    'L': BTN.L, 'R': BTN.R, 'ZL': BTN.ZL, 'ZR': BTN.ZR,
    'MINUS': BTN.Minus, 'PLUS': BTN.Plus,
    'LCLICK': BTN.LStick, 'RCLICK': BTN.RStick,
    'HOME': BTN.Home, 'CAPTURE': BTN.Capture,
    'LEFT': BTN.DpadLeft, 'RIGHT': BTN.DpadRight,
    'UP': BTN.DpadUp, 'DOWN': BTN.DpadDown
  };

  const KEYWORDS = new Set([
    'PRINT', 'ALERT', 'FOR', 'NEXT', 'BREAK', 'CONTINUE',
    'IF', 'ELIF', 'ELSE', 'ENDIF',
    'FUNC', 'ENDFUNC', 'CALL', 'RETURN',
    'WAIT', 'TO', 'DOWN', 'UP', 'RESET',
    'TIME', 'RAND'
  ]);

  const BUTTON_NAMES = new Set(Object.keys(SCRIPT_BUTTON_MAP));
  const DIRECTION_NAMES = new Set(['UP', 'DOWN', 'LEFT', 'RIGHT']);

  // ═══════════════════════════════════════
  //  Tokenizer
  // ═══════════════════════════════════════

  function tokenize(source) {
    const tokens = [];
    let pos = 0;
    let line = 1;
    let col = 1;

    function ch() { return source[pos]; }
    function peek(offset) { return source[pos + (offset || 0)]; }
    function advance() {
      const c = source[pos++];
      if (c === '\n') { line++; col = 1; } else { col++; }
      return c;
    }
    function addToken(type, value) {
      tokens.push({ type, value: value != null ? value : source[pos], line, col });
    }

    while (pos < source.length) {
      const c = ch();

      // Skip spaces and tabs (not newlines)
      if (c === ' ' || c === '\t') { advance(); continue; }

      // Newline
      if (c === '\r') {
        advance();
        if (ch() === '\n') advance();
        addToken('NEWLINE', '\\n');
        continue;
      }
      if (c === '\n') {
        advance();
        addToken('NEWLINE', '\\n');
        continue;
      }

      // Comment: skip to end of line
      if (c === '#') {
        while (pos < source.length && ch() !== '\r' && ch() !== '\n') advance();
        continue;
      }

      // Multi-char operators
      const two = source.substring(pos, pos + 2);
      if (two === '==' || two === '!=' || two === '>=' || two === '<=' || two === '<<' || two === '>>') {
        addToken('OPERATOR', two);
        advance(); advance();
        continue;
      }

      // Single-char operators
      if ('+-*/%&|^~'.includes(c)) {
        addToken('OPERATOR', c);
        advance();
        continue;
      }
      if ('<>=()'.includes(c)) {
        const type = c === '(' ? 'LPAREN' : c === ')' ? 'RPAREN' : 'OPERATOR';
        addToken(type, c);
        advance();
        continue;
      }
      if (c === ',') {
        addToken('COMMA', c);
        advance();
        continue;
      }

      // Number
      if (c >= '0' && c <= '9') {
        let num = '';
        while (pos < source.length && ch() >= '0' && ch() <= '9') {
          num += advance();
        }
        addToken('NUMBER', parseInt(num, 10));
        continue;
      }

      // Variable ($name) or Constant (_name)
      if (c === '$' || c === '_') {
        let name = advance();
        while (pos < source.length && /[a-zA-Z0-9_一-鿿]/.test(ch())) {
          name += advance();
        }
        addToken('IDENTIFIER', name);
        continue;
      }

      // Backslash (for PRINT no-newline)
      if (c === '\\') {
        addToken('BACKSLASH', c);
        advance();
        continue;
      }

      // Word (keyword, button name, stick name, or bare string)
      if (/[a-zA-Z]/.test(c)) {
        let word = '';
        while (pos < source.length && /[a-zA-Z0-9]/.test(ch())) {
          word += advance();
        }
        const upper = word.toUpperCase();

        if (KEYWORDS.has(upper)) {
          addToken('KEYWORD', upper);
        } else if (upper === 'LS' || upper === 'RS') {
          addToken('STICK_NAME', upper);
        } else if (BUTTON_NAMES.has(upper)) {
          addToken('BUTTON_NAME', upper);
        } else {
          addToken('STRING', word);
        }
        continue;
      }

      // Non-ASCII characters (Chinese, etc.) — group as STRING
      if (c.charCodeAt(0) > 127) {
        let text = '';
        while (pos < source.length && ch().charCodeAt(0) > 127) {
          text += advance();
        }
        addToken('STRING', text);
        continue;
      }

      advance();
    }

    addToken('EOF', null);
    return tokens;
  }

  // ═══════════════════════════════════════
  //  Parser
  // ═══════════════════════════════════════

  class ScriptError extends Error {
    constructor(line, col, message) {
      super(`Line ${line}: ${message}`);
      this.line = line;
      this.col = col;
    }
  }

  function parse(tokens, source) {
    let pos = 0;

    function peek() { return tokens[pos] || tokens[tokens.length - 1]; }
    function advance() { return tokens[pos++]; }
    function at(type, value) {
      const t = peek();
      if (type && t.type !== type) return false;
      if (value != null && t.value !== value) return false;
      return true;
    }
    function expect(type, value) {
      if (!at(type, value)) {
        const t = peek();
        throw new ScriptError(t.line, t.col, `Expected ${type}${value ? ' ' + value : ''}, got ${t.type} '${t.value}'`);
      }
      return advance();
    }
    function consumeNewlines() {
      while (at('NEWLINE')) advance();
    }
    function expectNewlineOrEof() {
      if (at('NEWLINE')) advance();
      // EOF is also acceptable
    }

    // ── Expression parser (precedence climbing) ──

    function parseExpression() {
      return parseRelational();
    }

    function parseRelational() {
      let left = parseBitwiseOr();
      while (at('OPERATOR') && ['==', '!=', '>', '<', '>=', '<='].includes(peek().value)) {
        const op = advance().value;
        const right = parseBitwiseOr();
        left = { type: 'BinaryOp', op, left, right };
      }
      return left;
    }

    function parseBitwiseOr() {
      let left = parseBitwiseXor();
      while (at('OPERATOR') && peek().value === '|') {
        const op = advance().value;
        const right = parseBitwiseXor();
        left = { type: 'BinaryOp', op, left, right };
      }
      return left;
    }

    function parseBitwiseXor() {
      let left = parseShift();
      while (at('OPERATOR') && peek().value === '^') {
        const op = advance().value;
        const right = parseShift();
        left = { type: 'BinaryOp', op, left, right };
      }
      return left;
    }

    function parseShift() {
      let left = parseAdditive();
      while (at('OPERATOR') && ['<<', '>>'].includes(peek().value)) {
        const op = advance().value;
        const right = parseAdditive();
        left = { type: 'BinaryOp', op, left, right };
      }
      return left;
    }

    function parseAdditive() {
      let left = parseMultiplicative();
      while (at('OPERATOR') && ['+', '-'].includes(peek().value)) {
        const op = advance().value;
        const right = parseMultiplicative();
        left = { type: 'BinaryOp', op, left, right };
      }
      return left;
    }

    function parseMultiplicative() {
      let left = parseUnary();
      while (at('OPERATOR') && ['*', '/', '%'].includes(peek().value)) {
        const op = advance().value;
        const right = parseUnary();
        left = { type: 'BinaryOp', op, left, right };
      }
      return left;
    }

    function parseUnary() {
      if (at('OPERATOR') && peek().value === '~') {
        advance();
        return { type: 'UnaryOp', op: '~', operand: parseUnary() };
      }
      if (at('OPERATOR') && peek().value === '-') {
        advance();
        return { type: 'UnaryOp', op: '-', operand: parseUnary() };
      }
      return parseAtom();
    }

    function parseAtom() {
      const tok = peek();

      // Number literal
      if (tok.type === 'NUMBER') {
        advance();
        return { type: 'NumberLiteral', value: tok.value };
      }

      // Variable ($name)
      if (tok.type === 'IDENTIFIER' && tok.value.startsWith('$')) {
        advance();
        return { type: 'VariableRef', name: tok.value };
      }

      // Constant (_name)
      if (tok.type === 'IDENTIFIER' && tok.value.startsWith('_')) {
        advance();
        return { type: 'ConstantRef', name: tok.value };
      }

      // Parenthesized expression
      if (at('LPAREN')) {
        advance();
        const expr = parseExpression();
        expect('RPAREN');
        return expr;
      }

      // Built-in functions: TIME(), RAND(expr)
      if (at('KEYWORD', 'TIME')) {
        advance();
        expect('LPAREN');
        expect('RPAREN');
        return { type: 'FunctionCall', name: 'TIME', args: [] };
      }
      if (at('KEYWORD', 'RAND')) {
        advance();
        expect('LPAREN');
        const arg = parseExpression();
        expect('RPAREN');
        return { type: 'FunctionCall', name: 'RAND', args: [arg] };
      }

      throw new ScriptError(tok.line, tok.col, `Expected expression, got ${tok.type} '${tok.value}'`);
    }

    // ── PRINT / ALERT argument parsing ──

    function parsePrintArgs() {
      const args = [];
      while (!at('NEWLINE') && !at('EOF')) {
        // Trailing backslash = no newline
        if (at('BACKSLASH')) {
          const saved = pos;
          advance();
          if (at('NEWLINE') || at('EOF')) {
            return { args, noNewline: true };
          }
          pos = saved; // not trailing, treat as literal text
        }

        // & concatenation separator
        if (at('OPERATOR') && peek().value === '&') {
          advance();
          // Skip whitespace after &
          continue;
        }

        // Variable or constant reference
        if (at('IDENTIFIER')) {
          const id = advance();
          args.push({ kind: 'variable', name: id.value });
        } else {
          // Literal text: consume tokens until &, \, newline, EOF, #
          let text = '';
          while (!at('NEWLINE') && !at('EOF')) {
            if ((at('OPERATOR') && peek().value === '&') || at('BACKSLASH')) break;
            if (at('STRING') || at('NUMBER') || at('KEYWORD') || at('BUTTON_NAME') || at('STICK_NAME') || at('IDENTIFIER')) {
              text += (text ? ' ' : '') + advance().value;
            } else {
              break;
            }
          }
          if (text) args.push({ kind: 'literal', text });
          else break; // nothing consumed
        }
      }
      return { args, noNewline: false };
    }

    // ── Statement parsing ──

    function parseStatement() {
      const tok = peek();

      if (tok.type === 'KEYWORD') {
        switch (tok.value) {
          case 'PRINT':    return parsePrint();
          case 'ALERT':    return parseAlert();
          case 'FOR':      return parseFor();
          case 'NEXT':     return parseNext();
          case 'BREAK':    return parseBreak();
          case 'CONTINUE': return parseContinue();
          case 'IF':       return parseIf();
          case 'FUNC':     return parseFuncDef();
          case 'CALL':     return parseCall();
          case 'RETURN':   return parseReturn();
          case 'WAIT':     return parseWait();
        }
      }

      if (tok.type === 'STICK_NAME') return parseStick();
      if (tok.type === 'BUTTON_NAME') return parseButton();
      if (tok.type === 'NUMBER') return parseBareNumber();
      if (tok.type === 'IDENTIFIER' && tok.value.startsWith('$')) return parseAssignment();

      // Skip unknown tokens
      if (at('NEWLINE')) { advance(); return parseStatement(); }

      const t = peek();
      throw new ScriptError(t.line, t.col, `Unexpected token: ${t.type} '${t.value}'`);
    }

    function parsePrint() {
      const line = peek().line;
      advance(); // consume PRINT
      const { args, noNewline } = parsePrintArgs();
      expectNewlineOrEof();
      return { type: 'PrintStatement', args, noNewline, line };
    }

    function parseAlert() {
      advance(); // consume ALERT
      const { args } = parsePrintArgs();
      expectNewlineOrEof();
      return { type: 'AlertStatement', args };
    }

    function parseButton() {
      const tok = advance();
      const button = SCRIPT_BUTTON_MAP[tok.value];
      if (button === undefined) {
        throw new ScriptError(tok.line, tok.col, `Unknown button: ${tok.value}`);
      }

      let mode = 'press';
      let duration = null;

      if (at('KEYWORD', 'DOWN')) {
        advance(); mode = 'down';
      } else if (at('KEYWORD', 'UP')) {
        advance(); mode = 'up';
      } else if (at('IDENTIFIER') && peek().value.startsWith('$')) {
        // Variable as duration
        duration = parseExpression();
      } else if (at('NUMBER')) {
        duration = parseExpression();
      } else if (at('LPAREN')) {
        // Expression as duration
        duration = parseExpression();
      }

      expectNewlineOrEof();
      return { type: 'ButtonStatement', button, mode, duration };
    }

    function parseStick() {
      const tok = advance(); // LS or RS
      const stick = tok.value === 'LS' ? 'L' : 'R';

      if (at('KEYWORD', 'RESET')) {
        advance();
        expectNewlineOrEof();
        return { type: 'StickStatement', stick, action: 'reset', value: null, duration: null };
      }

      let action, value;
      if (at('KEYWORD') && DIRECTION_NAMES.has(peek().value)) {
        action = 'direction';
        value = advance().value; // UP/DOWN/LEFT/RIGHT
      } else {
        action = 'angle';
        value = parseExpression();
      }

      let duration = null;
      if (at('COMMA')) {
        advance();
        duration = parseExpression();
      }

      expectNewlineOrEof();
      return { type: 'StickStatement', stick, action, value, duration };
    }

    function parseWait() {
      advance(); // consume WAIT
      const duration = parseExpression();
      expectNewlineOrEof();
      return { type: 'WaitStatement', duration };
    }

    function parseBareNumber() {
      const duration = parseExpression();
      expectNewlineOrEof();
      return { type: 'WaitStatement', duration };
    }

    function parseAssignment() {
      const tok = advance(); // $name or _name
      expect('OPERATOR', '=');
      const value = parseExpression();
      expectNewlineOrEof();

      const kind = tok.value.startsWith('_') ? 'constant' : 'variable';
      return { type: 'AssignmentStatement', target: { kind, name: tok.value }, value };
    }

    function parseFor() {
      advance(); // consume FOR
      let variable = null, start = null, end = null, count = null;

      if (at('IDENTIFIER') && peek().value.startsWith('$')) {
        variable = advance().value;
        if (at('OPERATOR', '=')) {
          advance(); // consume =
          start = parseExpression();
          expect('KEYWORD', 'TO');
          end = parseExpression();
        }
        // else: FOR $var (counter mode)
      } else if (at('NUMBER')) {
        count = parseExpression();
      }

      consumeNewlines();
      const body = [];
      while (!at('EOF')) {
        if (at('KEYWORD', 'NEXT')) { advance(); break; }
        if (at('KEYWORD', 'ENDFUNC')) break;
        body.push(parseStatement());
      }
      consumeNewlines();
      return { type: 'ForStatement', variable, start, end, count, body };
    }

    function parseNext() {
      advance();
      expectNewlineOrEof();
      return { type: 'NextStatement' };
    }

    function parseBreak() {
      advance();
      let level = 1;
      if (at('NUMBER')) level = advance().value;
      expectNewlineOrEof();
      return { type: 'BreakStatement', level };
    }

    function parseContinue() {
      advance();
      let level = 1;
      if (at('NUMBER')) level = advance().value;
      expectNewlineOrEof();
      return { type: 'ContinueStatement', level };
    }

    function parseIf() {
      advance(); // consume IF
      const branches = [];

      const condition = parseExpression();
      consumeNewlines();
      const body = parseBlockUntil('ELIF', 'ELSE', 'ENDIF');
      branches.push({ condition, body });

      while (at('KEYWORD', 'ELIF')) {
        advance();
        const elifCond = parseExpression();
        consumeNewlines();
        const elifBody = parseBlockUntil('ELIF', 'ELSE', 'ENDIF');
        branches.push({ condition: elifCond, body: elifBody });
      }

      let elseBody = null;
      if (at('KEYWORD', 'ELSE')) {
        advance();
        consumeNewlines();
        elseBody = parseBlockUntil('ENDIF');
      }

      expect('KEYWORD', 'ENDIF');
      consumeNewlines();
      return { type: 'IfStatement', branches, elseBody };
    }

    function parseFuncDef() {
      advance(); // consume FUNC
      const nameTok = peek();
      let name = '';
      if (at('IDENTIFIER')) {
        name = advance().value;
      } else if (at('STRING') || at('KEYWORD')) {
        name = advance().value;
      } else {
        throw new ScriptError(nameTok.line, nameTok.col, `Expected function name`);
      }

      consumeNewlines();
      const body = [];
      while (!at('EOF')) {
        if (at('KEYWORD', 'ENDFUNC')) { advance(); break; }
        body.push(parseStatement());
      }
      consumeNewlines();
      return { type: 'FuncDefStatement', name, body };
    }

    function parseCall() {
      advance(); // consume CALL
      const nameTok = peek();
      let name = '';
      if (at('IDENTIFIER')) {
        name = advance().value;
      } else if (at('STRING') || at('KEYWORD')) {
        name = advance().value;
      } else {
        throw new ScriptError(nameTok.line, nameTok.col, `Expected function name`);
      }
      expectNewlineOrEof();
      return { type: 'CallStatement', name };
    }

    function parseReturn() {
      advance(); // consume RETURN
      expectNewlineOrEof();
      return { type: 'ReturnStatement' };
    }

    function parseBlockUntil(...stopKeywords) {
      const body = [];
      while (!at('EOF')) {
        if (at('KEYWORD') && stopKeywords.includes(peek().value)) break;
        body.push(parseStatement());
      }
      return body;
    }

    // ── Top-level parse ──

    function parseProgram() {
      consumeNewlines();
      const body = [];
      while (!at('EOF')) {
        body.push(parseStatement());
      }
      return { type: 'Program', body };
    }

    return parseProgram();
  }

  // ═══════════════════════════════════════
  //  Interpreter
  // ═══════════════════════════════════════

  class AbortException extends Error { constructor() { super('Script aborted'); } }
  class BreakException { constructor(level = 1) { this.level = level; } }
  class ContinueException { constructor(level = 1) { this.level = level; } }
  class ReturnException {}

  let _abortController = null;
  let _isRunning = false;
  let _outputCallback = null;
  let _startTime = 0;
  let _scopeStack = [];
  let _functions = {};
  let _printNoNewline = false;

  function checkAbort() {
    if (_abortController && _abortController.signal.aborted) throw new AbortException();
  }

  function delay(ms) {
    if (ms <= 0) return Promise.resolve();
    checkAbort();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      const onAbort = () => { clearTimeout(timer); reject(new AbortException()); };
      _abortController.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  // ── Scope management ──

  function normalizeName(name) {
    return name.toLowerCase();
  }

  function getVariable(name) {
    if (name === '$0' || normalizeName(name) === '$0') return 0;
    const key = normalizeName(name);
    for (let i = _scopeStack.length - 1; i >= 0; i--) {
      if (_scopeStack[i].variables.has(key)) return _scopeStack[i].variables.get(key);
    }
    return 0;
  }

  function setVariable(name, value) {
    if (name === '$0' || normalizeName(name) === '$0') return;
    const key = normalizeName(name);
    // In function scope, check outer scopes first
    if (_scopeStack.length > 1) {
      for (let i = _scopeStack.length - 2; i >= 0; i--) {
        if (_scopeStack[i].variables.has(key)) {
          _scopeStack[i].variables.set(key, value);
          return;
        }
      }
    }
    _scopeStack[_scopeStack.length - 1].variables.set(key, value);
  }

  function getConstant(name) {
    const key = normalizeName(name);
    for (let i = _scopeStack.length - 1; i >= 0; i--) {
      if (_scopeStack[i].constants.has(key)) return _scopeStack[i].constants.get(key);
    }
    return 0;
  }

  function setConstant(name, value) {
    const key = normalizeName(name);
    _scopeStack[_scopeStack.length - 1].constants.set(key, value);
  }

  // ── Expression evaluation ──

  async function evalExpr(expr) {
    checkAbort();
    switch (expr.type) {
      case 'NumberLiteral': return expr.value;
      case 'VariableRef': return getVariable(expr.name);
      case 'ConstantRef': return getConstant(expr.name);
      case 'FunctionCall':
        if (expr.name === 'TIME') return Date.now() - _startTime;
        if (expr.name === 'RAND') {
          const max = await evalExpr(expr.args[0]);
          return Math.floor(Math.random() * Math.max(0, max));
        }
        return 0;
      case 'UnaryOp': {
        const val = await evalExpr(expr.operand);
        return expr.op === '-' ? -val : ~val;
      }
      case 'BinaryOp': {
        const left = await evalExpr(expr.left);
        const right = await evalExpr(expr.right);
        switch (expr.op) {
          case '+':  return left + right;
          case '-':  return left - right;
          case '*':  return left * right;
          case '/':  return right !== 0 ? Math.trunc(left / right) : 0;
          case '%':  return right !== 0 ? left % right : 0;
          case '==': return left === right ? 1 : 0;
          case '!=': return left !== right ? 1 : 0;
          case '>':  return left > right ? 1 : 0;
          case '<':  return left < right ? 1 : 0;
          case '>=': return left >= right ? 1 : 0;
          case '<=': return left <= right ? 1 : 0;
          case '&':  return left & right;
          case '|':  return left | right;
          case '^':  return left ^ right;
          case '<<': return left << right;
          case '>>': return left >> right;
        }
        return 0;
      }
    }
    return 0;
  }

  // ── Output helpers ──

  function output(text, newline) {
    if (!_outputCallback) return;
    if (newline === undefined) newline = true;
    _outputCallback(newline ? text + '\n' : text);
  }

  async function resolvePrintArgs(args) {
    let result = '';
    for (const arg of args) {
      if (result !== '') result += ' ';
      if (arg.kind === 'variable') {
        if (arg.name.startsWith('$')) {
          result += String(getVariable(arg.name));
        } else {
          result += String(getConstant(arg.name));
        }
      } else {
        result += arg.text;
      }
    }
    return result.trimEnd();
  }

  // ── Statement execution ──

  async function execBlock(stmts) {
    for (const stmt of stmts) {
      await execStatement(stmt);
    }
  }

  async function execStatement(stmt) {
    checkAbort();
    switch (stmt.type) {
      case 'PrintStatement':   return execPrint(stmt);
      case 'AlertStatement':   return execAlert(stmt);
      case 'ButtonStatement':  return execButton(stmt);
      case 'StickStatement':   return execStick(stmt);
      case 'WaitStatement':    return execWait(stmt);
      case 'ForStatement':     return execFor(stmt);
      case 'IfStatement':      return execIf(stmt);
      case 'AssignmentStatement': return execAssignment(stmt);
      case 'CallStatement':    return execCall(stmt);
      case 'ReturnStatement':  throw new ReturnException();
      case 'BreakStatement':   throw new BreakException(stmt.level || 1);
      case 'ContinueStatement':throw new ContinueException(stmt.level || 1);
      case 'NextStatement':    return; // handled by FOR parser
    }
  }

  async function execPrint(stmt) {
    const text = await resolvePrintArgs(stmt.args);
    if (_printNoNewline) {
      output(text, false);
      _printNoNewline = false;
    } else {
      output(text, !stmt.noNewline);
      if (stmt.noNewline) _printNoNewline = true;
    }
  }

  async function execAlert(stmt) {
    const text = await resolvePrintArgs(stmt.args);
    output('[通知] ' + text);
  }

  async function execButton(stmt) {
    if (!window.SerialService.isConnected) return;
    const proto = window.ProtocolHelper;

    if (stmt.mode === 'press') {
      const duration = stmt.duration ? await evalExpr(stmt.duration) : 50;
      window.SerialService.sendCommand(proto.createButtonCommand(stmt.button, true));
      await delay(duration);
      window.SerialService.sendCommand(proto.createButtonCommand(stmt.button, false));
    } else if (stmt.mode === 'down') {
      window.SerialService.sendCommand(proto.createButtonCommand(stmt.button, true));
    } else {
      window.SerialService.sendCommand(proto.createButtonCommand(stmt.button, false));
    }
  }

  async function execStick(stmt) {
    if (!window.SerialService.isConnected) return;
    const proto = window.ProtocolHelper;

    if (stmt.action === 'reset') {
      window.SerialService.sendCommand(proto.resetSticks());
      return;
    }

    let lx = 128, ly = 128, rx = 128, ry = 128;
    const isLeft = stmt.stick === 'L';

    if (stmt.action === 'direction') {
      const dir = stmt.value;
      if (dir === 'UP')    { if (isLeft) ly = 0;   else ry = 0; }
      if (dir === 'DOWN')  { if (isLeft) ly = 255;  else ry = 255; }
      if (dir === 'LEFT')  { if (isLeft) lx = 0;   else rx = 0; }
      if (dir === 'RIGHT') { if (isLeft) lx = 255;  else rx = 255; }
    } else if (stmt.action === 'angle') {
      const degrees = await evalExpr(stmt.value);
      const radians = (degrees * Math.PI) / 180;
      const x = Math.round(128 + 127 * Math.cos(radians));
      const y = Math.round(128 - 127 * Math.sin(radians));
      if (isLeft) { lx = x; ly = y; } else { rx = x; ry = y; }
    }

    window.SerialService.sendCommand(proto.setSticks(lx, ly, rx, ry));

    if (stmt.duration) {
      const ms = await evalExpr(stmt.duration);
      await delay(ms);
      window.SerialService.sendCommand(proto.resetSticks());
    }
  }

  async function execWait(stmt) {
    const ms = await evalExpr(stmt.duration);
    await delay(ms);
  }

  async function execFor(stmt) {
    if (stmt.count !== null) {
      // FOR number or FOR $var
      const count = await evalExpr(stmt.count);
      if (count <= 0) return;
      for (let i = 0; i < count; i++) {
        if (stmt.variable) setVariable(stmt.variable, i);
        try {
          await execBlock(stmt.body);
        } catch (e) {
          if (e instanceof BreakException) {
            if (e.level > 1) throw new BreakException(e.level - 1);
            break;
          }
          if (e instanceof ContinueException) {
            if (e.level > 1) throw new ContinueException(e.level - 1);
            continue;
          }
          throw e;
        }
      }
    } else if (stmt.start !== null && stmt.end !== null) {
      // FOR $var = start TO end
      const startVal = await evalExpr(stmt.start);
      const endVal = await evalExpr(stmt.end);
      for (let i = startVal; i <= endVal; i++) {
        if (stmt.variable) setVariable(stmt.variable, i);
        try {
          await execBlock(stmt.body);
        } catch (e) {
          if (e instanceof BreakException) {
            if (e.level > 1) throw new BreakException(e.level - 1);
            break;
          }
          if (e instanceof ContinueException) {
            if (e.level > 1) throw new ContinueException(e.level - 1);
            continue;
          }
          throw e;
        }
      }
    } else if (stmt.variable) {
      // FOR $var (variable holds count)
      const count = getVariable(stmt.variable);
      if (count <= 0) return;
      for (let i = 0; i < count; i++) {
        if (stmt.variable) setVariable(stmt.variable, i);
        try {
          await execBlock(stmt.body);
        } catch (e) {
          if (e instanceof BreakException) {
            if (e.level > 1) throw new BreakException(e.level - 1);
            break;
          }
          if (e instanceof ContinueException) {
            if (e.level > 1) throw new ContinueException(e.level - 1);
            continue;
          }
          throw e;
        }
      }
    }
  }

  async function execIf(stmt) {
    for (const branch of stmt.branches) {
      const cond = await evalExpr(branch.condition);
      if (cond !== 0) {
        await execBlock(branch.body);
        return;
      }
    }
    if (stmt.elseBody) {
      await execBlock(stmt.elseBody);
    }
  }

  async function execAssignment(stmt) {
    const value = await evalExpr(stmt.value);
    if (stmt.target.kind === 'constant') {
      setConstant(stmt.target.name, value);
    } else {
      setVariable(stmt.target.name, value);
    }
  }

  async function execCall(stmt) {
    const funcKey = stmt.name.toUpperCase();
    const funcDef = _functions[funcKey];
    if (!funcDef) {
      output('[错误] 未知函数: ' + stmt.name);
      return;
    }
    _scopeStack.push({ variables: new Map([['$0', 0]]), constants: new Map() });
    try {
      await execBlock(funcDef.body);
    } catch (e) {
      if (e instanceof ReturnException) {
        // normal return
      } else {
        throw e;
      }
    } finally {
      _scopeStack.pop();
    }
  }

  function cleanupHardwareState() {
    if (window.SerialService && window.SerialService.isConnected) {
      window.SerialService.sendCommand(window.ProtocolHelper.reset());
    }
  }

  // ═══════════════════════════════════════
  //  Public API
  // ═══════════════════════════════════════

  function loadScript(source) {
    const tokens = tokenize(source);
    const ast = parse(tokens, source);
    return ast;
  }

  async function run(ast, onOutput) {
    if (_isRunning) throw new Error('Script already running');
    _abortController = new AbortController();
    _isRunning = true;
    _outputCallback = onOutput || console.log;
    _startTime = Date.now();
    _scopeStack = [{ variables: new Map([['$0', 0]]), constants: new Map() }];
    _functions = {};
    _printNoNewline = false;

    // Pre-scan function definitions
    for (const stmt of ast.body) {
      if (stmt.type === 'FuncDefStatement') {
        _functions[stmt.name.toUpperCase()] = stmt;
      }
    }

    try {
      await execBlock(ast.body);
      output('[脚本执行完成]');
    } catch (e) {
      if (e instanceof AbortException) {
        output('[脚本已停止]');
      } else {
        output('[错误] ' + e.message);
        console.error('Script error:', e);
      }
    } finally {
      _isRunning = false;
      _abortController = null;
      cleanupHardwareState();
    }
  }

  function stop() {
    if (_abortController) {
      _abortController.abort();
    }
  }

  return {
    loadScript,
    run,
    stop,
    get isRunning() { return _isRunning; }
  };
})();
