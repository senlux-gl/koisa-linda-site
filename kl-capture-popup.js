(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KLCapturePopup = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var SESSION_KEY = 'kl_capture_popup_seen_v1';
  function mount(win, section, options) {
    options = options || {};
    var doc = win.document, dialog = doc.createElement('dialog');
    if (typeof dialog.showModal !== 'function') return null;
    dialog.setAttribute('id', 'kl-capture-dialog');
    dialog.setAttribute('class', 'kl-capture-dialog');
    dialog.setAttribute('aria-labelledby', 'kl-capture-title');
    var close = doc.createElement('button');
    close.setAttribute('type', 'button');
    close.setAttribute('class', 'kl-capture-popup-close');
    close.setAttribute('aria-label', 'Fechar convite de WhatsApp');
    close.textContent = '×';
    dialog.appendChild(close);
    doc.body.appendChild(dialog);
    var marker = doc.createElement('span'), previousFocus = null, previousScroll = null;
    marker.hidden = true;
    section.parentNode.insertBefore(marker, section);
    function seen() {
      try { return win.__klCapturePopupSeen || win.sessionStorage.getItem(SESSION_KEY) === 'shown'; }
      catch (_) { return Boolean(win.__klCapturePopupSeen); }
    }
    function otherDialog() {
      return Array.prototype.some.call(doc.querySelectorAll('dialog'), function (d) { return d !== dialog && d.open; });
    }
    function open(manual) {
      if (dialog.open || otherDialog()) return false;
      if (!manual && (seen() || (options.isSuppressed && options.isSuppressed()) || doc.visibilityState === 'hidden' || /^(INPUT|TEXTAREA|SELECT)$/.test((doc.activeElement || {}).tagName))) return false;
      previousFocus = doc.activeElement;
      previousScroll = {left:win.scrollX || 0,top:win.scrollY || 0,behavior:'instant'};
      marker.style.height = Math.ceil(section.getBoundingClientRect().height) + 'px';
      marker.style.display = 'block';
      if (win.getComputedStyle) {
        var style = win.getComputedStyle(section);
        marker.style.marginTop = style.marginTop || '0px';
        marker.style.marginBottom = style.marginBottom || '0px';
      }
      marker.hidden = false;
      dialog.appendChild(section);
      doc.body.classList.add('kl-capture-popup-open');
      try { dialog.showModal(); }
      catch (_) { restore(); return false; }
      win.__klCapturePopupSeen = true;
      try { win.sessionStorage.setItem(SESSION_KEY, 'shown'); } catch (_) {}
      close.focus({preventScroll:true});
      if (options.onOpen) options.onOpen(manual ? 'manual' : 'page_open');
      return true;
    }
    function restore() {
      // The marker keeps the same form/controller and its place in the page.
      marker.parentNode.insertBefore(section, marker);
      marker.hidden = true;marker.style.display = 'none';
      doc.body.classList.remove('kl-capture-popup-open');
    }
    function dismiss() { if (dialog.open) dialog.close(); }
    dialog.addEventListener('close', function () {
      restore();
      if (options.onClose) options.onClose();
      if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus({preventScroll:true});
      if (win.scrollTo && previousScroll) win.scrollTo(previousScroll);
    });
    close.addEventListener('click', dismiss);
    dialog.addEventListener('cancel', function (ev) { ev.preventDefault(); dismiss(); });
    dialog.addEventListener('click', function (ev) { if (ev.target === dialog) dismiss(); });
    function tryAutomatic() { return open(false); }
    function deferAttempt() { (win.requestAnimationFrame || win.setTimeout).call(win, tryAutomatic); }
    doc.addEventListener('visibilitychange', deferAttempt);
    doc.addEventListener('close', function (ev) { if (ev.target !== dialog) deferAttempt(); }, true);
    deferAttempt();
    return {open:open,close:dismiss,isOpen:function(){return dialog.open;},tryAutomatic:tryAutomatic};
  }
  return {mount:mount};
}));
