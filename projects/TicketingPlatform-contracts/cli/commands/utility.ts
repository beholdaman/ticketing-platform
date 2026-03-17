import { Command } from "commander";
import algosdk from "algosdk";
import { getClientContext } from "../context";

export function registerUtilityCommands(program: Command) {
    const infoCommand = program.command("info").description("Information and utility operations");

    // Get contract balance
    infoCommand
        .command("balance")
        .description("Get contract balance")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic")
        .action(async (options: any) => {
            try {
                const appId = parseInt(options.app);
                if (isNaN(appId)) throw new Error("Invalid app ID");

                const mnemonic = options.mnemonic || process.env.MNEMONIC;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log("Fetching contract balance...");

                const result = await ctx.client.send.balance();

                console.log("✓ Contract balance retrieved");
                console.log(`Balance: ${result.return} microAlgos`);
            } catch (error) {
                console.error("Error getting balance:", error);
                process.exit(1);
            }
        });

    // Check if opted in
    infoCommand
        .command("opted-in <assetId>")
        .description("Check if contract is opted in to an asset")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic")
        .action(async (assetId: string, options: any) => {
            try {
                const appId = parseInt(options.app);
                const assetIdNum = parseInt(assetId);

                if (isNaN(appId) || isNaN(assetIdNum)) throw new Error("Invalid IDs");

                const mnemonic = options.mnemonic || process.env.MNEMONIC;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log(`Checking opt-in status for asset ${assetIdNum}...`);

                const result = await ctx.client.send.isOptedInTo({
                    args: {
                        asset: BigInt(assetIdNum),
                    },
                    sender: sender.addr,
                });

                const status = result.return ? "✓ Yes" : "✗ No";
                console.log(`Contract opted in to asset ${assetIdNum}: ${status}`);
            } catch (error) {
                console.error("Error checking opt-in:", error);
                process.exit(1);
            }
        });

    // Get box value
    infoCommand
        .command("box-value <assetId>")
        .description("Get the box value for an asset listing")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic")
        .action(async (assetId: string, options: any) => {
            try {
                const appId = parseInt(options.app);
                const assetIdNum = parseInt(assetId);

                if (isNaN(appId) || isNaN(assetIdNum)) throw new Error("Invalid IDs");

                const mnemonic = options.mnemonic || process.env.MNEMONIC;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log(`Fetching box value for asset ${assetIdNum}...`);

                const result = await ctx.client.send.getBoxValue({
                    args: {
                        asset: BigInt(assetIdNum),
                    },
                    sender: sender.addr,
                });

                console.log("✓ Box value retrieved");
                console.log("Owner:", result.return?.owner);
                console.log("Unitary Price:", result.return?.unitaryPrice, "microAlgos");
            } catch (error) {
                console.error("Error getting box value:", error);
                process.exit(1);
            }
        });

    

    // Get MBR costs
    infoCommand
        .command("mbr")
        .description("Get MBR (Minimum Balance Requirement) costs")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic")
        .option("-t, --type <type>", "Type: 'listing' or 'free' (default: listing)", "listing")
        .action(async (options: any) => {
            try {
                const appId = parseInt(options.app);
                if (isNaN(appId)) throw new Error("Invalid app ID");

                const mnemonic = options.mnemonic || process.env.MNEMONIC;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log("Fetching MBR costs...");

                let result;
               
                    result = await ctx.client.send.listingBoxMbr();
                    console.log("✓ Listing MBR:", result.return, "microAlgos");
                
            } catch (error) {
                console.error("Error getting MBR:", error);
                process.exit(1);
            }
        });
}
