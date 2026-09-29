// bot.js — Miranda Trainer (USA, English + Spanish)
const { Bot, InlineKeyboard, InputFile } = require('grammy');
const OpenAI = require('openai');
const express = require('express');
const fs = require('fs');

// ============ CONFIG ============
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

if (!BOT_TOKEN) { console.error('TELEGRAM_BOT_TOKEN missing'); process.exit(1); }
if (!OPENROUTER_KEY) { console.error('OPENROUTER_API_KEY missing'); process.exit(1); }

const ai = new OpenAI({
  apiKey: OPENROUTER_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// ============ STATUS LABELS ============
const STATUS = {
  witness:   { en: 'Witness', es: 'Testigo' },
  suspect:   { en: 'Suspect', es: 'Sospechoso' },
  defendant: { en: 'Defendant', es: 'Acusado' },
  victim:    { en: 'Victim', es: 'Víctima' },
  plaintiff: { en: 'Plaintiff', es: 'Demandante' },
  respondent:{ en: 'Respondent', es: 'Demandado' }
};

// ============ SYSTEM PROMPTS ============
function buildPrompt(lang, status) {
  const statusEn = STATUS[status]?.en || 'Witness';
  const statusEs = STATUS[status]?.es || 'Testigo';

  const laws = `- U.S. Constitution, 4th Amendment — protection against unreasonable searches and seizures
- U.S. Constitution, 5th Amendment — right against self-incrimination, due process
- U.S. Constitution, 6th Amendment — right to counsel, speedy and public trial
- U.S. Constitution, 14th Amendment — due process, equal protection
- Miranda v. Arizona, 384 U.S. 436 (1966) — required warnings before custodial interrogation
- Gideon v. Wainwright, 372 U.S. 335 (1963) — right to appointed counsel
- Escobedo v. Illinois, 378 U.S. 478 (1964) — right to counsel during interrogation
- Berghuis v. Thompkins, 560 U.S. 370 (2010) — must invoke right to remain silent unambiguously
- Federal Rules of Criminal Procedure (esp. Rules 5, 5.1, 6, 7)
- Federal Rules of Evidence (esp. Rules 801, 802 — hearsay)
- Brady v. Maryland, 373 U.S. 83 (1963) — prosecution must disclose exculpatory evidence`;

  if (lang === 'ES') {
    return `Eres un entrenador de interrogatorios para Estados Unidos. Estado procesal del usuario: ${statusEs}. Idioma: Español.

IMPORTANTE PARA FORMATO:
- Usa SOLO asteriscos simples para negrita: *Texto* — no **Texto**.
- Para listas usa "•" y emojis.
- No uses tablas markdown.

ROL: Simulación realista de interrogatorio. Responde ESTRICTAMENTE en este formato:

🎭 Interrogador (Detective):
(Pregunta o declaración realista del detective/investigador, adaptada al estado "${statusEs}". Solo en español.)

💡 Abogado-Entrenador:
• 🎯 Análisis de la trampa: propósito de la pregunta y riesgo
• ⚠️ Error peligroso: cómo NO responder
• 🛡️ Estrategia correcta: 2-3 formulaciones seguras con referencias a normas

📊 Evaluación de su respuesta anterior:
(Si el usuario ya respondió — evalúa brevemente: ✅/⚠️/❌. En la primera ronda — escribe "Primera ronda — la evaluación viene después.")

BASE LEGAL:
${laws}

REGLAS:
1. Enseñar a responder solo a la pregunta formulada.
2. Distinguir entre "no recuerdo" y el derecho a guardar silencio.
3. El estado procesal es "${statusEs}" — tómalo en cuenta.
4. No dar asesoría legal sobre el caso.
5. Responder SOLO en español.`;
  }

  // Default — English
  return `You are an interrogation trainer for the United States. User's procedural status: ${statusEn}. Language: English.

IMPORTANT FORMATTING:
- Use ONLY single asterisks for bold: *Text* — not **Text**.
- For lists use "•" and emojis.
- Do not use markdown tables.

ROLE: Realistic interrogation simulation. Respond STRICTLY in this format:

🎭 Investigator (Detective):
(Realistic question or statement from the detective, adapted to status "${statusEn}". English only.)

💡 Trainer-Attorney:
• 🎯 Trap analysis: purpose of the question and the risk
• ⚠️ Dangerous mistake: how NOT to respond
• 🛡️ Correct strategy: 2-3 safe formulations with references to law

📊 Evaluation of your previous answer:
(If user already answered — briefly evaluate: ✅/⚠️/❌. First round — write "First round — evaluation comes next.")

LEGAL BASIS:
${laws}

RULES:
1. Teach to answer only the question asked.
2. Distinguish between "I don't recall" and the right to remain silent.
3. The procedural status is "${statusEn}" — take it into account.
4. Do not give legal advice on the case.
5. Respond ONLY in English.`;
}

// ============ SESSIONS ============
const sessions = new Map();

// ============ BOT ============
const bot = new Bot(BOT_TOKEN);

bot.catch((err) => console.error('Bot error:', err));

// /start
bot.command('start', async (ctx) => {
  sessions.delete(ctx.from.id);

  const kb = new InlineKeyboard()
    .text('🇺🇸 English', 'lang:EN').row()
    .text('🇲🇽 Español', 'lang:ES');

  await ctx.reply(
    '⚖️ *Miranda Trainer*\n\n' +
    'Interrogation training for the United States.\n' +
    'Entrenamiento de interrogatorios para Estados Unidos.\n\n' +
    'Choose your language / Elija su idioma:',
    { parse_mode: 'Markdown', reply_markup: kb }
  );
});

// Выбор языка → меню статусов
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

    await ctx.reply('🇺🇸 *Español*\n\n*Seleccione su estado procesal:*', {
      parse_mode: 'Markdown',
      reply_markup: kb
    });
    return;
  }

  const kb = new InlineKeyboard()
    .text('👤 Witness', 'st:witness').row()
    .text('🚨 Suspect', 'st:suspect').row()
    .text('⚖️ Defendant', 'st:defendant').row()
    .text('🛡️ Victim', 'st:victim').row()
    .text('📋 Plaintiff', 'st:plaintiff').row()
    .text('📋 Respondent', 'st:respondent');

  await ctx.reply('🇺🇸 *English*\n\n*Select your procedural status:*', {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
});

// Выбор статуса → инцидент
bot.callbackQuery(/^st:(witness|suspect|defendant|victim|plaintiff|respondent)$/, async (ctx) => {
  const status = ctx.match[1];
  const sess = sessions.get(ctx.from.id);
  if (!sess) return ctx.answerCallbackQuery({ text: 'Start with /start' });

  sess.status = status;
  await ctx.answerCallbackQuery();

  if (sess.lang === 'ES') {
    await ctx.reply(
      `🇺🇸 *${STATUS[status].es}*\n\n` +
      `*Describa su incidente en detalle.*\n\n` +
      `No incluya nombres, direcciones, números de teléfono o SSN.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await ctx.reply(
    `🇺🇸 *${STATUS[status].en}*\n\n` +
    `*Describe your incident in detail.*\n\n` +
    `Do not include names, addresses, phone numbers or SSN.`,
    { parse_mode: 'Markdown' }
  );
});

// /reset
bot.command('reset', async (ctx) => {
  sessions.delete(ctx.from.id);
  await ctx.reply('Session reset. / Sesión reiniciada.\n\nSend /start.');
});

// /help
bot.command('help', async (ctx) => {
  await ctx.reply(
    '⚖️ *Miranda Trainer — Help / Ayuda*\n\n' +
    '• /start — begin / comenzar\n' +
    '• /reset — reset session / reiniciar sesión\n' +
    '• /finish — final evaluation / evaluación final\n' +
    '• /export — save report / guardar informe\n' +
    '• /help — this help / esta ayuda',
    { parse_mode: 'Markdown' }
  );
});

// /finish
bot.command('finish', async (ctx) => {
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) {
    return ctx.reply(sess?.lang === 'ES' ? 'Comience con /start' : 'Start with /start');
  }

  const finishPrompt = sess.lang === 'ES'
    ? 'Termina la sesión de entrenamiento. Da una evaluación final: fortalezas, debilidades, recomendaciones. Breve y concreto.'
    : 'End the training session. Give a final evaluation: strengths, weaknesses, recommendations. Brief and specific.';

  sess.history.push({ role: 'user', content: finishPrompt });

  try {
    await ctx.replyWithChatAction('typing');
    const response = await ai.chat.completions.create({
      model: MODEL,
      messages: sess.history,
      temperature: 0.7,
      max_tokens: 1500
    });
    const answer = response.choices[0].message.content;
    const title = sess.lang === 'ES' ? '🎓 *RESULTADO*\n\n' : '🎓 *FINAL REPORT*\n\n';
    await sendLong(ctx, title + answer, 'Markdown');
  } catch (e) {
    console.error(e);
    await ctx.reply('Error getting the summary.');
  }
});

// /export
bot.command('export', async (ctx) => {
  const userId = ctx.from.id;
  const sess = sessions.get(userId);

  if (!sess || !sess.incident) {
    return ctx.reply(sess?.lang === 'ES' ? 'No hay sesión activa. Comience con /start' : 'No active session. Start with /start');
  }

  await ctx.reply(sess.lang === 'ES' ? '📄 Preparando archivo...' : '📄 Preparing file...');

  try {
    let content = '';
    content += '===========================================\n';
    content += '       MIRANDA TRAINER — TRAINING REPORT\n';
    content += '===========================================\n\n';
    content += 'Date / Fecha: ' + new Date().toISOString().slice(0, 19).replace('T', ' ') + '\n';
    content += 'Language / Idioma: ' + sess.lang + '\n';
    content += 'Status / Estado: ' + (STATUS[sess.status]?.en || '—') + ' / ' + (STATUS[sess.status]?.es || '—') + '\n\n';

    content += '-------------------------------------------\n';
    content += 'INCIDENT / INCIDENTE:\n';
    content += '-------------------------------------------\n';
    content += (sess.incident || '—') + '\n\n';

    content += '-------------------------------------------\n';
    content += 'DIALOG / DIÁLOGO:\n';
    content += '-------------------------------------------\n\n';

    sess.history.forEach((msg) => {
      if (msg.role === 'system') return;
      const label = msg.role === 'user' ? '► USER / USUARIO' : '◆ TRAINER / ENTRENADOR';
      content += label + ':\n' + (msg.content || '') + '\n\n';
    });

    content += '===========================================\n';
    content += 'This is training material, not legal advice.\n';
    content += 'Este es material de entrenamiento, no asesoría legal.\n';
    content += '===========================================\n';

    const tmpPath = '/tmp/Miranda_Training_' + userId + '_' + Date.now() + '.txt';
    fs.writeFileSync(tmpPath, content, 'utf8');

    await ctx.replyWithDocument(new InputFile(tmpPath), {
      caption: sess.lang === 'ES' ? '📄 Su entrenamiento ha sido guardado.' : '📄 Your training has been saved.'
    });

    fs.unlink(tmpPath, () => {});
  } catch (e) {
    console.error('Export error:', e);
    await ctx.reply('Error creating file.');
  }
});

// Основной обработчик
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  const sess = sessions.get(ctx.from.id);
  if (!sess) return ctx.reply('Start with /start');
  if (!sess.lang) return ctx.reply('Choose language: /start');
  if (!sess.status) return ctx.reply('Select procedural status.');

  if (!sess.incident) {
    sess.incident = text;
    sess.history = [
      { role: 'system', content: buildPrompt(sess.lang, sess.status) },
      {
        role: 'user',
        content: sess.lang === 'ES'
          ? `Incidente: ${text}\n\nComienza el entrenamiento. Primera pregunta del detective + comentario del Abogado-Entrenador.`
          : `Incident: ${text}\n\nBegin training. First question from detective + Trainer-Attorney commentary.`
      }
    ];
  } else {
    sess.history.push({ role: 'user', content: text });
    const sys = sess.history[0];
    const rest = sess.history.slice(1);
    if (rest.length > 24) sess.history = [sys, ...rest.slice(-24)];
  }

  const loading = sess.lang === 'ES' ? '⏳ Preparando respuesta...' : '⏳ Preparing response...';
  await ctx.reply(loading);

  try {
    await ctx.replyWithChatAction('typing');
    const response = await ai.chat.completions.create({
      model: MODEL,
      messages: sess.history,
      temperature: 0.7,
      max_tokens: 2000
    });
    const answer = response.choices[0].message.content;
    sess.history.push({ role: 'assistant', content: answer });
    await sendLong(ctx, answer, 'Markdown');
  } catch (e) {
    console.error('AI error:', e);
    await ctx.reply(sess.lang === 'ES' ? 'Error de IA.' : 'AI error.');
  }
});

// ============ ОТПРАВКА ДЛИННЫХ СООБЩЕНИЙ ============
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
    try {
      await ctx.reply(part, opts);
    } catch (e) {
      console.warn('Markdown parse error, sending plain:', e.message);
      await ctx.reply(part);
    }
  }
}

// ============ START ============
bot.start();
console.log('🚀 Miranda Trainer started');

const httpApp = express();
httpApp.get('/', (req, res) => res.send('Miranda Trainer is running'));
const PORT = process.env.PORT || 3000;
httpApp.listen(PORT, () => console.log('HTTP server on port ' + PORT));
