// bot.js — Miranda Trainer v7 (US, EN/ES, UX improvements)
const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const OpenAI = require('openai');
const express = require('express');

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

// ============ STATUS ============
const STATUS = {
  witness:    { en: 'Witness',    es: 'Testigo' },
  suspect:    { en: 'Suspect',    es: 'Sospechoso' },
  defendant:  { en: 'Defendant',  es: 'Acusado' },
  victim:     { en: 'Victim',     es: 'Víctima' },
  plaintiff:  { en: 'Plaintiff',  es: 'Demandante' },
  respondent: { en: 'Respondent', es: 'Demandado' }
};

// ============ TRANSLATIONS ============
const T = {
  EN: {
    startTitle: '⚖️ *Miranda Trainer*',
    startSub: '⚠️ This is a training simulator, not legal advice.',
    chooseMode: 'Choose mode:',
    beginner: '🎓 Beginner',
    exam: '📝 Exam',
    chooseStatus: '*Select your procedural status:*',
    describe: (status) => `*${status}*\n\n*Describe your incident in detail:*\n\n• What happened?\n• When?\n• Who was involved?\n• What did you do?\n\n⚠️ No personal data.`,
    preparingQ: '⏳ Preparing first question...',
    trainerStarted: '⚖️ *Trainer started.*\n\nButtons below — quick actions.',
    analyzing: '⏳ Analyzing response...',
    round: '📊 *Round',
    endBtn: '🎓 End Training',
    hintBtn: '💡 Hint',
    summaryBtn: '📊 Summary',
    changeStatusBtn: '🔄 Change Status',
    skipBtn: '⏭️ Skip',
    lawsBtn: '📚 Laws',
    hintDisabled: '💡 Hints are disabled in exam mode.',
    noSession: 'No active session. Send /start.',
    noIncident: 'Please start with /start',
    aiError: '⚠️ AI temporarily unavailable. Please try again in 30 seconds.',
    hintError: '⚠️ Hint error. Please try again.',
    summaryError: '⚠️ Summary error. Try /finish again.',
    skipped: '[Skipped question]',
    newTraining: 'Send /start for a new training.',
    examHint: 'Hint',
    examLabel: 'Exam',
    helpTitle: '⚖️ *Miranda Trainer — Help*',
    helpBody: '• /start — begin\n• /reset — reset session\n• /finish — final summary\n• /help — this help\n\n📚 Uses U.S. Constitution + Supreme Court cases.'
  },
  ES: {
    startTitle: '⚖️ *Miranda Trainer*',
    startSub: '⚠️ Este es un simulador de entrenamiento, no asesoría legal.',
    chooseMode: 'Elija el modo:',
    beginner: '🎓 Principiante',
    exam: '📝 Examen',
    chooseStatus: '*Seleccione su estado procesal:*',
    describe: (status) => `*${status}*\n\n*Describa su incidente en detalle:*\n\n• ¿Qué pasó?\n• ¿Cuándo?\n• ¿Quién participó?\n• ¿Qué hizo usted?\n\n⚠️ Sin datos personales.`,
    preparingQ: '⏳ Preparando primera pregunta...',
    trainerStarted: '⚖️ *Entrenador iniciado.*\n\nBotones abajo — acciones rápidas.',
    analyzing: '⏳ Analizando respuesta...',
    round: '📊 *Ronda',
    endBtn: '🎓 Terminar',
    hintBtn: '💡 Pista',
    summaryBtn: '📊 Resumen',
    changeStatusBtn: '🔄 Cambiar estado',
    skipBtn: '⏭️ Saltar',
    lawsBtn: '📚 Leyes',
    hintDisabled: '💡 Las pistas están desactivadas en el modo examen.',
    noSession: 'Sin sesión activa. Envíe /start.',
    noIncident: 'Por favor comience con /start',
    aiError: '⚠️ IA no disponible. Intente de nuevo en 30 segundos.',
    hintError: '⚠️ Error de pista. Intente de nuevo.',
    summaryError: '⚠️ Error de resumen. Intente /finish de nuevo.',
    skipped: '[Pregunta saltada]',
    newTraining: 'Envíe /start para un nuevo entrenamiento.',
    examHint: 'Pista',
    examLabel: 'Examen',
    helpTitle: '⚖️ *Miranda Trainer — Ayuda*',
    helpBody: '• /start — comenzar\n• /reset — reiniciar\n• /finish — resumen final\n• /help — esta ayuda\n\n📚 Usa la Constitución de EE.UU. + casos del Tribunal Supremo.'
  }
};

