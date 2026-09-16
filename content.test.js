const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const CONTENT_JS = path.join(__dirname, "content.js");

function runScenario({ duration, playerIsLive, hasLiveBadge = false }) {
  const listeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  let intervalCallback = null;
  const setCalls = [];

  const video = {
    duration,
    currentTime: 99,
    seekable: {
      length: 1,
      start: () => 0,
      end: () => 100
    },
    playbackRate: 1,
    defaultPlaybackRate: 1,
    addEventListener: (name, cb) => {
      if (!listeners.has(name)) {
        listeners.set(name, []);
      }
      listeners.get(name).push(cb);
    },
    removeEventListener: () => {}
  };

  const player = {
    classList: {
      contains: (cls) => cls === "ytp-live" && playerIsLive
    },
    querySelector: (selector) =>
      hasLiveBadge && selector.includes(".ytp-live-badge") ? {} : null
  };

  const document = {
    hidden: false,
    documentElement: {},
    querySelector: (selector) =>
      selector === "#movie_player" ? player : video,
    addEventListener: () => {}
  };

  const window = {
    setTimeout: (cb) => {
      const id = nextTimerId++;
      timers.set(id, cb);
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    setInterval: (cb) => {
      intervalCallback = cb;
      return nextTimerId++;
    },
    addEventListener: () => {}
  };

  const chrome = {
    runtime: { lastError: null },
    storage: {
      sync: {
        get: (_keys, cb) => cb({ youtubePlaybackSpeed: 2 }),
        set: (value, cb) => {
          setCalls.push(value);
          if (cb) {
            cb();
          }
        }
      },
      onChanged: { addListener: () => {} }
    }
  };

  class MutationObserver {
    observe() {}
  }

  const sandbox = {
    window,
    document,
    chrome,
    MutationObserver
  };

  const source = fs.readFileSync(CONTENT_JS, "utf8");
  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  let guard = 1000;
  while (timers.size > 0 && guard-- > 0) {
    const pending = [...timers.values()];
    timers.clear();
    for (const cb of pending) {
      cb();
    }
  }

  const fire = (name) => {
    for (const cb of listeners.get(name) || []) {
      cb();
    }
  };

  fire("timeupdate");

  guard = 1000;
  while (timers.size > 0 && guard-- > 0) {
    const pending = [...timers.values()];
    timers.clear();
    for (const cb of pending) {
      cb();
    }
  }

  return { playbackRate: video.playbackRate, setCalls };
}

test("VOD no fim não desliga o controle mesmo com badge oculto", () => {
  const { playbackRate, setCalls } = runScenario({
    duration: 100,
    playerIsLive: false,
    hasLiveBadge: true
  });

  assert.equal(playbackRate, 2);
  assert.equal(setCalls.length, 0);
});

test("live na borda desliga o controle", () => {
  const { playbackRate, setCalls } = runScenario({
    duration: Infinity,
    playerIsLive: true
  });

  assert.equal(playbackRate, 1);
  assert.equal(setCalls.length, 1);
  assert.equal(setCalls[0].youtubePlaybackSpeed, null);
  assert.equal(Object.keys(setCalls[0]).length, 1);
});
