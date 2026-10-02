// bot.js — Miranda Trainer v8 (US, EN/ES, rights + complaints + training)
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

// ============ SCENARIOS ============
const SCENARIOS = {
  theft: {
    emoji: '🏪',
    en: 'Convenience store robbery',
    es: 'Robo en tienda',
    textEn: 'I was stopped by police near a convenience store. They said I matched the description of someone who robbed it. They want to question me at the station.',
    textEs: 'La policía me detuvo cerca de una tienda. Dicen que coincido con la descripción de un ladrón. Quieren interrogarme en la comisaría.'
  },
  traffic: {
    emoji: '🚗',
    en: 'Traffic stop',
    es: 'Control de tráfico',
    textEn: 'I was pulled over during a traffic stop. The officer started asking questions about where I was coming from and what was in my car.',
    textEs: 'Me detuvieron en un control de tráfico. El oficial empezó a hacerme preguntas sobre de dónde venía y qué llevaba en el coche.'
  },
  fraud: {
    emoji: '💰',
    en: 'Fraud investigation',
    es: 'Investigación de fraude',
    textEn: 'Detectives came to my workplace asking about a coworker suspected of fraud. They want me to answer questions about his activities and my involvement.',
    textEs: 'Los detectives vinieron a mi trabajo preguntando por un compañero sospechoso de fraude. Quieren que responda sobre sus actividades y mi participación.'
  },
  search: {
    emoji: '🏠',
    en: 'Home search',
    es: 'Registro domiciliario',
    textEn: 'Police arrived at my home with a search warrant. While searching, they started asking me questions about items they found and about my neighbors.',
    textEs: 'La policía llegó a mi casa con una orden de registro. Mientras registraban, empezaron a preguntarme sobre objetos que encontraron y sobre mis vecinos.'
  },
  witness_other: {
    emoji: '🧑‍⚖️',
    en: 'Witness in a case',
    es: 'Testigo en un caso',
    textEn: 'I witnessed an assault outside a bar. Police want me to give a statement, and they are asking detailed questions about what I saw and who was involved.',
    textEs: 'Presencié una agresión fuera de un bar. La policía quiere mi declaración y me hace preguntas detalladas sobre lo que vi y quién estuvo involucrado.'
  },
  custom: {
    emoji: '📝',
    en: 'Custom incident',
    es: 'Incidente propio',
    textEn: null,
    textEs: null
  }
};

