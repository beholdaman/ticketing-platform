import { AlgorandClient, Config, getAccountInformation, populateAppCallResources } from '@algorandfoundation/algokit-utils'
import { registerDebugEventHandlers } from '@algorandfoundation/algokit-utils-debug'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import algosdk, { Address, makeApplicationOptInTxnFromObject, waitForConfirmation, OnApplicationComplete, Account, ABIMethod, getApplicationAddress } from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { TicketingPlatformFactory } from '../artifacts/ticketing_platform/TicketingPlatformClient'

import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { AlgoConfig } from '@algorandfoundation/algokit-utils/types/network-client'
import { Uint64 } from '@algorandfoundation/algorand-typescript-testing/impl/primitives'
import { AppClient } from '@algorandfoundation/algokit-utils/types/app-client'
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'
import {abimethod, arc4} from '@algorandfoundation/algorand-typescript'
import { Asset, BoxReference } from 'algosdk/dist/types/client/v2/algod/models/types'
import { TestExecutionContext } from '@algorandfoundation/algorand-typescript-testing'
//import { AssignedTicketKey} from '../artifacts/ticketing_platform/TicketingPlatformClient'
import { AssignedTicketKey } from './contract.algo'
//import { AssignedTicketKey } from './contract.algo'





describe('TicketingPlatform contract', () => {
  const localnet = algorandFixture()
  beforeAll(() => {
    Config.configure({
      debug: true,
      // traceAll: true,
    })
    registerDebugEventHandlers()
  })
  beforeEach(localnet.newScope, 100_000)

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
    const ctx = new TestExecutionContext();
    
  
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
        manager: client.appClient.appAddress,
        reserve: client.appClient.appAddress,
        freeze: client.appClient.appAddress,
        clawback: client.appClient.appAddress,
        extraFee: AlgoAmount.MicroAlgo(1_000)
    }
  )
   
    const payTxn = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appClient.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr)
    })

    // extract the minted asset id from the mint call return
    //const assetId: bigint = (asset as any).return ?? BigInt((asset as any).groupId ?? 0)
    

   await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    // verify the app reports it is opted in to the asset
    /*const check = await client.send.isOptedInTo(
      { args: { asset: asset.assetId }, 
      populateAppCallResources: true })

    expect(check.return).toEqual(true)*/
    const contractAddress = getApplicationAddress(client.appClient.appId);

    const result = await client.send.isOptedInTo({args: {asset: asset.assetId}});
    const balanceAfterOptIn = (await algorand.account.getInformation(testAccount)).balance
    const appBalanceAfterOptIn = (await algorand.account.getInformation(client.appClient.appAddress)).balance

    expect(result.return).toBe(true);
    expect(balance).toEqual(1_000_000);
    expect(balanceAfterOptIn).toEqual(1_000_000 - optInMbr);
    expect(appBalanceAfterOptIn).toEqual(optInMbr);

    
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
    

    await expect(() =>  (client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })
    )).rejects.toThrowError('minimum balance requirement for opt in is not met');
    

    // verify the app reports it is opted in to the asset
    const check = await client.send.isOptedInTo({ args: { asset: asset.assetId } })
    expect(check.return).toBe(false);

    const balanceAfterOptIn = (await algorand.account.getInformation(testAccount)).balance
    const appBalanceAfterOptIn = (await algorand.account.getInformation(client.appClient.appAddress)).balance

    expect(balanceAfterOptIn.microAlgos).toEqual(balance.microAlgos);
    expect(appBalanceAfterOptIn.microAlgos).toEqual(appBalance.microAlgos);

  })

  test('optInShouldFailIfDoneTwice', async () => {

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
        clawback: client.appClient.appAddress
    })
  
   
    const payTxn1 = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr)
    })

    const payTxn2 = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr)
    })

    // extract the minted asset id from the mint call return
    //const assetId: bigint = (asset as any).return ?? BigInt((asset as any).groupId ?? 0)

    const t1 = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn1
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    
    

    const t2 =  await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn2
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })
    //).rejects.toThrowError('contract already opted in to asset');
    
   const group = algorand.newGroup()
      .addTransaction(t1.transactions[0])
      .addTransaction(t2.transactions[0]);

    expect(await group.send()).rejects.toThrowError('contract already opted in to asset');

    // verify the app reports it is opted in to the asset
    const check = await client.send.isOptedInTo({ args: { asset: asset.assetId } })
    expect(check.return).toBe(true);

    const balanceAfterOptIn = (await algorand.account.getInformation(testAccount)).balance
    const appBalanceAfterOptIn = (await algorand.account.getInformation(client.appClient.appAddress)).balance

    expect(balanceAfterOptIn.microAlgos).toEqual(balance.microAlgos - BigInt(optInMbr));
    expect(appBalanceAfterOptIn.microAlgos).toEqual(appBalance.microAlgos + BigInt(optInMbr));

  })

  test('optInShoulFailWithWrongMbrReceiver', async () => {

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
        clawback: client.appClient.appAddress
  })
   
    const payTxn = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: testAccount.addr,
      amount: AlgoAmount.MicroAlgos(optInMbr - 1)
    })

    // extract the minted asset id from the mint call return
    //const assetId: bigint = (asset as any).return ?? BigInt((asset as any).groupId ?? 0)
    

    await expect(() =>  (client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })
    )).rejects.toThrowError('receiver of the payment is not the contract');
    

    // verify the app reports it is opted in to the asset
    const check = await client.send.isOptedInTo({ args: { asset: asset.assetId } })
    expect(check.return).toBe(false);

    const balanceAfterOptIn = (await algorand.account.getInformation(testAccount)).balance
    const appBalanceAfterOptIn = (await algorand.account.getInformation(client.appClient.appAddress)).balance

    expect(balanceAfterOptIn.microAlgos).toEqual(balance.microAlgos);
    expect(appBalanceAfterOptIn.microAlgos).toEqual(appBalance.microAlgos);

  })

  test('newListingSuccess', async () => {

    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;

    const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

    const newListing = await client.createTransaction.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })


  const key = new AssignedTicketKey({
    asset: new arc4.UintN64(asset.assetId)
  })
  
  //expect((await client.send.getBoxValue({args: {key: key}})).return?.owner).toEqual(testAccount);
  //const value = client.state.box.assignedTicketlistings.value(key);

  const balanceAfterNewListing = (await algorand.account.getInformation(testAccount)).balance
  const appBalanceAfterNewListing = (await algorand.account.getInformation(client.appClient.appAddress)).balance

  expect(balanceAfterNewListing.microAlgos).toEqual(balance.microAlgos - BigInt(listingMbr));
  expect(appBalanceAfterNewListing.microAlgos).toEqual(appBalance.microAlgos + BigInt(listingMbr));


})

  test('newListingShouldFailIfPriceIsNegative', async () => {

    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!

    const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance

    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

    const newListing = await client.createTransaction.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 0,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })

    const res1 =  await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      }, 
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) 
    })

    expect((await client.send.isOptedInTo({args: {asset: asset.assetId}})).return).toBe(true);
    

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.assetId)
    });

    const balanceAfterNewListing = (await algorand.account.getInformation(testAccount)).balance
  const appBalanceAfterNewListing = (await algorand.account.getInformation(client.appClient.appAddress)).balance

  expect(balanceAfterNewListing.microAlgos).toEqual(balance.microAlgos);
  expect(appBalanceAfterNewListing.microAlgos).toEqual(appBalance.microAlgos);


  })

  test('newListingShouldFailIfListingAlreadyExists', async () => {

    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!

    
    const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    const xfer2 = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

    const mbrPay2 = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

    

    const res1 =  await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      }, 
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) 
    })

    expect((await client.send.isOptedInTo({args: {asset: asset.assetId}})).return).toBe(true);
    

   
    await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })

    expect(await client.send.newListing({ 
      args: {
        xfer: xfer2,
        unitaryPrice: 2_222,
        mbrPay: mbrPay2
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrowError('Listing for asset already exists');

    const result = await client.send.getBoxValue({args: {asset: asset.assetId}});
    const optedIn = await client.send.isOptedInTo({args: {asset: asset.assetId}});


    expect(optedIn.return).toEqual(true);
    expect(result.return?.owner).toEqual(testAccount);
    expect(result.return?.unitaryPrice).toEqual(1_111);

  const balanceAfterNewListing = (await algorand.account.getInformation(testAccount)).balance
  const appBalanceAfterNewListing = (await algorand.account.getInformation(client.appClient.appAddress)).balance

  expect(balanceAfterNewListing.microAlgos).toEqual(balance.microAlgos);
  expect(appBalanceAfterNewListing.microAlgos).toEqual(appBalance.microAlgos);
    


  })

  test('newListingShouldFailWithWrongMbrReciever', async () => {

    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!

    const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

   
    

    const res1 =  await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      }, 
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) 
    })

    

   
    expect(await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrowError('Receiver for payment is not the application')

    

    
    const optedIn = await client.send.isOptedInTo({args: {asset: asset.assetId}});
    const listingExists = await client.send.boxExists({args: {asset: asset.assetId}});

    expect(optedIn.return).toEqual(true);
    expect(listingExists).toBe(false);

    
  const balanceAfterNewListing = (await algorand.account.getInformation(testAccount)).balance
  const appBalanceAfterNewListing = (await algorand.account.getInformation(client.appClient.appAddress)).balance

  expect(balanceAfterNewListing.microAlgos).toEqual(balance.microAlgos);
  expect(appBalanceAfterNewListing.microAlgos).toEqual(appBalance.microAlgos);
    
   

  });

  //'Insufficient funds to create listing'
  test('newListingShouldFailWithInsufficentMbr', async () => {

    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!

     const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(listingMbr - 2),
      receiver: client.appAddress,
      sender: testAccount
    });

   
    

    const res1 =  await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      }, 
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) 
    })

    

   
    expect(await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrowError('Insufficient funds to create listing')

    

    
    const optedIn = await client.send.isOptedInTo({args: {asset: asset.assetId}});
    const listingExists = await client.send.boxExists({args: {asset: asset.assetId}});

    expect(optedIn.return).toEqual(true);
    expect(listingExists).toBe(false);

    const balanceAfterNewListing = (await algorand.account.getInformation(testAccount)).balance
  const appBalanceAfterNewListing = (await algorand.account.getInformation(client.appClient.appAddress)).balance

  expect(balanceAfterNewListing.microAlgos).toEqual(balance.microAlgos);
  expect(appBalanceAfterNewListing.microAlgos).toEqual(appBalance.microAlgos);
    

  });

  //'Asset receiver is not the application'
  test('newListingShouldFailWithWrongAssetReceiver', async () => {

    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!
    const other =  algorand.account.random();

    const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    

    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: other,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

   
    

    const res1 =  await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      }, 
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) 
    })

    

   
    expect(await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrowError('Asset receiver is not the application')
    
    const optedIn = await client.send.isOptedInTo({args: {asset: asset.assetId}});
    const listingExists = await client.send.boxExists({args: {asset: asset.assetId}});

    expect(optedIn.return).toEqual(true);
    expect(listingExists).toBe(false);

      const balanceAfterNewListing = (await algorand.account.getInformation(testAccount)).balance
  const appBalanceAfterNewListing = (await algorand.account.getInformation(client.appClient.appAddress)).balance

  expect(balanceAfterNewListing.microAlgos).toEqual(balance.microAlgos);
  expect(appBalanceAfterNewListing.microAlgos).toEqual(appBalance.microAlgos);

  });

  //Asset must be unique
  test('newListingShouldFailWithNonUniqueAsset', async () => {

    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!
    const other =  algorand.account.random();

     const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance

    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: other,
      sender: testAccount,
      amount: BigInt(2), //multiple assets
      assetId: asset.assetId,
    })

    

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

   
    

    const res1 =  await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      }, 
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) 
    })

    

   
    expect(await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrowError('Asset must be unique')
    
    const optedIn = await client.send.isOptedInTo({args: {asset: asset.assetId}});
    const listingExists = await client.send.boxExists({args: {asset: asset.assetId}});

    expect(optedIn.return).toEqual(true);
    expect(listingExists).toBe(false);

        const balanceAfterNewListing = (await algorand.account.getInformation(testAccount)).balance
  const appBalanceAfterNewListing = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    expect(balanceAfterNewListing.microAlgos).toEqual(balance.microAlgos);
  expect(appBalanceAfterNewListing.microAlgos).toEqual(appBalance.microAlgos);

  })

  test('changePriceSuccess', async () => {

   const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;

    const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

    const newListing = await client.createTransaction.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })


  const price = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(price).toEqual(1_234)

  
  const changePrice = await client.send.changePrice({
    args: {
      asset: asset.assetId,
      newPrice: 6_789
    }
  })

  const newPrice = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(newPrice).toEqual(6_789)

  })

  test('changePriceShouldFailIfListingDoesNotExists', async () => {

     const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;

    const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

    const newListing = await client.createTransaction.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })


  const price = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(price).toEqual(1_234)

  
  expect( await client.send.changePrice({
    args: {
      asset: BigInt(88888), //asset senza listing
      newPrice: 6_789
    }
  })).rejects.toThrowError('Listing for given asset does not exist');

  

  const newPrice = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(newPrice).toEqual(1_234)

  })

  test('chanegPriceShouldFailIfCallerIsNotSeller', async () => {

    const {testAccount, algorand} = localnet.context;
    //const amount = await algodClient.accountInformation(testAccount.addr).do().amount();
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;
    const other = await algorand.account.random();

    const balance = (await algorand.account.getInformation(testAccount)).balance
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance


    const asset = await algorand.send.assetCreate({
        sender: testAccount.addr,
        assetName: 'asset',
        url: 'https://google.com',
        total: BigInt(2),
        decimals: 0,
        manager: testAccount.addr,
        reserve: testAccount.addr,
        freeze: testAccount.addr,
        clawback: client.appClient.appAddress,
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
    

    const optIn = await client.createTransaction.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

    const newListing = await client.createTransaction.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })


  const price = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(price).toEqual(1_234)

  
  expect( await client.send.changePrice({
    args: {
      asset: BigInt(88888), //asset senza listing
      newPrice: 6_789
    },
    sender: other
  })).rejects.toThrowError('Only the owner of this listing can change its price');

  

  const newPrice = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(newPrice).toEqual(1_234)

  })


})


 
