import fs from "node:fs";
import { getStickerById } from "../stickers/registry.js";
import { logger } from "../logger.js";

export async function sendSticker(sock, remoteJid, stickerId, quotedMsg) {
  const sticker = getStickerById(stickerId);
  if (!sticker) {
    logger.warn({ stickerId }, "Sticker não encontrado");
    return false;
  }

  try {
    const buffer = fs.readFileSync(sticker.filePath);
    await sock.sendMessage(
      remoteJid,
      {
        sticker: buffer,
        ...(sticker.animated ? { isAnimated: true } : {}),
      },
      quotedMsg ? { quoted: quotedMsg } : undefined
    );
    logger.info({ stickerId, animated: Boolean(sticker.animated) }, "Sticker enviado");
    return true;
  } catch (error) {
    logger.error({ error, stickerId }, "Falha ao enviar sticker");
    return false;
  }
}