// ============ TRANSLATIONS ============
const T = {
  EN: {
    startTitle: '⚖️ *Miranda Trainer*',
    startSub: '⚠️ This is a training simulator, not legal advice.',
    chooseLang: 'Choose your language:',
    chooseMode: 'Choose mode:',
    beginner: '🎓 Beginner',
    exam: '📝 Exam',
    chooseStatus: '*Select your procedural status:*',
    chooseScenario: '*Choose a scenario* or describe your own:',
    describeCustom: (status) => `*${status}*\n\n*Describe your incident:*\n\n• What happened?\n• When?\n• Who was involved?\n• What did you do?\n\n⚠️ No personal data.`,
    startingTraining: '⏳ Starting training...',
    preparingQ: '⏳ Preparing first question...',
    trainerStarted: '⚖️ *Trainer started.*\n\nButtons below — quick actions.',
    analyzing: '⏳ Analyzing response...',
    round: '📊 *Round',
    endBtn: '🎓 End Training',
    hintBtn: '💡 Hint',
    rightsBtn: '🛡️ My Rights',
    summaryBtn: '📊 Summary',
    changeStatusBtn: '🔄 Change Status',
    skipBtn: '⏭️ Skip',
    meaningBtn: '🤔 What did he mean?',
    lawsBtn: '📚 Laws',
    compareBtn: '📊 Compare with standard',
    hintDisabled: '💡 Hints are disabled in exam mode.',
    noSession: 'No active session. Send /start.',
    aiError: '⚠️ AI temporarily unavailable. Please try again in 30 seconds.',
    hintError: '⚠️ Hint error. Please try again.',
    summaryError: '⚠️ Summary error. Try /finish again.',
    skipped: '[Skipped question]',
    newTraining: 'Send /start for a new training.',
    continueTraining: 'Continue training. Answer the investigator or use another right.',
    rightsMenu: '🛡️ *Choose a procedural action:*',
    complaintsMenu: '📞 *Complaints and documentation:*',
    backBtn: '← Back',
    showLawsTitle: '📚 *Relevant laws:*',
    helpTitle: '⚖️ *Miranda Trainer — Help*',
    helpBody: '• /start — begin\n• /reset — reset\n• /finish — final summary\n• /help — this help\n\n📚 Uses U.S. Constitution + Miranda v. Arizona, Gideon v. Wainwright.'
  },
  ES: {
    startTitle: '⚖️ *Miranda Trainer*',
    startSub: '⚠️ Este es un simulador de entrenamiento, no asesoría legal.',
    chooseLang: 'Elija su idioma:',
    chooseMode: 'Elija el modo:',
    beginner: '🎓 Principiante',
    exam: '📝 Examen',
    chooseStatus: '*Seleccione su estado procesal:*',
    chooseScenario: '*Elija un escenario* o describa el suyo:',
    describeCustom: (status) => `*${status}*\n\n*Describa su incidente:*\n\n• ¿Qué pasó?\n• ¿Cuándo?\n• ¿Quién participó?\n• ¿Qué hizo usted?\n\n⚠️ Sin datos personales.`,
    startingTraining: '⏳ Iniciando entrenamiento...',
    preparingQ: '⏳ Preparando primera pregunta...',
    trainerStarted: '⚖️ *Entrenador iniciado.*\n\nBotones abajo — acciones rápidas.',
    analyzing: '⏳ Analizando respuesta...',
    round: '📊 *Ronda',
    endBtn: '🎓 Terminar',
    hintBtn: '💡 Pista',
    rightsBtn: '🛡️ Mis Derechos',
    summaryBtn: '📊 Resumen',
    changeStatusBtn: '🔄 Cambiar Estado',
    skipBtn: '⏭️ Saltar',
    meaningBtn: '🤔 ¿Qué quiso decir?',
    lawsBtn: '📚 Leyes',
    compareBtn: '📊 Comparar con modelo',
    hintDisabled: '💡 Las pistas están desactivadas en modo examen.',
    noSession: 'Sin sesión activa. Envíe /start.',
    aiError: '⚠️ IA no disponible. Intente en 30 segundos.',
    hintError: '⚠️ Error de pista. Intente de nuevo.',
    summaryError: '⚠️ Error de resumen. Intente /finish de nuevo.',
    skipped: '[Pregunta saltada]',
    newTraining: 'Envíe /start para un nuevo entrenamiento.',
    continueTraining: 'Continúe el entrenamiento. Responda al investigador o use otro derecho.',
    rightsMenu: '🛡️ *Elija una acción procesal:*',
    complaintsMenu: '📞 *Quejas y documentación:*',
    backBtn: '← Atrás',
    showLawsTitle: '📚 *Leyes relevantes:*',
    helpTitle: '⚖️ *Miranda Trainer — Ayuda*',
    helpBody: '• /start — comenzar\n• /reset — reiniciar\n• /finish — resumen final\n• /help — ayuda\n\n📚 Usa la Constitución de EE.UU. + Miranda v. Arizona, Gideon v. Wainwright.'
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
  return `⚠️ STRICT: Answer ONLY in ${langName}.
⚠️ STRICT: ONLY U.S. law (Constitution, Miranda v. Arizona, Gideon v. Wainwright, Escobedo v. Illinois).
⚠️ FORBIDDEN: other languages, other countries.
⚠️ ONE question. NO analysis.

Country: United States. Status: ${statusText}.

INCIDENT:
${incident}

DIALOG:
${history}

FORMAT:
🎭 Investigator: [one question in ${langName}]`;
}

function buildEvaluationPrompt(lang, status, incident, history) {
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  const langName = lang === 'ES' ? 'Spanish' : 'English';
  return `⚠️ STRICT: ONLY ${langName.toUpperCase()}.
⚠️ STRICT: ONLY U.S. law.
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

📚 Law: [exact U.S. references]

💬 Brief: [1-2 sentences]

ONLY THIS FORMAT.`;
}

function buildHintPrompt(lang, status, incident, history) {
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  const langName = lang === 'ES' ? 'Spanish' : 'English';
  return `⚠️ ONLY ${langName.toUpperCase()}. Max 2 sentences. NO full answer.

Country: United States. Status: ${statusText}.
INCIDENT: ${incident}
DIALOG: ${history}

FORMAT:
💡 Hint: [max 2 sentences in ${langName}]`;
}

function buildMeaningPrompt(lang, question, incident) {
  const langName = lang === 'ES' ? 'Spanish' : 'English';
  return `⚠️ ONLY ${langName.toUpperCase()}. Explain what the investigator really meant. What's the trap?

INVESTIGATOR'S QUESTION: "${question}"
INCIDENT: ${incident}

FORMAT:
🤔 What the investigator meant:
• 🎯 Purpose: [1 sentence]
• ⚠️ Risk: [1 sentence]
• 🛡️ How to respond: [1-2 sentences]

ONLY THIS FORMAT.`;
}

function buildActionPrompt(lang, action, status, incident, question) {
  const langName = lang === 'ES' ? 'Spanish' : 'English';
  const actions = {
    silence: lang === 'ES' ? 'derecho a guardar silencio (5ª Enmienda)' : 'right to remain silent (5th Amendment)',
    lawyer: lang === 'ES' ? 'derecho a abogado (6ª Enmienda, Gideon v. Wainwright)' : 'right to counsel (6th Amendment, Gideon v. Wainwright)',
    miranda: lang === 'ES' ? 'invocar derechos Miranda' : 'invoke Miranda rights',
    break: lang === 'ES' ? 'solicitar una pausa' : 'request a break',
    document: lang === 'ES' ? 'documentar todo' : 'document everything',
    translator: lang === 'ES' ? 'solicitar intérprete' : 'request an interpreter',
    pressure: lang === 'ES' ? 'reportar coerción' : 'report coercion',
    clarify: lang === 'ES' ? 'pedir aclaración' : 'ask for clarification'
  };
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  return `⚠️ ONLY ${langName.toUpperCase()}. Give the user the exact phrasing.

Situation: user wants to use ${actions[action]}.
Status: ${statusText}.
Current investigator's question: "${question || '(none)'}"
INCIDENT: ${incident}

FORMAT:
🛡️ *${actions[action]}*

📝 Phrasing:
«[exact phrase to say]»

⚖️ Legal basis: [reference]

💡 Tip: [1 sentence]

ONLY THIS FORMAT.`;
}

function buildComplaintPrompt(lang, type, status, incident) {
  const langName = lang === 'ES' ? 'Spanish' : 'English';
  const types = {
    supervisor: lang === 'ES' ? 'queja ante el supervisor' : 'complaint to supervisor',
    prosecutor: lang === 'ES' ? 'queja ante el fiscal' : 'complaint to prosecutor',
    civil: lang === 'ES' ? 'queja de derechos civiles (ACLU/DOJ)' : 'civil rights complaint (ACLU/DOJ)',
    document: lang === 'ES' ? 'documentar la violación' : 'document the violation'
  };
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  return `⚠️ ONLY ${langName.toUpperCase()}. Give the user instructions for: ${types[type]}.

Status: ${statusText}.
INCIDENT: ${incident}

FORMAT:
📞 *${types[type]}*

📝 What/where:
[1-2 sentences]

🎯 How:
1. [step 1]
2. [step 2]
3. [step 3]

⚖️ Legal basis: [reference]

ONLY THIS FORMAT.`;
}

function buildSummaryPrompt(lang, status, incident, history, stats) {
  const statusText = STATUS[status][lang.toLowerCase() === 'es' ? 'es' : 'en'];
  const langName = lang === 'ES' ? 'Spanish' : 'English';
  return `⚠️ ONLY ${langName.toUpperCase()}. ONLY U.S. law.

Analyze the training.

Status: ${statusText}.
Stats: ✅ ${stats.correct}, ⚠️ ${stats.warnings}, ❌ ${stats.errors}.
Actions used: ${stats.actionsUsed || 0}.

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
    .text(t.rightsBtn).text(t.summaryBtn).row()
    .text(t.changeStatusBtn).resized().persistent();
}

function questionInlineKeyboard(lang) {
  const t = T[lang];
  return new InlineKeyboard()
    .text(t.hintBtn, 'hint').row()
    .text(t.meaningBtn, 'meaning').row()
    .text(t.rightsBtn, 'rights_menu').row()
    .text(t.skipBtn, 'skip_question');
}

function rightsInlineKeyboard(lang) {
  const t = T[lang];
  const labels = lang === 'ES' ? {
    silence: '🛡️ Guardar silencio',
    lawyer: '👨‍⚖️ Pedir abogado',
    miranda: '📢 Invocar Miranda',
    break: '⏸️ Pedir pausa',
    document: '📝 Documentar todo',
    translator: '🌐 Pedir intérprete',
    pressure: '⚠️ Reportar coerción',
    clarify: '🔍 Pedir aclaración',
    complaints: '📞 Quejas y documentación'
  } : {
    silence: '🛡️ Remain silent',
    lawyer: '👨‍⚖️ Request attorney',
    miranda: '📢 Invoke Miranda',
    break: '⏸️ Request a break',
    document: '📝 Document everything',
    translator: '🌐 Request interpreter',
    pressure: '⚠️ Report coercion',
    clarify: '🔍 Ask for clarification',
    complaints: '📞 Complaints'
  };
  return new InlineKeyboard()
    .text(labels.silence, 'act:silence').row()
    .text(labels.lawyer, 'act:lawyer').row()
    .text(labels.miranda, 'act:miranda').row()
    .text(labels.break, 'act:break').row()
    .text(labels.document, 'act:document').row()
    .text(labels.translator, 'act:translator').row()
    .text(labels.pressure, 'act:pressure').row()
    .text(labels.clarify, 'act:clarify').row()
    .text(labels.complaints, 'complaint_menu');
}

function complaintsInlineKeyboard(lang) {
  const t = T[lang];
  const labels = lang === 'ES' ? {
    supervisor: '📞 Al supervisor',
    prosecutor: '📞 Al fiscal',
    civil: '📧 Queja de derechos civiles',
    document: '📸 Documentar violación',
    back: '← Atrás'
  } : {
    supervisor: '📞 To supervisor',
    prosecutor: '📞 To prosecutor',
    civil: '📧 Civil rights complaint',
    document: '📸 Document violation',
    back: '← Back'
  };
  return new InlineKeyboard()
    .text(labels.supervisor, 'comp:supervisor').row()
    .text(labels.prosecutor, 'comp:prosecutor').row()
    .text(labels.civil, 'comp:civil').row()
    .text(labels.document, 'comp:document').row()
    .text(labels.back, 'rights_menu');
}

function afterEvalInlineKeyboard(lang) {
  const t = T[lang];
  return new InlineKeyboard()
    .text(t.compareBtn, 'compare_with_standard').row()
    .text(t.lawsBtn, 'show_laws');
}

// ============ PROGRESS ============
function progressBar(sess, lang) {
  const t = T[lang];
  return `${t.round} ${sess.round}*  ·  ✅ ${sess.correct}  ⚠️ ${sess.warnings}  ❌ ${sess.errors}`;
}

// ============ BOT ============
const bot = new Bot(BOT_TOKEN);
bot.catch((err) => console.error('Bot error:', err));

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
      console.log(`⚠️ Rate limit. Retry in ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      return callAI(prompt, maxTokens, expectedLang, attempt + 1);
    }
    throw e;
  }
  const langWrong = detectLanguage(text) === 'cyrillic';
  if (langWrong) {
    console.warn('⚠️ Language violation. Retrying...');
    try {
      const retry = await ai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: text },
          { role: 'user', content: `WRONG! Only ${expectedLang === 'ES' ? 'Spanish' : 'English'}. Only U.S. law. Only the format.` }
        ],
        temperature: 0.2, max_tokens: maxTokens
      });
      text = retry.choices[0].message.content || text;
    } catch (e) { console.warn('Retry failed:', e.message); }
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
    round: 0, correct: 0, warnings: 0, errors: 0, actionsUsed: 0,
    currentQuestion: null, lastEvaluation: null, lastUserAnswer: null, lastLaws: []
  });
  await ctx.answerCallbackQuery();

  const t = T[lang];
  const kb = new InlineKeyboard()
    .text(t.beginner, 'mode:beginner').row()
    .text(t.exam, 'mode:exam');

  await ctx.reply(`${t.startTitle}\n\n${t.startSub}\n\n${t.chooseMode}`, {
    parse_mode: 'Markdown', reply_markup: kb
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
  const t = T[lang];
  const kb = new InlineKeyboard()
    .text('🏪 ' + SCENARIOS.theft[lang === 'ES' ? 'es' : 'en'], 'sc:theft').row()
    .text('🚗 ' + SCENARIOS.traffic[lang === 'ES' ? 'es' : 'en'], 'sc:traffic').row()
    .text('💰 ' + SCENARIOS.fraud[lang === 'ES' ? 'es' : 'en'], 'sc:fraud').row()
    .text('🏠 ' + SCENARIOS.search[lang === 'ES' ? 'es' : 'en'], 'sc:search').row()
    .text('🧑‍⚖️ ' + SCENARIOS.witness_other[lang === 'ES' ? 'es' : 'en'], 'sc:witness_other').row()
    .text('📝 ' + SCENARIOS.custom[lang === 'ES' ? 'es' : 'en'], 'sc:custom');

  await ctx.reply(t.chooseScenario, { parse_mode: 'Markdown', reply_markup: kb });
});

