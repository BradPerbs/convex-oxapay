import { defineApp } from "convex/server";
import oxapay from "convex-oxapay/convex.config";

const app = defineApp();
app.use(oxapay);

export default app;
