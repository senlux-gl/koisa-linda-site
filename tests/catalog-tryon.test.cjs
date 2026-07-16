'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const TryOn = require('../kl-catalog-tryon.js');

const ELIGIBLE_CATEGORIES = new Set([
  'vestidos-noiva',
  'vestidos-madrinha',
  'vestidos-debutante',
]);

function isEligible(product) {
  return Boolean(product && ELIGIBLE_CATEGORIES.has(product.c));
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function invalidJsonResponse(message, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => { throw new SyntaxError(message); },
  };
}

test('lista interna usa a base completa, o callback injetado e só categorias elegíveis', () => {
  const visited = [];
  const source = fixtures.slice().reverse();
  const before = JSON.stringify(source);
  const eligible = TryOn.filterEligibleProducts(source, (product) => {
    visited.push(product.k);
    return isEligible(product);
  });

  assert.deepEqual(visited, source.map((product) => product.k));
  assert.deepEqual(
    eligible.map((product) => product.k).sort(),
    ['DB-010', 'MD-020', 'NV-001', 'NV-002'],
  );
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(TryOn.filterEligibleProducts(source, null), []);
});

test('busca interna normaliza diacríticos e case em código e cor', () => {
  const products = [
    { ...fixtures[0], k: ' Nv-Á01 ', co: 'Rosé' },
    fixtures[2],
  ];

  assert.deepEqual(
    TryOn.filterProducts(products, { query: 'nv-a01', category: 'all' }).map((item) => item.k),
    [' Nv-Á01 '],
  );
  assert.deepEqual(
    TryOn.filterProducts(products, { query: 'ROSE', category: 'all' }).map((item) => item.k),
    [' Nv-Á01 '],
  );
  assert.deepEqual(
    TryOn.filterProducts(products, { query: 'vinho', category: 'vestidos-debutante' }).map((item) => item.k),
    ['DB-010'],
  );
});

test('filtro interno aceita categoria e revela lotes cumulativos de 24 sem mutar entrada', () => {
  const source = Array.from({ length: 55 }, (_, index) => ({
    ...fixtures[index % 4],
    k: `V-${String(index).padStart(2, '0')}`,
    c: index === 54 ? 'vestidos-debutante' : 'vestidos-noiva',
  }));
  const before = JSON.stringify(source);

  assert.equal(TryOn.filterProducts(source, { category: 'all', page: 1 }).length, 24);
  assert.equal(TryOn.filterProducts(source, { category: 'all', page: 2 }).length, 48);
  assert.equal(TryOn.filterProducts(source, { category: 'all', page: 3 }).length, 55);
  assert.deepEqual(
    TryOn.filterProducts(source, { category: 'vestidos-debutante', page: 1 }).map((item) => item.k),
    ['V-54'],
  );
  assert.equal(JSON.stringify(source), before);
});

test('manequim nunca declara que o vestido não serve', () => {
  assert.deepEqual(TryOn.fitFor({ t: 'm' }, 'M'), { kind: 'ok', label: 'cabe' });
  assert.deepEqual(TryOn.fitFor({ t: 'P' }, 'M'), { kind: 'adjust', label: 'ajustável' });
  assert.deepEqual(TryOn.fitFor({ t: 'Único' }, 'M'), { kind: 'made', label: 'sob medida' });
  assert.deepEqual(TryOn.fitFor({ t: '42' }, 'M'), { kind: 'made', label: 'sob medida' });
  assert.deepEqual(TryOn.fitFor({}, 'M'), { kind: 'made', label: 'sob medida' });
  assert.equal(TryOn.fitFor({ t: 'M' }, null), null);
});

test('WhatsApp do resultado usa unidade válida, contato injetado e código normalizado', () => {
  const contacts = Object.freeze({ barra: 'BARRA-CONTACT', sf: 'SF-CONTACT' });
  const actions = {
    CONTACTS: contacts,
    unitOf(product) {
      return product && (product.un === 'barra' || product.un === 'sf') ? product.un : null;
    },
    whatsappHref(contact, message) {
      return `wa:${contact}:${message}`;
    },
  };

  const href = TryOn.resultWhatsAppHref({ k: ' nv 001/azul ', un: 'barra' }, actions);

  assert.match(href, /^wa:BARRA-CONTACT:/);
  assert.match(href, /NV 001\/AZUL/);
  assert.equal(href.includes(' nv 001/azul '), false);
  assert.equal(
    TryOn.resultWhatsAppHref({ k: 'NV-001', un: 'invalida' }, actions),
    'unidades.html',
  );
});

