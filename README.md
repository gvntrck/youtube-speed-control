# YouTube Speed Control

Extensao para Chrome que fixa uma velocidade de reproducao nos videos do YouTube e reaplica o valor mesmo quando a plataforma navega sem recarregar a pagina.

## Recursos

- Barra de velocidade estilo volume com pontos clicaveis de `1.0x` ate `3.0x`
- Modo `Desligar controle` para deixar o YouTube seguir a velocidade manual
- Persistencia da configuracao em `chrome.storage.sync`
- Reaplicacao automatica quando o player muda, o video troca ou a rota do YouTube muda

## Como instalar

1. Abra `chrome://extensions/`
2. Ative o `Modo do desenvolvedor`
3. Clique em `Carregar sem compactacao`
4. Selecione esta pasta

## Como usar

1. Abra qualquer pagina do YouTube
2. Clique no icone da extensao
3. Escolha a velocidade desejada
4. A extensao passa a manter essa velocidade automaticamente enquanto o controle estiver ligado

## Estrutura

- `manifest.json`: configuracao da extensao
- `content.js`: monitoramento do player, mudancas de rota e reaplicacao da velocidade
- `popup.html`: estrutura do popup
- `popup.css`: estilos do popup
- `popup.js`: leitura e gravacao do estado salvo

## Versao

`v3.0.0` - refatoracao completa para tornar o comportamento mais consistente e confiavel
