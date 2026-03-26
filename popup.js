const STORAGE_KEY = "youtubePlaybackSpeed";
const LAST_SPEED_KEY = "youtubePlaybackSpeedLastValue";
const MIN_SPEED = 1;
const MAX_SPEED = 3;
const SPEED_STEP = 0.25;
const DEFAULT_SPEED = 1.5;
const SPEED_POINTS = Array.from(
  { length: Math.round((MAX_SPEED - MIN_SPEED) / SPEED_STEP) + 1 },
  (_, index) => Number((MIN_SPEED + index * SPEED_STEP).toFixed(2))
);

document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("speedRange");
  const pointsContainer = document.getElementById("speedPoints");
  const statusElement = document.getElementById("status");
  const valueElement = document.getElementById("speedValue");
  const detailElement = document.getElementById("speedDetail");
  const toggleButton = document.getElementById("toggleControl");

  let activeSpeed = null;
  let lastSpeed = DEFAULT_SPEED;

  function normalizeSpeed(value, fallback = null) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }

    const rounded = Math.round(value / SPEED_STEP) * SPEED_STEP;
    const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, rounded));

    return Number(clamped.toFixed(2));
  }

  function formatSpeedLabel(speed) {
    const normalized = normalizeSpeed(speed, DEFAULT_SPEED);
    const label = normalized
      .toFixed(2)
      .replace(/\.00$/, ".0")
      .replace(/(\.\d)0$/, "$1");

    return `${label}x`;
  }

  function setStatus(message, tone = "neutral") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
  }

  function getSliderSpeed() {
    return normalizeSpeed(Number.parseFloat(slider.value), DEFAULT_SPEED);
  }

  function setSliderSpeed(speed) {
    const normalized = normalizeSpeed(speed, DEFAULT_SPEED);
    const progress = ((normalized - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;

    slider.value = String(normalized);
    slider.style.setProperty("--range-progress", `${progress}%`);
  }

  function updatePointSelection(selectedSpeed, mode) {
    const normalized = normalizeSpeed(selectedSpeed, DEFAULT_SPEED);

    pointsContainer.dataset.mode = mode;

    pointsContainer.querySelectorAll(".speed-point").forEach((button) => {
      const pointSpeed = normalizeSpeed(
        Number.parseFloat(button.dataset.speed),
        DEFAULT_SPEED
      );
      const isActive = pointSpeed === normalized;

      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function render(controlSpeed = activeSpeed, sliderSpeed = lastSpeed, previewSpeed = null) {
    const normalizedSliderSpeed = normalizeSpeed(sliderSpeed, DEFAULT_SPEED);
    const isPreview = previewSpeed !== null;
    const isControlActive = controlSpeed !== null;
    const displaySpeed = isPreview
      ? normalizeSpeed(previewSpeed, normalizedSliderSpeed)
      : controlSpeed !== null
        ? normalizeSpeed(controlSpeed, normalizedSliderSpeed)
        : normalizedSliderSpeed;
    const pointMode = isPreview || isControlActive ? "on" : "off";

    setSliderSpeed(normalizedSliderSpeed);
    updatePointSelection(normalizedSliderSpeed, pointMode);

    if (isPreview) {
      valueElement.textContent = formatSpeedLabel(displaySpeed);
      detailElement.textContent = `Solte a barra para aplicar ${formatSpeedLabel(displaySpeed)}.`;
      toggleButton.textContent = "Desligar controle";
      toggleButton.classList.remove("off");
      return;
    }

    if (isControlActive) {
      valueElement.textContent = formatSpeedLabel(displaySpeed);
      detailElement.textContent = "Controle automatico ligado.";
      toggleButton.textContent = "Desligar controle";
      toggleButton.classList.remove("off");
      return;
    }

    valueElement.textContent = "Desligado";
    detailElement.textContent = `Pronto para religar em ${formatSpeedLabel(normalizedSliderSpeed)}.`;
    toggleButton.textContent = `Ligar em ${formatSpeedLabel(normalizedSliderSpeed)}`;
    toggleButton.classList.add("off");
  }

  function describeState(controlSpeed, rememberedSpeed) {
    if (controlSpeed === null) {
      return `Controle automatico desligado. O video atual volta para 1.0x e a barra fica pronta para ${formatSpeedLabel(rememberedSpeed)}.`;
    }

    return `A extensao vai manter ${formatSpeedLabel(controlSpeed)} automaticamente.`;
  }

  function saveSelection(nextSpeed) {
    const normalizedNextSpeed = normalizeSpeed(nextSpeed, null);
    const rememberedSpeed =
      normalizedNextSpeed === null ? getSliderSpeed() : normalizedNextSpeed;

    activeSpeed = normalizedNextSpeed;
    lastSpeed = rememberedSpeed;

    render(activeSpeed, lastSpeed);
    setStatus(
      normalizedNextSpeed === null
        ? "Desligando o controle e voltando para 1.0x..."
        : `Aplicando ${formatSpeedLabel(normalizedNextSpeed)}...`,
      "pending"
    );

    chrome.storage.sync.set(
      {
        [STORAGE_KEY]: normalizedNextSpeed,
        [LAST_SPEED_KEY]: rememberedSpeed
      },
      () => {
        if (chrome.runtime.lastError) {
          setStatus("Nao foi possivel salvar a configuracao.", "error");
          refreshFromStorage();
          return;
        }

        setStatus(describeState(activeSpeed, lastSpeed), "success");
      }
    );
  }

  function refreshFromStorage() {
    chrome.storage.sync.get([STORAGE_KEY, LAST_SPEED_KEY], (result) => {
      if (chrome.runtime.lastError) {
        setStatus("Nao foi possivel carregar a configuracao.", "error");
        return;
      }

      const storedActiveSpeed = normalizeSpeed(result[STORAGE_KEY], null);
      const storedLastSpeed = normalizeSpeed(result[LAST_SPEED_KEY], DEFAULT_SPEED);

      activeSpeed = storedActiveSpeed;
      lastSpeed = storedActiveSpeed !== null ? storedActiveSpeed : storedLastSpeed;

      render(activeSpeed, lastSpeed);
      setStatus(describeState(activeSpeed, lastSpeed), "success");
    });
  }

  function buildSpeedPoints() {
    SPEED_POINTS.forEach((speed) => {
      const point = document.createElement("button");
      const isMajorPoint = Number.isInteger(speed * 2);

      point.type = "button";
      point.className = "speed-point";
      point.dataset.speed = String(speed);
      point.innerHTML = `
        <span class="speed-point-dot" aria-hidden="true"></span>
        <span class="speed-point-label${isMajorPoint ? " major" : ""}">${formatSpeedLabel(speed)}</span>
      `;

      point.addEventListener("click", () => {
        lastSpeed = speed;
        saveSelection(speed);
      });

      pointsContainer.appendChild(point);
    });
  }

  slider.addEventListener("input", () => {
    const previewSpeed = getSliderSpeed();

    lastSpeed = previewSpeed;
    render(activeSpeed, previewSpeed, previewSpeed);
    setStatus(`Solte a barra para aplicar ${formatSpeedLabel(previewSpeed)}.`, "pending");
  });

  slider.addEventListener("change", () => {
    saveSelection(getSliderSpeed());
  });

  toggleButton.addEventListener("click", () => {
    if (activeSpeed === null) {
      saveSelection(getSliderSpeed());
      return;
    }

    saveSelection(null);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    if (!(STORAGE_KEY in changes) && !(LAST_SPEED_KEY in changes)) {
      return;
    }

    const nextActiveSpeed =
      STORAGE_KEY in changes
        ? normalizeSpeed(changes[STORAGE_KEY].newValue, null)
        : activeSpeed;
    const nextLastSpeed =
      LAST_SPEED_KEY in changes
        ? normalizeSpeed(changes[LAST_SPEED_KEY].newValue, lastSpeed)
        : lastSpeed;

    activeSpeed = nextActiveSpeed;
    lastSpeed = nextActiveSpeed !== null ? nextActiveSpeed : nextLastSpeed;

    render(activeSpeed, lastSpeed);
    setStatus(describeState(activeSpeed, lastSpeed), "success");
  });

  buildSpeedPoints();
  refreshFromStorage();
});
