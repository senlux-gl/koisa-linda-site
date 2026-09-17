/* Activate the purchase link only after checking the real product and payment terms. */
(function () {
  'use strict';
  var link = document.getElementById('consultoria-checkout');
  var status = document.getElementById('checkout-status');
  if (!link || !status) return;
  link.addEventListener('click', function (event) {
    if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });
  fetch('/kl-consultoria-config.json', { cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
    .then(function (config) {
      if (!config.checkoutVerified || config.priceBRL !== 2997 || !config.checkoutUrl) return;
      var url = new URL(config.checkoutUrl);
      if (url.protocol !== 'https:' || url.username || url.password) return;
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
