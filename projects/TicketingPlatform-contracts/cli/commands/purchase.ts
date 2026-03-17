import { Command } from "commander";
import algosdk from "algosdk";
import { getClientContext } from "../context";

export function registerPurchaseCommands(program: Command) {
    const buyCommand = program.command("buy").description("Purchase operations");

    // Buy ticket
    buyCommand
        .command("ticket <assetId> <price>")
        .description("Buy a ticket from a listing")
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

                console.log("Note: Full transaction composition required");
                console.log("This requires: payment transaction + asset transfer composition");
            } catch (error) {
                console.error("Error buying ticket:", error);
                process.exit(1);
            }
        });

    // Buy free access ticket
    buyCommand
        .command("free <assetId> <owner> <nonce> <quantity>")
        .description("Buy free access tickets")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic")
        .action(async (assetId: string, owner: string, nonce: string, quantity: string, options: any) => {
            try {
                const appId = parseInt(options.app);
                const assetIdNum = parseInt(assetId);
                const nonceNum = BigInt(nonce);
                const quantityNum = BigInt(quantity);

                if (isNaN(appId) || isNaN(assetIdNum)) throw new Error("Invalid IDs");

                const mnemonic = options.mnemonic || process.env.MNEMONIC;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log(`Buying ${quantity} free access tickets`);
                console.log(`Asset: ${assetIdNum}, Owner: ${owner}, Nonce: ${nonce}`);
                console.log("Note: Full transaction composition required");
            } catch (error) {
                console.error("Error buying free tickets:", error);
                process.exit(1);
            }
        });

    // Buy with assets
    buyCommand
        .command("assets <assetId>")
        .description("Buy a ticket with another asset")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic")
        .option("-p, --payment-asset <id>", "Asset ID to pay with")
        .action(async (assetId: string, options: any) => {
            try {
                const appId = parseInt(options.app);
                const assetIdNum = parseInt(assetId);

                if (isNaN(appId) || isNaN(assetIdNum)) throw new Error("Invalid IDs");

                const mnemonic = options.mnemonic || process.env.MNEMONIC;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log(`Buying ticket (asset ${assetIdNum}) with another asset`);
                console.log("Note: Full transaction composition required");
            } catch (error) {
                console.error("Error buying with assets:", error);
                process.exit(1);
            }
        });
}
