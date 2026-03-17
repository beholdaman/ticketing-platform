import { Command } from "commander";
import algosdk from "algosdk";
import { getClientContext } from "../context";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { AlgoAmount } from "@algorandfoundation/algokit-utils/types/amount";
import { execSync } from "child_process";
import * as path from "path";

export function registerListingCommands(program: Command) {
    const listingCommand = program.command("listing").description("Listing operations");

    // Create listing
    listingCommand
        .command("create <assetId> <price>")
        .description("Create a listing for an NFT ticket")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic")
        .action(async (assetId: string, price: string, options: any) => {
            try {
                const appId = parseInt(options.app);
                const assetIdNum = parseInt(assetId);
                const priceNum = BigInt(price);

                if (isNaN(appId) || isNaN(assetIdNum)) throw new Error("Invalid IDs");

                const mnemonic = options.mnemonic || process.env.MNEMONIC;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log(`Creating listing for asset ${assetIdNum} at price ${price} microAlgos`);

                // This is a simplified example - actual implementation needs proper transaction composition
                console.log("Note: Full transaction composition required for listings");
                console.log("This requires: asset transfer + payment transaction");
            } catch (error) {
                console.error("Error creating listing:", error);
                process.exit(1);
            }
        });

    // Change price
    listingCommand
        .command("price <assetId> <newPrice>")
        .description("Change the price of a listing")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic")
        .action(async (assetId: string, newPrice: string, options: any) => {
            try {
                const appId = parseInt(options.app);
                const assetIdNum = parseInt(assetId);
                const newPriceNum = BigInt(newPrice);

                if (isNaN(appId) || isNaN(assetIdNum)) throw new Error("Invalid IDs");

                const mnemonic = options.mnemonic || process.env.MNEMONIC;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log(`Changing price for asset ${assetIdNum} to ${newPrice} microAlgos`);

                const result = await ctx.client.send.changePrice({
                    args: {
                        asset: BigInt(assetIdNum),
                        newPrice: newPriceNum,
                    },
                    sender: sender.addr,
                });

                console.log("✓ Price updated successfully");
                console.log(`Transaction ID: ${result.txIds}`);
            } catch (error) {
                console.error("Error changing price:", error);
                process.exit(1);
            }
        });

    // Withdraw asset
    listingCommand
        .command("withdraw <assetId>")
        .description("Withdraw an asset from listing")
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

                console.log(`Withdrawing asset ${assetIdNum}`);

                const result = await ctx.client.send.withdrawAsset({
                    args: {
                        asset: BigInt(assetIdNum),
                    },
                    sender: sender.addr,
                });

                console.log("✓ Asset withdrawn successfully");
                console.log(`Transaction ID: ${result.txIds}`);
            } catch (error) {
                console.error("Error withdrawing asset:", error);
                process.exit(1);
            }
        });

    // Opt-in to asset
    listingCommand
        .command("optin <assetId>")
        .description("Opt-in the contract to an asset")
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

                console.log(`Opting in to asset ${assetIdNum}`);
                console.log("Note: This requires a separate payment transaction for MBR");
            } catch (error) {
                console.error("Error opting in:", error);
                process.exit(1);
            }
        });

        listingCommand
            .command("setup <network>")
            .description("Deploy the application on the given network and create a funded test account")
            .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
            .action(async (network: string) => {
                try {
                    const validNets = ["localnet", "testnet", "mainnet"];
                    if (!validNets.includes(network)) {
                        throw new Error(`network must be one of ${validNets.join(", ")}`);
                    }

                
                    console.log(`Deploying application to '${network}'...`);

                    
                    // Load and execute the deploy function
                    const { deploy } = await import("../../smart_contracts/ticketing_platform/deploy-config");
                    await deploy();

                    console.log("Application deployed successfully.");

                    if (network !== "mainnet") {
                        console.log("Creating a funded test account...");

                        const algorand = AlgorandClient.fromEnvironment();
                        const deployer = await algorand.account.fromEnvironment("DEPLOYER");

                        const testAccount = algosdk.generateAccount();
                        const mnemonic = algosdk.secretKeyToMnemonic(testAccount.sk);
                        console.log(`Test account address: ${testAccount.addr}`);
                        console.log(`Test account mnemonic: ${mnemonic}`);

                        // fund with 1 ALGO
                        // ensureFunded expects addresses/strings for the target
                        await algorand.account.ensureFunded(testAccount.addr, deployer, AlgoAmount.Algos(1));
                        console.log("Test account funded with 1 ALGO");
                    }
                } catch (error) {
                    console.error("Error during setup:", error);
                    process.exit(1);
                }
            
            });
}
