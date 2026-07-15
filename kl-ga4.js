/* Koisa Linda — privacy-minded GA4 loader and event bridge.
 * Loads only with a valid Measurement ID from kl-analytics-config.js.
 * Does not send names, phone numbers, photo data or raw search text.
 */
(function () {
  'use strict';

  var id = String(window.KL_GA4_MEASUREMENT_ID || '').trim();
  var validId = /^G-[A-Z0-9]{8,}$/.test(id);
  var allowedKeys = {
    page_type: 1, page_path: 1, landing_path: 1,
    utm_source: 1, utm_medium: 1, utm_campaign: 1, utm_content: 1, utm_term: 1,
    fbclid: 1, gclid: 1, store: 1, product_code: 1, content_category: 1,
    catalog_category: 1, catalog_unit: 1, filter_type: 1, filter_value: 1,
    query_length: 1, query_has_product_code: 1, result_count: 1,
    scroll_depth: 1, seconds: 1, has_prefill: 1, source_event: 1,
    destination_category: 1, destination_path: 1, favorite_state: 1, favorite_count: 1
  };
  var eventNames = {
    KL_WhatsApp_Click: 'generate_lead',
    KL_Favorites_WhatsApp_Click: 'generate_lead',
    KL_Product_View: 'view_item',
    KL_Product_Open_Click: 'select_item',
    KL_Catalog_Search: 'search',
    KL_Filter_Change: 'filter_change',
    KL_Catalog_Result_Update: 'catalog_result_update',
    KL_Engaged_30s: 'engaged_30s',
    KL_Scroll_Depth: 'scroll_depth',
    KL_Favorite_Toggle: 'favorite_toggle',
    KL_Favorites_Clear: 'favorites_clear',
    KL_CTA_Click: 'cta_click',
    KL_Sticky_CTA_Click: 'sticky_cta_click',
    KL_Outbound_Click: 'outbound_click',
    KL_UI_Click: 'ui_click',
    KL_Page_Context: 'page_context'
  };

  function clean(value, limit) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit || 100);
  }

  function safeParams(input) {
    var out = {};
    Object.keys(input || {}).forEach(function (key) {
      if (!allowedKeys[key]) return;
      var value = input[key];
      if (typeof value === 'number' && isFinite(value)) out[key] = value;
      else {
        value = clean(value, 120);
        if (value) out[key] = value;
      }
    });
    return out;
  }

  function mapEvent(name, input) {
    var eventName = eventNames[name] || clean(name, 40).toLowerCase();
    var params = safeParams(input);
    var itemId = clean(params.product_code, 40);
    var itemCategory = clean(params.content_category || params.catalog_category, 60);
    if ((eventName === 'view_item' || eventName === 'select_item') && itemId) {
      params.items = [{ item_id: itemId, item_category: itemCategory || undefined }];
    }
    if (eventName === 'generate_lead') params.method = 'whatsapp';
    return { name: eventName, params: params };
  }

  window.klAnalyticsTrack = function (name, params) {
    if (!validId || typeof window.gtag !== 'function') return false;
    var mapped = mapEvent(name, params);
    window.gtag('event', mapped.name, mapped.params);
    if (window.__KL_GA4_DEBUG__) {
      window.__klGa4Events = window.__klGa4Events || [];
      window.__klGa4Events.push(mapped);
    }
    return true;
  };

  if (!validId) {
    window.__KL_GA4_STATUS__ = 'disabled_missing_id';
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, {
    send_page_view: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_flags: 'SameSite=Lax;Secure'
  });

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  script.setAttribute('data-kl-ga4', id);
  (document.head || document.documentElement).appendChild(script);
  window.__KL_GA4_STATUS__ = 'configured';
})();
