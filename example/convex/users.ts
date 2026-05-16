import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server.js";

/** Create or fetch a demo user by email. No auth required. */
export const getOrCreateByEmail = mutation({
  args: { name: v.string(), email: v.string() },
  returns: v.object({
    _id: v.id("users"),
    _creationTime: v.number(),
    name: v.string(),
    email: v.string(),
    isPremium: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) return existing;
    const id = await ctx.db.insert("users", { name: args.name, email: args.email });
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Just-inserted user not found");
    return doc;
  },
});

/** Read a user by email (returns null if not yet created). */
export const getByEmail = query({
  args: { email: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      email: v.string(),
      isPremium: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    if (!args.email) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    return user ?? null;
  },
});

export const markPremiumByEntityId = internalMutation({
  args: { entityId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // `entityId` was passed as `order_id` at invoice creation. In this demo
    // we use the user's email as the entityId.
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.entityId))
      .unique();
    if (!user) {
      console.warn(`[oxapay] paid webhook for unknown entityId=${args.entityId}`);
      return null;
    }
    await ctx.db.patch(user._id, { isPremium: true });
    return null;
  },
});
