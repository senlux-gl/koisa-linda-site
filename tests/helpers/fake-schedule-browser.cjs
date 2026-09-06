'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createFakeCatalogBrowser, createStorage } = require('./fake-browser.cjs');
const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

// Extend the existing test DOM with the innerHTML parsing used by the booking form.
function addHTMLParser(document) {
  const prototype = Object.getPrototypeOf(document.body);
  Object.defineProperty(prototype, 'innerHTML', {
    configurable: true,
    get() { return this._html || ''; },
    set(html) {
      this._html = String(html);
      const removeIds = node => { node.children.forEach(removeIds); if (node.getAttribute('id')) document._ids.delete(node.getAttribute('id')); };
      this.children.forEach(removeIds);
      this.textContent = '';
      const stack = [this];
      for (const token of this._html.matchAll(/<\/?([a-z][a-z0-9]*)([^>]*)>|([^<]+)/gi)) {
        if (!token[1]) { stack.at(-1)._textContent += token[3]; continue; }
        if (token[0].startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
        const node = document.createElement(token[1]);
        for (const attr of token[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(attr[1], attr[2] || '');
        node.value = node.getAttribute('value') || '';
        stack.at(-1).appendChild(node);
        if (!/^(input|img|br|hr|meta|link)$/.test(token[1])) stack.push(node);
      }
    },
  });
}

function loadSchedule(options = {}) {
  const browser = createFakeCatalogBrowser();
  const { document, window } = browser;
  addHTMLParser(document);
  for (const id of ['cartao', 'trilha', 'rotuloPasso', 'scheduleTitle', 'scheduleDesc', 'scheduleEyebrow']) {
    const node = document.createElement('div'); node.setAttribute('id', id); document.body.appendChild(node);
  }
  document.title = 'Agendamento';
  document.referrer = options.referrer || '';
  document.querySelector = sel => document.querySelectorAll(sel)[0] || null;
  document.head = document.createElement('head');
  const storage = createStorage(options.storage);
  if (options.blockedStorage) { storage.getItem = storage.setItem = () => { throw new Error("blocked"); }; }
  const calls = [];
  const fbqCalls = [];
  const gtagCalls = [];
  const location = new URL(options.url || 'https://koisalinda.com.br/agendar/?variant=d&un=barra&ocasiao=noiva');
  Object.assign(window, {
    URL, URLSearchParams, location, sessionStorage: storage,
    navigator: { userAgent: 'Fixture browser' }, screen: { width: 1280 },
    fbq: (...args) => fbqCalls.push(args),
    addEventListener() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, scrollTo() {}, scrollY: 0,
    gtag: options.noGA ? undefined : (...args) => gtagCalls.push(args),
    __klGA4Ready: !options.noGA,
    fetch: async (url, request) => {
      const payload = request.body ? JSON.parse(request.body) : undefined;
      calls.push({ url, payload });
      let body;
      if (url.endsWith('/lead')) body = options.leadResponse || { ok: true, lead_id: 'fixture-lead' };
      else if (url.endsWith('/pedido')) body = options.response || { ok: true, status: 'confirmed', appointment_id: '00000000-0000-4000-8000-000000000001' };
      else body = { ok: true, dias: [{ data: '2026-10-10', rotulo: 'sábado, 10 de outubro', dia_semana: 'sábado', dia: '10', mes: 'out', manha: ['10:00'], tarde: [] }] };
      return { ok: true, status: 200, json: async () => body };
    },
  });
  window.window = window;
  function run(file) { vm.runInNewContext(read(file), window, { filename: file }); }
  if (options.tracking !== false) run('kl-tracking.js');
  run('kl-agendar.js');
  return { ...browser, storage, calls, fbqCalls, gtagCalls, run };
}

async function submitBooking(env) {
  const doc = env.document;
  const formFirst = Boolean(doc.getElementById('lead-d'));
  async function chooseTime() {
    await new Promise(setImmediate);
    doc.getElementById('horarios').querySelector('.hora').click();
  }
  if (!formFirst) {
    await chooseTime();
    doc.getElementById('ir3').click();
  }
  doc.getElementById('nome').value = 'Pessoa Fixture';
  doc.getElementById('telefone').value = '21988887777';
  doc.getElementById('notas').value = 'Texto privado fixture@example.invalid';
  doc.getElementById('aceite').checked = true;
  doc.getElementById(formFirst ? 'lead-d' : 'form').dispatchEvent({ type: 'submit', preventDefault() {} });
  await new Promise(setImmediate);
  if (formFirst) {
    doc.getElementById('ir2').click();
    await chooseTime();
    const submit = doc.getElementById('ir3');
    submit.click();
    await new Promise(setImmediate);
    return submit;
  }
}

module.exports = { loadSchedule, submitBooking };