test('intercepta somente clique primário simples sem target ou download especial', () => {
  const event = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  const plainLink = {
    target: '',
    hasAttribute() { return false; },
  };

  assert.equal(TryOn.shouldInterceptLink(event, plainLink), true);
  assert.equal(TryOn.shouldInterceptLink({ ...event, button: 1 }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, metaKey: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, ctrlKey: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, shiftKey: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, altKey: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, defaultPrevented: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink(event, { ...plainLink, target: '_blank' }), false);
  assert.equal(TryOn.shouldInterceptLink(event, {
    target: '',
    hasAttribute(name) { return name === 'download'; },
  }), false);
  assert.equal(TryOn.shouldInterceptLink(null, plainLink), false);
});

test('request guard gera tokens, identifica o atual e invalida respostas antigas', () => {
  const guard = TryOn.createRequestGuard();
  const first = guard.token();

  assert.equal(guard.current(first), true);
  const second = guard.token();
  assert.equal(guard.current(first), false);
  assert.equal(guard.current(second), true);
  guard.invalidate();
  assert.equal(guard.current(second), false);
});

test('Worker faz POST explícito sem query, usa só image_b64 e consulta status a cada 2500 ms', async () => {
  let clock = 0;
  const calls = [];
  const waits = [];
  const queued = [
    response({ id: 'job/with space', restam_voce: 2 }),
    response({ status: 'processing' }),
    response({ status: 'done', image: 'https://img.test/generated.jpg' }),
  ];
  const client = TryOn.createWorkerClient({
    fetch: async (url, options) => {
      calls.push({ url, options });
      return queued.shift();
    },
    wait: async (milliseconds) => {
      waits.push(milliseconds);
      clock += milliseconds;
    },
    now: () => clock,
    workerUrl: 'https://worker.test/',
  });

  assert.deepEqual(calls, []);
  const result = await client.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'data:image/png;base64,PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
  });

  assert.deepEqual(result, {
    kind: 'success',
    image: 'https://img.test/generated.jpg',
    remaining: 2,
  });
  assert.deepEqual(waits, [2500, 2500]);
  assert.deepEqual(calls.map((call) => call.url), [
    'https://worker.test/tryon',
    'https://worker.test/status?id=job%2Fwith%20space',
    'https://worker.test/status?id=job%2Fwith%20space',
  ]);
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(calls[0].options.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    garment_url: 'https://img.test/dress.jpg',
    image_b64: 'data:image/png;base64,PRIVATE_PHOTO_BYTES',
  });
  assert.equal('image_url' in JSON.parse(calls[0].options.body), false);
});

test('Worker retorna limite em 429 sem tentar ler ou expor a resposta', async () => {
  let jsonCalled = false;
  const client = TryOn.createWorkerClient({
    fetch: async () => ({
      ok: false,
      status: 429,
      json: async () => {
        jsonCalled = true;
        return { raw: 'PRIVATE_PHOTO_BYTES' };
      },
    }),
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });

  const result = await client.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
  });

  assert.deepEqual(result, { kind: 'limit' });
  assert.equal(jsonCalled, false);
});

test('Worker distingue JSON inválido, forma inválida e erro de geração', async (t) => {
  const runWithResponses = async (responses) => {
    const client = TryOn.createWorkerClient({
      fetch: async () => responses.shift(),
      wait: async () => {},
      now: () => 0,
      workerUrl: 'https://worker.test',
    });
    return client.run({
      garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
      imageBase64: 'PRIVATE_PHOTO_BYTES',
      isCurrent: () => true,
    });
  };

  await t.test('JSON inválido', async () => {
    assert.deepEqual(
      await runWithResponses([invalidJsonResponse('raw PRIVATE_PHOTO_BYTES private-photo.jpg')]),
      { kind: 'invalid-response' },
    );
  });

  await t.test('forma inválida no POST', async () => {
    assert.deepEqual(
      await runWithResponses([response({ restam_voce: 2, raw: 'PRIVATE_PHOTO_BYTES' })]),
      { kind: 'invalid-response' },
    );
    assert.deepEqual(
      await runWithResponses([undefined]),
      { kind: 'invalid-response' },
    );
  });

  await t.test('forma inválida no status', async () => {
    assert.deepEqual(
      await runWithResponses([
        response({ id: 'job', restam_voce: 2 }),
        response({ status: 'done', raw: 'PRIVATE_PHOTO_BYTES' }),
      ]),
      { kind: 'invalid-response' },
    );
  });

  await t.test('status error', async () => {
    assert.deepEqual(
      await runWithResponses([
        response({ id: 'job', restam_voce: 2 }),
        response({ status: 'error', error: 'raw PRIVATE_PHOTO_BYTES private-photo.jpg' }),
      ]),
      { kind: 'generation-error' },
    );
  });
});

