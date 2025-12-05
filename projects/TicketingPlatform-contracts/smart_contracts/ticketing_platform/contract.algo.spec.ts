import { Account, arc4, Global, OnCompleteAction } from '@algorandfoundation/algorand-typescript'
import { TestExecutionContext } from '@algorandfoundation/algorand-typescript-testing'
import { appOptedIn } from '@algorandfoundation/algorand-typescript/op'
import { afterEach, describe, expect, test } from 'vitest'
import { AssignedTicketKey, TicketingPlatform } from './contract.algo'
import { ByteLengthQueuingStrategy } from 'node:stream/web'
import { a } from 'vitest/dist/chunks/suite.B2jumIFP'

const TEST_DECIMALS = 6

describe('ticketingPlatform', () => {

  //TODO: test di fallimento
  //TODO: test per biglietti ad accesso libero

  const sender = Account();
  const ctx = new TestExecutionContext(sender.bytes);

  const optInMbr = Global.assetOptInMinBalance;

  const listingMbr = (4_00*48) + 2_500;

  afterEach( () => {
    ctx.reset();
  });

  test('optInSuccess', async () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

     ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: seller})]).
    execute(() => {
      contract.optInToAsset(asset, 
        ctx.any.txn.payment({
          sender: seller,
          receiver: testApp.address,
          amount: optInMbr
        })
      )
    })

     expect(ctx.txn.lastGroup.lastItxnGroup().getAssetTransferInnerTxn().assetAmount).
        toEqual(0);
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().xferAsset).
        toEqual(asset); //il mbr
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().assetSender===testApp.address).
        toEqual(true); //dato dal seller
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().assetReceiver===testApp.address).
        toEqual(true);


  })

  //receiver of the payment is not the contract
  test('optInShoulFailIfReceiverOfMbrIsNotContract', async () => {

     const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    const other = ctx.any.account();
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

    
    expect(() => {
      contract.optInToAsset(asset, 
        ctx.any.txn.payment({
          sender: seller,
          receiver: other, //dest sbagliato
          amount: optInMbr
        })
      )
    }).toThrowError('receiver of the payment is not the contract');


  })

  //minimum balance requirement for opt in is not met
  test('optInShouldFailIfPaymentAmountTooLow', async () => {

      const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    const other = ctx.any.account();
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

    
    expect(() => {
      contract.optInToAsset(asset, 
        ctx.any.txn.payment({
          sender: seller,
          receiver: testApp.address, 
          amount: optInMbr - 1 //quantita' troppo bassa
        })
      )
    }).toThrowError('minimum balance requirement for opt in is not met');

  })
 
  test('newListingSuccess', ()=> {
    
    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

    
    
    const startingBalance = testApp.address.balance;
    
    const ledger = ctx.ledger;
      
    ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: seller})]).
    execute(() => {
        contract.optInToAsset(
          asset,
          ctx.any.txn.payment({
            amount: optInMbr,
            sender: seller,
            receiver: testApp.address
          })
        )
        contract.newListing(
          ctx.any.txn.assetTransfer({
              xferAsset: asset,
              assetAmount: 1,
              assetReceiver: testApp.address
          }),
          price,
          ctx.any.txn.payment({
            amount: listingMbr,
            receiver: testApp.address
          })
        )
    });

        const key = new AssignedTicketKey ({
          asset: new arc4.UintN64(asset.id)
        })
        
        const value = contract.assignedTicketlistings(key).value;

        expect(value.owner.native).toEqual(seller);
        expect(value.unitaryPrice.native).toEqual(price.native);
    
    //check opt in
    expect(ctx.txn.lastGroup.lastItxnGroup().getAssetTransferInnerTxn().assetAmount).
        toEqual(0);
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().xferAsset).
        toEqual(asset); //il mbr
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().assetSender===testApp.address).
        toEqual(true); //dato dal seller
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().assetReceiver===testApp.address).
        toEqual(true); //al contratto
          
  });

  test('newListingInsufficientFundsFail', () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

    ctx.any.txn.applicationCall({
      sender: seller,
      appId: testApp,
      onCompletion: OnCompleteAction.OptIn
    })
    
    const startingBalance = testApp.address.balance;
    
    const ledger = ctx.ledger;

        //act
        expect(() =>  contract.newListing(
          ctx.any.txn.assetTransfer({
              xferAsset: asset,
              assetAmount: 1,
              assetReceiver: testApp.address
          }),
          price,
          ctx.any.txn.payment({
            amount: listingMbr - 1, //insufficient mbr
            receiver: testApp.address
          })
        )
        ).toThrowError('Insufficient funds to create listing');

        const key = new AssignedTicketKey ({
          asset: new arc4.UintN64(asset.id)
        })

    expect(contract.assignedTicketlistings(key).exists).toBe(false);

  });

  test('newListingExistingListingFail', () => {
     const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

    ctx.any.txn.applicationCall({
      sender: seller,
      appId: testApp,
      onCompletion: OnCompleteAction.OptIn
    })

    contract.newListing(
      ctx.any.txn.assetTransfer({
              xferAsset: asset,
              assetAmount: 1,
              assetReceiver: testApp.address
          }),
          price,
          ctx.any.txn.payment({
            amount: listingMbr,
            receiver: testApp.address
          })
    )
    
    const startingBalance = testApp.address.balance;
    
    const ledger = ctx.ledger;

        //act
        expect(() =>  contract.newListing(
          ctx.any.txn.assetTransfer({
              xferAsset: asset,
              assetAmount: 1,
              assetReceiver: testApp.address
          }),
          price,
          ctx.any.txn.payment({
            amount: listingMbr,
            receiver: testApp.address
          })
        )
        ).toThrowError('Listing for asset already exists');

        const key = new AssignedTicketKey ({
          asset: new arc4.UintN64(asset.id)
        })

    expect(contract.assignedTicketlistings(key).exists).toBe(true);

  });

  test('newListingWrongPayReceiverFail', () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    const other = ctx.any.account()
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

    ctx.any.txn.applicationCall({
      sender: seller,
      appId: testApp,
      onCompletion: OnCompleteAction.OptIn
    })
    
    const startingBalance = testApp.address.balance;
    
    const ledger = ctx.ledger;

        //act
        expect(() =>  contract.newListing(
          ctx.any.txn.assetTransfer({
              xferAsset: asset,
              assetAmount: 1,
              assetReceiver: testApp.address
          }),
          price,
          ctx.any.txn.payment({
            amount: listingMbr,
            receiver: other //incorrect payment receiver
          })
        )
        ).toThrowError('Receiver for payment is not the application');

        const key = new AssignedTicketKey ({
          asset: new arc4.UintN64(asset.id)
        })

    expect(contract.assignedTicketlistings(key).exists).toBe(false);


  });

  test('newListingWrongAssetReceiverFail', () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    const other = ctx.any.account()
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

    ctx.any.txn.applicationCall({
      sender: seller,
      appId: testApp,
      onCompletion: OnCompleteAction.OptIn
    })
    
    const startingBalance = testApp.address.balance;
    
    const ledger = ctx.ledger;

        //act
        expect(() =>  contract.newListing(
          ctx.any.txn.assetTransfer({
              xferAsset: asset,
              assetAmount: 1,
              assetReceiver: other //indirizzo sbagliato
          }),
          price,
          ctx.any.txn.payment({
            amount: listingMbr,
            receiver: testApp.address
          })
        )
        ).toThrowError('Asset receiver is not the application');

     const key = new AssignedTicketKey ({
          asset: new arc4.UintN64(asset.id)
        })

    expect(contract.assignedTicketlistings(key).exists).toBe(false);

  });

  test('newListingIncorrectAmount', () => {

     const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000});
    const other = ctx.any.account()
    
    
    const price = new arc4.UintN64(1_234);
    
    //arrange
    const testApp = ctx.ledger.getApplicationForContract(contract);

    ctx.any.txn.applicationCall({
      sender: seller,
      appId: testApp,
      onCompletion: OnCompleteAction.OptIn
    })
    
    const startingBalance = testApp.address.balance;
    
    const ledger = ctx.ledger;

        //act
        expect(() =>  contract.newListing(
          ctx.any.txn.assetTransfer({
              xferAsset: asset,
              assetAmount: 2,
              assetReceiver: testApp.address
          }),
          price,
          ctx.any.txn.payment({
            amount: listingMbr,
            receiver: testApp.address
          })
        )
        ).toThrowError('Asset must be unique');

     const key = new AssignedTicketKey ({
          asset: new arc4.UintN64(asset.id)
        })

    expect(contract.assignedTicketlistings(key).exists).toBe(false);

  })

  test('changePriceSuccess', () => {
    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account();
    
    const price = new arc4.UintN64(1_234);
    
    const app = ctx.ledger.getApplicationForContract(contract);

    //act
    ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: seller})]).
    execute(() => {
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address,
        sender: seller
      })
    )
    contract.newListing(
      ctx.any.txn.assetTransfer({
          assetAmount:1,
          assetReceiver: app.address,
          xferAsset: asset
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address
      })
    );
    contract.changePrice(
      asset,
      new arc4.UintN64(1)
    );
  })

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })
    const value = contract.assignedTicketlistings(key).value
    //assert

    expect(value.owner.native).toEqual(sender);
    expect(value.unitaryPrice.native).toEqual(new arc4.UintN64(1).native );

    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().assetAmount).
        toEqual(0);
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().xferAsset).
        toEqual(asset); //il mbr
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().assetSender===app.address).
        toEqual(true); //dato dal seller
    expect(ctx.txn.lastGroup.getItxnGroup().getAssetTransferInnerTxn().assetReceiver===app.address).
        toEqual(true); //al contratto

  });

  test('changePriceNegativePriceFail', () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account();
    
    const price = new arc4.UintN64(1_234);
    
    const app = ctx.ledger.getApplicationForContract(contract);

    //act
    contract.newListing(
      ctx.any.txn.assetTransfer({
          assetAmount:1,
          assetReceiver: app.address,
          xferAsset: asset
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address
      })
    );
    

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    expect(() => contract.changePrice(
      asset,
      new arc4.UintN64(0)
    )).toThrowError('Price cannot be negative');

    const value = contract.assignedTicketlistings(key).value

    expect(value.owner.native===sender).toEqual(true);
    expect(value.unitaryPrice.native).toEqual(price.native );

  })  

    test('changePriceWrongCallerFail', () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account();
    const other = ctx.any.account();
    
    const price = new arc4.UintN64(1_234);
    
    const app = ctx.ledger.getApplicationForContract(contract);

    //act
    contract.newListing(
      ctx.any.txn.assetTransfer({
          assetAmount:1,
          assetSender: seller,
          assetReceiver: app.address,
          xferAsset: asset
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address
      })
    );
    

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: other})]).
    execute( () => {
      expect(() => contract.changePrice(
        asset,
        new arc4.UintN64(1)
      )).toThrowError('Only the owner of this listing can change its price')
    });

    const value = contract.assignedTicketlistings(key).value

    expect(value.owner.native===sender).toEqual(true);
    expect(value.unitaryPrice.native).toEqual(price.native); //method fails no price doesn't change

  })

  test('buySuccess', () => {
    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const buyer = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 0]])});

    expect(buyer.balance).toBe(2_000_000);
    expect(asset.balance(seller)).toEqual(new arc4.UintN64(1).native);
    expect(asset.balance(buyer)).toEqual(new arc4.UintN64(0).native);
    
    const price = new arc4.UintN64(1_234);
    
    const app = ctx.ledger.getApplicationForContract(contract);

    //act
    ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: seller})]).
    execute(() => {
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address
      })
    )
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address
      })
    )
  })

  ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: buyer})]).
    execute(() => {
      contract.buy(
        asset, 
        ctx.any.txn.payment({
          amount: price.native,
          receiver: seller,
          sender: buyer
        })
      )
    })

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

   
    
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().xferAsset).
        toEqual(asset); //asset
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().assetReceiver===buyer).
        toEqual(true); //al compratore
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().assetSender===seller).
        toEqual(true); //dal venditore

    expect(contract.assignedTicketlistings(key).exists).toBe(false);

    expect(ctx.txn.lastGroup.getItxnGroup(1).getPaymentInnerTxn().amount).
        toEqual(listingMbr); //il listing mbr
    expect(ctx.txn.lastGroup.getItxnGroup(1).getPaymentInnerTxn().receiver===seller).
        toEqual(true); //ridato al venditore 
    expect(ctx.txn.lastGroup.getItxnGroup(1).getPaymentInnerTxn().sender===app.address).
        toEqual(true); //dal contratto
});

  test('buyWithChangeSuccess', () => {
    
     const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const buyer = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 0]])});

    expect(buyer.balance).toBe(2_000_000);
    expect(asset.balance(seller)).toEqual(new arc4.UintN64(1).native);
    expect(asset.balance(buyer)).toEqual(new arc4.UintN64(0).native);
    
    const price = new arc4.UintN64(1_234);
    
    const app = ctx.ledger.getApplicationForContract(contract);

    //act
    ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: seller})]).
    execute(() => {
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address
      })
    )
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address
      })
    )
  })

  ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: buyer})]).
    execute(() => {
      contract.buy(
        asset, 
        ctx.any.txn.payment({
          amount: price.native + 250,
          receiver: seller,
          sender: buyer
        })
      )
    })

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    expect(contract.assignedTicketlistings(key).exists).toBe(false);

   
       

    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().xferAsset).
        toEqual(asset); //l'asset
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().assetAmount).
        toEqual(1); //asset unico
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().assetReceiver===buyer).
        toEqual(true); //dato al compratore
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().assetSender===seller).
        toEqual(true); //dal venditore

    expect(ctx.txn.lastGroup.getItxnGroup(1).getPaymentInnerTxn().amount).
        toEqual(new arc4.UintN64(250).native); //il resto
    expect(ctx.txn.lastGroup.getItxnGroup(1).getPaymentInnerTxn().receiver===buyer).
        toEqual(true); //dato al compratore
    expect(ctx.txn.lastGroup.getItxnGroup(1).getPaymentInnerTxn().sender===seller).
        toEqual(true); //dal venditore

    expect(ctx.txn.lastGroup.getItxnGroup(2).getPaymentInnerTxn().amount).
        toEqual(listingMbr); //il listing mbr
    expect(ctx.txn.lastGroup.getItxnGroup(2).getPaymentInnerTxn().receiver===seller).
        toEqual(true); //ridato al venditore
    expect(ctx.txn.lastGroup.getItxnGroup(2).getPaymentInnerTxn().sender===app.address).
        toEqual(true); //dal contratto
    
    expect(contract.assignedTicketlistings(key).exists).toBe(false);
   
    
    const payment = ctx.txn.lastGroup.getItxnGroup().getPaymentInnerTxn();
    expect(payment.amount).toEqual(listingMbr);
    expect(payment.receiver===seller).toEqual(true);
        

  });

  test('buyInsufficientPaymentFail', () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const buyer = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 0]])});

    expect(buyer.balance).toBe(2_000_000);
    expect(asset.balance(seller)).toEqual(new arc4.UintN64(1).native);
    expect(asset.balance(buyer)).toEqual(new arc4.UintN64(0).native);
    
    const price = new arc4.UintN64(1_234);
    
    const app = ctx.ledger.getApplicationForContract(contract);

    //act
    ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: seller})]).
    execute(() => {
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address
      })
    )
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetSender: seller,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        sender: seller,
        receiver: app.address
      })
    )
  });

  ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: buyer})]).
    execute(() => {
      expect(() => contract.buy(
        asset,
        ctx.any.txn.payment({
          sender: buyer,
          receiver: seller, 
          amount: price.native - 1
        })
      )
    ).toThrowError('Insufficient payment');

  });
    //test
    const key = new AssignedTicketKey({
      asset:new arc4.UintN64(asset.id)
    });

   
    expect(contract.assignedTicketlistings(key).exists).toBe(true); 
    //listing still exists, purchase didn't happen
    //expect(asset.balance(seller)).toEqual(new arc4.UintN64(0).native); //listing was created
    //expect(asset.balance(buyer)).toEqual(new arc4.UintN64(0).native); //but purchase didn't happen
    
    const value = contract.assignedTicketlistings(key).value;
    expect(value.owner.native===seller).toEqual(true);
    expect(value.unitaryPrice.native).toEqual(price.native);

  })

   test('buyWrongPaymentReceiverFail', () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const buyer = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 0]])});
    const other = ctx.any.account();

    expect(buyer.balance).toBe(2_000_000);
    expect(asset.balance(seller)).toEqual(new arc4.UintN64(1).native);
    expect(asset.balance(buyer)).toEqual(new arc4.UintN64(0).native);
    
    const price = new arc4.UintN64(1_234);
    
    const app = ctx.ledger.getApplicationForContract(contract);

    //act
    ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: seller})]).
    execute(() => {
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address
      })
    )
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetSender: seller,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        sender: seller,
        receiver: app.address
      })
    )
  });

  ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: buyer})]).
    execute(() => {
      expect(() => contract.buy(
        asset,
        ctx.any.txn.payment({
          sender: buyer,
          receiver: other, 
          amount: price.native
        })
      )
    ).toThrowError('Pay receiver must be owner of the listing');

  });
    //test
    const key = new AssignedTicketKey({
      asset:new arc4.UintN64(asset.id)
    });

   
    expect(contract.assignedTicketlistings(key).exists).toBe(true); 
    //listing still exists, purchase didn't happen

    
    const value = contract.assignedTicketlistings(key).value;
    expect(value.owner.native===seller).toEqual(true);
    expect(value.unitaryPrice.native).toEqual(price.native);

  })

  test('withdrawSuccess', async () => {
    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});

    const app = ctx.ledger.getApplicationForContract(contract);

    const price = new arc4.UintN64(1_234);

    console.log('seller opted in: %b', appOptedIn(seller, app));

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    //act
    ctx.txn.createScope([ctx.any.txn.applicationCall({sender: seller,appId: contract})]).
    execute(() => {
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address,
      })
    )
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address
      })
    )

  })
   
  ctx.txn.createScope([ctx.any.txn.applicationCall({sender: seller,appId: contract})]).
    execute(() => {
       contract.withdrawAsset(
      asset
    )

  })

    
  
  //assert
 
  expect(contract.assignedTicketlistings(key).exists).toBe(false);


  /*expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn(0).assetAmount).
        toEqual(1); 
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn(0).xferAsset).
        toEqual(asset); //asset
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn(0).assetReceiver).
        toEqual(seller); //ridato al venditore
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn(0).assetSender).
        toEqual(app.address); //dal contratto

    expect(ctx.txn.lastGroup.getItxnGroup().getPaymentInnerTxn(0).amount).
        toEqual(listingMbr); //il listing mbr
    expect(ctx.txn.lastGroup.getItxnGroup().getPaymentInnerTxn(0).receiver).
        toEqual(seller); //ridato al venditore
    expect(ctx.txn.lastGroup.getItxnGroup().getPaymentInnerTxn(0).sender).
        toEqual(app.address); //dal contratto*/

    

});

  test('withdrawFailNoListingFail', () => {

        const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});

    const app = ctx.ledger.getApplicationForContract(contract);

    const price = new arc4.UintN64(1_234);

    console.log('seller opted in: %b', appOptedIn(seller, app));

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    //act
  
  //no listing created

  ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: seller})]).
  execute(() => {
    expect(() => {
      contract.withdrawAsset(
        asset
      )
    }).toThrowError('No listing exists for given asset')
  })
  //assert
 
    expect(contract.assignedTicketlistings(key).exists).toBe(false);
  })

  test('withdrawWrongCallerFail', () => {

        const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const other = ctx.any.account();

    const app = ctx.ledger.getApplicationForContract(contract);

    const price = new arc4.UintN64(1_234);

    console.log('seller opted in: %b', appOptedIn(seller, app));

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    //act
    ctx.txn.createScope([ctx.any.txn.applicationCall({
      sender: seller,
      appId: contract
    })]).
    execute(() => {
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address
      })
    )
  });


 

  ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: other})]).
  execute(() => 
    expect(() => { 
      contract.withdrawAsset(
        asset
      )
    }).toThrowError('Only owner can withdraw assets')
  );
  //assert
 
  expect(contract.assignedTicketlistings(key).exists).toBe(true); 
  //listing was created but withdraw failed

  });



  test('buyWithAssetsSuccess', () => {
    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const asset1 = ctx.any.asset();
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const buyer = ctx.any.account({balance: 1_000_000, optedAssetBalances: new Map([[asset1.id, 1]])});
    const other = ctx.any.account();

    const app = ctx.ledger.getApplicationForContract(contract);

    const price = new arc4.UintN64(1_234);

    //act
    ctx.txn.createScope([ctx.any.txn.applicationCall({
      sender: seller,
      appId: contract
    })]).
    execute(() => {
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address,
        sender: seller
      })
    )
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetSender: seller,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address
      })
    )
  });

  ctx.txn.createScope([ctx.any.txn.applicationCall({appId: contract, sender: buyer})]).
    execute(() => {
      contract.buyWithAssets(
        asset,
        ctx.any.txn.assetTransfer({
          assetSender: buyer,
          assetReceiver: app.address, 
          assetAmount: 1,
          xferAsset: asset1
        })
      )
  });

  const key = new AssignedTicketKey({
    asset: new arc4.UintN64(asset.id)
  })
  //verify
  expect(contract.assignedTicketlistings(key).exists).toBe(false);
  
  expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().xferAsset).
        toEqual(asset); //asset venduto
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().assetReceiver===buyer).
        toBe(true); //dato al compratore
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn().assetSender===seller).
        toBe(true); //dal venditore

  expect(ctx.txn.lastGroup.getItxnGroup().getPaymentInnerTxn().amount).
        toEqual(listingMbr); //il listing mbr
    expect(ctx.txn.lastGroup.getItxnGroup().getPaymentInnerTxn().receiver===seller).
        toEqual(true); //ridato al venditore
    expect(ctx.txn.lastGroup.getItxnGroup().getPaymentInnerTxn().sender===app.address).
        toEqual(true);

    
  
});

