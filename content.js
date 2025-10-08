let currentTargetSpeed = null; // null indica que o controle da extensão está desligado
let debounceTimer = null; // Timer para debounce do MutationObserver

// Função para aplicar a velocidade ao elemento de vídeo
function applySpeedToVideo(videoElement, speedToApply) {
  if (!videoElement) return;

  if (speedToApply === null) {
    // Se o controle está desligado (speedToApply é null), não fazemos nada.
    // O vídeo continuará na velocidade que o YouTube ou o usuário definiu.
    // Se quiséssemos resetar para 1.0x ao desligar, faríamos: videoElement.playbackRate = 1.0;
    console.log('Controle de velocidade da extensão desligado. Velocidade do vídeo não alterada.');
    return;
  }

  if (videoElement.playbackRate !== speedToApply) {
    videoElement.playbackRate = speedToApply;
    console.log(`Velocidade do vídeo definida para ${speedToApply}x pela extensão.`);
  }
}

// Encontra o vídeo e aplica a velocidade configurada
function findAndApplyConfiguredSpeed() {
  const video = document.querySelector('video.html5-main-video');
  if (video) {
    // Aplica apenas se currentTargetSpeed não for null (ou seja, controle está "ligado")
    if (currentTargetSpeed !== null) {
      if (video.readyState >= 1) { // HAVE_METADATA ou superior
        applySpeedToVideo(video, currentTargetSpeed);
      } else {
        video.addEventListener('loadedmetadata', function onLoadedMetadata() {
          applySpeedToVideo(video, currentTargetSpeed);
        }, { once: true });
      }
    } else {
      // Se currentTargetSpeed é null, a extensão está desligada, então não interfere.
      applySpeedToVideo(video, null); // Informa que o controle está desligado
    }
  }
}

// Listener para mensagens do popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setSpeed") {
    currentTargetSpeed = request.speed; // Atualiza a velocidade alvo (pode ser null)
    console.log(`Velocidade recebida do popup: ${currentTargetSpeed === null ? 'Controle Desligado' : currentTargetSpeed + 'x'}`);
    findAndApplyConfiguredSpeed(); // Aplica a nova velocidade imediatamente
    sendResponse({ status: "Velocidade atualizada" });
  }
  return true; // Para sendResponse assíncrono, se necessário
});

// Carrega a velocidade salva quando o content script é injetado
chrome.storage.sync.get(['youtubePlaybackSpeed'], (result) => {
  if (result.youtubePlaybackSpeed !== undefined) {
    currentTargetSpeed = result.youtubePlaybackSpeed;
    console.log(`Velocidade inicial carregada do storage: ${currentTargetSpeed === null ? 'Controle Desligado' : currentTargetSpeed + 'x'}`);
  } else {
    // Se não houver nada salvo no storage, mantém o controle desligado (null).
    currentTargetSpeed = null;
    console.log('Nenhuma velocidade salva anteriormente. Controle permanece desligado.');
  }
  findAndApplyConfiguredSpeed(); // Tenta aplicar ao carregar a página
});

// MutationObserver para lidar com a navegação SPA do YouTube
const observer = new MutationObserver((mutationsList, observerInstance) => {
  // Debounce: cancela o timer anterior e cria um novo
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  // Aplica a velocidade apenas após 500ms sem novas mutações
  debounceTimer = setTimeout(() => {
    findAndApplyConfiguredSpeed();
    debounceTimer = null;
  }, 500);
});

// Observa mudanças no corpo do documento ou em um container mais específico do player
// YouTube usa 'ytd-page-manager' para carregar novas "páginas"
const pageManager = document.querySelector("ytd-page-manager");
if (pageManager) {
    observer.observe(pageManager, { childList: true, subtree: true });
} else {
    // Fallback se ytd-page-manager não for encontrado
    observer.observe(document.body, { childList: true, subtree: true });
    console.warn("Elemento ytd-page-manager não encontrado. Observando document.body.");
}

console.log('YouTube Speed Control: content script carregado e observando.');