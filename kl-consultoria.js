/* Activate the purchase link only after checking the real product and payment terms. */
(function () {
  'use strict';
  var link = document.getElementById('consultoria-checkout');
  var status = document.getElementById('checkout-status');
  if (!link || !status) return;
  link.addEventListener('click', function (event) {
    if (link.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
    // Clique real no botão de contratar: evento próprio, sem duplicar o InitiateCheckout que a Kiwify dispara no checkout.
    try { if (window.fbq) window.fbq('trackCustom', 'KLEDU_CheckoutClick', { content_name: 'consultoria-koisa-linda' }); } catch (_) {}
  });
  fetch('/kl-consultoria-config.json', { cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
    .then(function (config) {
      if (!config.checkoutVerified || config.priceBRL !== 2997 || !config.checkoutUrl) return;
      var url = new URL(config.checkoutUrl);
      if (url.protocol !== 'https:' || url.username || url.password) return;
      // Preserve campaign attribution without forwarding arbitrary form/personal data.
      if (typeof window !== 'undefined') {
        var incoming = new URLSearchParams(window.location.search);
        var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'adset_id', 'ad_id', 'fbclid'];
        var saved = {}, current = {};
        try { saved = JSON.parse(window.sessionStorage.getItem('kl_consultoria_attribution') || '{}') || {}; } catch (_) {}
        if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
        keys.forEach(function (key) {
          var value = incoming.get(key);
          if (value && value.length <= 512) current[key] = value;
        });
        var attribution = Object.keys(current).length ? current : saved;
        if (Object.keys(current).length) {
          try { window.sessionStorage.setItem('kl_consultoria_attribution', JSON.stringify(current)); } catch (_) {}
        }
        keys.forEach(function (key) {
          var value = attribution[key];
          if (typeof value === 'string' && value && value.length <= 512) url.searchParams.set(key, value);
        });
      }
      link.href = url.href;
      link.removeAttribute('aria-disabled');
      link.removeAttribute('role');
      link.removeAttribute('tabindex');
      link.textContent = 'Contratar consultoria';
      status.textContent = 'Você seguirá para a página de pagamento.';
      document.querySelector('.installments').textContent = config.installmentsConfirmed && config.installmentDisclosure
        ? config.installmentDisclosure : 'Consulte as formas de pagamento e o valor total na página de pagamento.';
    })
    .catch(function () { /* The visible fallback stays honest, without opening a wrong checkout. */ });
}());
