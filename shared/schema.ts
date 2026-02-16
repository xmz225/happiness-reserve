import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  phone: text("phone"),
  summaryFrequencyWeeks: integer("summary_frequency_weeks").default(2),
  lastSummarySentAt: timestamp("last_summary_sent_at"),
});

export const deposits = pgTable("deposits", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  emotion: text("emotion"),
  mediaUri: text("media_uri"),
  mediaType: text("media_type"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  lastSurfacedAt: timestamp("last_surfaced_at"),
  status: integer("status").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rainyDayLogs = pgTable("rainy_day_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  emotion: text("emotion").notNull(),
  depositId: varchar("deposit_id").references(() => deposits.id),
  rating: integer("rating"),
  feedbackNote: text("feedback_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Circle connections between users
export const connections = pgTable("connections", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  connectedUserId: varchar("connected_user_id").references(() => users.id).notNull(),
  status: text("status").default("pending").notNull(), // pending, accepted, declined
  createdAt: timestamp("created_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
});

// Invitations to join Circle (for non-users)
export const circleInvites = pgTable("circle_invites", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  inviteType: text("invite_type").notNull(), // phone, email, link
  inviteValue: text("invite_value"), // phone number or email
  inviteCode: varchar("invite_code").notNull().unique(),
  status: text("status").default("pending").notNull(), // pending, accepted, expired
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// Deposits shared between connected users
export const sharedDeposits = pgTable("shared_deposits", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  receiverId: varchar("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  emotion: text("emotion"),
  mediaUri: text("media_uri"),
  mediaType: text("media_type"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  status: integer("status").default(0).notNull(), // 0=active, >0=cooldown, -1=inactive
  lastSurfacedAt: timestamp("last_surfaced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track when shared deposits are used (for sender summaries)
export const sharedDepositUsage = pgTable("shared_deposit_usage", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sharedDepositId: varchar("shared_deposit_id").references(() => sharedDeposits.id).notNull(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
  helpful: boolean("helpful"), // null if no feedback, true/false otherwise
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDepositSchema = createInsertSchema(deposits).omit({
  id: true,
  createdAt: true,
});

export const insertRainyDayLogSchema = createInsertSchema(rainyDayLogs).omit({
  id: true,
  createdAt: true,
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertCircleInviteSchema = createInsertSchema(circleInvites).omit({
  id: true,
  createdAt: true,
});

export const insertSharedDepositSchema = createInsertSchema(sharedDeposits).omit({
  id: true,
  createdAt: true,
  lastSurfacedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type RainyDayLog = typeof rainyDayLogs.$inferSelect;
export type InsertRainyDayLog = z.infer<typeof insertRainyDayLogSchema>;
export type Connection = typeof connections.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type CircleInvite = typeof circleInvites.$inferSelect;
export type InsertCircleInvite = z.infer<typeof insertCircleInviteSchema>;
export type SharedDeposit = typeof sharedDeposits.$inferSelect;
export type InsertSharedDeposit = z.infer<typeof insertSharedDepositSchema>;
export type SharedDepositUsage = typeof sharedDepositUsage.$inferSelect;
