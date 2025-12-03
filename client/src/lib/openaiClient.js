/**
 * OpenAI client (dev proxy): uses /openai/v1/chat/completions
 * Assumes Vite proxy routes /openai -> https://api.openai.com with Authorization header.
 * If you are calling the real API directly, set VITE_OPENAI_API_KEY in .env and use fetch to https://api.openai.com.
 */

const BASE = (import.meta.env.VITE_OPENAI_BASE_URL || '').trim() || '/openai';
const PATH = '/v1/chat/completions';

// Default model order (fast → strong)
const MODEL_ORDER = [
  import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-0613',
  'gpt-3.5-turbo'
];

function toMessages(prompt) {
  return [
    { role: 'system', content: 'You are MyZone. Be concise, accurate, code-aware. If local code varies, say so.' },
    { role: 'user', content: prompt }
  ];
}

async function callChat(model, prompt, { signal, timeoutMs=15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const combined = signal
    ? new AbortController()
    : ctrl;

  // If external signal provided, abort both when either fires
  if (signal) {
    signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }

  try {
    const res = await fetch(`${BASE}${PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
        // NOTE: When using /openai proxy, Authorization is added by the proxy.
        // If calling api.openai.com directly, ensure:
        // 'authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: toMessages(prompt),
        temperature: 0.2,
      }),
      signal: ctrl.signal
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      const err = new Error(`OpenAI chat error ${res.status}: ${txt.slice(0,300)}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!content) throw new Error('Empty response from OpenAI.');

    try {
      window.dispatchEvent(new CustomEvent('myzone:ai-debug', {
        detail: { ok: true, content, model, endpoint: 'chat' }
      }));
    } catch {}
    return content + `\n\n<!-- model:${model} -->`;
  } finally {
    clearTimeout(timer);
  }
}

export async function getSearchInsights(prompt, meta={}, opts={}) {
  let lastErr;
  for (const model of MODEL_ORDER) {
    try {
      console.log('[MyZone AI] trying chat with', model);
      return await callChat(model, decoratePrompt(prompt, meta), opts);
    } catch (e) {
      console.warn('[MyZone AI] chat failed for', model, e?.message || e);
      lastErr = e;
      continue;
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('myzone:ai-debug', {
      detail: { ok: false, error: String(lastErr?.message || lastErr || 'All models failed.') }
    }));
  } catch {}
  throw lastErr || new Error('All models failed.');
}

function decoratePrompt(prompt, meta) {
  const parts = [];
  if (meta?.mode === 'dictionary') {
    parts.push('Return a brief, authoritative definition with a short example for urban planning/architecture.');
  } else {
    parts.push('Answer for zoning, land development, urbanism, construction/architecture. If code varies by jurisdiction, list checks.');
  }
  if (meta?.cityName) parts.push(`Jurisdiction: ${meta.cityName}`);
  if (meta?.cityId) parts.push(`CityId: ${meta.cityId}`);
  if (meta?.zoningDistrict) parts.push(`Zone (if applicable): ${meta.zoningDistrict}`);
  parts.push(`User query: ${prompt}`);
  return parts.join(' | ');
}