// ============ SCENARIO ============
bot.callbackQuery(/^sc:(theft|traffic|fraud|search|witness_other|custom)$/, async (ctx) => {
  const key = ctx.match[1];
  const sess = sessions.get(ctx.from.id);
  if (!sess) return ctx.answerCallbackQuery({ text: 'Send /start' });
  await ctx.answerCallbackQuery();

  const lang = sess.lang;
  const t = T[lang];
  const statusText = STATUS[sess.status][lang === 'ES' ? 'es' : 'en'];

  if (key === 'custom') {
    await ctx.reply(t.describeCustom(statusText), { parse_mode: 'Markdown' });
    return;
  }

  const scenario = SCENARIOS[key];
  const text = lang === 'ES' ? scenario.textEs : scenario.textEn;
  await ctx.reply(`${scenario.emoji} *${scenario[lang === 'ES' ? 'es' : 'en']}*\n\n${text}\n\n${t.startingTraining}`, { parse_mode: 'Markdown' });
  await startTraining(ctx, sess, text);
});

// ============ START TRAINING ============
async function startTraining(ctx, sess, incidentText) {
  const lang = sess.lang;
  const t = T[lang];

  sess.incident = incidentText;
  sess.history = [{ role: 'user', content: 'Incident: ' + incidentText }];
  sess.round = 1;

  try {
    await ctx.replyWithChatAction('typing');
    const question = await callAI(
      buildQuestionPrompt(lang, sess.status, sess.incident, 'Incident: ' + incidentText),
      500,
      lang
    );
    sess.currentQuestion = question;
    sess.history.push({ role: 'assistant', content: question });

    await ctx.reply(t.trainerStarted, {
      parse_mode: 'Markdown', reply_markup: mainReplyKeyboard(lang)
    });
    await ctx.reply(progressBar(sess, lang), { parse_mode: 'Markdown' });
    await ctx.reply(question, { parse_mode: 'Markdown', reply_markup: questionInlineKeyboard(lang) });
  } catch (e) {
    console.error('AI error:', e);
    await ctx.reply(t.aiError);
  }
}