test('Worker distingue timeout e falha de rede sem vazar dados da requisição', async () => {
  let clock = 0;
  const timeoutClient = TryOn.createWorkerClient({
    fetch: async (url) => url.endsWith('/tryon')
      ? response({ id: 'job', restam_voce: 1 })
      : response({ status: 'processing' }),
    wait: async (milliseconds) => { clock += milliseconds; },
    now: () => clock,
    workerUrl: 'https://worker.test',
    timeout: 5000,
  });
  const timeoutResult = await timeoutClient.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
  });

  const networkClient = TryOn.createWorkerClient({
    fetch: async () => {
      throw new Error('PRIVATE_PHOTO_BYTES private-photo.jpg https://img.test/dress.jpg?x=TRACKING_VALUE');
    },
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });
  const networkResult = await networkClient.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
  });

  assert.deepEqual(timeoutResult, { kind: 'timeout' });
  assert.deepEqual(networkResult, { kind: 'network' });
  const failures = JSON.stringify([timeoutResult, networkResult]);
  assert.equal(failures.includes('PRIVATE_PHOTO_BYTES'), false);
  assert.equal(failures.includes('private-photo.jpg'), false);
  assert.equal(failures.includes('TRACKING_VALUE'), false);
});

test('guard inválido antes ou após await cancela e resposta tardia nunca é lida', async () => {
  let fetchCalls = 0;
  const inactiveClient = TryOn.createWorkerClient({
    fetch: async () => { fetchCalls += 1; return response({}); },
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });

  assert.deepEqual(await inactiveClient.run({
    garmentUrl: 'https://img.test/dress.jpg',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => false,
  }), { kind: 'cancelled' });
  assert.equal(fetchCalls, 0);

  let resolveFetch;
  let current = true;
  let jsonCalled = false;
  const delayedClient = TryOn.createWorkerClient({
    fetch: () => new Promise((resolve) => { resolveFetch = resolve; }),
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });
  const pending = delayedClient.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => current,
  });

  current = false;
  resolveFetch({
    ok: true,
    status: 200,
    json: async () => {
      jsonCalled = true;
      return { id: 'late', restam_voce: 1 };
    },
  });

  assert.deepEqual(await pending, { kind: 'cancelled' });
  assert.equal(jsonCalled, false);
});

test('invalidação entre o json e a continuação do run ainda cancela o sucesso', async () => {
  let current = true;
  let parsedFinalStatus = false;
  let scheduledInvalidation = false;
  const responses = [
    response({ id: 'job', restam_voce: 1 }),
    {
      ok: true,
      status: 200,
      json: async () => {
        parsedFinalStatus = true;
        return { status: 'done', image: 'https://img.test/generated.jpg' };
      },
    },
  ];
  const client = TryOn.createWorkerClient({
    fetch: async () => responses.shift(),
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });

  const result = await client.run({
    garmentUrl: 'https://img.test/dress.jpg',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => {
      if (parsedFinalStatus && !scheduledInvalidation) {
        scheduledInvalidation = true;
        queueMicrotask(() => { current = false; });
      }
      return current;
    },
  });

  assert.deepEqual(result, { kind: 'cancelled' });
});

test('AbortSignal e AbortError são cancelamento, não falha de rede', async () => {
  let calls = 0;
  const client = TryOn.createWorkerClient({
    fetch: async () => {
      calls += 1;
      const error = new Error('aborted PRIVATE_PHOTO_BYTES');
      error.name = 'AbortError';
      throw error;
    },
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });

  assert.deepEqual(await client.run({
    garmentUrl: 'https://img.test/dress.jpg',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
    signal: { aborted: true },
  }), { kind: 'cancelled' });
  assert.equal(calls, 0);

  assert.deepEqual(await client.run({
    garmentUrl: 'https://img.test/dress.jpg',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
    signal: { aborted: false },
  }), { kind: 'cancelled' });
});

test('UMD publica API exata mínima sem tocar document, storage ou fetch globais', () => {
  [
    'filterEligibleProducts',
    'filterProducts',
    'fitFor',
    'createRequestGuard',
    'createWorkerClient',
    'resultWhatsAppHref',
    'shouldInterceptLink',
    'create',
  ].forEach((name) => assert.equal(typeof TryOn[name], 'function', name));
  assert.equal(TryOn.DEFAULT_WORKER_URL, 'https://kl-tryon.contato-4d7.workers.dev');

  const source = fs.readFileSync(path.join(__dirname, '..', 'kl-catalog-tryon.js'), 'utf8');
  const sandbox = {};
  sandbox.window = sandbox;
  ['document', 'localStorage', 'fetch'].forEach((name) => {
    Object.defineProperty(sandbox, name, {
      configurable: true,
      get() { throw new Error(`${name} must not be read`); },
    });
  });

  assert.doesNotThrow(() => vm.runInNewContext(source, sandbox, {
    filename: 'kl-catalog-tryon.js',
  }));
  assert.equal(typeof sandbox.window.KLCatalog.TryOn, 'object');
  assert.equal(typeof sandbox.window.KLCatalog.TryOn.createWorkerClient, 'function');
});
