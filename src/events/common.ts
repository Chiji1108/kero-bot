import {
  type Attachment,
  AttachmentBuilder,
  type GuildTextBasedChannel,
} from "discord.js";
import { type ArgsOf, type Client, Discord, On } from "discordx";

type AttachmentCopyResult = {
  files: AttachmentBuilder[];
  warnings: string[];
};

async function fetchAttachmentBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download attachment: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function buildAttachmentCopies(
  attachments: Iterable<Attachment>,
  options: { filenamePrefix: string }
): Promise<AttachmentCopyResult> {
  const files: AttachmentBuilder[] = [];
  const warnings: string[] = [];

  for (const attachment of attachments) {
    if (attachment.ephemeral) {
      warnings.push(
        `添付ファイル ${attachment.name ?? attachment.id} はエフェメラルのため再取得できませんでした。`
      );
      continue;
    }

    try {
      const data = await fetchAttachmentBuffer(attachment.url);
      files.push(
        new AttachmentBuilder(data, {
          name: `${options.filenamePrefix}${attachment.name ?? attachment.id}`,
          description: attachment.description ?? undefined,
        })
      );
    } catch (error) {
      console.error("Failed to copy attachment", attachment.url, error);
      warnings.push(
        `添付ファイル ${attachment.name ?? attachment.id} の再取得に失敗しました。`
      );
    }
  }

  return { files, warnings };
}

@Discord()
export class MessageLogging {
  @On()
  async messageDelete(
    [message]: ArgsOf<"messageDelete">,
    client: Client
  ): Promise<void> {
    if (message.partial) {
      try {
        await message.fetch();
      } catch (error) {
        console.error("Failed to fetch partial message", error);
        return;
      }
    }

    if (!(message.guild && message.channel)) {
      return;
    }

    const channel = message.channel;
    if (!channel.isTextBased() || channel.isDMBased()) {
      return;
    }

    const sendChannel = channel as GuildTextBasedChannel;
    const keroId = process.env.KERO_ID;
    const authorId = message.author?.id;

    if (keroId) {
      if (!authorId || authorId !== keroId) {
        // await sendChannel.send(
        //   "ケロではないので削除された内容は開示されません。500円で開示請求を行うことができます。"
        // );
        return;
      }
    } else {
      console.warn(
        "KERO_ID is not set; falling back to default delete logging."
      );
    }

    const authorTag = message.author?.tag ?? "不明";
    const authorMention = message.author?.toString() ?? "不明";
    const content = message.content?.trim();

    const attachmentNames = message.attachments.map(
      (attachment) => attachment.name ?? attachment.id
    );
    const { files: copiedAttachments, warnings: attachmentWarnings } =
      attachmentNames.length > 0
        ? await buildAttachmentCopies(message.attachments.values(), {
            filenamePrefix: "deleted-",
          })
        : { files: [], warnings: [] };
    const lines: string[] = [
      "🗑️ メッセージが削除されました。",
      `投稿者: ${authorMention} (${authorTag})`,
    ];

    if (content) {
      lines.push(`内容: ${content}`);
    } else if (attachmentNames.length > 0) {
      lines.push(
        `添付ファイル (${attachmentNames.length}件): ${attachmentNames.join(", ")}`
      );
      lines.push("※ 添付ファイルを再アップロードしました");
    } else {
      lines.push("内容: (取得できませんでした)");
    }

    if (attachmentWarnings.length > 0) {
      lines.push(...attachmentWarnings.map((warning) => `⚠️ ${warning}`));
    }

    await sendChannel.send({
      content: lines.join("\n"),
      files: copiedAttachments.length > 0 ? copiedAttachments : undefined,
    });

    console.log(
      "Message Deleted",
      client.user?.username,
      `${authorTag}: ${content ?? "(no content)"}`
    );
  }

