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
node --test tests/url-redirects.test.cjs
```

O gerador percorre os arquivos existentes, produz 28 páginas principais/editoriais, preserva as páginas `/p/` já indexadas, reconstrói sitemap/canonical/Open Graph e cria pontes para os endereços antigos. `tools/build-site.py` contém o mapa único de páginas. As fontes em `fonts/` têm suas licenças OFL incluídas.

- Páginas de conteúdo são HTML real com resposta 200; não dependem de um fallback de SPA/404.
- As pontes antigas usam JavaScript e link manual, preservando parâmetros e fragmentos. **Não são redirects HTTP 301**, que a hospedagem estática atual não oferece por arquivo.
- `/provar.html` segue para `/catalogo/?prova=1`, levando modelo e atribuição.
- `/peca/` é uma interface dinâmica `noindex`; as fichas públicas em `/p/` continuam com sua identidade original.
- `kl-agendar.js`, base do catálogo, números das lojas, IDs de medição e integrações operacionais não foram alterados.

## Publicação e retorno seguro

**Ainda não publicada.** Estado verificado em 04/09: GitHub Pages em `legacy`, servindo `main:/`, versão `4956efc`. Publicar exige OK explícito do Guilherme conforme o AGENTS.md do cérebro.

Após esse OK, o agente deve salvar e conferir o estado anterior; incorporar o código revisado; configurar a origem do Pages para GitHub Actions; executar manualmente `pages.yml`; validar no domínio real home, catálogo, agendamento, aliases, parâmetros e sitemap. O workflow não tem cron nem publicação automática por push.

O artefato `_site/` é o que deve ir ao ar. Não publicar `_preview/` nem trocar apenas os fontes HTML mantendo o modo antigo: isso deixaria os novos caminhos incompletos. O procedimento usa a [publicação oficial de artefatos estáticos do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Para rollback, preservar os trabalhos novos, restaurar a origem `legacy` para o snapshot de publicação anterior em uma branch de recuperação própria e conferir o domínio; não executar reset destrutivo, force push ou sobrescrever trabalho concorrente.

Relatório de QA e limitações: `docs/qa/2026-09-04-design-urls.md`.