// ============ Reply keyboard ============
bot.hears(/^(🎓 End Training|🎓 Terminar)$/, async (ctx) => { await handleFinish(ctx); });
bot.hears(/^(💡 Hint|💡 Pista)$/, async (ctx) => { await handleHint(ctx); });
bot.hears(/^(📊 Summary|📊 Resumen)$/, async (ctx) => { await handleFinish(ctx); });
bot.hears(/^(🛡️ My Rights|🛡️ Mis Derechos)$/, async (ctx) => {
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Send /start');
  const t = T[sess.lang];
  await ctx.reply(t.rightsMenu, { parse_mode: 'Markdown', reply_markup: rightsInlineKeyboard(sess.lang) });
});
bot.hears(/^(🔄 Change Status|🔄 Cambiar Estado)$/, async (ctx) => {
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
    const hist = sess.history.map(m => (m.role === 'user' ? '👤 ' : '🎭 ') + m.content).join('\n\n');
    const answer = await callAI(buildHintPrompt(sess.lang, sess.status, sess.incident, hist), 300, sess.lang);
    await ctx.reply(answer, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await ctx.reply(t.hintError);
  }
}

bot.callbackQuery('meaning', async (ctx) => {
  await ctx.answerCallbackQuery();
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.currentQuestion) return ctx.reply('Send /start');
  await ctx.replyWithChatAction('typing');
  try {
    const answer = await callAI(buildMeaningPrompt(sess.lang, sess.currentQuestion, sess.incident), 500, sess.lang);
    await ctx.reply(answer, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await ctx.reply('⚠️ Error. Try again.');
  }
});

bot.callbackQuery('rights_menu', async (ctx) => {
  await ctx.answerCallbackQuery();
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Send /start');
  await ctx.reply(T[sess.lang].rightsMenu, { parse_mode: 'Markdown', reply_markup: rightsInlineKeyboard(sess.lang) });
});

// ============ ACTION ============
bot.callbackQuery(/^act:(silence|lawyer|miranda|break|document|translator|pressure|clarify)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const action = ctx.match[1];
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Send /start');

  sess.actionsUsed = (sess.actionsUsed || 0) + 1;

  await ctx.replyWithChatAction('typing');
  try {
    const answer = await callAI(
      buildActionPrompt(sess.lang, action, sess.status, sess.incident, sess.currentQuestion),
      500,
      sess.lang
    );
    await ctx.reply(answer, { parse_mode: 'Markdown' });
    await ctx.reply(T[sess.lang].continueTraining);
  } catch (e) {
    console.error(e);
    await ctx.reply('⚠️ Error. Try again.');
  }
});

