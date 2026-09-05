# Koisa Linda — site estático

HTML, CSS e JavaScript sem framework. As fontes HTML continuam na raiz. O site publicável é gerado em `_site/` para oferecer URLs de diretório, manter os links antigos e usar as mesmas fontes visuais sem depender do Google Fonts em tempo de navegação.

## Desenvolvimento e conferência

```sh
python3 tools/build-site.py --preview --output _preview
python3 -m http.server 4185 --bind 127.0.0.1 --directory _preview
```

A prévia desliga os scripts de analytics e o fallback do Pixel. Consultas de disponibilidade da agenda continuam usando a API existente; não submeter pedidos durante QA sem autorização. Não servir a raiz como versão final: ela contém as fontes e os endereços anteriores.

## Gerar e validar a publicação

```sh
python3 tools/build-site.py
python3 tools/build-site.py --preview --output _preview
python3 -m unittest discover -s tests -p test_url_build.py
python3 -m unittest discover -s tests -p test_seo_build.py
node --test tests/url-redirects.test.cjs
```

O gerador percorre os arquivos existentes, produz 28 páginas principais/editoriais, preserva as páginas `/p/` já indexadas, reconstrói sitemap/canonical/Open Graph e cria pontes para os endereços antigos. `tools/build-site.py` contém o mapa único de páginas. As fontes em `fonts/` têm suas licenças OFL incluídas.

- Páginas de conteúdo são HTML real com resposta 200; não dependem de um fallback de SPA/404.
- As pontes antigas usam JavaScript e link manual, preservando parâmetros e fragmentos. **Não são redirects HTTP 301**, que a hospedagem estática atual não oferece por arquivo.
- `/provar.html` segue para `/catalogo/?prova=1`, levando modelo e atribuição.
- `/peca/` é uma interface dinâmica `noindex`; as fichas públicas em `/p/` continuam com sua identidade original.
- `kl-agendar.js`, base do catálogo, números das lojas, IDs de medição e integrações operacionais não foram alterados.

## Publicação e retorno seguro

**Publicada em 04/09/2026, após autorização explícita do Guilherme nesta tarefa.** O GitHub Pages agora publica o artefato por Actions, com domínio e HTTPS preservados. Código em produção: `9dc4e8d`; [execução de publicação validada](https://github.com/senlux-gl/koisa-linda-site/actions/runs/33936541002). A primeira publicação visual foi a execução `33936093073` (`9a3ce28`).

Para uma nova publicação autorizada, conferir o estado anterior e os testes; incorporar o código revisado; executar manualmente `pages.yml`; validar no domínio real home, catálogo, agendamento, aliases, parâmetros e sitemap. O workflow não tem cron nem publicação automática por push.

O artefato `_site/` é o que deve ir ao ar. Não publicar `_preview/` nem trocar apenas os fontes HTML mantendo o modo antigo: isso deixaria os novos caminhos incompletos. O procedimento usa a [publicação oficial de artefatos estáticos do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Para rollback, o estado anterior está preservado em `codex/kl-site-before-20260904`, commit `4956efca27740c437024c685eb6fca2423a6d7df`. Se for necessário retornar, preservar os trabalhos novos e configurar o Pages em `legacy`, com essa branch e caminho `/`, mantendo domínio e HTTPS; conferir o domínio após o build. Não executar reset destrutivo, force push ou sobrescrever trabalho concorrente.

Relatório de QA e limitações: `docs/qa/2026-09-04-design-urls.md`.

## SEO no build

`tools/seo_site.py` organiza metadados, breadcrumbs, links estáticos entre categorias e fichas, e seleções de estilo por unidade. A fonte de tamanho/unidade é o catálogo atual; os atributos visuais vêm das fichas e do arquivo de atributos existente. A camada não promete estoque ou preço. `kl-seo.css` apresenta os elementos de navegação sem novo JavaScript.

Alterações de conteúdo ou cadastro precisam passar novamente pelo build. Publicar os HTMLs brutos contornaria essas correções. Diagnóstico, validação e limites do cadastro: [revisão de SEO de 05/09/2026](docs/qa/2026-09-05-seo.md).
