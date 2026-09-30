// bot.js — Miranda Trainer (US, EN/ES) — 1 free trial + Stars paywall
const { Bot, InlineKeyboard } = require('grammy');
const OpenAI = require('openai');
const express = require('express');

// ============ CONFIG ============
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const PRICE_XTR = 100; // 100 Stars

if (!BOT_TOKEN) { console.error('TELEGRAM_BOT_TOKEN missing'); process.exit(1); }
if (!OPENROUTER_KEY) { console.error('OPENROUTER_API_KEY missing'); process.exit(1); }

const ai = new OpenAI({
  apiKey: OPENROUTER_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// ============ USER STATE (in-memory) ============
const users = new Map(); // userId -> { trialUsed, paid }

function getUser(userId) {
  return users.get(userId) || { trialUsed: false, paid: false };
}
function setUser(userId, patch) {
  users.set(userId, { ...getUser(userId), ...patch });
}

// ============ STATUS ============
const STATUS = {
  witness:    { en: 'Witness', es: 'Testigo' },
  suspect:    { en: 'Suspect', es: 'Sospechoso' },
  defendant:  { en: 'Defendant', es: 'Acusado' },
  victim:     { en: 'Victim', es: 'Víctima' },
  plaintiff:  { en: 'Plaintiff', es: 'Demandante' },
  respondent: { en: 'Respondent', es: 'Demandado' }
};

// ============ PROMPTS ============
function buildPrompt(lang, status) {
  const statusEn = STATUS[status]?.en || 'Witness';
  const statusEs = STATUS[status]?.es || 'Testigo';

  const laws = `- U.S. Constitution, 4th Amendment — unreasonable searches and seizures
- U.S. Constitution, 5th Amendment — right against self-incrimination
- U.S. Constitution, 6th Amendment — right to counsel
- U.S. Constitution, 14th Amendment — due process
- Miranda v. Arizona, 384 U.S. 436 (1966)
- Gideon v. Wainwright, 372 U.S. 335 (1963)
- Escobedo v. Illinois, 378 U.S. 478 (1964)
- Berghuis v. Thompkins, 560 U.S. 370 (2010)
- Brady v. Maryland, 373 U.S. 83 (1963)`;

  if (lang === 'ES') {
    return `Eres un entrenador de interrogatorios para Estados Unidos. Estado procesal: ${statusEs}. Idioma: Español.

FORMATO: usa SOLO asteriscos simples para negrita: *Texto* — no **Texto**.

🎭 Interrogador (Detective):
(Pregunta realista, adaptada al estado "${statusEs}". Solo en español.)

💡 Abogado-Entrenador:
• 🎯 Análisis de la trampa
• ⚠️ Error peligroso
• 🛡️ Estrategia correcta: 2-3 formulaciones con referencias

📊 Evaluación de su respuesta anterior: (✅/⚠️/❌ o "Primera ronda — la evaluación viene después.")

BASE LEGAL:
${laws}

REGLAS:
1. Solo responder a la pregunta formulada.
2. Distinguir "no recuerdo" del derecho a guardar silencio.
3. Estado: "${statusEs}".
4. Sin asesoría legal.
5. SOLO en español.`;
  }

  return `You are an interrogation trainer for the United States. Procedural status: ${statusEn}. Language: English.

FORMAT: use ONLY single asterisks for bold: *Text* — not **Text**.

🎭 Investigator (Detective):
(Realistic question adapted to status "${statusEn}". English only.)

💡 Trainer-Attorney:
• 🎯 Trap analysis
• ⚠️ Dangerous mistake
• 🛡️ Correct strategy: 2-3 formulations with references

📊 Evaluation of your previous answer: (✅/⚠️/❌ or "First round — evaluation comes next.")

LEGAL BASIS:
${laws}

RULES:
1. Answer only the question asked.
2. Distinguish "I don't recall" from the right to remain silent.
3. Status: "${statusEn}".
4. No legal advice.
5. ONLY in English.`;
}

// ============ SESSIONS ============
const sessions = new Map();

// ============ BOT ============
const bot = new Bot(BOT_TOKEN);
bot.catch((err) => console.error('Bot error:', err));

// ============ PAYWALL ============
function showPaywall(ctx) {
  const kb = new InlineKeyboard().text(`⭐ Unlock lifetime access — ${PRICE_XTR} Stars`, 'buy_access');
  return ctx.reply(
    '🔒 *Free trial used*\n\n' +
    'You have completed your one free interrogation training.\n\n' +
    '*Unlimited access — one-time payment, lifetime use:*',
    { parse_mode: 'Markdown', reply_markup: kb }
  );
}

// ============ /start ============
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const u = getUser(userId);

  if (!u.paid && u.trialUsed) {
    return showPaywall(ctx);
  }

  sessions.delete(userId);

  const kb = new InlineKeyboard()
    .text('🇺🇸 English', 'lang:EN').row()
    .text('🇲🇽 Español', 'lang:ES');

  await ctx.reply(
    '⚖️ *Miranda Trainer*\n\n' +
    (u.paid ? '' : '🎁 *Your first training is free.*\n\n') +
    'Choose your language / Elija su idioma:',
    { parse_mode: 'Markdown', reply_markup: kb }
  );
});

