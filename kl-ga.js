/* Koisa Linda — bootstrap do Google tag (Google Ads).
 *
 * GA4_ID fica VAZIO de propósito: quem bootstrapa o GA4 (G-D6HYW29TS4) é o
 * kl-tracking.js, em bootstrapGA4(). Configurar o mesmo GA4 aqui também duplicaria
 * o page_view. Este arquivo cuida só do Google Ads — ele roda antes no <head>,
 * cria window.gtag, e o kl-tracking.js reaproveita (window.gtag || ...).
 *
 * Onde achar cada valor:
 *   ADS_ID     ads.google.com (conta 852-793-1368) > Metas > Conversões → AW-XXXXXXXXX
 *   LABEL_*    o label de cada conversão ("WhatsApp SF" e "WhatsApp Barra"), a parte
 *              depois da barra em AW-XXXXXXXXX/AbCdEfGhIj
 *
 * Depois de mexer nos valores: subir o ?v= do include nas páginas para furar cache.
 */
(function () {
  var GA4_ID = '';                 // vazio de propósito — ver comentário acima
  var ADS_ID = 'AW-18265250514';
  var CONV_LABEL = {
    sao_francisco: 'Yq17CIKUl-EcENK1xoVE',   // conversão "WhatsApp SF"
    barra: 'QVPJCIWUl-EcENK1xoVE'            // conversão "WhatsApp Barra"
  };

  /* Lido pelo kl-tracking.js para rotear a conversão do Ads pela loja certa. */
  window.KL_ADS = { id: ADS_ID, label: CONV_LABEL };

  if (!GA4_ID && !ADS_ID) return;  // nada configurado ainda — sai sem efeito nenhum

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  if (GA4_ID) window.gtag('config', GA4_ID);
  if (ADS_ID) window.gtag('config', ADS_ID);

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + (GA4_ID || ADS_ID);
  document.head.appendChild(s);
})();
