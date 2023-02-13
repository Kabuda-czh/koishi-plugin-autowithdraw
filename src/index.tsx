/*
 * @Author: Kabuda-czh
 * @Date: 2023-02-12 04:42:59
 * @LastEditors: Kabuda-czh
 * @LastEditTime: 2023-02-13 20:44:34
 * @FilePath: \KBot-App\plugins\autowithdraw\src\index.tsx
 * @Description: 
 * 
 * Copyright (c) 2023 by Kabuda-czh, All Rights Reserved.
 */
import { Context, Schema, Session, sleep } from "koishi";

export const name = "autowithdraw";

export interface Config {
  quoteEnable?: boolean;
}

export const Config: Schema<Config> = Schema.object({
  quoteEnable: Schema.boolean().default(false).description("是否启用以引用方式回复指令, 注意: 目前图片暂时不支持回复"),
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
  const messageIdArrayMap: {
    [x: string]: string[]
  } = {};

  ctx.on("command/before-execute", ({ session }) => {
    session.send = ((send) => async (...args) => {
      const { messageId, userId } = session;
      let content = args[0];
      if (content === '') return [];
      let message;
      // TODO 图片处理问题
      if (typeof content === "string") {
        for (const [key, value] of Object.entries(replaceMap)) {
          content = content.replace(new RegExp(key, "g"), value);
        }

        message = <message>
          <quote id={messageId} />
          <at id={userId} />
          <p>{content}</p>
          <at id={userId} />
        </message>
      } else {
        message = content;
      }

      const ids = await send(message);
      messageIdArrayMap[messageId] = (messageIdArrayMap[messageId] || []).concat(ids)

      return ids
    })(session.send.bind(session));
  })

  ctx.on("message-deleted", async (session) => {
    if (messageIdArrayMap[session.messageId]) {
      messageIdArrayMap[session.messageId].forEach(async (id) => {
        await session.bot.deleteMessage(session.channelId, id);
        await sleep(1000);
      })
      messageIdArrayMap[session.messageId] = [];
    }
  });
}
