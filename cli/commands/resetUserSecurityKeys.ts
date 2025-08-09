import { CommandModule } from "yargs";
import { db, users, securityKeys } from "@server/db";
import { eq } from "drizzle-orm";

type ResetUserSecurityKeysArgs = {
    email: string;
};

export const resetUserSecurityKeys: CommandModule<{}, ResetUserSecurityKeysArgs> = {
    command: "reset-user-security-keys",
    describe: "Reset a user's security keys (passkeys) by deleting all their webauthn credentials",
    builder: (yargs) => {
        return yargs
            .option("email", {
                type: "string",
                demandOption: true,
                describe: "User email address"
            });
    },
    handler: async (argv: { email: string }) => {
        try {
            const { email } = argv;

            console.log(`Looking for user with email: ${email}`);

            // Find the user by email
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);

            if (!user) {
                console.error(`User with email '${email}' not found`);
                process.exit(1);
            }

            console.log(`Found user: ${user.email} (ID: ${user.userId})`);

            // Check if user has any security keys
            const userSecurityKeys = await db
                .select()
                .from(securityKeys)
                .where(eq(securityKeys.userId, user.userId));

            if (userSecurityKeys.length === 0) {
                console.log(`User '${email}' has no security keys to reset`);
                process.exit(0);
            }

            console.log(`Found ${userSecurityKeys.length} security key(s) for user '${email}'`);

            // Delete all security keys for the user
            await db
                .delete(securityKeys)
                .where(eq(securityKeys.userId, user.userId));

            console.log(`Successfully reset security keys for user '${email}'`);
            console.log(`Deleted ${userSecurityKeys.length} security key(s)`);

            process.exit(0);
        } catch (error) {
            console.error("Error:", error);
            process.exit(1);
        }
    }
}; 