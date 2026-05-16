import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The example app has its own minimal `users` table; the OxaPay component
 * brings its own tables behind the scenes when registered via convex.config.ts.
 */
export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    /** Set to true once any payment for this user reaches `paid` status. */
    isPremium: v.optional(v.boolean()),
  }).index("email", ["email"]),
});
