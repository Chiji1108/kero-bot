import type { GuildTextBasedChannel } from "discord.js";
import { type ArgsOf, type Client, Discord, On } from "discordx";

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
    const authorTag = message.author?.tag ?? "不明";
    const authorMention = message.author?.toString() ?? "不明";
    const content = message.content?.trim();

    const attachmentUrls = message.attachments.map(
      (attachment) => attachment.url
    );
    const lines: string[] = [
      "🗑️ メッセージが削除されました。",
      `投稿者: ${authorMention} (${authorTag})`,
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