test('mintNFTSuccess', () => {
  const contract = ctx.contract.create(TicketingPlatform);
  const asset = ctx.any.asset({decimals: TEST_DECIMALS});
  const asset1 = ctx.any.asset();
  const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
  const buyer = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset1.id, 1]])});

  const app = ctx.ledger.getApplicationForContract(contract);

  const nft = contract.mintNft(
    'ticket1',
    'https://google.com'
  )

  console.log(nft);
  

})

test('withdrawAssetSuccess', async () => {

   const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const asset1 = ctx.any.asset();
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const buyer = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset1.id, 1]])});

    const app = ctx.ledger.getApplicationForContract(contract);

    const price = new arc4.UintN64(1_234);

    ctx.txn.createScope([ctx.any.txn.applicationCall({
      sender: seller,
      appId: contract
    })]).
    execute(() => {
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address,
        sender: seller
      })
    )
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetSender: seller,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address,
        sender: seller
      })
    ),
    contract.withdrawAsset(asset)
  });

  const key = new AssignedTicketKey({
    asset: new arc4.UintN64(asset.id)
  });

  expect(contract.assignedTicketlistings(key).exists).toBe(false);

   expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn(0).xferAsset).
        toEqual(asset); //l'asset ritirato
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn(0).assetReceiver===app.address).
       toEqual(true); //ridato al venditore 
    expect(ctx.txn.lastGroup.getItxnGroup(0).getAssetTransferInnerTxn(0).assetSender===app.address).
        toEqual(true); //dall'aplicazione
    //questa e' la transazione di optIn

     expect(ctx.txn.lastGroup.getItxnGroup(2).getPaymentInnerTxn().amount).
        toEqual(listingMbr); //il listing mbr
    expect(ctx.txn.lastGroup.getItxnGroup(2).getPaymentInnerTxn().receiver===seller).
        toEqual(true); //ridato al venditore
    expect(ctx.txn.lastGroup.getItxnGroup(2).getPaymentInnerTxn().sender===app.address).
        toEqual(true); //dal contratto

    //TODO. check di asset restituito

})
//'No listing exists for given asset'
test('withdrawShouldFailIfListingDoesNotExist', async () => {

  const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const asset1 = ctx.any.asset();
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const buyer = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset1.id, 1]])});

    const app = ctx.ledger.getApplicationForContract(contract);

    const price = new arc4.UintN64(1_234);

    ctx.txn.createScope([ctx.any.txn.applicationCall({
      sender: seller,
      appId: contract
    })]).
    execute(() => expect(() => { 
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address,
        sender: seller
      })
    ),
    contract.withdrawAsset(asset)
  })).toThrowError('No listing exists for given asset');

  const key = new AssignedTicketKey({
    asset: new arc4.UintN64(asset.id)
  });

  expect(contract.assignedTicketlistings(key).exists).toBe(false);


})

