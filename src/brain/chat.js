import OpenAI from "openai";
import { config } from "../config.js";
import { getFootballContext } from "../football/sofascore.js";
import { logger } from "../logger.js";
import { memory } from "../memory/repository.js";
import {
  buildPickStickerTool,
  needsTextAnswer,
  pickStickerForContext,
  preferStickerOnly,
  shouldAttachSticker,
} from "../stickers/registry.js";
import { formatBotMessage } from "./format.js";
import {
  buildSystemPrompt,
  detectInsult,
  extractClubMention,
  extractSelectionMention,
  formatConversationHistory,
  getRecentBotReplies,
  pickHeavyProfanityMode,
  pickResponseVibe,
} from "./personality.js";

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const LEARN_FACTS_TOOL = {
  type: "function",
  function: {
    name: "save_facts",
    description: "Salva fatos aprendidos sobre usuários ou o grupo para memória futura",
    parameters: {
      type: "object",
      properties: {
        facts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entity_type: { type: "string", enum: ["user", "group"] },
              fact: { type: "string" },
              favorite_club: { type: "string", description: "Clube que a pessoa torce (ex: Flamengo)" },
              favorite_selection: { type: "string", description: "Seleção que a pessoa torce (ex: Brasil)" },
              favorite_team: { type: "string", description: "Alias de favorite_club" },
              rival_team: { type: "string", description: "Clube rival/que a pessoa odeia" },
              personality: { type: "string", description: "Traço de personalidade observado" },
              group_vibe: { type: "string", description: "Vibe/padrão do grupo" },
            },
            required: ["entity_type", "fact"],
          },
        },
      },
      required: ["facts"],
    },
  },
};

function buildTools() {
  const tools = [LEARN_FACTS_TOOL];
  const stickerTool = buildPickStickerTool();
  if (stickerTool) tools.push(stickerTool);
  return tools;
}

const FALLBACK_REPLIES = {
  invite: [
    (name) => `${name}? Cheguei. Trouxe ironia e paciência negativa.`,
    (name) => `Opa ${name}, tava no VAR da sua conversa. Pode falar.`,
    (name) => `${name} me chamou? Que honra inesperada. Manda.`,
    (name) => `Apareci ${name}. Se for falar do seu time, já aviso: vai ser constrangedor.`,
  ],
  default: [
    (name) => `${name}, fala. Hoje tô inspirado pra zoar com classe.`,
    (name) => `Oi ${name}. Qual é a zueira agora?`,
    (name) => `${name}, manda. Tô com tempo e sarcasmo de sobra.`,
    (name) => `E aí ${name}, time perdendo ou veio pedir conselho?`,
    (name) => `${name}, chegou. O grupo tava sério demais, bora zoar.`,
  ],
};

const HEAVY_FALLBACK_REPLIES = {
  invite: [
    (name) => `${name}? Cheguei. Trouxe zueira e vontade de te foder no argumento.`,
    (name) => `${name} me chamou? Tô aqui, arrombado. Sem filtro e sem paciência.`,
  ],
  default: [
    (name) => `${name}, fala caralho. Hoje tô inspirado pra zoar.`,
    (name) => `${name}, manda. Tô com tempo e maldade, FDP.`,
    (name) => `E aí ${name}, veio tomar no cu de graça?`,
  ],
};

function pickFallbackReply(userName, message, heavyProfanityMode = false) {
  const name = userName?.split(" ")[0] ?? "mano";
  const sets = heavyProfanityMode ? HEAVY_FALLBACK_REPLIES : FALLBACK_REPLIES;
  const pool = /cola|vem|chama|bora/i.test(message) ? sets.invite : sets.default;
  return pool[Math.floor(Math.random() * pool.length)](name);
}

function buildCompletionOptions({ tools = true } = {}) {
  const model = config.openai.model;
  const isGpt5 = /^gpt-5/.test(model);
  const isChatLatest = model.includes("chat-latest");
  const toolList = tools ? buildTools() : undefined;

  const options = {
    model,
    ...(toolList?.length ? { tools: toolList, tool_choice: "auto" } : {}),
    ...(isGpt5 ? { max_completion_tokens: 300 } : { max_tokens: 300 }),
  };

  if (!isChatLatest) {
    options.temperature = config.openaiGeneration.temperature;
    options.frequency_penalty = config.openaiGeneration.frequencyPenalty;
    options.presence_penalty = config.openaiGeneration.presencePenalty;
  }

  return options;
}

async function callOpenAI(messages, { tools = true } = {}) {
  return openai.chat.completions.create({
    messages,
    ...buildCompletionOptions({ tools }),
  });
}

function buildUserMessage(text, image) {
  if (!image?.dataUrl) {
    return { role: "user", content: text };
  }

  return {
    role: "user",
    content: [
      { type: "text", text },
      {
        type: "image_url",
        image_url: { url: image.dataUrl, detail: "low" },
      },
    ],
  };
}

