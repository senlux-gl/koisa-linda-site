'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeCatalogBrowser } = require('./helpers/fake-browser.cjs');
const { loadTracking } = require('./helpers/fake-tracking-browser.cjs');
const Gallery = require('../kl-catalog-gallery.js');
const Actions = require('../kl-catalog-actions.js');
const Core = require('../kl-catalog-core.js');
const product = require('./helpers/catalog-fixtures.cjs')[3];

for (const selectedUnit of ['barra', 'sf']) {
  test('festa: intenção separada do contato, destino ' + selectedUnit + ', origem e dedupe', () => {
    const browser = createFakeCatalogBrowser({ dialogs: true });
    const dialog = browser.nodes.galleryDialog;
    function add(tag, id, className) {
      const node = browser.document.createElement(tag);
      if (id) node.setAttribute('id', id);
      if (className) node.className = className;
      dialog.appendChild(node);
      return node;
    }
    ['gallery-title', 'gallery-code', 'gallery-unit', 'gallery-specs'].forEach(id => add('div', id));
    add('button', 'gallery-favorite');
    const cta = add('a', 'gallery-whatsapp');
    add('a', 'gallery-schedule');
    ['gallery-prev', 'gallery-next', 'gallery-close'].forEach(cls => add('button', null, cls));
    const env = loadTracking({ products: [product], search: '?utm_source=meta&utm_campaign=kl_barra_festa590_out26&utm_content=creative-test' });
    const gallery = Gallery.create({ dialog, image: browser.nodes.galleryImage, products: [product], core: Core, actions: Actions,
      onNavigate() {}, onRequestClose() {}, onFavorite() {}, isFavorite: () => false,
      onTrack: (name, ctx) => env.window.KLTracking.catalog(name, ctx) });
    const events = name => env.fbqCalls.filter(call => call[1] === name);
    gallery.open(product.k);
    cta.click();
    cta.click();
    assert.equal(events('KL_Unit_Selector_Open').length, 1);
    assert.equal(events('Lead').length, 0);
    assert.equal(events('KL_WhatsApp_Click').length, 0);
    const link = dialog.querySelector('[data-kl-unit-contact="' + selectedUnit + '"]');
    assert.equal(link.getAttribute('data-kl-track-manual'), 'true');
    // Simulate the existing document capture handler for dynamically generated WhatsApp links.
    env.dispatch('DOMContentLoaded');
    env.dispatch('click', { target: { closest: selector => selector.includes('href*=') ? link : null } });
    const destination = new URL(link.getAttribute('href'));
    assert.equal(destination.pathname, '/' + Actions.CONTACTS[selectedUnit]);
    assert.match(destination.searchParams.get('text'), new RegExp(product.k));
    assert.match(destination.searchParams.get('text'), /Cheguei pelo Instagram/);
    assert.match(destination.searchParams.get('text'), selectedUnit === 'sf' ? /São Francisco/ : /Barra da Tijuca/);
    link.click();
    link.click();
    assert.equal(events('KL_Unit_Selected').length, 1);
    assert.equal(events('KL_WhatsApp_Click').length, 1);
    assert.equal(events('Lead').length, 1);
    const selection = events('KL_Unit_Selected')[0][2];
    const contact = events('KL_WhatsApp_Click')[0][2];
    assert.equal(selection.product_unit, 'barra');
    assert.equal(selection.selected_unit, selectedUnit);
    assert.equal(contact.store, selectedUnit === 'sf' ? 'sao_francisco' : 'barra');
    assert.equal(contact.product_code, product.k);
    assert.equal(contact.content_category, 'vestidos-madrinha');
    assert.equal(contact.ui_source, 'gallery');
    assert.equal(contact.utm_source, 'meta');
    assert.equal(contact.utm_campaign, 'kl_barra_festa590_out26');
    assert.equal(contact.utm_content, 'creative-test');
    assert.equal(env.gtagCalls.filter(call => call[1] === 'generate_lead').length, 1);
    gallery.update(product.k);
    assert.equal(cta.getAttribute('aria-expanded'), 'false');
    assert.equal(dialog.querySelector('#gallery-unit-selector').hidden, true);
  });
}

test('unidade inválida não abre contato nem produz seleção', () => {
  assert.equal(Actions.productWhatsAppHref(product, Actions.CONTACTS, 'invalida'), 'unidades.html');
  const env = loadTracking({ products: [product] });
  env.window.KLTracking.catalog('KL_Unit_Selected', { productCode: product.k, unit: 'invalida', source: 'gallery' });
  assert.equal(env.fbqCalls.filter(call => call[1] === 'KL_Unit_Selected').length, 0);
});
