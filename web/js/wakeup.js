window.WakeupService = (() => {
  function expandCidr(cidr) {
    const parts = cidr.trim().split('/');
    if (parts.length !== 2) throw new Error('Invalid CIDR');
    const octets = parts[0].split('.').map(Number);
    if (octets.length !== 4 || octets.some(n => isNaN(n) || n < 0 || n > 255)) throw new Error('Invalid IP');
    const prefix = parseInt(parts[1]);
    if (prefix < 0 || prefix > 32) throw new Error('Invalid prefix');

    let ip = (octets[0] << 24 | octets[1] << 16 | octets[2] << 8 | octets[3]) >>> 0;
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const network = (ip & mask) >>> 0;
    const broadcast = (network | ~mask) >>> 0;

    const result = [];
    for (let i = (network + 2) >>> 0; i < broadcast; i = (i + 1) >>> 0) {
      result.push(`${(i >>> 24) & 0xFF}.${(i >>> 16) & 0xFF}.${(i >>> 8) & 0xFF}.${i & 0xFF}`);
    }
    return result;
  }

  async function scanForNS2(ips, onProgress) {
    const PATH = '/switch2/wakeup';
    const TIMEOUT_MS = 500;
    const MAX_PARALLEL = 50;
    const found = [];
    let running = 0;
    let idx = 0;

    return new Promise(resolve => {
      function next() {
        while (running < MAX_PARALLEL && idx < ips.length) {
          const ip = ips[idx++];
          running++;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

          fetch(`http://${ip}${PATH}`, {
            signal: controller.signal,
            mode: 'no-cors'
          }).then(() => {
            found.push(ip);
          }).catch(e => {
            // AbortError = timeout (device not reachable)
            // Other errors (TypeError for CORS) might mean device exists
            if (e.name !== 'AbortError') {
              found.push(ip);
            }
          }).finally(() => {
            clearTimeout(timer);
            running--;
            if (onProgress) onProgress(idx, ips.length);
            next();
          });
        }
        if (running === 0) resolve(found.sort());
      }
      next();
    });
  }

  return { expandCidr, scanForNS2 };
})();
