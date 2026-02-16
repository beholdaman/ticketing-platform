import algosdk, { Algodv2 } from "algosdk"
import {TicketingPlatformClient} from "../smart_contracts/artifacts/ticketing_platform/TicketingPlatformClient"
import { arg } from "@algorandfoundation/algorand-typescript/op"
import { AlgorandClient } from "@algorandfoundation/algokit-utils"

export interface ClientContext {
    sender: algosdk.Account
    client: TicketingPlatformClient
    algod: algosdk.Algodv2
    appId: number
}

export function getClientContext(sender: algosdk.Account, appId: number): ClientContext {
    const algod = new algosdk.Algodv2(
        process.env.ALGOD_TOKEN || "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        process.env.ALGOD_URL || "http://localhost",
        process.env.ALGOD_PORT || "4001"
    );
    
    const client = new TicketingPlatformClient({
        appId: BigInt(appId),
        defaultSender: sender.addr,
        algorand: algod as unknown as AlgorandClient
});

    return { sender, client, algod, appId };
}