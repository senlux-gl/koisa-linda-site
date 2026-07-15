(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.KLCatalog = root.KLCatalog || {};
    root.KLCatalog.Gallery = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function shouldInterceptProductLink(event, ready) {
    return Boolean(
      ready
      && event
      && !event.defaultPrevented
      && event.button === 0
      && !event.metaKey
      && !event.ctrlKey
      && !event.shiftKey
      && !event.altKey
    );
  }

  function closeAction(context) {
    return context && context.ownedHistoryEntry
      ? 'back'
      : 'replace-without-product';
  }

  function neighborIndexes(index, length) {
    var values = [];
    if (
      Number.isInteger(index)
      && Number.isInteger(length)
      && length > 0
      && index >= 0
      && index < length
    ) {
      if (index > 0) values.push(index - 1);
      if (index + 1 < length) values.push(index + 1);
    }
    return values;
  }

  function createRequestGuard() {
    var token = 0;
    var currentCode = '';
    return {
      next: function (code) {
        currentCode = String(code || '');
        token += 1;
        return token;
      },
      isCurrent: function (candidate, code) {
        return candidate === token && String(code || '') === currentCode;
      },
    };
  }

  function create(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('Gallery.create options must be an object.');
    }

    function noop() {}

    return {
      open: noop,
      update: noop,
      close: noop,
      destroy: noop,
      isReady: function () { return false; },
    };
  }

  return {
    shouldInterceptProductLink: shouldInterceptProductLink,
    closeAction: closeAction,
    neighborIndexes: neighborIndexes,
    createRequestGuard: createRequestGuard,
    create: create,
  };
}));