// ============ LANGUAGE GUARD ============
function detectLanguage(text) {
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  const cyr = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
  if (latin + cyr === 0) return 'unknown';
  return latin > cyr ? 'latin' : 'cyrillic';
}

// ============ PROMPTS ============
function buildQuestionPrompt(lang, status, incident, history) {
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  const langName = lang === 'ES' ? 'Spanish' : 'English';

  return `⚠️ STRICT: Answer ONLY in ${langName}. No other languages.
⚠️ STRICT: ONLY U.S. law: Constitution, Miranda v. Arizona, Gideon v. Wainwright, Escobedo v. Illinois.
⚠️ FORBIDDEN: other countries, other languages.
⚠️ ONE question. NO analysis. NO comments.

Country: United States. Status: ${statusText}.

INCIDENT:
${incident}

DIALOG:
${history}

FORMAT:
🎭 Investigator: [one question in ${langName}]

ONLY THIS LINE.`;
}

function buildEvaluationPrompt(lang, status, incident, history) {
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  const langName = lang === 'ES' ? 'Spanish' : 'English';

  return `⚠️ STRICT: ONLY ${langName.toUpperCase()}. No other languages.
⚠️ STRICT: ONLY U.S. law.
⚠️ FORBIDDEN: analysis of your role, "The user...", inventing facts.
⚠️ ONLY the format below.

Country: United States. Status: ${statusText}.

INCIDENT:
${incident}

DIALOG:
${history}

FORMAT (strict):

📊 Evaluation: [✅ / ⚠️ / ❌]

⚠️ Error: [1 sentence or "none"]

🎯 Model answer: «[correct phrasing]»

📚 Law: [exact references — U.S. only]

💬 Brief: [1-2 sentences]

ONLY THIS FORMAT.`;
}

function buildHintPrompt(lang, status, incident, history) {
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  const langName = lang === 'ES' ? 'Spanish' : 'English';

  return `⚠️ ONLY ${langName.toUpperCase()}. Maximum 2 sentences. NO full answer.

Country: United States. Status: ${statusText}.
INCIDENT: ${incident}
DIALOG: ${history}

FORMAT:
💡 Hint: [maximum 2 sentences in ${langName}]`;
}

function buildSummaryPrompt(lang, status, incident, history, stats) {
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  const langName = lang === 'ES' ? 'Spanish' : 'English';

  return `⚠️ ONLY ${langName.toUpperCase()}. ONLY U.S. law.

Analyze the training and give a summary.

Status: ${statusText}.
Stats: correct ${stats.correct}, warnings ${stats.warnings}, errors ${stats.errors}.

INCIDENT:
${incident}

DIALOG:
${history}

FORMAT (strict):

🎓 TRAINING SUMMARY

✅ Correct: ${stats.correct}
⚠️ Warnings: ${stats.warnings}
❌ Errors: ${stats.errors}

📊 Weaknesses:
• [point 1]
• [point 2]
• [point 3]

💡 Review:
• [topic 1]
• [topic 2]

🎯 Recommendation: [1-2 sentences]

ONLY THIS FORMAT.`;
}

// ============ SESSIONS ============
const sessions = new Map();

// ============ KEYBOARDS ============
function mainReplyKeyboard(lang) {
  const t = T[lang];
  return new Keyboard()
    .text(t.endBtn).text(t.hintBtn).row()
    .text(t.summaryBtn).text(t.changeStatusBtn).row()
    .resized().persistent();
}

function questionInlineKeyboard(lang) {
  const t = T[lang];
  return new InlineKeyboard()
    .text(t.hintBtn, 'hint').row()
    .text(t.lawsBtn, 'show_laws').row()
    .text(t.skipBtn, 'skip_question');
}

// ============ BOT ============
const bot = new Bot(BOT_TOKEN);
bot.catch((err) => console.error('Bot error:', err));

// ============ PROGRESS BAR ============
function progressBar(sess, lang) {
  const t = T[lang];
  return `${t.round} ${sess.round}*  ·  ✅ ${sess.correct}  ⚠️ ${sess.warnings}  ❌ ${sess.errors}`;
}

