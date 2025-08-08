import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
    dialect: "postgresql",
    schema: [path.join("server", "db", "pg", "schema.ts")],
    out: path.join("server", "migrations"),
    verbose: true,
    dbCredentials: {
        url: process.env.DATABASE_URL as string
    }
});
