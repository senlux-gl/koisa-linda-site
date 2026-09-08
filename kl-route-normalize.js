/* Old campaign links keep their model and attribution on the dedicated page. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var next = api.destination(root.location.href);
    if (next) root.location.replace(next);
  }
}(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  function destination(href) {
    try {
      var url = new URL(href);
      if (!/^https?:$/.test(url.protocol)) return null;
      if (!/^\/(?:catalogo(?:\/|\.html)?|catalogo\/index\.html)$/.test(url.pathname)
          || url.searchParams.get('prova') !== '1') return null;
      url.pathname = '/prova-virtual/';
      url.searchParams.delete('prova');
      return url.href;
    } catch (_) { return null; }
  }
  return { destination: destination };
}));
