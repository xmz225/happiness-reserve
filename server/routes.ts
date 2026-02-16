import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { 
  deposits, 
  rainyDayLogs, 
  users,
  connections,
  circleInvites,
  sharedDeposits,
  sharedDepositUsage,
  insertDepositSchema, 
  insertRainyDayLogSchema,
  insertSharedDepositSchema
} from "@shared/schema";
import { eq, and, or, gt, gte, desc, ne, sql } from "drizzle-orm";
import crypto from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all deposits (excluding inactive ones by default, or all with ?includeInactive=true)
  app.get("/api/deposits", async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === "true";
      
      const allDeposits = includeInactive
        ? await db.select().from(deposits).orderBy(desc(deposits.createdAt))
        : await db.select().from(deposits).where(ne(deposits.status, -1)).orderBy(desc(deposits.createdAt));
      
      res.json(allDeposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      res.status(500).json({ error: "Failed to fetch deposits" });
    }
  });

  // Create a new deposit
  app.post("/api/deposits", async (req, res) => {
    try {
      const result = insertDepositSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid deposit data", details: result.error });
      }

      const [newDeposit] = await db.insert(deposits).values({ ...result.data, status: 0 }).returning();
      res.status(201).json(newDeposit);
    } catch (error) {
      console.error("Error creating deposit:", error);
      res.status(500).json({ error: "Failed to create deposit" });
    }
  });

  app.get("/api/deposits/surface", async (req, res) => {
    try {
      const excludeParam = req.query.exclude as string | undefined;
      const excludeIds: string[] = excludeParam ? excludeParam.split(",").filter(Boolean) : [];

      let eligibleDeposits;
      if (excludeIds.length > 0) {
        eligibleDeposits = await db
          .select()
          .from(deposits)
          .where(and(
            eq(deposits.status, 0),
            sql`${deposits.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`
          ));
      } else {
        eligibleDeposits = await db
          .select()
          .from(deposits)
          .where(eq(deposits.status, 0));
      }

      if (eligibleDeposits.length === 0) {
        return res.json(null);
      }

      const randomDeposit = eligibleDeposits[Math.floor(Math.random() * eligibleDeposits.length)];
      res.json(randomDeposit);
    } catch (error) {
      console.error("Error surfacing deposit:", error);
      res.status(500).json({ error: "Failed to surface deposit" });
    }
  });

  // Update deposit (description, emotion, tags)
  app.patch("/api/deposits/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { content, emotion, tags } = req.body;

      const updateData: any = {};
      if (content !== undefined) updateData.content = content;
      if (emotion !== undefined) updateData.emotion = emotion;
      if (tags !== undefined) updateData.tags = tags;

      const [updated] = await db
        .update(deposits)
        .set(updateData)
        .where(eq(deposits.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Deposit not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating deposit:", error);
      res.status(500).json({ error: "Failed to update deposit" });
    }
  });

  // Update deposit status (soft delete or set cooldown)
  app.patch("/api/deposits/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (typeof status !== "number") {
        return res.status(400).json({ error: "Status must be a number" });
      }

      const [updated] = await db
        .update(deposits)
        .set({ status })
        .where(eq(deposits.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Deposit not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating deposit status:", error);
      res.status(500).json({ error: "Failed to update deposit status" });
    }
  });

  // Delete a deposit (soft delete - set status to -1)
  app.delete("/api/deposits/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Soft delete by setting status to -1
      const [updated] = await db
        .update(deposits)
        .set({ status: -1 })
        .where(eq(deposits.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Deposit not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting deposit:", error);
      res.status(500).json({ error: "Failed to delete deposit" });
    }
  });

  // Get stats
  app.get("/api/stats", async (_req, res) => {
    try {
      const allDeposits = await db.select().from(deposits).where(ne(deposits.status, -1));
      const allLogs = await db.select().from(rainyDayLogs);

      const activeDeposits = allDeposits.filter(d => d.status === 0);
      const cooldownDeposits = allDeposits.filter(d => d.status > 0);

      const stats = {
        totalDeposits: allDeposits.length,
        activeDeposits: activeDeposits.length,
        cooldownDeposits: cooldownDeposits.length,
        totalRainyDays: allLogs.length,
        connections: 0,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Mark a deposit as surfaced (sets cooldown to 30 days)
  app.patch("/api/deposits/:id/surface", async (req, res) => {
    try {
      const { id } = req.params;
      const [updated] = await db
        .update(deposits)
        .set({ lastSurfacedAt: new Date(), status: 30 })
        .where(eq(deposits.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Deposit not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error marking deposit as surfaced:", error);
      res.status(500).json({ error: "Failed to update deposit" });
    }
  });

  // Log a rainy day entry
  app.post("/api/rainy-day-logs", async (req, res) => {
    try {
      const result = insertRainyDayLogSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid log data", details: result.error });
      }

      const [newLog] = await db.insert(rainyDayLogs).values(result.data).returning();
      res.status(201).json(newLog);
    } catch (error) {
      console.error("Error creating rainy day log:", error);
      res.status(500).json({ error: "Failed to create rainy day log" });
    }
  });

  // Get all rainy day logs
  app.get("/api/rainy-day-logs", async (_req, res) => {
    try {
      const logs = await db.select().from(rainyDayLogs).orderBy(desc(rainyDayLogs.createdAt));
      res.json(logs);
    } catch (error) {
      console.error("Error fetching rainy day logs:", error);
      res.status(500).json({ error: "Failed to fetch rainy day logs" });
    }
  });

  // Update rainy day log with feedback
  app.patch("/api/rainy-day-logs/:id/feedback", async (req, res) => {
    try {
      const { id } = req.params;
      const { rating, feedbackNote } = req.body;

      if (rating !== undefined && (rating !== 2 && rating !== 1 && rating !== -1)) {
        return res.status(400).json({ error: "Rating must be 2 (loved it), 1 (helpful), or -1 (not helpful)" });
      }

      const updateData: any = {};
      if (rating !== undefined) updateData.rating = rating;
      if (feedbackNote !== undefined) updateData.feedbackNote = feedbackNote;

      const [updated] = await db
        .update(rainyDayLogs)
        .set(updateData)
        .where(eq(rainyDayLogs.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Log not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating rainy day log feedback:", error);
      res.status(500).json({ error: "Failed to update feedback" });
    }
  });

  // ============ CIRCLE ENDPOINTS ============

  // Get or create current user (simplified - in production would use auth)
  app.post("/api/users/current", async (req, res) => {
    try {
      const { deviceId, displayName, email, phone } = req.body;
      
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, deviceId));

      if (existingUser) {
        // Update user info if provided
        if (displayName || email || phone) {
          const updateData: any = {};
          if (displayName) updateData.displayName = displayName;
          if (email) updateData.email = email;
          if (phone) updateData.phone = phone;
          
          const [updated] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, existingUser.id))
            .returning();
          return res.json(updated);
        }
        return res.json(existingUser);
      }

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          username: deviceId,
          password: crypto.randomBytes(32).toString("hex"),
          displayName: displayName || null,
          email: email || null,
          phone: phone || null,
        })
        .returning();

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error with current user:", error);
      res.status(500).json({ error: "Failed to get/create user" });
    }
  });

  // Update user settings (summary frequency)
  app.patch("/api/users/:id/settings", async (req, res) => {
    try {
      const { id } = req.params;
      const { summaryFrequencyWeeks, displayName, email, phone } = req.body;

      const updateData: any = {};
      if (summaryFrequencyWeeks !== undefined) updateData.summaryFrequencyWeeks = summaryFrequencyWeeks;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Create a circle invite
  app.post("/api/circle/invites", async (req, res) => {
    try {
      const { senderId, inviteType, inviteValue } = req.body;

      if (!senderId || !inviteType) {
        return res.status(400).json({ error: "Sender ID and invite type required" });
      }

      const inviteCode = crypto.randomBytes(6).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const [invite] = await db
        .insert(circleInvites)
        .values({
          senderId,
          inviteType,
          inviteValue: inviteValue || null,
          inviteCode,
          expiresAt,
        })
        .returning();

      res.status(201).json(invite);
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: "Failed to create invite" });
    }
  });

  // Get invite by code
  app.get("/api/circle/invites/:code", async (req, res) => {
    try {
      const { code } = req.params;

      const [invite] = await db
        .select()
        .from(circleInvites)
        .where(eq(circleInvites.inviteCode, code));

      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (invite.status !== "pending") {
        return res.status(400).json({ error: "Invite already used or expired" });
      }

      if (invite.expiresAt && new Date() > invite.expiresAt) {
        await db
          .update(circleInvites)
          .set({ status: "expired" })
          .where(eq(circleInvites.id, invite.id));
        return res.status(400).json({ error: "Invite expired" });
      }

      // Get sender info
      const [sender] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, invite.senderId));

      res.json({ ...invite, sender });
    } catch (error) {
      console.error("Error getting invite:", error);
      res.status(500).json({ error: "Failed to get invite" });
    }
  });

  // Accept a circle invite
  app.post("/api/circle/invites/:code/accept", async (req, res) => {
    try {
      const { code } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }

      const [invite] = await db
        .select()
        .from(circleInvites)
        .where(eq(circleInvites.inviteCode, code));

      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (invite.status !== "pending") {
        return res.status(400).json({ error: "Invite already used or expired" });
      }

      if (invite.senderId === userId) {
        return res.status(400).json({ error: "Cannot accept your own invite" });
      }

      // Check if connection already exists
      const existingConnections = await db
        .select()
        .from(connections)
        .where(
          or(
            and(
              eq(connections.userId, invite.senderId),
              eq(connections.connectedUserId, userId)
            ),
            and(
              eq(connections.userId, userId),
              eq(connections.connectedUserId, invite.senderId)
            )
          )
        );

      if (existingConnections.length > 0) {
        return res.status(400).json({ error: "Already connected" });
      }

      // Create bi-directional connection
      const [connection1] = await db
        .insert(connections)
        .values({
          userId: invite.senderId,
          connectedUserId: userId,
          status: "accepted",
          acceptedAt: new Date(),
        })
        .returning();

      await db
        .insert(connections)
        .values({
          userId: userId,
          connectedUserId: invite.senderId,
          status: "accepted",
          acceptedAt: new Date(),
        });

      // Mark invite as accepted
      await db
        .update(circleInvites)
        .set({ status: "accepted" })
        .where(eq(circleInvites.id, invite.id));

      res.json({ success: true, connection: connection1 });
    } catch (error) {
      console.error("Error accepting invite:", error);
      res.status(500).json({ error: "Failed to accept invite" });
    }
  });

  // Get user's connections (Circle)
  app.get("/api/circle/connections/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const userConnections = await db
        .select({
          id: connections.id,
          connectedUserId: connections.connectedUserId,
          status: connections.status,
          createdAt: connections.createdAt,
          acceptedAt: connections.acceptedAt,
        })
        .from(connections)
        .where(
          and(
            eq(connections.userId, userId),
            eq(connections.status, "accepted")
          )
        );

      // Get connected user details
      const connectionsWithUsers = await Promise.all(
        userConnections.map(async (conn) => {
          const [connectedUser] = await db
            .select({ id: users.id, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, conn.connectedUserId));
          return { ...conn, connectedUser };
        })
      );

      res.json(connectionsWithUsers);
    } catch (error) {
      console.error("Error getting connections:", error);
      res.status(500).json({ error: "Failed to get connections" });
    }
  });

  // Remove a connection
  app.delete("/api/circle/connections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const [connection] = await db
        .select()
        .from(connections)
        .where(eq(connections.id, id));

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Delete both directions
      await db
        .delete(connections)
        .where(
          or(
            and(
              eq(connections.userId, connection.userId),
              eq(connections.connectedUserId, connection.connectedUserId)
            ),
            and(
              eq(connections.userId, connection.connectedUserId),
              eq(connections.connectedUserId, connection.userId)
            )
          )
        );

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing connection:", error);
      res.status(500).json({ error: "Failed to remove connection" });
    }
  });

  // Send a deposit to a connection
  app.post("/api/circle/shared-deposits", async (req, res) => {
    try {
      const result = insertSharedDepositSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid shared deposit data", details: result.error });
      }

      const { senderId, receiverId } = result.data;

      // Verify connection exists
      const [connection] = await db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.userId, senderId),
            eq(connections.connectedUserId, receiverId),
            eq(connections.status, "accepted")
          )
        );

      if (!connection) {
        return res.status(403).json({ error: "Not connected to this user" });
      }

      const [sharedDeposit] = await db
        .insert(sharedDeposits)
        .values({ ...result.data, status: 0 })
        .returning();

      res.status(201).json(sharedDeposit);
    } catch (error) {
      console.error("Error creating shared deposit:", error);
      res.status(500).json({ error: "Failed to create shared deposit" });
    }
  });

  // Get shared deposits received by user
  app.get("/api/circle/shared-deposits/received/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const includeInactive = req.query.includeInactive === "true";

      const received = includeInactive
        ? await db
            .select()
            .from(sharedDeposits)
            .where(eq(sharedDeposits.receiverId, userId))
            .orderBy(desc(sharedDeposits.createdAt))
        : await db
            .select()
            .from(sharedDeposits)
            .where(
              and(
                eq(sharedDeposits.receiverId, userId),
                ne(sharedDeposits.status, -1)
              )
            )
            .orderBy(desc(sharedDeposits.createdAt));

      res.json(received);
    } catch (error) {
      console.error("Error getting received shared deposits:", error);
      res.status(500).json({ error: "Failed to get shared deposits" });
    }
  });

  // Get shared deposits sent by user
  app.get("/api/circle/shared-deposits/sent/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const sent = await db
        .select()
        .from(sharedDeposits)
        .where(eq(sharedDeposits.senderId, userId))
        .orderBy(desc(sharedDeposits.createdAt));

      res.json(sent);
    } catch (error) {
      console.error("Error getting sent shared deposits:", error);
      res.status(500).json({ error: "Failed to get shared deposits" });
    }
  });

  // Surface a random shared deposit for rainy day
  app.get("/api/circle/shared-deposits/surface/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const eligibleShared = await db
        .select()
        .from(sharedDeposits)
        .where(
          and(
            eq(sharedDeposits.receiverId, userId),
            eq(sharedDeposits.status, 0)
          )
        );

      if (eligibleShared.length === 0) {
        return res.json(null);
      }

      const randomShared = eligibleShared[Math.floor(Math.random() * eligibleShared.length)];
      res.json(randomShared);
    } catch (error) {
      console.error("Error surfacing shared deposit:", error);
      res.status(500).json({ error: "Failed to surface shared deposit" });
    }
  });

  // Mark shared deposit as used and log usage
  app.post("/api/circle/shared-deposits/:id/use", async (req, res) => {
    try {
      const { id } = req.params;
      const { helpful } = req.body;

      // Update the shared deposit
      const [updated] = await db
        .update(sharedDeposits)
        .set({ lastSurfacedAt: new Date(), status: 30 })
        .where(eq(sharedDeposits.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Shared deposit not found" });
      }

      // Log the usage (privacy: sender never sees when exactly)
      await db.insert(sharedDepositUsage).values({
        sharedDepositId: id,
        helpful: helpful ?? null,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error marking shared deposit as used:", error);
      res.status(500).json({ error: "Failed to update shared deposit" });
    }
  });

  // Get sender summary (how many times their deposits helped)
  app.get("/api/circle/summary/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const weeksBack = parseInt(req.query.weeks as string) || 2;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - weeksBack * 7);

      // Get all shared deposits by this user
      const sentDeposits = await db
        .select({ id: sharedDeposits.id })
        .from(sharedDeposits)
        .where(eq(sharedDeposits.senderId, userId));

      const depositIds = sentDeposits.map((d) => d.id);

      if (depositIds.length === 0) {
        return res.json({ totalUses: 0, helpfulUses: 0, weeks: weeksBack });
      }

      // Count usages in the period
      const usages = await db
        .select()
        .from(sharedDepositUsage)
        .where(
          and(
            sql`${sharedDepositUsage.sharedDepositId} = ANY(${depositIds})`,
            gte(sharedDepositUsage.usedAt, cutoffDate)
          )
        );

      const totalUses = usages.length;
      const helpfulUses = usages.filter((u) => u.helpful === true).length;

      res.json({ totalUses, helpfulUses, weeks: weeksBack });
    } catch (error) {
      console.error("Error getting sender summary:", error);
      res.status(500).json({ error: "Failed to get summary" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
