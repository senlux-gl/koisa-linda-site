# QA — Catálogo híbrido Koisa Linda

Data da validação final: 16/07/2026
Branch: `codex/kl-catalogo-hibrido-20260715`

## Escopo

Validação local da experiência híbrida do catálogo: navegação responsiva, busca, filtros por unidade, estado na URL, galeria imersiva, favoritos, roteamento dos CTAs e página da peça. Este relatório não representa deploy ou validação em produção.

## Matriz responsiva

| Largura | Colunas | Overflow horizontal |
| ---: | ---: | --- |
| 320 px | 2 | Não |
| 375 px | 2 | Não |
| 768 px | 2 | Não |
| 1024 px | 3 | Não |
| 1440 px | 5 | Não |

## Fluxos validados

- Busca por nome ou código, com atualização correta dos resultados.
- Filtros por categoria e unidade, incluindo Barra da Tijuca e São Francisco.
- Leitura, atualização e saneamento dos parâmetros de URL.
- Galeria imersiva com abertura direta, navegação entre peças, fechamento, histórico do navegador e restauração de foco.
- Favoritos com inclusão, remoção, contador e agrupamento por unidade.
- CTA contextual para a unidade correta e fallback para a página de unidades quando necessário.
- Página da peça com dados, imagens relacionadas, unidade, atendimento e estado de peça não encontrada.
- Prova virtual e detalhe com CTA direcionado pela unidade da peça, aceitando `?p=` e `?codigo=` quando aplicável.
- Menu responsivo entre 861 e 1100 px com ícone vertical, alvo de 48 px e sem overflow.
- CTA flutuante com botão de fechar de 44 × 44 px no mobile.

## Gates automatizados

- 41 testes Python aprovados.
- 81 testes Node aprovados.
- Sintaxe dos módulos JavaScript aprovada com `node --check`.
- `git diff --check` sem erros.

## Evidências visuais

- Mobile, 375 px: `/Users/guilhermepessanha/.codex/visualizations/2026/07/14/019f61ac-ac81-7df1-80c2-aa66c0caa80a/catalogo-375-final.png`
- Tablet, 768 px: `/Users/guilhermepessanha/.codex/visualizations/2026/07/14/019f61ac-ac81-7df1-80c2-aa66c0caa80a/catalogo-768.png`
- Desktop, 1440 px: `/Users/guilhermepessanha/.codex/visualizations/2026/07/14/019f61ac-ac81-7df1-80c2-aa66c0caa80a/catalogo-1440.png`

## Peso estático

Comparado à baseline, o catálogo adiciona aproximadamente:

- `+85.335 bytes` no payload bruto.
- `+19.644 bytes` no proxy gzip.
- `259.212 bytes` em imagens editoriais.

Esses números são uma aproximação estática do impacto. Não foi possível obter uma medição Lighthouse exata neste ambiente; métricas reais de carregamento devem ser confirmadas no ambiente publicado.

## Observações

- O console mantém um aviso já existente do Meta Pixel sobre múltiplas versões. Não foram identificados erros novos do catálogo durante a validação local.
- O catálogo está pronto para aprovação local. Nenhum deploy foi realizado como parte desta validação.
