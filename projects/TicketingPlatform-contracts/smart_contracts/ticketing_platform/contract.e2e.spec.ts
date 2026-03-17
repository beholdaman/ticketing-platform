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
import { a } from 'vitest/dist/chunks/suite.B2jumIFP'
import { balance } from '@algorandfoundation/algorand-typescript/op'
//import { AssignedTicketKey } from './contract.algo'

//21 test di integrazione



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
    localnet.algorand.account.ensureFunded(appClient.appAddress, account.addr, AlgoAmount.MicroAlgos(10_000))

    return { client: appClient }
  }



 

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
        extraFee: AlgoAmount.MicroAlgo(1_000) //per coprire transazione interna
    }
  )
   
    const payTxn = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appClient.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr)
    })

    

   await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      sender: testAccount,
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })

    
    const contractAddress = getApplicationAddress(client.appClient.appId);

    const result = await client.send.isOptedInTo({args: {asset: asset.assetId}, populateAppCallResources: true});
    const balanceAfterOptIn = (await algorand.account.getInformation(testAccount)).balance
    const appBalanceAfterOptIn = (await algorand.account.getInformation(client.appClient.appAddress)).balance

    
    
  })

   test('optInShouldFailWithLowMbr', async() => {

     const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 1_000;    


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

  
    

    await expect(() =>  client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })
  ).rejects.toThrowError('minimum balance requirement for opt in is not met');
    

    const check = await client.send.isOptedInTo({ args: { asset: asset.assetId } })
    expect(check.return).toBe(false);

    

  })

  


  
  test('optInShoulFailWithWrongMbrReceiver', async () => {

    const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    
  
    const balance = (await algorand.account.getInformation(testAccount)).balance
    
  
    const appBalance = (await algorand.account.getInformation(client.appClient.appAddress)).balance
    
    
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

    

    await expect(() =>  (client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) //to cover inner transaction cost
    })
    )).rejects.toThrowError('receiver of the payment is not the contract');
    

    const check = await client.send.isOptedInTo({ args: { asset: asset.assetId } })
    expect(check.return).toBe(false);

   

  })

  test('newListingSuccess', async () => {

    const {testAccount, algorand} = localnet.context;
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

    

    const optIn = await client.send.optInToAsset({
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

    const newListing = await client.send.newListing({ 
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
  
})

test('newListingShouldFailIfPriceIsNotPositive', async () => {

    const {testAccount, algorand} = localnet.context;
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

   
    const optIn = await client.send.optInToAsset({
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

    await expect( () => client.createTransaction.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 0,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrow('Price must be positive')

    
  

  })

  test('newListingShouldFailIfListingAlreadyExists', async () => {

    const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!

    console.log("testAccount:", testAccount.addr.toString());
    console.log("application address:", client.appAddress.toString());

    
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

    

    await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(2_000), 
      sender: testAccount.addr
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

    await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: testAccount.addr
    })

    await expect(() => client.send.newListing({ 
      args: {
        xfer: xfer2,
        unitaryPrice: 2_222,
        mbrPay: mbrPay2
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: testAccount.addr

    })).rejects.toThrowError('Listing for asset already exists');

  })

  test('newListingShouldFailWithWrongMbrReciever', async () => {

    const {testAccount, algorand} = localnet.context;
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

 
    const optIn = await client.send.optInToAsset({
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

    

     console.log("testAccount:", testAccount.addr.toString());
    console.log("application address:", client.appAddress.toString());

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgo(listingMbr),
      receiver: testAccount,
      sender: testAccount
    });
   
    await expect(() =>  client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrowError('Receiver for payment is not the application')


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

   

    const optIn = await client.send.optInToAsset({
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

   
    


    

   
    await expect(() =>  (client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })
  )).rejects.toThrowError('Insufficient funds to create listing')

    

    
    

    

  });

  //'Asset receiver is not the application'
  test('newListingShouldFailWithWrongAssetReceiver', async () => {

    const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!
    //const other =  algorand.account.random();

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

  await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      }, 
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) 
    })
   
  


    

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: testAccount,
      sender: testAccount,
      amount: BigInt(1),
      assetId: asset.assetId,
    })

    

    const mbrPay = algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(listingMbr),
      receiver: client.appAddress,
      sender: testAccount
    });

   
    

    

    

   
    await expect(() => client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrowError('Asset receiver is not the application')
    
   
 

  });

  //Asset must be unique
  test('newListingShouldFailWithNonUniqueAsset', async () => {

    const {testAccount, algorand} = localnet.context;
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

    

    const xfer = algorand.createTransaction.assetTransfer({
      receiver: client.appAddress,
      sender: testAccount,
      amount: BigInt(2), 
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

    

   
    await expect(() => client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_111,
        mbrPay: mbrPay
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })).rejects.toThrowError('Asset must be unique')
    
    
   
  })

  test('changePriceSuccess', async () => {

   const {testAccount, algorand} = localnet.context;
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


    const optIn = await client.send.optInToAsset({
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

    const newListing = await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })


  const price = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(price).toEqual(1_234n)

  
  const changePrice = await client.send.changePrice({
    args: {
      asset: asset.assetId,
      newPrice: 6_789
    }
  })

  const newPrice = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(newPrice).toEqual(6_789n)

  })

  test('changePriceShouldFailIfListingDoesNotExists', async () => {

     const {testAccount, algorand} = localnet.context;
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

 

    const optIn = await client.send.optInToAsset({
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

    const newListing = await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })


  const price = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(price).toEqual(1_234n)

  
  await expect(() => client.send.changePrice({
    args: {
      asset: BigInt(88888), 
      newPrice: 6_789
    }
  })).rejects.toThrowError('Listing for given asset does not exist');

  

  const newPrice = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(newPrice).toEqual(1_234n)

  })

  test('chanegPriceShouldFailIfCallerIsNotSeller', async () => {

    //I have to fund the other account

    const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;


    const other = await algorand.account.random();
    const dispenser = await algorand.account.localNetDispenser();
    await algorand.account.ensureFunded(
      other.addr,
      dispenser,
      (1).algo()
    )

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


    const optIn = await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      //populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000) 
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

    const newListing = await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000)
    })


  const price = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(price).toEqual(1_234n)

  
  await expect(() => client.send.changePrice({
    args: {
      asset: BigInt(asset.assetId), 
      newPrice: 6_789
    },
    sender: other
  })).rejects.toThrowError('Only the owner of this listing can change its price');

  

  const newPrice = (await client.send.getBoxValue({args: {asset: asset.assetId}})).return?.unitaryPrice
  expect(newPrice).toEqual(1_234n)

  })

  test('buySuccess', async () => {

    const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;

    const seller = algorand.account.random();
    await algorand.account.ensureFunded(seller, testAccount, AlgoAmount.MicroAlgos(1_000_000))
    const buyer = algorand.account.random();
    await algorand.account.ensureFunded(buyer, testAccount, AlgoAmount.MicroAlgos(1_000_000))


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

    await algorand.send.assetTransfer({
      sender: seller,
      receiver: seller,
      assetId: BigInt(asset.assetId),
      amount: BigInt(0)
    })

    await algorand.send.assetTransfer({
      sender: buyer,
      receiver: buyer,
      assetId: BigInt(asset.assetId),
      amount: BigInt(0)
    })
   
    const payTxn = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr)
    })

    await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),  //to cover inner transaction cost
      sender: seller
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

    await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: seller
    })

    const buyPay = await algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(1_234),
      sender: buyer.addr,
      receiver: seller.addr
    })

    await client.send.buy({
      args: {
          asset: asset.assetId,
          buyPay: buyPay
      },
      extraFee: AlgoAmount.MicroAlgos(2_000),
      sender: buyer,
      populateAppCallResources: true
    });




  })

  test('buyShouldFailForNonExistingListing', async () => {
    
    const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;

    const seller = algorand.account.random();
    await algorand.account.ensureFunded(seller, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const buyer = algorand.account.random();
    await algorand.account.ensureFunded(buyer, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    console.log("testAccount:", testAccount.addr.toString());
    console.log("seller: ", seller.addr.toString());
    console.log("buyer: ", buyer.addr.toString());

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

    await algorand.send.assetTransfer({
      assetId: BigInt(asset.assetId),
      amount: BigInt(0),
      sender: seller,
      receiver: seller
    })

    await algorand.send.assetTransfer({
      assetId: BigInt(asset.assetId),
      amount: BigInt(0),
      sender: buyer,
      receiver: buyer
    })
   
    const payTxn = await algorand.createTransaction.payment({
      sender: testAccount.addr,
      receiver: client.appAddress,
      amount: AlgoAmount.MicroAlgos(optInMbr)
    })

   
    await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),  
   
    })

    

    /*const xfer = algorand.createTransaction.assetTransfer({
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

    await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: seller
    })*/

    const buyPay = await algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(1_234),
      sender: buyer.addr,
      receiver: seller.addr
    })

    await expect(() => client.send.buy({
      args: {
          asset: asset.assetId,
          buyPay: buyPay
      },
      extraFee: AlgoAmount.MicroAlgos(2_000),
      sender: buyer.addr,
      populateAppCallResources: true
    })).rejects.toThrowError('Listing for given asset does not exist');

   

  })

  //Insufficient payment
  test('buyShoulFailWithInsufficientPayment', async () => {

        const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;

    const seller = algorand.account.random();
    await algorand.account.ensureFunded(seller, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const buyer = algorand.account.random();
    await algorand.account.ensureFunded(buyer, testAccount, AlgoAmount.MicroAlgos(1_000_000))


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

   

    await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000), 
      sender: seller
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

    await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: seller
    })

    const buyPay = await algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(1_234 - 1), //low price
      sender: buyer.addr,
      receiver: seller.addr
    })

    await expect(() => client.send.buy({
      args: {
          asset: asset.assetId,
          buyPay: buyPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: buyer,
      populateAppCallResources: true
    })).rejects.toThrowError('Insufficient payment');

    

  })

  //Pay receiver must be owner of the listing
  test('buyShouldFailWithWrongPayReciever', async () => {

            const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;

    const seller = algorand.account.random();
    await algorand.account.ensureFunded(seller, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const buyer = algorand.account.random();
    await algorand.account.ensureFunded(buyer, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const other = algorand.account.random();
    await algorand.account.ensureFunded(other, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    console.log("seller:", seller.addr.toString());
    console.log("buyer: ", buyer.addr.toString());
    console.log("other: ", other.addr.toString());

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

   

    await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000), 
      sender: seller
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

    await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: seller
    })

    const buyPay = await algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(1_234), 
      sender: buyer.addr,
      receiver: other.addr
    })

    await expect(() => client.send.buy({
      args: {
          asset: asset.assetId,
          buyPay: buyPay
      },
      extraFee: AlgoAmount.MicroAlgos(2_000),
      sender: buyer,
      populateAppCallResources: true
    })).rejects.toThrowError('Pay receiver must be owner of the listing');

    

  })

  test('withdrawSuccess', async () => {

    const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;
    const price = 1_234

  
    const seller = algorand.account.random();
    await algorand.account.ensureFunded(seller, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const buyer = algorand.account.random();
    await algorand.account.ensureFunded(buyer, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const other = algorand.account.random();
    await algorand.account.ensureFunded(other, testAccount, AlgoAmount.MicroAlgos(1_000_000))



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


    await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),  //to cover inner transaction cost
      sender: seller
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

    await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: seller
    })

    const buyPay = await algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(1_234), //low price
      sender: buyer.addr,
      receiver: seller.addr
    })

    await client.send.withdrawAsset({
      args: {
        asset: asset.assetId
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: seller
    })




  })

  //No listing exists for given asset
  test('withdrawFailsIfLisingDoesNotExist', async () => {

        const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;
    const price = 1_234

    const seller = algorand.account.random();
    await algorand.account.ensureFunded(seller, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const buyer = algorand.account.random();
    await algorand.account.ensureFunded(buyer, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const other = algorand.account.random();


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

    

    await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),  //to cover inner transaction cost
      
    })

    

    

   

    await expect(() => client.send.withdrawAsset({
      args: {
        asset: asset.assetId
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: seller.addr
    })).rejects.toThrowError('No listing exists for given asset');

   

  })

  //Only owner can withdraw assets
  test('withdrawFailsIfCallerIsNotOwner', async () => {

            const {testAccount, algorand} = localnet.context;
    const {client} = await deploy(testAccount);
    const optInMbr = 100_000;
    const listingMbr = (await client.send.listingBoxMbr()).return?.microAlgo().valueOf()!;
    const price = 1_234

     const sellerBalance = 1_000_000
    const seller = algorand.account.random();
    await algorand.account.ensureFunded(seller, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const buyerBalance = 1_000
    const buyer = algorand.account.random();
    await algorand.account.ensureFunded(buyer, testAccount, AlgoAmount.MicroAlgos(1_000_000))

    const other = algorand.account.random();
    await algorand.account.ensureFunded(other, testAccount, AlgoAmount.MicroAlgos(1_000_000))



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

    

    await client.send.optInToAsset({
      args: {
        asset: asset.assetId,
        mbrPay: payTxn
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),  //to cover inner transaction cost
      sender: seller
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

    await client.send.newListing({ 
      args: {
        xfer: xfer,
        unitaryPrice: 1_234,
        mbrPay: mbrPay
      },
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: seller
    })

    const buyPay = await algorand.createTransaction.payment({
      amount: AlgoAmount.MicroAlgos(1_234), //low price
      sender: buyer.addr,
      receiver: other.addr
    })

    await expect(() =>  client.send.withdrawAsset({
      args: {
        asset: asset.assetId
      },
      populateAppCallResources: true,
      extraFee: AlgoAmount.MicroAlgos(1_000),
      sender: other.addr
    })).rejects.toThrowError('Only owner can withdraw assets');


  })


})


 
