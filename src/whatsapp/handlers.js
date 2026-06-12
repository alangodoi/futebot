import { isJidGroup } from "@whiskeysockets/baileys";
import { trackGroupMessage } from "../behavior/counter.js";
import { generateReply } from "../brain/chat.js";
import { detectInsult, shouldRespond } from "../brain/personality.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { memory } from "../memory/repository.js";
import {
  getBotIdentity,
  getMessageText,
  getSenderJid,
  hasQuotedImage,
  isImageMessage,
  isMentionedBot,
  isReplyToBot,
  resolveMessageImage,
} from "./client.js";
import { sendSticker } from "./stickers.js";

const processing = new Set();

export async function handleIncomingMessage(sock, msg, upsertType = "notify") {
  if (!msg.key || msg.key.fromMe) return;

  const messageId = msg.key.id;
  const remoteJid = msg.key.remoteJid;
  if (!messageId || !remoteJid) return;

  if (processing.has(messageId)) return;
  processing.add(messageId);
  setTimeout(() => processing.delete(messageId), 60_000);

  const isGroup = Boolean(isJidGroup(remoteJid));
  const isLive = upsertType === "notify";

  const text = getMessageText(msg)?.trim() ?? "";
  const hasImage = isImageMessage(msg) || hasQuotedImage(msg);

  if (!text && !hasImage) {
    if (isGroup && isLive) {
      logger.info({ jid: remoteJid, messageId }, "Mensagem de grupo sem texto decodificado");
    }
    return;
  }

  const senderJid = getSenderJid(msg);
  if (!senderJid) {
    if (isGroup && isLive) {
      logger.info({ jid: remoteJid, messageId, text: text.slice(0, 80) }, "Mensagem sem remetente");
    }
    return;
  }

  const pushName = msg.pushName ?? undefined;
  const bot = getBotIdentity(sock);

  if (!bot.id) return;

  const groupJid = isGroup ? remoteJid : senderJid;
  const mentionedBot = isMentionedBot(msg, bot);
  const replyToBot = isReplyToBot(msg, bot);

  const memoryContent = text || (hasQuotedImage(msg) ? "[resposta à imagem]" : "[imagem]");

  if (isGroup && isLive) {
    logger.info(
      {
        from: pushName,
        jid: remoteJid,
        text: (text || "[imagem]").slice(0, 80),
        hasImage,
        mentionedBot,
        replyToBot,
        botId: bot.id,
        botLid: bot.lid,
      },
      "Mensagem de grupo recebida"
    );
  }

  memory.saveMessage({
    groupJid,
    userJid: senderJid,
    userName: pushName,
    content: memoryContent,
  });

  if (!isLive) return;

  const messageCount = isGroup ? trackGroupMessage(groupJid) : 0;

  const willRespond = shouldRespond({
    text,
    isGroup,
    isMentioned: mentionedBot,
    isReplyToBot: replyToBot,
    messageCount,
    messagesPerResponse: config.behavior.messagesPerResponse,
  });

  if (!willRespond) {
    logger.info(
      {
        from: pushName,
        text: text.slice(0, 80),
        mentionedBot,
        replyToBot,
        isGroup,
        messageCount,
        nextAt: isGroup
          ? config.behavior.messagesPerResponse -
            (messageCount % config.behavior.messagesPerResponse)
          : null,
      },
      "Mensagem ignorada"
    );
    return;
  }

  logger.info(
    { from: pushName, jid: remoteJid, text: (text || "[imagem]").slice(0, 80), hasImage },
    "Respondendo"
  );

  try {
    const imageData = hasImage ? await resolveMessageImage(sock, msg) : null;
    const image = imageData?.image ?? null;

    let messageForBrain = text;
    if (imageData?.source === "quoted" && text) {
      messageForBrain = `${text}\n\n(O usuário citou/respondeu uma IMAGEM — olha a foto anexada e comenta o que aparece nela com zueira de bar.)`;
      if (imageData.caption) {
        messageForBrain += `\nLegenda original da imagem: ${imageData.caption}`;
      }
    } else if (!text && image) {
      messageForBrain =
        "Enviou uma imagem no grupo (sem legenda). Olha a imagem e reage com zueira de futebol/bar.";
    } else if (!text && hasImage) {
      messageForBrain = "Enviou ou citou uma imagem, mas não consegui baixar.";
    }

    const { reply, stickerId } = await generateReply({
      groupJid,
      userJid: senderJid,
      userName: pushName,
      message: messageForBrain,
      image,
      mustRespond: mentionedBot || replyToBot || !isGroup || detectInsult(text),
    });

    if (!reply && !stickerId) {
      logger.info({ from: pushName, text: text.slice(0, 80) }, "OpenAI retornou vazio ou [SKIP]");
      return;
    }

    if (reply) {
      await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
      memory.saveMessage({
        groupJid,
        userJid: bot.id,
        userName: config.bot.name,
        content: reply,
        isFromBot: true,
      });
    }

    if (stickerId) {
      await sendSticker(sock, remoteJid, stickerId, reply ? undefined : msg);
      memory.saveMessage({
        groupJid,
        userJid: bot.id,
        userName: config.bot.name,
        content: `[sticker:${stickerId}]`,
        isFromBot: true,
      });
    }
  } catch (error) {
    logger.error({ error }, "Erro ao processar mensagem");
  }
}
