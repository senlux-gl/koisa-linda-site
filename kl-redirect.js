/* Preserve old bookmarks, ad attribution, store, filters, model and fragments. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root || !root.document) return;
  var link = root.document.getElementById('kl-redirect');
  var refresh = root.document.querySelector('meta[http-equiv="refresh"]');
  var canonical = root.document.querySelector('link[rel="canonical"]');
  if (!link && canonical) {
    // Use the canonical path on previews too; never jump to the production host.
    var target = new URL(canonical.getAttribute('href'));
    link = { getAttribute: function () { return target.pathname + target.search + target.hash; } };
  }
  if (!link) return;
  var href = api.destination(root.location.href, link.getAttribute('href'));
  if (!href) return;
  link.href = href;
  if (refresh) refresh.setAttribute('content', '0; url=' + href);
  root.location.replace(href);
}(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  function destination(current, target) {
    try {
      var source = new URL(current);
      var next = new URL(target, source.origin);
      if (next.origin !== source.origin || !/^https?:$/.test(next.protocol)) return null;
      var defaults = new URLSearchParams(next.search);
      next.search = source.search;
      defaults.forEach(function (value, key) { next.searchParams.set(key, value); });
      if (next.pathname === '/prova-virtual/') next.searchParams.delete('prova');
      if (source.hash) next.hash = source.hash;
      return next.href === source.href ? null : next.href;
    } catch (_) { return null; }
  }
  return { destination: destination };
}));
