(() => {
  if (window.__youtubeSpeedControlInitialized) {
    return;
  }

  window.__youtubeSpeedControlInitialized = true;

  const STORAGE_KEY = "youtubePlaybackSpeed";
  const VIDEO_EVENTS = ["loadedmetadata", "canplay", "play", "emptied"];
  const NAVIGATION_EVENTS = [
    "yt-navigate-finish",
    "yt-page-data-updated",
    "popstate",
    "pageshow"
  ];
  const SPEED_EPSILON = 0.01;

  const state = {
    preferredSpeed: null,
    currentVideo: null,
    syncTimer: null,
    isApplyingSpeed: false,
    pendingResetToNormal: false
  };

  function normalizeSpeed(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.min(16, Math.max(0.25, value));
  }

  function isSameSpeed(left, right) {
    return Math.abs(left - right) < SPEED_EPSILON;
  }

  function scheduleSync(delay = 120) {
    if (state.syncTimer !== null) {
      if (delay !== 0) {
        return;
      }

      window.clearTimeout(state.syncTimer);
    }

    state.syncTimer = window.setTimeout(() => {
      state.syncTimer = null;
      syncVideoReference();
    }, delay);
  }

  function getVideoElement() {
    return document.querySelector("video.html5-main-video, ytd-player video, video");
  }

  function releaseVideo() {
    if (!state.currentVideo) {
      return;
    }

    VIDEO_EVENTS.forEach((eventName) => {
      state.currentVideo.removeEventListener(eventName, handleVideoLifecycle);
    });

    state.currentVideo.removeEventListener("ratechange", handleRateChange);
    state.currentVideo = null;
  }

  function bindVideo(video) {
    if (state.currentVideo === video) {
      return;
    }

    releaseVideo();

    if (!video) {
      return;
    }

    state.currentVideo = video;

    VIDEO_EVENTS.forEach((eventName) => {
      state.currentVideo.addEventListener(eventName, handleVideoLifecycle, {
        passive: true
      });
    });

    state.currentVideo.addEventListener("ratechange", handleRateChange);
  }

  function applyPlaybackRate(targetSpeed, video = state.currentVideo) {
    if (!video || targetSpeed === null) {
      return;
    }

    const currentDefaultSpeed =
      typeof video.defaultPlaybackRate === "number"
        ? video.defaultPlaybackRate
        : targetSpeed;

    if (
      isSameSpeed(video.playbackRate, targetSpeed) &&
      isSameSpeed(currentDefaultSpeed, targetSpeed)
    ) {
      return;
    }

    state.isApplyingSpeed = true;

    try {
      if (!isSameSpeed(currentDefaultSpeed, targetSpeed)) {
        video.defaultPlaybackRate = targetSpeed;
      }
    } catch (error) {
      // Some player states may reject defaultPlaybackRate updates.
    }

    try {
      if (!isSameSpeed(video.playbackRate, targetSpeed)) {
        video.playbackRate = targetSpeed;
      }
    } catch (error) {
      // Playback rate can briefly reject updates during player transitions.
    }

    window.setTimeout(() => {
      state.isApplyingSpeed = false;
    }, 0);
  }

  function applyPreferredSpeed(video = state.currentVideo) {
    if (state.preferredSpeed === null) {
      return;
    }

    applyPlaybackRate(state.preferredSpeed, video);
  }

  function resetPlaybackRate(video = state.currentVideo) {
    applyPlaybackRate(1, video);
    state.pendingResetToNormal = false;
  }

  function syncVideoReference() {
    const video = getVideoElement();

    bindVideo(video);

    if (video) {
      if (state.pendingResetToNormal) {
        resetPlaybackRate(video);
        return;
      }

      applyPreferredSpeed(video);
    }
  }

  function updatePreferredSpeed(nextSpeed) {
    const normalizedSpeed = normalizeSpeed(nextSpeed);
    const wasControlActive = state.preferredSpeed !== null;

    state.preferredSpeed = normalizedSpeed;
    state.pendingResetToNormal = wasControlActive && normalizedSpeed === null;

    if (state.currentVideo) {
      if (state.pendingResetToNormal) {
        resetPlaybackRate(state.currentVideo);
        return;
      }

      applyPreferredSpeed(state.currentVideo);
      return;
    }

    scheduleSync(0);
  }

  function handleVideoLifecycle() {
    scheduleSync(0);
  }

  function handleRateChange() {
    if (
      state.isApplyingSpeed ||
      state.preferredSpeed === null ||
      !state.currentVideo
    ) {
      return;
    }

    if (!isSameSpeed(state.currentVideo.playbackRate, state.preferredSpeed)) {
      applyPreferredSpeed(state.currentVideo);
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !(STORAGE_KEY in changes)) {
      return;
    }

    updatePreferredSpeed(changes[STORAGE_KEY].newValue);
  });

  chrome.storage.sync.get([STORAGE_KEY], (result) => {
    const initialSpeed = chrome.runtime.lastError
      ? null
      : result[STORAGE_KEY];

    updatePreferredSpeed(initialSpeed);
  });

  const observer = new MutationObserver(() => {
    scheduleSync();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  NAVIGATION_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, () => scheduleSync(0), { passive: true });
    document.addEventListener(eventName, () => scheduleSync(0), {
      passive: true
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      scheduleSync(0);
    }
  });

  scheduleSync(0);
})();
