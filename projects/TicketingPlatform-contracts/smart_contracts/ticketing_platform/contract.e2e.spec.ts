import { Config } from '@algorandfoundation/algokit-utils'
import { registerDebugEventHandlers } from '@algorandfoundation/algokit-utils-debug'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import { Address } from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { TicketingPlatformFactory } from '../artifacts/t_uno/TicketingPlatformClient'

import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'





describe('TicketingPlatform contract', () => {
  const localnet = algorandFixture()
  beforeAll(() => {
    Config.configure({
      debug: true,
      // traceAll: true,
    })
    registerDebugEventHandlers()
  })
  beforeEach(localnet.newScope)

  

  const deploy = async (account: Address) => {
    const factory = localnet.algorand.client.getTypedAppFactory(TicketingPlatformFactory, {
      defaultSender: account,
    })

    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
    })
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
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const asset = await client.send.mintNft({
      args: {
        sender: testAccount.addr.toString(),
        assetName: 'asset1',
        ticketLink: 'https://google.com'
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgo(100_000)
  })
    const seller = testAccount;
    
    
    //const seller = await algorand.account.fromKmd('seller');
   
    const payTxn = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr)
    })

    // extract the minted asset id from the mint call return
    const assetId: bigint = (asset as any).return ?? BigInt((asset as any).groupId ?? 0)

    const result = await client.send.optInToAsset({
      args: {
        asset: assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true
    })

    // verify the app reports it is opted in to the asset
    const check = await client.send.isOptedInTo({ args: { asset: assetId } })
    expect(check.return).toBe(true)

    
  })
})
