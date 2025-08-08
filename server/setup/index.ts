import { ensureActions } from "./ensureActions";
import { copyInConfig } from "./copyInConfig";
import { clearStaleData } from "./clearStaleData";

export async function runSetupFunctions() {
    await copyInConfig(); // copy in the config to the db as needed
    await ensureActions(); // make sure all of the actions are in the db and the roles
    await clearStaleData();
}
