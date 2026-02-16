import { Command } from "commander";
import algosdk from "algosdk";
import { getClientContext } from "../context";

export function registerNftCommands(program: Command) {
    const nftCommand = program.command("nft").description("NFT operations");

    nftCommand
        .command("mint <name> <link>")
        .description("Mint a new NFT ticket")
        .option("-a, --app <id>", "Application ID", process.env.APP_ID || "0")
        .option("-m, --mnemonic <phrase>", "Sender mnemonic", process.env.MNEMONIC)
        .action(async (name: string, link: string, options: any) => {
            try {
                const appId = parseInt(options.app);
                if (isNaN(appId)) throw new Error("Invalid app ID");

                const mnemonic = options.mnemonic;
                if (!mnemonic) throw new Error("MNEMONIC required");

                const sender = algosdk.mnemonicToSecretKey(mnemonic);
                const ctx = getClientContext(sender, appId);

                console.log(`Minting NFT: ${name}`);
                console.log(`Link: ${link}`);

                const result = await ctx.client.send.mintNft({
                    args: {
                        assetName: name,
                        ticketLink: link,
                    },
                    sender: sender.addr,
                });

                console.log("✓ NFT minted successfully");
                console.log(`Transaction ID: ${result.txIds}`);
                console.log(`Asset ID: ${result.return}`);
            } catch (error) {
                console.error("Error minting NFT:", error);
                process.exit(1);
            }
        });
}