function processToolCalls(toolCalls, { groupJid, userJid }) {
  const learnedFacts = [];
  let stickerId = null;
  let stickerOnly = false;

  for (const toolCall of toolCalls ?? []) {
    if (toolCall.type !== "function") continue;

    try {
      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === "save_facts") {
        for (const item of args.facts ?? []) {
          const entityJid = item.entity_type === "user" ? userJid : groupJid;
          memory.addFact(item.entity_type, entityJid, item.fact);

          if (item.entity_type === "user") {
            const club = item.favorite_club ?? item.favorite_team;
            if (club) memory.updateUserClub(userJid, club);
            if (item.favorite_selection) memory.updateUserSelection(userJid, item.favorite_selection);
            if (item.rival_team) memory.updateUserTeam(userJid, item.rival_team, true);
            if (item.personality) memory.updateUserPersonality(userJid, item.personality);
          } else if (item.group_vibe) {
            memory.updateGroupVibe(groupJid, item.group_vibe);
          }

          learnedFacts.push(item.fact);
        }
      }

      if (toolCall.function.name === "pick_sticker" && args.sticker_id) {
        stickerId = args.sticker_id;
        if (args.send_text === false) stickerOnly = true;
      }
    } catch (error) {
      logger.warn({ error, tool: toolCall.function?.name }, "Falha ao processar tool call");
    }
  }

  return { learnedFacts, stickerId, stickerOnly };
}

async function finalizeReply(messages, {
  groupJid,
  userJid,
  mustRespond,
  userName,
  message,
  insultDetected = false,
  hasImage = false,
  heavyProfanityMode = false,
}) {
  let reply = null;
  let stickerId = null;
  let stickerFromAi = false;
  let learnedFacts = [];

  const completion = await callOpenAI(messages);
  const choice = completion.choices[0];

  if (choice.message.tool_calls?.length) {
    const processed = processToolCalls(choice.message.tool_calls, { groupJid, userJid });
    learnedFacts = processed.learnedFacts;
    stickerId = processed.stickerId;
    stickerFromAi = Boolean(stickerId);
    const stickerOnly = processed.stickerOnly && !needsTextAnswer(message);

    if (!(stickerId && stickerOnly)) {
      const followUp = await callOpenAI(
        [
          ...messages,
          choice.message,
          ...choice.message.tool_calls.map((tc) => ({
            role: "tool",
            tool_call_id: tc.id,
            content:
              tc.function.name === "pick_sticker"
                ? stickerOnly
                  ? "Figurinha registrada. Sem texto."
                : "Figurinha registrada."
                : "Fatos salvos.",
          })),
        ],
        { tools: false }
      );

      reply = sanitizeReply(followUp.choices[0]?.message?.content?.trim() ?? null, mustRespond);
    }
  } else {
    reply = sanitizeReply(choice.message.content?.trim() ?? null, mustRespond);
  }

  if (!reply && mustRespond && (!stickerId || needsTextAnswer(message))) {
    const retry = await callOpenAI(
      [
        ...messages,
        {
          role: "user",
          content: needsTextAnswer(message)
            ? heavyProfanityMode
              ? "Te fizeram uma pergunta direta. Responda em TEXTO com zueira e opinião. 2-4 frases, pode usar palavrão pesado. Proibido [SKIP] e proibido responder só com figurinha."
              : "Te fizeram uma pergunta direta. Responda em TEXTO com sarcasmo e opinião. 2-4 frases, ironia e deboche — SEM palavrão pesado. Proibido [SKIP] e proibido responder só com figurinha."
            : heavyProfanityMode
              ? "Responda agora com zueira OFENSIVA e ORIGINAL em 1-2 frases. Pode usar palavrão pesado. Tom diferente das anteriores. Proibido [SKIP] e clichês."
              : "Responda agora com sarcasmo afiado e zueira inteligente em 1-2 frases. SEM palavrão pesado — use ironia, deboche e comparação absurda. Proibido [SKIP] e clichês.",
        },
      ],
      { tools: false }
    );
    reply = sanitizeReply(retry.choices[0]?.message?.content?.trim() ?? null, true);
  }

  if (!reply && mustRespond && !stickerId) {
    reply = pickFallbackReply(userName, message, heavyProfanityMode);
    logger.warn({ message }, "Usando resposta fallback após menção direta");
  }

  if (!stickerId && reply) {
    stickerId = pickStickerForContext({
      insultDetected,
      mustRespond,
      reply,
      message,
      userName,
      user: memory.getUser(userJid),
    });
    if (stickerId) {
      stickerFromAi = false;
      logger.info({ stickerId }, "Figurinha escolhida por heurística");
    }
  }

  if (
    stickerId &&
    !shouldAttachSticker({
      stickerId,
      insultDetected,
      message,
      reply,
      userName,
      user: memory.getUser(userJid),
      fromAi: stickerFromAi,
      hasImage,
    })
  ) {
    logger.info({ stickerId, stickerFromAi }, "Figurinha descartada (moderação)");
    stickerId = null;
  }

  if (stickerId && preferStickerOnly({ stickerId, message, mustRespond, hasImage })) {
    reply = null;
    logger.info({ stickerId }, "Resposta só com figurinha");
  }

  return { reply, stickerId, learnedFacts };
}

