document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.speed-buttons button');
  
    function updateActiveButton(selectedSpeed) {
      buttons.forEach(button => {
        const buttonSpeed = button.dataset.speed;
        let isActive = false;
        
        if (buttonSpeed === 'off' && selectedSpeed === null) {
          // Botão "Desligar" ativo quando selectedSpeed é null
          isActive = true;
        } else if (buttonSpeed !== 'off' && parseFloat(buttonSpeed) === selectedSpeed) {
          // Botões de velocidade ativos quando correspondem ao valor
          isActive = true;
        }
        
        if (isActive) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
    }
  
    // Carrega a velocidade salva e define o botão ativo
    chrome.storage.sync.get(['youtubePlaybackSpeed'], (result) => {
      let currentSpeedSetting = result.youtubePlaybackSpeed;
      // Se undefined, significa que nunca foi definido, consideramos "off" ou um padrão.
      // Se null, foi explicitamente desligado.
      if (currentSpeedSetting === undefined) {
          updateActiveButton(null); // Ou um padrão, ex: 1.0
      } else {
          updateActiveButton(currentSpeedSetting); // currentSpeedSetting pode ser null aqui
      }
    });
  
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        let newSpeedValue;
        const speedData = button.dataset.speed;
  
        if (speedData === 'off') {
          newSpeedValue = null; // `null` representará "controle desligado"
        } else {
          newSpeedValue = parseFloat(speedData);
        }
  
        chrome.storage.sync.set({ youtubePlaybackSpeed: newSpeedValue }, () => {
          updateActiveButton(newSpeedValue);
          // Envia mensagem para o content script da aba ativa
          chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.youtube.com/watch*" }, (tabs) => {
            if (tabs && tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "setSpeed", speed: newSpeedValue })
                .then(() => {
                  console.log(`Velocidade ${newSpeedValue === null ? 'desligada' : newSpeedValue + 'x'} aplicada com sucesso.`);
                })
                .catch(error => {
                  // O content script pode não estar pronto ou a aba não é uma página de vídeo válida.
                  console.log("Aviso: Não foi possível enviar mensagem para content script:", error.message);
                });
            } else {
              console.log("Nenhuma aba do YouTube ativa encontrada. A velocidade será aplicada na próxima vez que você abrir um vídeo.");
            }
          });
        });
      });
    });
  });