import {Command} from "commander"
import algosdk from "algosdk"
import {registerNftCommands} from "./commands/nft"
import {registerListingCommands} from "./commands/listings"
import {registerPurchaseCommands} from "./commands/purchase"
import {registerUtilityCommands} from "./commands/utility"
import {getClientContext} from "./context"

const program = new Command();

program.name("platform")
    .description("CLI interface for interacting with the TicketingPlatform smart contract")
    .version("1.0.0");

program.requiredOption("-a, --app <id>", "Application ID")
    .option("-m, --mnemonic <phrase>", "Sender mnemonic", process.env.MNEMONIC)

program.hook("preAction", (thisCommand) => {
    // Allow `setup` commands to run without global --app / --mnemonic
    if (process.argv.includes("setup")) return;

    const appId = parseInt(thisCommand.opts().app);
    if (isNaN(appId)) {
        console.error("Error: --app must be a valid number");
        process.exit(1);
    }

    const mnemonic = thisCommand.opts().mnemonic;
    if (!mnemonic) {
        console.error("Error: MNEMONIC required (pass via -m flag or MNEMONIC env var)");
        process.exit(1);
    }
});

// Register command groups
registerNftCommands(program);
registerListingCommands(program);
registerPurchaseCommands(program);
registerUtilityCommands(program);

program.parse(process.argv);