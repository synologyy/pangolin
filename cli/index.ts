#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { setAdminCredentials } from "@cli/commands/setAdminCredentials";
import { resetUserSecurityKeys } from "@cli/commands/resetUserSecurityKeys";

yargs(hideBin(process.argv))
    .scriptName("pangctl")
    .command(setAdminCredentials)
    .command(resetUserSecurityKeys)
    .demandCommand()
    .help().argv;
