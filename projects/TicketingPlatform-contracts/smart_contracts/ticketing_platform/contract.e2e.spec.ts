import { AlgorandClient, Config, getAccountInformation } from '@algorandfoundation/algokit-utils'
import { registerDebugEventHandlers } from '@algorandfoundation/algokit-utils-debug'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import { Address, makeApplicationOptInTxnFromObject, waitForConfirmation, OnApplicationComplete, Account } from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { TicketingPlatformFactory } from '../artifacts/ticketing_platform/TicketingPlatformClient'

import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { AlgoConfig } from '@algorandfoundation/algokit-utils/types/network-client'
import { Uint64 } from '@algorandfoundation/algorand-typescript-testing/impl/primitives'
import { AppClient } from '@algorandfoundation/algokit-utils/types/app-client'
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'





describe('TicketingPlatform contract', () => {
  const localnet = algorandFixture()
  beforeAll(() => {
    Config.configure({
      debug: true,
      // traceAll: true,
    })
    registerDebugEventHandlers()
  })
  beforeEach(localnet.newScope, 5_000)

  const algodConfig = {
    server: 'http://localhost/',
    port: 4001,
    token: 'a'.repeat(64),
    network: localnet

  }
  const algodClient = AlgorandClient.fromConfig({algodConfig}).client.algod;

  
  

  const deploy = async (account: Account & TransactionSignerAccount) => {
    const factory = localnet.algorand.client.getTypedAppFactory(TicketingPlatformFactory, {
      defaultSender: account.addr,
      defaultSigner: account.signer,
    })

    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
    })
    localnet.algorand.account.ensureFunded(appClient.appAddress, account.addr, AlgoAmount.MicroAlgos(100_000))

    return { client: appClient }
  }

  /*test('says hello', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    const result = await client.send.hello({ args: { name: 'World' } })

    expect(result.return).toBe('Hello, World')
  })

  test('simulate says hello with correct budget consumed', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const result = await client
      .newGroup()
      .hello({ args: { name: 'World' } })
      .hello({ args: { name: 'Jane' } })
      .simulate()

    expect(result.returns[0]).toBe('Hello, World')
    expect(result.returns[1]).toBe('Hello, Jane')
    expect(result.simulateResponse.txnGroups[0].appBudgetConsumed).toBeLessThan(100)
  })*/

 

  test('optIn', async() => {
    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    
  
    const balance = (await algorand.account.getInformation(testAccount)).balance
    console.log('test account balance', balance);

    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance
    console.log('app balance', appBalance);
    
    const asset = await algorand.send.assetCreate({
        sender: testAccount,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount,
        reserve: testAccount,
        freeze: testAccount,
        clawback: testAccount,
        extraFee: AlgoAmount.MicroAlgo(1_000)
    }
  )
   
    const payTxn = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr)
    })

    // extract the minted asset id from the mint call return
    //const assetId: bigint = (asset as any).return ?? BigInt((asset as any).groupId ?? 0)
    

    const result = await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    // verify the app reports it is opted in to the asset
    const check = await client.send.isOptedInTo({ args: { asset: asset.assetId } })
    expect(check.return).toBe(true)
    
  })

   test('optInShouldFailWithLowMbr', async() => {

     const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    
  
    const balance = (await algorand.account.getInformation(testAccount)).balance
    console.log('test account balance', balance);

    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance
    console.log('app balance', appBalance);
    
    const asset = await algorand.send.assetCreate({
        sender: testAccount,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount,
        reserve: testAccount,
        freeze: testAccount,
        clawback: testAccount
    }
  )
   
    const payTxn = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr - 1)
    })

    // extract the minted asset id from the mint call return
    //const assetId: bigint = (asset as any).return ?? BigInt((asset as any).groupId ?? 0)
    

    await expect(() => client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })
  ).rejects.toThrowError('minimum balance requirement for opt in is not met');
    

    // verify the app reports it is opted in to the asset
    const check = await client.send.isOptedInTo({ args: { asset: asset.assetId } })
    expect(check.return).toBe(false)

  })

})


 