// ============ BUY ============
bot.callbackQuery('buy_access', async (ctx) => {
  const userId = ctx.from.id;
  await ctx.answerCallbackQuery();

  await ctx.replyWithInvoice(
    'Miranda Trainer — Lifetime Access',
    'One-time payment. Unlimited interrogations, forever.',
    `miranda_access_${userId}`,
    'XTR',
    [{ label: 'Lifetime Access', amount: PRICE_XTR }],
    { provider_token: '' }
  );
});

// ============ PAYMENT ============
bot.on('message:successful_payment', async (ctx) => {
  const userId = ctx.from.id;
  setUser(userId, { paid: true });

  await ctx.reply(
    '✅ *Payment received!*\n\n' +
    'Lifetime access activated. Send /start to begin.',
    { parse_mode: 'Markdown' }
  );
});

// ============ LANGUAGE ============
bot.callbackQuery(/^lang:(EN|ES)$/, async (ctx) => {
  const lang = ctx.match[1];
  sessions.set(ctx.from.id, { lang, status: null, incident: null, history: [] });

  await ctx.answerCallbackQuery();

  if (lang === 'ES') {
    const kb = new InlineKeyboard()
      .text('👤 Testigo', 'st:witness').row()
      .text('🚨 Sospechoso', 'st:suspect').row()
      .text('⚖️ Acusado', 'st:defendant').row()
      .text('🛡️ Víctima', 'st:victim').row()
      .text('📋 Demandante', 'st:plaintiff').row()
      .text('📋 Demandado', 'st:respondent');

    return ctx.reply('🇺🇸 *Español*\n\n*Seleccione su estado procesal:*', { parse_mode: 'Markdown', reply_markup: kb });
  }

  const kb = new InlineKeyboard()
    .text('👤 Witness', 'st:witness').row()
    .text('🚨 Suspect', 'st:suspect').row()
    .text('⚖️ Defendant', 'st:defendant').row()
    .text('🛡️ Victim', 'st:victim').row()
    .text('📋 Plaintiff', 'st:plaintiff').row()
    .text('📋 Respondent', 'st:respondent');

  await ctx.reply('🇺🇸 *English*\n\n*Select your procedural status:*', { parse_mode: 'Markdown', reply_markup: kb });
});

// ============ STATUS ============
bot.callbackQuery(/^st:(witness|suspect|defendant|victim|plaintiff|respondent)$/, async (ctx) => {
  const status = ctx.match[1];
  const sess = sessions.get(ctx.from.id);
  if (!sess) return ctx.answerCallbackQuery({ text: 'Send /start' });

  sess.status = status;
  await ctx.answerCallbackQuery();

  if (sess.lang === 'ES') {
    return ctx.reply(
      `🇺🇸 *${STATUS[status].es}*\n\n*Describa su incidente en detalle.*\n\nNo incluya nombres, direcciones, teléfonos.`,
      { parse_mode: 'Markdown' }
    );
  }

  await ctx.reply(
    `🇺🇸 *${STATUS[status].en}*\n\n*Describe your incident in detail.*\n\nDo not include names, addresses, phones.`,
    { parse_mode: 'Markdown' }
  );
});

// ============ /reset ============
bot.command('reset', async (ctx) => {
  sessions.delete(ctx.from.id);
  await ctx.reply('Session reset. Send /start.');
});

