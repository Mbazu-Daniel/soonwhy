import { notificationChannels } from "../../../../common/db/schema";

export type ChannelRecord = typeof notificationChannels.$inferSelect;
