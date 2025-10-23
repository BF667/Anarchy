require("./config/global");
const path = require("path");
const fs = require("fs");
const {
  makeInMemoryStore,
  useMultiFileAuthState,
  default: makeWASocket,
  Browsers,
  makeCacheableSignalKeyStore,
  isJidStatusBroadcast,
  isJidGroup,
  DisconnectReason,
  getContentType,
} = require("baileys");
const pino = require("pino");
const NodeCache = require("node-cache");
const inquirer = require("inquirer");
let useCode = {
  isTrue: true,
};

const sleep = require("./utils/sleep");
const logger = require("./utils/logger");

const log = pino({ level: "fatal" }).child({ level: "fatal", stream: "store" });

const store = useStore ? makeInMemoryStore({ logger: log }) : null;
store?.readFromFile("./sezz/store.json");
setInterval(() => {
  store?.writeToFile("./sezz/store.json");
  store?.readFromFile("./sezz/store.json");
}, 5000);

(async function start() {
  console.log("\n\n");
  const commands = await new Promise((resolve, reject) => {
    const data = [];
    function readcmd(dircmd) {
      fs.readdirSync(dircmd).forEach((file) => {
        const fullpath = path.join(dircmd, file);
        if (fs.statSync(fullpath).isDirectory()) {
          readcmd(fullpath);
        } else if (file.endsWith(".js")) {
          const filecontent = require(fullpath);
          filecontent.cmd = file.replace(".js", "");
          filecontent.path = fullpath;

          const existCmd = data.find(
            (val) => val.cmd === file.replace(".js", ""),
          );
          if (existCmd) {
            reject(
              `Terdapat duplikat filename (filename sebagai command)\n- ${fullpath}\n- ${existCmd.path}`,
            );
          }

          data.push(filecontent);
        }
      });
    }
    readcmd(path.join(__dirname, "./commands"));
    resolve(data);
  }).catch((err) => {
    console.log(err);
    process.send("exit");
  });
  const { state, saveCreds } = await useMultiFileAuthState("./sezz/auth").catch(
    console.log,
  );
  const sock = makeWASocket({
    logger: log,
    borwser: Browsers.ubuntu("Chrome"),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log),
    },
    printQRInTerminal: !useCode.isTrue,
    defaultQueryTimeoutMs: undefined,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      if (store) {
        const m = await store.loadMessage(key.remoteJid, key.id);
        return m;
      } else return {};
    },
    markOnlineOnConnect: global.online,
    msgRetryCounterCache: new NodeCache(),
    shouldSyncHistoryMessage: () => true,
    shouldIgnoreJid: (jid) => isJidStatusBroadcast(jid),
    syncFullHistory: useStore,
  });
  store?.bind(sock.ev);
  if (useCode.isTrue && !sock.user && !sock.authState.creds.registered) {
    console.log("\n\n");
    async function next() {
      logger("info", "PAIRING CODE", `Request pairing code: ${botNumber}`);
      await sleep(3000);
      let code = await sock.requestPairingCode(botNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      logger("primary", "PAIRING CODE", `Pairing code: ${code}`);
    }
    if (botNumber) {
      await next();
    } else {
      await inquirer
        .prompt([
          {
            type: "confirm",
            name: "confirm",
            default: true,
            message: "Terhubung menggunakan pairing code?",
          },
        ])
        .then(async ({ confirm }) => {
          useCode.isTrue = confirm;
          if (confirm) {
            botNumber = (
              await inquirer.prompt([
                {
                  type: "number",
                  name: "number",
                  message: "Masukkan nomor WhatsApp (Contoh: 6285179845835)",
                },
              ])
            ).number;
            await next();
          } else return start();
        });
    }
  }
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "connecting") {
      if (sock.user) {
        logger(
          "info",
          "CONNECTION",
          `Reconnecting ${sock.user.id.split(":")[0]}`,
        );
      }
    }
    if (connection === "open") {
      sock.id = `${sock.user.id.split(":")[0]}@s.whatsapp.net`;
      if (inviteCode) {
        await sock.groupAcceptInvite(inviteCode);
      }
      await sock.sendMessage(sock.id, {
        text: `Berhasil terhubung dengan ${botName}`,
      });
      logger("success", "CONNECTION", `Connected ${sock.id.split("@")[0]}`);
    }
    if (connection === "close") {
      const { statusCode, message, error } =
        lastDisconnect.error?.output.payload;
      if (
        statusCode === DisconnectReason.badSession ||
        statusCode === DisconnectReason.forbidden ||
        statusCode == 405 ||
        (statusCode === DisconnectReason.loggedOut &&
          message !== "Stream Errored (conflict)")
      ) {
        fs.rmSync("./sezz", {
          force: true,
          recursive: true,
        });
      }
      logger("error", `Koneksi ${error}`, `${statusCode} ${message}`);
      start();
    }
  });
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    if (m.message.reactionMessage || m.message.protocolMessage) return;
    m.id = m.key.remoteJid;
    m.isGroup = isJidGroup(m.id);
    m.userId = !m.isGroup
      ? m.id
      : m.key.participant || `${m.participant.split(":")[0]}@s.whatsapp.net`;
    m.isBot = m.userId.endsWith("@bot");
    m.userName = m.pushName;
    m.fromMe = m.key.fromMe;
    m.itsSelf = m.id === sock.id;
    m.isOwner = `${global.owner.number}@s.whatsapp.net` === m.userId;
    m.type = getContentType(m.message);
    m.isMentioned =
      m.message[m.type].contextInfo?.mentionedJid?.length > 0
        ? m.message[m.type].contextInfo.mentionedJid
        : null;
    m.isQuoted = m.message[m.type].contextInfo?.quotedMessage;
    m.quoted = m.isQuoted ? m.message[m.type].contextInfo : null;
    m.isForwarded = m.message[m.type].contextInfo?.isForwarded;
    m.text =
      m.type === "conversation"
        ? m.message.conversation
        : m.type === "extendedTextMessage"
          ? m.message.extendedTextMessage.text
          : m.type === "imageMessage"
            ? m.message.imageMessage.caption
            : m.type === "videoMessage"
              ? m.message.videoMessage.caption
              : m.type === "documentMessage"
                ? m.message.documentMessage.caption
                : m.type === "templateButtonReplyMessage"
                  ? m.message.templateButtonReplyMessage.selectedId
                  : m.type === "interactiveResponseMessage"
                    ? JSON.parse(
                        m.message.interactiveResponseMessage
                          .nativeFlowResponseMessage.paramsJson,
                      ).id
                    : m.type === "messageContextInfo"
                      ? m.message.buttonsResponseMessage?.selectedButtonId ||
                        m.message.listResponseMessage?.singleSelectReply
                          .selectedRowId ||
                        m.message.buttonsResponseMessage?.selectedButtonId ||
                        (m.message.interactiveResponseMessage
                          ?.nativeFlowResponseMessage.paramsJson
                          ? JSON.parse(
                              m.message.interactiveResponseMessage
                                .nativeFlowResponseMessage.paramsJson,
                            )?.id
                          : "") ||
                        ""
                      : m.type === "senderKeyDistributionMessage"
                        ? m.message.conversation ||
                          m.message.imageMessage?.caption
                        : "";
    m.isCmd = m.text?.startsWith(prefixCommand);
    m.cmd = m.text
      ?.trim()
      .replace(prefixCommand, "")
      .split(" ")[0]
      .toLowerCase();
    m.args = m.text
      ?.replace(/^\S*\b/g, "")
      .trim()
      .split(global.splitArgs)
      .filter((arg) => arg !== "");
    m.isLink = m.text?.match(
      /(http:\/\/|https:\/\/)?(www\.)?[a-zA-Z0-9]+\.[a-zA-Z]+(\.[a-zA-Z]+)?(\/[^\s]*)?/g,
    );
    console.log(m);

    if (
      (setting.selfmode && !m.fromMe && !m.isOwner) ||
      (global.dev && !m.fromMe && !m.isOwner)
    )
      return;

    if (!m.isCmd) return;

    m.reply = (text) => sock.sendMessage(m.id, { text }, { quoted: m });

    for (let command of commands) {
      if (m.cmd === command.cmd) {
        if (command.onlyOwner && !m.fromMe && !m.isOwner) return;
        try {
          logger("info", "COMMAND", m.cmd.toUpperCase());
          if (command.autoRead) {
            await sock.readMessages([m.key]);
          }

          if (command.presence) {
            const presenceOptions = [
              "unavailable",
              "available",
              "composing",
              "recording",
              "paused",
            ];
            await sock.sendPresenceUpdate(
              presenceOptions.includes(command.presence)
                ? command.presence
                : "composing",
              m.id,
            );
          }

          if (command.react) {
            await sock.sendMessage(m.id, {
              react: {
                key: m.key,
                text: command.react,
              },
            });
          }

          await command.handle(sock, m);
          if (command.react) {
            await sock.sendMessage(m.id, {
              react: {
                key: m.key,
                text: "✅",
              },
            });
          }
        } catch (err) {
          m.reply(`*ERROR:* ${err.message}`);
          console.log(err);
          logger("error", "COMMAND", m.cmd.toUpperCase());
        }
        break;
      }
    }
  });
})();