// ============ COMPLAINTS ============
bot.callbackQuery('complaint_menu', async (ctx) => {
  await ctx.answerCallbackQuery();
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Send /start');
  await ctx.reply(T[sess.lang].complaintsMenu, { parse_mode: 'Markdown', reply_markup: complaintsInlineKeyboard(sess.lang) });
});

bot.callbackQuery(/^comp:(supervisor|prosecutor|civil|document)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const type = ctx.match[1];
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Send /start');

  await ctx.replyWithChatAction('typing');
  try {
    const answer = await callAI(buildComplaintPrompt(sess.lang, type, sess.status, sess.incident), 500, sess.lang);
    await ctx.reply(answer, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await ctx.reply('⚠️ Error. Try again.');
  }
});

// ============ SHOW LAWS ============
bot.callbackQuery('show_laws', async (ctx) => {
  await ctx.answerCallbackQuery();
  const sess = sessions.get(ctx.from.id);
  if (!sess) return;
  const lang = sess.lang;
  const text = lang === 'ES'
    ? `📚 *Leyes de EE.UU.:*\n\n*4ª Enmienda* — protección contra registros irrazonables.\n\n*5ª Enmienda* — derecho a no autoincriminarse.\n\n*6ª Enmienda* — derecho a abogado.\n\n*Miranda v. Arizona (1966)* — advertencias antes del interrogatorio.\n\n*Gideon v. Wainwright (1963)* — derecho a abogado designado.\n\n*Escobedo v. Illinois (1964)* — derecho a abogado durante el interrogatorio.\n\n*Berghuis v. Thompkins (2010)* — invocación inequívoca.`
    : `📚 *U.S. Law References:*\n\n*4th Amendment* — protection against unreasonable searches and seizures.\n\n*5th Amendment* — right against self-incrimination.\n\n*6th Amendment* — right to counsel.\n\n*Miranda v. Arizona (1966)* — required warnings before custodial interrogation.\n\n*Gideon v. Wainwright (1963)* — right to appointed counsel.\n\n*Escobedo v. Illinois (1964)* — right to counsel during interrogation.\n\n*Berghuis v. Thompkins (2010)* — must invoke right to remain silent unambiguously.`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// ============ COMPARE ============
bot.callbackQuery('compare_with_standard', async (ctx) => {
  await ctx.answerCallbackQuery();
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.lastEvaluation || !sess.lastUserAnswer) {
    return ctx.reply(sess?.lang === 'ES' ? '📊 Nada que comparar aún.' : '📊 Nothing to compare yet.');
  }
  const lang = sess.lang;
  const match = sess.lastEvaluation.match(/🎯 (?:Model answer|Etalon|Эталон): «(.+?)»/s);
  const standard = match ? match[1] : '(not found)';

  const text = lang === 'ES'
    ? `📊 *Comparación con modelo*\n\n👤 *Tu respuesta:*\n«${sess.lastUserAnswer}»\n\n🎯 *Modelo:*\n«${standard}»\n\n💡 Presta atención a:\n• Precisión\n• Referencia legal\n• Brevedad\n\nIntenta usar la estructura del modelo.`
    : `📊 *Compare with standard*\n\n👤 *Your answer:*\n«${sess.lastUserAnswer}»\n\n🎯 *Standard:*\n«${standard}»\n\n💡 Pay attention to:\n• Precision\n• Legal reference\n• Brevity\n\nTry to use the standard's structure.`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// ============ SKIP ============
bot.callbackQuery('skip_question', async (ctx) => {
  await ctx.answerCallbackQuery();
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply('Send /start');
  sess.round++;
  sess.errors++;
  sess.history.push({ role: 'user', content: T[sess.lang].skipped });
  await nextQuestion(ctx, sess);
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

// ============ /finish ============
bot.command('finish', async (ctx) => { await handleFinish(ctx); });
async function handleFinish(ctx) {
  const sess = sessions.get(ctx.from.id);
  if (!sess || !sess.incident) return ctx.reply(T[sess?.lang || 'EN'].noSession);
  const lang = sess.lang;
  const t = T[lang];

  await ctx.replyWithChatAction('typing');
  try {
    const hist = sess.history.map(m => (m.role === 'user' ? '👤 ' : '🎭 ') + m.content).join('\n\n');
    const summary = await callAI(buildSummaryPrompt(lang, sess.status, sess.incident, hist, sess), 1200, lang);
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
    const hist = sess.history.map(m => (m.role === 'user' ? '👤 ' : '🎭 ') + m.content).join('\n\n');
    const question = await callAI(buildQuestionPrompt(lang, sess.status, sess.incident, hist), 500, lang);
    sess.currentQuestion = question;
    sess.history.push({ role: 'assistant', content: question });

    await ctx.reply(progressBar(sess, lang), { parse_mode: 'Markdown' });
    await ctx.reply(question, { parse_mode: 'Markdown', reply_markup: questionInlineKeyboard(lang) });
  } catch (e) {
    console.error(e);
    await ctx.reply(t.aiError);
  }
}

// ============ MAIN TEXT ============
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

  const labels = [t.endBtn, t.hintBtn, t.rightsBtn, t.summaryBtn, t.changeStatusBtn];
  if (labels.includes(text)) return;

  if (!sess.incident) {
    await startTraining(ctx, sess, text);
    return;
  }

  sess.history.push({ role: 'user', content: text });
  sess.lastUserAnswer = text;
  await ctx.reply(t.analyzing);

  try {
    await ctx.replyWithChatAction('typing');
    const hist = sess.history.map(m => (m.role === 'user' ? '👤 ' : '🎭 ') + m.content).join('\n\n');
    const evaluation = await callAI(buildEvaluationPrompt(lang, sess.status, sess.incident, hist), 700, lang);
    sess.lastEvaluation = evaluation;

    if (evaluation.includes('📊 Evaluation: ✅') || evaluation.includes('📊 Evaluación: ✅')) sess.correct++;
    else if (evaluation.includes('📊 Evaluation: ⚠️') || evaluation.includes('📊 Evaluación: ⚠️')) sess.warnings++;
    else if (evaluation.includes('📊 Evaluation: ❌') || evaluation.includes('📊 Evaluación: ❌')) sess.errors++;
    sess.round++;

    await ctx.reply(evaluation, { parse_mode: 'Markdown', reply_markup: afterEvalInlineKeyboard(lang) });
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
      onStart: (bi) => {
        console.log(`🚀 Miranda Trainer v8 started as @${bi.username}`);
        retryCount = 0;
      }
    });
  } catch (e) {
    const is409 = e.message && e.message.includes('409');
    if (is409 && retryCount < MAX_RETRIES) {
      retryCount++;
      const wait = Math.min(30 * retryCount, 120);
      console.log(`⚠️ 409 (${retryCount}/${MAX_RETRIES}). Retry in ${wait}s...`);
      setTimeout(startBot, wait * 1000);
    } else {
      console.error('❌ Fatal:', e.message);
      process.exit(1);
    }
  }
}
startBot();

const httpApp = express();
httpApp.get('/', (req, res) => res.send('Miranda Trainer v8 running'));
const PORT = process.env.PORT || 3000;
httpApp.listen(PORT, () => console.log('HTTP server on port ' + PORT));
