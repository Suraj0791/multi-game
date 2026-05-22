const MAX_EVENTS = 200;
export const eventLog = [];

export function clearEventLog() {
  eventLog.length = 0;
}

export function traceSend(socket, eventName, ...args) {
  const entry = {
    timestamp: Date.now(),
    direction: 'EMIT',
    event: eventName,
    payload: safeClone(args),
  };
  eventLog.push(entry);
  if (eventLog.length > MAX_EVENTS) eventLog.shift();
  return socket.emit(eventName, ...args);
}

export function traceOn(socket, eventName, handler) {
  socket.on(eventName, (...args) => {
    const entry = {
      timestamp: Date.now(),
      direction: 'RECEIVE',
      event: eventName,
      payload: safeClone(args),
    };
    eventLog.push(entry);
    if (eventLog.length > MAX_EVENTS) eventLog.shift();
    handler(...args);
  });
}

export function traceOnce(socket, eventName, handler) {
  socket.once(eventName, (...args) => {
    const entry = {
      timestamp: Date.now(),
      direction: 'RECEIVE',
      event: eventName,
      payload: safeClone(args),
    };
    eventLog.push(entry);
    if (eventLog.length > MAX_EVENTS) eventLog.shift();
    handler(...args);
  });
}

function safeClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return String(obj);
  }
}

export function getLastEvents(n = 10) {
  return eventLog.slice(-n);
}

export function findEvent(direction, eventName) {
  return eventLog.find(e => e.direction === direction && e.event === eventName);
}

export function findEvents(direction, eventName) {
  return eventLog.filter(e => e.direction === direction && e.event === eventName);
}

export function dumpEventLog() {
  console.log('\n  ── Socket Event Log ──');
  eventLog.forEach((e, i) => {
    const ts = new Date(e.timestamp).toISOString().slice(11, 23);
    console.log(`  [${ts}] ${e.direction === 'EMIT' ? '→' : '←'} ${e.event}${e.payload ? ' ' + JSON.stringify(e.payload).slice(0, 200) : ''}`);
  });
  if (eventLog.length === 0) console.log('  (no events captured)');
  console.log('  ──────────────────────\n');
}

export function findMissingEvent(direction, eventName) {
  const found = eventLog.filter(e => e.direction === direction && e.event === eventName);
  if (found.length === 0) {
    const previousEvents = eventLog.filter(e => e.direction === direction).slice(-5);
    return {
      missing: eventName,
      lastEvents: previousEvents.map(e => `${e.event} at ${new Date(e.timestamp).toISOString().slice(11, 23)}`),
    };
  }
  return null;
}
