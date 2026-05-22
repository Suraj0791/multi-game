const MAX_EVENTS = 200;

export const SOCKET_TRACER_SCRIPT = `
(function() {
  if (window.__socketTracerInstalled) return;
  window.__socketTracerInstalled = true;
  window.__socketEvents = [];

  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (this.io && (type === 'connect' || type === 'event')) {
      // Socket.io internal — skip
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  const origEmit = io.Socket.prototype.emit;
  if (origEmit) {
    io.Socket.prototype.emit = function(ev, ...args) {
      window.__socketEvents.push({
        timestamp: Date.now(),
        direction: 'EMIT',
        event: ev,
        payload: safeClone(args)
      });
      if (window.__socketEvents.length > ${MAX_EVENTS}) window.__socketEvents.shift();
      return origEmit.call(this, ev, ...args);
    };
  }

  const origOnevent = io.Socket.prototype.onevent;
  if (origOnevent) {
    io.Socket.prototype.onevent = function(packet) {
      if (packet && packet.data) {
        window.__socketEvents.push({
          timestamp: Date.now(),
          direction: 'RECEIVE',
          event: packet.data[0],
          payload: safeClone(packet.data.slice(1))
        });
        if (window.__socketEvents.length > ${MAX_EVENTS}) window.__socketEvents.shift();
      }
      return origOnevent.call(this, packet);
    };
  }

  function safeClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); }
    catch { return String(obj); }
  }
})();
`;

export async function injectSocketTracer(page) {
  await page.addInitScript(SOCKET_TRACER_SCRIPT);
}

export async function getSocketEvents(page) {
  return page.evaluate(() => window.__socketEvents || []);
}

export async function dumpSocketEvents(page, label = 'Socket Events') {
  const events = await getSocketEvents(page);
  console.log(`\n  ── ${label} ──`);
  if (events.length === 0) {
    console.log('  (no events captured)');
  } else {
    events.forEach(e => {
      const ts = new Date(e.timestamp).toISOString().slice(11, 23);
      const dir = e.direction === 'EMIT' ? '→' : '←';
      const payload = e.payload ? JSON.stringify(e.payload).slice(0, 200) : '';
      console.log(`  [${ts}] ${dir} ${e.event} ${payload}`);
    });
    console.log(`  Total: ${events.length} events`);
  }
  console.log(`  ──────────────────────\n`);
}

export async function findMissingEvent(page, direction, eventName) {
  const events = await getSocketEvents(page);
  const found = events.filter(e => e.direction === direction && e.event === eventName);
  if (found.length === 0) {
    const lastEvents = events.filter(e => e.direction === direction).slice(-5);
    return {
      missing: eventName,
      lastEvents: lastEvents.map(e => `${e.event} at ${new Date(e.timestamp).toISOString().slice(11, 23)}`),
    };
  }
  return null;
}

export async function assertEventReceived(page, eventName, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const events = await getSocketEvents(page);
    if (events.some(e => e.direction === 'RECEIVE' && e.event === eventName)) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  const events = await getSocketEvents(page);
  const lastEvents = events.slice(-10).map(e => `[${new Date(e.timestamp).toISOString().slice(11, 23)}] ${e.direction} ${e.event}`);
  throw new Error(
    `Timeout waiting for event "${eventName}" (${timeoutMs}ms)\n` +
    `  Last 10 events:\n    ${lastEvents.join('\n    ')}`
  );
}