//'Only owner can withdraw assets'
test('withdrawShouldFailIfCallerIsNotOwner', async () => {

    const contract = ctx.contract.create(TicketingPlatform);
    const asset = ctx.any.asset({decimals: TEST_DECIMALS});
    const asset1 = ctx.any.asset();
    const seller = ctx.any.account({balance: 2_000_000, optedAssetBalances: new Map([[asset.id, 1]])});
    const buyer = ctx.any.account({balance: 2_000_000, optedAssetBalances:   new Map([[asset1.id, 1]])});
    const other = ctx.any.account();

    const app = ctx.ledger.getApplicationForContract(contract);

    const price = new arc4.UintN64(1_234);

    ctx.txn.createScope([ctx.any.txn.applicationCall({
      sender: seller,
      appId: contract
    })]).
    execute(() => { 
    contract.optInToAsset(
      asset,
      ctx.any.txn.payment({
        amount: optInMbr,
        receiver: app.address,
        sender: seller
      })
    ),
    contract.newListing(
      ctx.any.txn.assetTransfer({
        xferAsset: asset,
        assetSender: seller,
        assetReceiver: app.address,
        assetAmount: 1
      }),
      price,
      ctx.any.txn.payment({
        amount: listingMbr,
        receiver: app.address,
        sender: seller
      })
    )
  })

  ctx.txn.createScope([ctx.any.txn.applicationCall({
      sender: other,
      appId: contract
    })]).
    execute(() => expect(() => {
      contract.withdrawAsset(asset)
    })).toThrowError('Only owner can withdraw assets')

  const key = new AssignedTicketKey({
    asset: new arc4.UintN64(asset.id)
  });

  expect(contract.assignedTicketlistings(key).exists).toBe(true);

})

});