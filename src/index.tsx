/*
 * @Author: Kabuda-czh
 * @Date: 2023-02-12 04:42:59
 * @LastEditors: Kabuda-czh
 * @LastEditTime: 2023-02-12 20:34:54
 * @FilePath: \koishi-plugin-autowithdraw\src\index.tsx
 * @Description: 
 * 
 * Copyright (c) 2023 by Kabuda-czh, All Rights Reserved.
 */
import { Context, h, Schema } from "koishi";

export const name = "autowithdraw";

declare module "koishi" {
  interface Tables {
    msgTable: MsgTable;
  }
}

interface MsgTable {
  id: number;
  reciveMsgId?: string;
  sendMsgId?: string;
  sendUserId?: string;
  sendChannelId?: string;
  messageInfo?: string
}

export interface Config {
  quoteEnable?: boolean;
}

export const Config: Schema<Config> = Schema.object({
  quoteEnable: Schema.boolean().default(false).description("是否启用以引用方式回复指令"),
});

export const using = ["database"];

const replaceMap = {
  "&#39;": "'",
  "&quot;": '"',
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">"
}

export async function apply(ctx: Context, config: Config) {
  let messageObj;

  ctx.model.extend(
    "msgTable",
    {
      id: { type: "integer" },
      reciveMsgId: { type: "string" },
      sendMsgId: { type: "string" },
      sendUserId: { type: "string" },
      sendChannelId: { type: "string" },
      messageInfo: { type: "string" },
    },
    {
      autoInc: true,
    }
  );

  ctx.on("message", (session) => {
    messageObj = {
      id: +session.id,
      reciveMsgId: session.messageId,
      sendUserId: session.userId,
      sendChannelId: session.channelId,
      messageInfo: session.content,
    };
  });

  if (config.quoteEnable) {
    ctx.on("before-send", (session) => {
      if (+session.id - messageObj.id === 1) {
        let sendMsg = session.content;
        for (const [key, value] of Object.entries(replaceMap)) {
          sendMsg = sendMsg.replace(new RegExp(key, "g"), value);
        }

        session.send(
          <message>
            <quote id={messageObj.reciveMsgId} />
            <p>{sendMsg}</p>
            <at id={messageObj.sendUserId} />
          </message>
        )
        return true;
      }
    })
  }

  ctx.on("send", async (session) => {
    if ([2, 3].includes(+session.id - messageObj.id)) {
      messageObj.sendMsgId = session.messageId;
      delete messageObj.id;
      await ctx.database.create("msgTable", {
        ...messageObj,
      });
      messageObj = {};
    }
  });

  ctx.on("message-deleted", async (session) => {
    const msg = await ctx.database.get("msgTable", {
      reciveMsgId: session.messageId,
      sendUserId: session.userId,
    });
    if (msg.length === 1) {
      session.bot.deleteMessage(msg[0].sendChannelId, msg[0].sendMsgId);
      await ctx.database.remove("msgTable", {
        reciveMsgId: session.messageId,
        sendUserId: session.userId,
      });
    }
  });
}