// ============ AI CALL ============
async function callAI(prompt, maxTokens, expectedLang, attempt = 1) {
  let text = '';
  try {
    const r = await ai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: maxTokens
    });
    text = r.choices[0].message.content || '';
  } catch (e) {
    const is429 = e.message && (e.message.includes('429') || e.message.includes('rate') || e.message.includes('quota'));
    if (is429 && attempt < 3) {
      const wait = attempt * 15;
      console.log(`⚠️ Rate limit (${attempt}/3). Retry in ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      return callAI(prompt, maxTokens, expectedLang, attempt + 1);
    }
    throw e;
  }

  const lang = detectLanguage(text);
  const langWrong = (expectedLang === 'EN' && lang === 'cyrillic') ||
                    (expectedLang === 'ES' && lang === 'cyrillic');
  if (langWrong) {
    console.warn(`⚠️ Language violation. Retrying...`);
    try {
      const retry = await ai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: text },
          { role: 'user', content: `WRONG! Only ${expectedLang === 'ES' ? 'Spanish' : 'English'}. Only U.S. law. Only the format.` }
        ],
        temperature: 0.2,
        max_tokens: maxTokens
      });
      text = retry.choices[0].message.content || text;
    } catch (e) {
      console.warn('Retry failed:', e.message);
    }
  }
  return text;
}

// ============ /start ============
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

// ============ LANGUAGE ============
bot.callbackQuery(/^lang:(EN|ES)$/, async (ctx) => {
  const lang = ctx.match[1];
  sessions.set(ctx.from.id, {
    lang, mode: null, status: null, incident: null, history: [],
    round: 0, correct: 0, warnings: 0, errors: 0,
    currentQuestion: null, lastLaws: []
  });
  await ctx.answerCallbackQuery();

  const t = T[lang];
  const kb = new InlineKeyboard()
    .text(t.beginner, 'mode:beginner').row()
    .text(t.exam, 'mode:exam');

  await ctx.reply(`${t.startTitle}\n\n${t.startSub}\n\n${t.chooseMode}`, {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
});

// ============ MODE ============
bot.callbackQuery(/^mode:(beginner|exam)$/, async (ctx) => {
  const mode = ctx.match[1];
  const sess = sessions.get(ctx.from.id);
  if (!sess) return ctx.answerCallbackQuery({ text: 'Send /start' });
  sess.mode = mode;
  await ctx.answerCallbackQuery();

  const lang = sess.lang;
  const t = T[lang];

  const kb = lang === 'ES'
    ? new InlineKeyboard()
        .text('👤 Testigo', 'st:witness').row()
        .text('🚨 Sospechoso', 'st:suspect').row()
        .text('⚖️ Acusado', 'st:defendant').row()
        .text('🛡️ Víctima', 'st:victim').row()
        .text('📋 Demandante', 'st:plaintiff').row()
        .text('📋 Demandado', 'st:respondent')
    : new InlineKeyboard()
        .text('👤 Witness', 'st:witness').row()
        .text('🚨 Suspect', 'st:suspect').row()
        .text('⚖️ Defendant', 'st:defendant').row()
        .text('🛡️ Victim', 'st:victim').row()
        .text('📋 Plaintiff', 'st:plaintiff').row()
        .text('📋 Respondent', 'st:respondent');

  await ctx.reply(t.chooseStatus, { parse_mode: 'Markdown', reply_markup: kb });
});

// ============ STATUS ============
bot.callbackQuery(/^st:(witness|suspect|defendant|victim|plaintiff|respondent)$/, async (ctx) => {
  const status = ctx.match[1];
  const sess = sessions.get(ctx.from.id);
  if (!sess) return ctx.answerCallbackQuery({ text: 'Send /start' });
  sess.status = status;
  await ctx.answerCallbackQuery();

  const lang = sess.lang;
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];

  await ctx.reply(T[lang].describe(statusText), { parse_mode: 'Markdown' });
});

// ============ /reset ============
bot.command('reset', async (ctx) => {
  sessions.delete(ctx.from.id);
  await ctx.reply('Session reset. / Sesión reiniciada.\n\nSend /start.');
});

// ============ /help ============
bot.command('help', async (ctx) => {
  const sess = sessions.get(ctx.from.id);
  const lang = sess?.lang || 'EN';
  const t = T[lang];
  await ctx.reply(`${t.helpTitle}\n\n${t.helpBody}`, { parse_mode: 'Markdown' });
});

// ============ Reply keyboard handlers ============
bot.hears(/^(🎓 End Training|🎓 Terminar)$/, async (ctx) => { await handleFinish(ctx); });
bot.hears(/^(💡 Hint|💡 Pista)$/, async (ctx) => { await handleHint(ctx); });
bot.hears(/^(📊 Summary|📊 Resumen)$/, async (ctx) => { await handleFinish(ctx); });
bot.hears(/^(🔄 Change Status|🔄 Cambiar estado)$/, async (ctx) => {
  const sess = sessions.get(ctx.from.id);
  if (!sess) return ctx.reply('Send /start');
  const lang = sess.lang;
  const kb = lang === 'ES'
    ? new InlineKeyboard()
        .text('👤 Testigo', 'st:witness').row()
        .text('🚨 Sospechoso', 'st:suspect').row()
        .text('⚖️ Acusado', 'st:defendant').row()
        .text('🛡️ Víctima', 'st:victim').row()
        .text('📋 Demandante', 'st:plaintiff').row()
        .text('📋 Demandado', 'st:respondent')
    : new InlineKeyboard()
        .text('👤 Witness', 'st:witness').row()
        .text('🚨 Suspect', 'st:suspect').row()
        .text('⚖️ Defendant', 'st:defendant').row()
        .text('🛡️ Victim', 'st:victim').row()
        .text('📋 Plaintiff', 'st:plaintiff').row()
        .text('📋 Respondent', 'st:respondent');
  await ctx.reply(T[lang].chooseStatus, { parse_mode: 'Markdown', reply_markup: kb });
});

// ============ INLINE handlers ============
bot.callbackQuery('hint', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleHint(ctx);
});

async function handleHint(ctx) {
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Send /start');
  const t = T[sess.lang];
  if (sess.mode === 'exam') return ctx.reply(t.hintDisabled);

  await ctx.replyWithChatAction('typing');
  try {
    const lastQ = sess.currentQuestion || '';
    const histText = sess.history.map(m => (m.role === 'user' ? '👤 ' : '🎭 ') + m.content).join('\n\n');
    const answer = await callAI(
      buildHintPrompt(sess.lang, sess.status, sess.incident, histText),
      300,
      sess.lang
    );
    await ctx.reply(answer, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await ctx.reply(t.hintError);
  }
}

bot.callbackQuery('show_laws', async (ctx) => {
  await ctx.answerCallbackQuery();
  const sess = sessions.get(ctx.from.id);
  if (!sess) return;
  const lang = sess.lang;
  const text = lang === 'ES'
    ? `📚 *Leyes de EE.UU.:*\n\n*4ª Enmienda* — protección contra registros irrazonables.\n\n*5ª Enmienda* — derecho a no autoincriminarse.\n\n*6ª Enmienda* — derecho a abogado.\n\n*Miranda v. Arizona (1966)* — advertencias antes del interrogatorio.\n\n*Gideon v. Wainwright (1963)* — derecho a abogado designado.\n\n*Escobedo v. Illinois (1964)* — derecho a abogado durante el interrogatorio.\n\n*Berghuis v. Thompkins (2010)* — invocación inequívoca del derecho a guardar silencio.`
    : `📚 *U.S. Law References:*\n\n*4th Amendment* — protection against unreasonable searches and seizures.\n\n*5th Amendment* — right against self-incrimination.\n\n*6th Amendment* — right to counsel.\n\n*Miranda v. Arizona (1966)* — required warnings before custodial interrogation.\n\n*Gideon v. Wainwright (1963)* — right to appointed counsel.\n\n*Escobedo v. Illinois (1964)* — right to counsel during interrogation.\n\n*Berghuis v. Thompkins (2010)* — must invoke right to remain silent unambiguously.`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.callbackQuery('skip_question', async (ctx) => {
  await ctx.answerCallbackQuery();
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Send /start');

  sess.round++;
  sess.errors++;
  sess.history.push({ role: 'user', content: T[sess.lang].skipped });

  await nextQuestion(ctx, sess);
});

// ============ /finish ============
bot.command('finish', async (ctx) => { await handleFinish(ctx); });

async function handleFinish(ctx) {
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply(T[sess?.lang || 'EN'].noSession);

  const lang = sess.lang;
  const t = T[lang];

  await ctx.replyWithChatAction('typing');
  try {
    const histText = sess.history.map(m => (m.role === 'user' ? '👤 ' : '🎭 ') + m.content).join('\n\n');
    const summary = await callAI(
      buildSummaryPrompt(lang, sess.status, sess.incident, histText, sess),
      1200,
      lang
    );
    await ctx.reply(summary, { parse_mode: 'Markdown' });
    await ctx.reply(t.newTraining);
    sessions.delete(ctx.from.id);
  } catch (e) {
    console.error(e);
    await ctx.reply(t.summaryError);
  }
}

// ============ NEXT QUESTION ============
async function nextQuestion(ctx, sess) {
  const lang = sess.lang;
  const t = T[lang];

  await ctx.replyWithChatAction('typing');
  try {
    const histText = sess.history.map(m => (m.role === 'user' ? '👤 ' : '🎭 ') + m.content).join('\n\n');
    const question = await callAI(
      buildQuestionPrompt(lang, sess.status, sess.incident, histText),
      500,
      lang
    );
    sess.currentQuestion = question;
    sess.history.push({ role: 'assistant', content: question });

    await ctx.reply(progressBar(sess, lang), { parse_mode: 'Markdown' });
    await ctx.reply(question, { parse_mode: 'Markdown', reply_markup: questionInlineKeyboard(lang) });
  } catch (e) {
    console.error('AI error:', e);
    await ctx.reply(t.aiError);
  }
}

// ============ MAIN ============
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  const userId = ctx.from.id;
  const sess = sessions.get(userId);
  if (!sess) return ctx.reply('Send /start');
  if (!sess.lang) return ctx.reply('Choose language: /start');
  if (!sess.mode) return ctx.reply('Choose mode: /start');
  if (!sess.status) return ctx.reply('Choose status.');

  const lang = sess.lang;
  const t = T[lang];

  // Skip reply keyboard labels (already handled by bot.hears)
  if ([t.endBtn, t.hintBtn, t.summaryBtn, t.changeStatusBtn].includes(text)) return;

  // ========== FIRST INCIDENT ==========
  if (!sess.incident) {
    sess.incident = text;
    sess.history = [{ role: 'user', content: 'Incident: ' + text }];
    sess.round = 1;

    await ctx.reply(t.preparingQ);

    try {
      await ctx.replyWithChatAction('typing');
      const question = await callAI(
        buildQuestionPrompt(lang, sess.status, sess.incident, 'Incident: ' + text),
        500,
        lang
      );
      sess.currentQuestion = question;
      sess.history.push({ role: 'assistant', content: question });

      await ctx.reply(t.trainerStarted, {
        parse_mode: 'Markdown',
        reply_markup: mainReplyKeyboard(lang)
      });

      await ctx.reply(progressBar(sess, lang), { parse_mode: 'Markdown' });
      await ctx.reply(question, { parse_mode: 'Markdown', reply_markup: questionInlineKeyboard(lang) });
    } catch (e) {
      console.error('AI error:', e);
      await ctx.reply(t.aiError);
    }
    return;
  }

  // ========== USER ANSWER ==========
  sess.history.push({ role: 'user', content: text });
  await ctx.reply(t.analyzing);

  try {
    await ctx.replyWithChatAction('typing');
    const histText = sess.history.map(m => (m.role === 'user' ? '👤 ' : '🎭 ') + m.content).join('\n\n');
    const evaluation = await callAI(
      buildEvaluationPrompt(lang, sess.status, sess.incident, histText),
      700,
      lang
    );

    // Stats
    if (evaluation.includes('📊 Evaluation: ✅') || evaluation.includes('📊 Evaluación: ✅')) sess.correct++;
    else if (evaluation.includes('📊 Evaluation: ⚠️') || evaluation.includes('📊 Evaluación: ⚠️')) sess.warnings++;
    else if (evaluation.includes('📊 Evaluation: ❌') || evaluation.includes('📊 Evaluación: ❌')) sess.errors++;
    sess.round++;

    await ctx.reply(evaluation, { parse_mode: 'Markdown' });
    await nextQuestion(ctx, sess);
  } catch (e) {
    console.error('AI error:', e);
    await ctx.reply(t.aiError);
  }
});

// ============ START WITH RETRY ============
let retryCount = 0;
const MAX_RETRIES = 10;

async function startBot() {
  try {
    await bot.start({
      drop_pending_updates: true,
      onStart: (botInfo) => {
        console.log(`🚀 Miranda Trainer v7 started as @${botInfo.username}`);
        retryCount = 0;
      }
    });
  } catch (e) {
    const is409 = e.message && e.message.includes('409');
    if (is409 && retryCount < MAX_RETRIES) {
      retryCount++;
      const wait = Math.min(30 * retryCount, 120);
      console.log(`⚠️ 409 (attempt ${retryCount}/${MAX_RETRIES}). Retry in ${wait}s...`);
      setTimeout(startBot, wait * 1000);
    } else {
      console.error('❌ Fatal:', e.message);
      process.exit(1);
    }
  }
}
startBot();

const httpApp = express();
httpApp.get('/', (req, res) => res.send('Miranda Trainer v7 running'));
const PORT = process.env.PORT || 3000;
httpApp.listen(PORT, () => console.log('HTTP server on port ' + PORT));
