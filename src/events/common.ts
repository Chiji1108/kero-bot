import {
  AuditLogEvent,
  type GuildTextBasedChannel,
  type Message,
  type PartialMessage,
} from "discord.js";
import { type ArgsOf, type Client, Discord, On } from "discordx";

@Discord()
export class MessageLogging {
  private async resolveDeleter(
    message: Message<boolean> | PartialMessage
  ): Promise<string> {
    if (!message.guild) {
      return "不明";
    }

    try {
      const logs = await message.guild.fetchAuditLogs({
        type: AuditLogEvent.MessageDelete,
        limit: 5,
      });

      const entry = logs.entries.find((log) => {
        const sameTarget = log.target?.id === message.author?.id;
        const sameChannel = log.extra?.channel?.id === message.channelId;
        // biome-ignore lint/style/noMagicNumbers: FIXME
        const recentEnough = Date.now() - log.createdTimestamp < 5000;

        return Boolean(sameTarget && sameChannel && recentEnough);
      });

      if (entry) {
        return entry.executor?.toString() ?? entry.executorId ?? "不明";
      }
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
    }

    return "不明";
  }

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
    const authorTag = message.author?.tag ?? "不明";
    const authorMention = message.author?.toString() ?? "不明";
    const content = message.content?.trim();

    const deleterLabel = await this.resolveDeleter(message);

    const attachmentUrls = message.attachments.map(
      (attachment) => attachment.url
    );
    const lines: string[] = [
      "🗑️ メッセージが削除されました。",
      `削除したユーザー: ${deleterLabel}`,
      `元の投稿者: ${authorMention} (${authorTag})`,
    ];

    if (content) {
      lines.push(`内容: ${content}`);
    } else if (attachmentUrls.length > 0) {
      lines.push(`添付ファイル: ${attachmentUrls.join(", ")}`);
    } else {
      lines.push("内容: (取得できませんでした)");
    }

    await sendChannel.send(lines.join("\n"));

    console.log(
      "Message Deleted",
      client.user?.username,
      `${authorTag}: ${content ?? "(no content)"}`
    );
  }
}