export async function generateReply(params) {
  const { groupJid, userJid, userName, message, image = null, mustRespond = false } = params;

  memory.ensureUser(userJid, userName);
  memory.ensureGroup(groupJid);

  const insultDetected = detectInsult(message);
  const heavyProfanityMode = pickHeavyProfanityMode();
  if (insultDetected) {
    memory.incrementInsultCount(userJid);
  }

  const detectedClub = extractClubMention(message);
  if (detectedClub) {
    memory.updateUserClub(userJid, detectedClub);
  }

  const detectedSelection = extractSelectionMention(message);
  if (detectedSelection) {
    memory.updateUserSelection(userJid, detectedSelection);
  }

  const group = memory.getGroup(groupJid);
  const user = memory.getUser(userJid);
  const groupMembers = memory.getGroupMembers(groupJid);
  const userFacts = memory.getFacts("user", userJid);
  const groupFacts = memory.getFacts("group", groupJid);
  const recentMessages = memory.getRecentMessages(groupJid, config.behavior.maxContextMessages);
  const history = formatConversationHistory(recentMessages);
  const recentBotReplies = getRecentBotReplies(recentMessages);
  const responseVibe = pickResponseVibe(heavyProfanityMode);

  const teamQuery = detectedClub ?? user?.favorite_team ?? user?.favorite_selection ?? undefined;
  const footballContext = await getFootballContext(teamQuery);

  const systemPrompt = buildSystemPrompt({
    group,
    user,
    groupMembers,
    userFacts,
    groupFacts,
    footballContext,
    mustRespond,
    responseVibe,
    recentBotReplies,
    insultDetected,
    heavyProfanityMode,
  });

  const vulgarHint = heavyProfanityMode
    ? insultDetected
      ? "Te xingaram — nesta resposta pode devolver com palavrão pesado."
      : "Modo palavrão pesado ativo nesta resposta — use com moderação, 1-2 frases."
    : insultDetected
      ? "Te xingaram — devolve com sarcasmo cortante, SEM palavrão pesado."
      : "Tom sarcástico e irônico — zueira inteligente, sem palavrão pesado.";
  const creativityHint = `Tom desta resposta: ${responseVibe}. ${vulgarHint} Seja original — não repita suas frases recentes.`;

  const questionHint = needsTextAnswer(message)
    ? "PERGUNTA DIRETA — responda em TEXTO com opinião/zueira. Figurinha pode ir junto, mas NUNCA só figurinha."
    : "Na maioria das vezes responda SÓ com texto, sem figurinha.";

  const imageHint = image?.dataUrl
    ? "O usuário mandou IMAGEM — olha a foto (placar, meme, print, jogador, estádio, etc.) e comenta com zueira de bar. Se pedirem opinião sobre a imagem, responda em TEXTO."
    : "";

  const userContent = mustRespond
    ? `${creativityHint}\n\nO usuário te chamou diretamente. Responda com zueira, NUNCA [SKIP]. ${questionHint}${imageHint ? `\n\n${imageHint}` : ""}\n\nHistórico recente do grupo:\n${history || "(vazio)"}\n\nÚltima mensagem de ${userName ?? "alguém"}:\n${message}`
    : `${creativityHint}\n\n${questionHint}${imageHint ? `\n\n${imageHint}` : ""}\n\nHistórico recente do grupo:\n${history || "(vazio)"}\n\nÚltima mensagem de ${userName ?? "alguém"}:\n${message}`;

  const messages = [
    { role: "system", content: systemPrompt },
    buildUserMessage(userContent, image),
  ];

  try {
    return await finalizeReply(messages, {
      groupJid,
      userJid,
      mustRespond,
      userName,
      message,
      insultDetected,
      hasImage: Boolean(image?.dataUrl),
      heavyProfanityMode,
    });
  } catch (error) {
    logger.error({ error }, "Erro na OpenAI");
    if (mustRespond) {
      return {
        reply: pickFallbackReply(userName, message, heavyProfanityMode),
        stickerId: null,
        learnedFacts: [],
      };
    }
    return { reply: null, stickerId: null, learnedFacts: [] };
  }
}

function sanitizeReply(reply, allowSkip = false) {
  if (!reply) return null;
  if (reply === "[STICKER_ONLY]" || reply.includes("[STICKER_ONLY]")) return null;
  if (!allowSkip && (reply === "[SKIP]" || reply.includes("[SKIP]"))) return null;
  return formatBotMessage(reply.replace(/^["']|["']$/g, "").trim());
}