  @On()
  async messageUpdate(
    [oldMessage, newMessage]: ArgsOf<"messageUpdate">,
    client: Client
  ): Promise<void> {
    const resolvedNewMessage = await (async () => {
      if (!newMessage.partial) {
        return newMessage;
      }

      try {
        return await newMessage.fetch();
      } catch (error) {
        console.error("Failed to fetch partial updated message", error);
        return null;
      }
    })();

    if (!resolvedNewMessage) {
      return;
    }

    const channel = resolvedNewMessage.channel ?? oldMessage.channel;
    if (!channel?.isTextBased() || channel.isDMBased()) {
      return;
    }

    if (!resolvedNewMessage.guild) {
      return;
    }

    const sendChannel = channel as GuildTextBasedChannel;
    const keroId = process.env.KERO_ID;
    const author = resolvedNewMessage.author ?? oldMessage.author;
    const authorId = author?.id;

    if (keroId) {
      if (!authorId || authorId !== keroId) {
        // await sendChannel.send(
        //   "ケロではないので編集前の内容は開示されません。500円で開示請求を行うことができます。"
        // );
        return;
      }
    } else {
      console.warn("KERO_ID is not set; falling back to default edit logging.");
    }

    const authorTag = author?.tag ?? "不明";
    const authorMention = author?.toString() ?? "不明";

    const beforeContent = oldMessage.content?.trim();
    const afterContent = resolvedNewMessage.content?.trim();

    const beforeAttachmentList = [...oldMessage.attachments.values()];
    const afterAttachmentList = [...resolvedNewMessage.attachments.values()];
    const beforeAttachmentUrls = beforeAttachmentList.map(
      (attachment) => attachment.url
    );
    const afterAttachmentUrls = afterAttachmentList.map(
      (attachment) => attachment.url
    );

    const hasContentChange = beforeContent !== afterContent;
    const hasAttachmentChange =
      beforeAttachmentUrls.join(",") !== afterAttachmentUrls.join(",");

    if (!(hasContentChange || hasAttachmentChange)) {
      return;
    }

    const lines: string[] = [
      "✏️ メッセージが編集されました。",
      `投稿者: ${authorMention} (${authorTag})`,
    ];

    if (beforeContent) {
      lines.push(`編集前: ${beforeContent}`);
    } else if (beforeAttachmentList.length > 0) {
      const beforeAttachmentNames = beforeAttachmentList.map(
        (attachment) => attachment.name ?? attachment.id
      );
      lines.push(
        `編集前の添付ファイル (${beforeAttachmentNames.length}件): ${beforeAttachmentNames.join(", ")}`
      );
    } else {
      lines.push("編集前: (取得できませんでした)");
    }

    if (hasContentChange && afterContent) {
      lines.push(`編集後: ${afterContent}`);
    } else if (hasAttachmentChange && afterAttachmentList.length > 0) {
      const afterAttachmentNames = afterAttachmentList.map(
        (attachment) => attachment.name ?? attachment.id
      );
      lines.push(
        `編集後の添付ファイル (${afterAttachmentNames.length}件): ${afterAttachmentNames.join(", ")}`
      );
    }

    const {
      files: beforeAttachmentCopies,
      warnings: beforeAttachmentWarnings,
    } =
      hasAttachmentChange && beforeAttachmentList.length > 0
        ? await buildAttachmentCopies(beforeAttachmentList, {
            filenamePrefix: "before-edit-",
          })
        : { files: [], warnings: [] };

    if (beforeAttachmentWarnings.length > 0) {
      lines.push(...beforeAttachmentWarnings.map((warning) => `⚠️ ${warning}`));
    }

    await sendChannel.send({
      content: lines.join("\n"),
      files:
        beforeAttachmentCopies.length > 0 ? beforeAttachmentCopies : undefined,
    });

    console.log(
      "Message Updated",
      client.user?.username,
      `${authorTag}: ${beforeContent ?? "(no content)"} -> ${afterContent ?? "(no content)"}`
    );
  }
}
