# Festa: escolha de unidade antes do WhatsApp

Fluxo: abrir peça de festa no catálogo → Quero provar esse vestido → escolher Barra ou São Francisco → WhatsApp da unidade com código da peça. Disponibilidade continua sujeita à confirmação da loja. Noiva/debutante mantêm agenda.

Eventos: `KL_Unit_Selector_Open` mede intenção, sem Lead; `KL_Unit_Selected` mede a unidade escolhida; `KL_WhatsApp_Click` e Lead existente apenas no link de saída. Seleção e contato deduplicados em 3 segundos. Produto, unidade original, unidade escolhida e atribuição da sessão separados. O clique não comprova mensagem enviada, conversa ou venda.

Validação local: 39 testes de galeria/ações/funil/tracking aprovados; 55 testes Node do gate de publicação e 30 Python aprovados. Sintaxe dos quatro JS modificados e git diff --check aprovados. Chrome desktop e 390×844: seletor, destinos das duas lojas, reset ao trocar peça e rolagem da escolha conferidos; nenhuma mensagem enviada.

Suite adicional catalog-app: 69/71. Os dois testes divergentes (init inválido e limpeza de parâmetro desconhecido) falham identicamente na base publicada 62f68e3, confirmados no worktree anterior; nenhuma regressão nova observada. Não alterar expectativas legadas neste escopo.

Testes usam emissores simulados, sem poluir analytics. A recepção em Testar eventos da Meta, atribuição e CAPI não estão certificadas por este QA. Campanhas permanecem pausadas até revisão do dono e validação do evento de otimização. Conversão específica da campanha Barra continua filtrando KL_WhatsApp_Click, store=barra, content_category=vestidos-madrinha e ui_source=gallery; São Francisco não conta como Barra.
