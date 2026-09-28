# Festa: catálogo, visita livre e endereços

Pedido: tráfego de festa deve chegar ao catálogo; visita sem agendamento e endereços fáceis de encontrar. Base origin/main 710e2d9, trabalho isolado.

- Catálogo: aviso compacto; endereços e horários expansíveis; atalho fixo abre a seção preservando filtros e UTMs.
- Galeria, ficha estática/dinâmica e prova virtual: endereço e rota da unidade da peça de festa. Não presume unidade quando desconhecida.
- Rodapés: endereços das duas lojas, rota direta e distinção festa livre / noivas e debutantes com agendamento.
- Fotos, acervo, Pixel, formulários e serviços do provador preservados. Não inclui promoção de presente nem ativa campanhas.

Validação: build público e prévia; 27 testes Python de URLs, SEO, popup e visita; 96 testes Node de galeria, ações, provador, captura e rotas. Sintaxe dos módulos de publicação verificada.

Browser: catálogo em 320, 375, 768, 1024 e 1440 px sem overflow; galeria MD-001 mostra Barra e 020008 mostra São Francisco; detalhe e provador 020008 mostram rota de São Francisco; ao selecionar noiva 040301 o aviso de festa é ocultado. Alternar categoria no catálogo restaura o botão de agenda. Atalho de lojas preserva UTMs. Nenhuma foto, mensagem ou formulário enviado. Console sem erros nas jornadas verificadas.

Teste legado adicional `site-enhance-routing.test.cjs` mantém uma falha preexistente: espera home → unidades, mas HEAD já usa agenda. Arquivo de teste e módulo são idênticos ao HEAD de origem; fora desta alteração. Os checks de publicação acima passam.
