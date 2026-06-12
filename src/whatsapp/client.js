import makeWASocket, {
  DisconnectReason,
  areJidsSameUser,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  getContentType,
  isJidGroup,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import fs from "node:fs";
import qrcode from "qrcode-terminal";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { memory } from "../memory/repository.js";
import { startWorldCupAlerts } from "../notifications/worldcup-alerts.js";
import { handleIncomingMessage } from "./handlers.js";

let sock = null;

export function getSocket() {
  return sock;
}

export async function startWhatsApp() {
  fs.mkdirSync(config.whatsapp.authStatePath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(config.whatsapp.authStatePath);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("Escaneie o QR code abaixo com o WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn({ statusCode, shouldReconnect }, "Conexão WhatsApp fechada");

      if (shouldReconnect) {
        await startWhatsApp();
      } else {
        logger.error("Sessão deslogada. Apague auth_info e escaneie o QR de novo.");
      }
    } else if (connection === "open") {
      logger.info("WhatsApp conectado!");
      startWorldCupAlerts(sock);
    }
  });

  sock.ev.on("messages.upsert", async (event) => {
    if (event.type !== "notify" && event.type !== "append") return;

    for (const msg of event.messages) {
      await handleIncomingMessage(sock, msg, event.type);
    }
  });

  sock.ev.on("groups.upsert", (groups) => {
    for (const group of groups) {
      memory.ensureGroup(group.id, group.subject);
      logger.info({ id: group.id, subject: group.subject }, "Entrou em grupo");
    }
  });

  return sock;
}

function getNormalizedContent(msg) {
  if (!msg.message) return null;
  return normalizeMessageContent(msg.message);
}

export function getMessageText(msg) {
  if (!msg.key) return null;

  const content = getNormalizedContent(msg);
  if (!content) return null;

  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    null
  );
}

export function isImageMessage(msg) {
  const content = getNormalizedContent(msg);
  if (!content) return false;
  return getContentType(content) === "imageMessage";
}

export function getQuotedMessage(msg) {
  const contextInfo = getContextInfo(msg);
  if (!contextInfo?.quotedMessage) return null;

  const message = normalizeMessageContent(contextInfo.quotedMessage);
  if (!message) return null;

  return {
    key: {
      remoteJid: contextInfo.remoteJid ?? msg.key?.remoteJid,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant,
    },
    message,
  };
}

export function hasQuotedImage(msg) {
  const quoted = getQuotedMessage(msg);
  return quoted ? isImageMessage(quoted) : false;
}

export async function downloadMessageImage(sock, msg) {
  if (!isImageMessage(msg)) return null;

  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger,
        reuploadRequest: sock.updateMediaMessage,
      }
    );

    const content = getNormalizedContent(msg);
    const mime = content?.imageMessage?.mimetype ?? "image/jpeg";
    const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

    return { dataUrl, mime, bytes: buffer.length };
  } catch (error) {
    logger.warn({ error }, "Falha ao baixar imagem do WhatsApp");
    return null;
  }
}

export async function resolveMessageImage(sock, msg) {
  if (isImageMessage(msg)) {
    const image = await downloadMessageImage(sock, msg);
    if (image) {
      const content = getNormalizedContent(msg);
      return {
        image,
        caption: content?.imageMessage?.caption ?? null,
        source: "message",
      };
    }
  }

  const quoted = getQuotedMessage(msg);
  if (quoted && isImageMessage(quoted)) {
    const image = await downloadMessageImage(sock, quoted);
    if (image) {
      const content = getNormalizedContent(quoted);
      return {
        image,
        caption: content?.imageMessage?.caption ?? null,
        source: "quoted",
      };
    }
  }

  return null;
}

export function getContextInfo(msg) {
  const content = getNormalizedContent(msg);
  if (!content) return null;

  const type = getContentType(content);
  if (!type || !content[type]) return null;

  return content[type].contextInfo ?? null;
}

export function getBotIdentity(sock) {
  const me = sock.authState?.creds?.me;
  const lid = me?.lid
    ? me.lid.includes("@")
      ? me.lid
      : `${me.lid}@lid`
    : null;

  return {
    id: sock.user?.id ?? me?.id ?? null,
    lid,
  };
}

function matchesBotJid(jid, bot) {
  if (!jid) return false;
  if (bot.id && areJidsSameUser(jid, bot.id)) return true;
  if (bot.lid && areJidsSameUser(jid, bot.lid)) return true;
  return false;
}

export function isMentionedBot(msg, bot) {
  const contextInfo = getContextInfo(msg);
  const mentioned = contextInfo?.mentionedJid ?? [];
  return mentioned.some((jid) => matchesBotJid(jid, bot));
}

export function getSenderJid(msg) {
  if (!msg.key) return null;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return null;

  if (isJidGroup(remoteJid)) {
    return msg.key.participant ?? msg.participant ?? null;
  }

  return remoteJid;
}

export function isReplyToBot(msg, bot) {
  const contextInfo = getContextInfo(msg);
  const quoted = contextInfo?.participant;
  return Boolean(quoted && matchesBotJid(quoted, bot));
}
