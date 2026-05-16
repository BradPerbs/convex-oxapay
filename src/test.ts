/**
 * Test helper for consumers using `convex-test`.
 *
 * Usage:
 *
 *   // example/convex/setup.test.ts
 *   import { convexTest } from "convex-test";
 *   import schema from "./schema";
 *   import component from "convex-oxapay/test";
 *   const modules = import.meta.glob("./!**!/!*.*s");
 *   export function initConvexTest() {
 *     const t = convexTest(schema, modules);
 *     component.register(t);
 *     return t;
 *   }
 */

/// <reference types="vite/client" />
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema.js";

const modules = import.meta.glob("./component/**/*.ts");

/**
 * Register the OxaPay component against a `convex-test` instance.
 *
 * @param t      the test instance returned by `convexTest(schema, modules)`
 * @param name   the component name as registered in `convex.config.ts`
 *               (defaults to `"oxapay"`)
 */
export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name: string = "oxapay",
) {
  t.registerComponent(name, schema, modules);
}

export default { register, schema, modules };