// ============ /help ============
bot.command('help', async (ctx) => {
  await ctx.reply(
    '⚖️ *Miranda Trainer — Help*\n\n' +
    '• /start — begin\n' +
    '• /reset — reset session\n' +
    '• /finish — final evaluation\n' +
    '• /help — this help',
    { parse_mode: 'Markdown' }
  );
});

// ============ /finish ============
bot.command('finish', async (ctx) => {
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Start with /start');

  sess.history.push({
    role: 'user',
    content: sess.lang === 'ES'
      ? 'Termina la sesión. Da evaluación final: fortalezas, debilidades, recomendaciones.'
      : 'End the session. Give final evaluation: strengths, weaknesses, recommendations.'
  });

  try {
    await ctx.replyWithChatAction('typing');
    const r = await ai.chat.completions.create({
      model: MODEL, messages: sess.history, temperature: 0.7, max_tokens: 1500
    });
    const answer = r.choices[0].message.content;
    await sendLong(ctx, (sess.lang === 'ES' ? '🎓 *RESULTADO*\n\n' : '🎓 *FINAL REPORT*\n\n') + answer, 'Markdown');
  } catch (e) {
    console.error(e);
    await ctx.reply('Error getting the summary.');
  }
});

// ============ MAIN HANDLER ============
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  const userId = ctx.from.id;
  const u = getUser(userId);
  const sess = sessions.get(userId);

  if (!sess) return ctx.reply('Send /start');
  if (!sess.lang) return ctx.reply('Choose language: /start');
  if (!sess.status) return ctx.reply('Select procedural status.');

  // First incident → mark trial as used
  if (!sess.incident) {
    sess.incident = text;
    setUser(userId, { trialUsed: true });
    sess.history = [
      { role: 'system', content: buildPrompt(sess.lang, sess.status) },
      {
        role: 'user',
        content: sess.lang === 'ES'
          ? `Incidente: ${text}\n\nComienza. Primera pregunta + análisis del Abogado-Entrenador.`
          : `Incident: ${text}\n\nBegin. First question + Trainer-Attorney commentary.`
      }
    ];
  } else {
    sess.history.push({ role: 'user', content: text });
    const sys = sess.history[0];
    const rest = sess.history.slice(1);
    if (rest.length > 24) sess.history = [sys, ...rest.slice(-24)];
  }

  await ctx.reply(sess.lang === 'ES' ? '⏳ Preparando respuesta...' : '⏳ Preparing response...');

  try {
    await ctx.replyWithChatAction('typing');
    const r = await ai.chat.completions.create({
      model: MODEL, messages: sess.history, temperature: 0.7, max_tokens: 2000
    });
    const answer = r.choices[0].message.content;
    sess.history.push({ role: 'assistant', content: answer });
    await sendLong(ctx, answer, 'Markdown');
  } catch (e) {
    console.error('AI error:', e);
    await ctx.reply('AI error.');
  }
});

// ============ SEND LONG ============
function cleanForTelegram(text) {
  let cleaned = text.replace(/\*\*([^*]+?)\*\*/g, '*$1*');
  cleaned = cleaned.replace(/__([^_]+?)__/g, '_$1_');
  return cleaned;
}

async function sendLong(ctx, text, parseMode) {
  const MAX = 4000;
  const cleaned = parseMode === 'Markdown' ? cleanForTelegram(text) : text;
  const opts = parseMode ? { parse_mode: parseMode } : {};

  const parts = [];
  let remaining = cleaned;
  while (remaining.length > MAX) {
    let end = remaining.lastIndexOf('\n\n', MAX);
    if (end < MAX / 2) end = remaining.lastIndexOf('\n', MAX);
    if (end < MAX / 2) end = MAX;
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trim();
  }
  if (remaining) parts.push(remaining);

  for (const part of parts) {
    try { await ctx.reply(part, opts); }
    catch (e) { console.warn('Markdown err, plain:', e.message); await ctx.reply(part); }
  }
}

// ============ START ============
bot.start();
console.log('🚀 Miranda Trainer started');

const httpApp = express();
httpApp.get('/', (req, res) => res.send('Miranda Trainer is running'));
const PORT = process.env.PORT || 3000;
httpApp.listen(PORT, () => console.log('HTTP server on port ' + PORT));
