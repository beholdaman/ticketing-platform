import { TestExecutionContext } from "@algorandfoundation/algorand-typescript-testing"
import { afterEach, describe, expect, test } from 'vitest'
import { AssignedTicketKey, AssignedTicketValue, TicketingPlatform } from "../t_uno/contract.algo"
import { arc4, Bytes, Global, gtxn } from '@algorandfoundation/algorand-typescript'
import { interpretAsArc4 } from '@algorandfoundation/algorand-typescript/arc4'
import { GTxn } from "@algorandfoundation/algorand-typescript/op"
import * as algosdk from "@algorandfoundation/algorand-typescript-testing"
import * as algots from "@algorandfoundation/algorand-typescript"
import { ItxnGroup } from "@algorandfoundation/algorand-typescript-testing/subcontexts/transaction-context"

const TEST_DECIMALS = 6;

describe('TicketingPlatform', () => {

    const context = new TestExecutionContext()
    const optInMbr = Global.assetCreateMinBalance;
    const listingMbr = (4_00*48) + 2_500;

    afterEach( () => {
        context.reset();
    })

    test('optInToAssetSuccess', () => {
        const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        //arrange
        var testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                sender: seller,
                amount: optInMbr,
            })
        );

        //ASSERT
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })

        testApp = context.ledger.getApplicationForContract(contract);

        //il contratto ha fatto opt in all'asset
        expect(testApp.address.isOptedIn(asset)).toEqual(true);

        //non ci sono ancora listing per l'asset dato
        expect(!contract.assignedTicketlistings(key).exists).toEqual(true);

        //al bilancio si aggiunge mbr per opt in
        expect(testApp.address.balance).toEqual(startingBalance+optInMbr);
        
    });

    //se opt-in viene fatto due volte il risultato dovrebbe essere lo stesso
    //ma con un solo optInMbr pagato
    test('optInToAssetAlreadyOptedInFail', () => {
        const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                amount: optInMbr,
            })
        );
        //gia' fatto opt in
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                amount: optInMbr,
            })
        )

        //ASSERT
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })

        //il contratto ha fatto opt in all'asset
        expect(testApp.address.isOptedIn(asset));

        //non ci sono ancora listing per l'asset dato
        expect(!contract.assignedTicketlistings(key).exists)

        //al bilancio si aggiunge UN SOLO mbr per opt in
        expect(testApp.address.balance===startingBalance+optInMbr)
        
    });

    test('optInToAssetInsufficientMbrFail', () => {
        const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                amount: optInMbr-1, //insufficent funds
            })
        );

        //ASSERT
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })
        
        //il bilancio rimane invariato
        expect(testApp.address.balance===startingBalance);

        //non c'e' stato opt-in
        expect(!testApp.address.isOptedIn(asset));

        //non ci sono ancora listing per l'asset dato
        expect(!contract.assignedTicketlistings(key).exists)

    })

    test('optInToAssetWrongPayReceiverFail', () => {
        const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: context.any.account(), //indirizzo sbagliato
                amount: optInMbr,
            })
        );

        //ASSERT
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })
        
        //il bilancio rimane invariato
        expect(testApp.address.balance===startingBalance);

        //non c'e' stato opt-in
        expect(!testApp.address.isOptedIn(asset));

        //non ci sono ancora listing per l'asset dato
        expect(!contract.assignedTicketlistings(key).exists)
    })



    test('newListingSuccess' , () => {
        const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        const price = new arc4.UintN64(1_234);

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        const ledger = context.ledger;

        expect(testApp.address.balance).toEqual(startingBalance);

        contract.optInToAsset(asset, context.any.txn.payment({
            sender: seller,
            receiver: testApp.address,
            amount: optInMbr
        }));

        expect(testApp.address.balance).toEqual(startingBalance+optInMbr);
        expect(testApp.address.isOptedIn(asset)).toEqual(true);

        contract.newListing(
            context.any.txn.assetTransfer({
                xferAsset: asset,
                assetReceiver: testApp.address,
                sender: seller,
                assetAmount: 1
            }),
            price,
            context.any.txn.payment({
                amount: listingMbr,
                sender: seller,
                receiver: testApp.address
            })
        )

        expect(testApp.address.balance).toEqual(startingBalance+optInMbr+listingMbr);

        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        });

        expect(contract.assignedTicketlistings(key).exists).toEqual(true);

        //grouped transaction?
        /*context.txn.createScope([
            context.any.txn.applicationCall(
                {appId: testApp, appArgs: [Bytes('optInToAsset'), asset, 
                    context.any.txn.payment(
                        {sender: seller, receiver: testApp.address, amount: optInMbr})
                ]}
            ),
            context.any.txn.applicationCall(
                {appId: testApp, appArgs: [Bytes('newListing'), 
                    context.any.txn.assetTransfer({
                        xferAsset: asset,
                        sender: seller,
                        assetReceiver: testApp.address,
                        assetAmount: 1
                    }),
                    price,
                    context.any.txn.payment({
                        sender: seller,
                    receiver: testApp.address,
                    amount: listingMbr
                    })
                
                ]}
            )
        ]).execute(contract.approvalProgram);
        expect(context.txn.lastGroup.transactions.length).toEqual(2)*/
        



        //ASSERT

        //al bilancio dell'account e' sommato l'mbr
        expect(testApp.address.balance).toEqual(startingBalance+listingMbr+optInMbr);
        

        //esiste un nuovo listing per l'asset dato con il prezzo dato

        //creare il box  
        // per l'asset dato  con il prezzo dato
         // Il proprieatario del listing e' il chiamante del metodo

         expect(context.ledger.boxExists(contract, Bytes('listings').concat(key.bytes))).toBe(true);

    });

    //il prezzo stabilito non puo' essere negativo o nullo
    /*test('newListingNegativePriceFail', ()=> {
        const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        const price = new arc4.UintN64(0);

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                amount: optInMbr,
            })
        );
        contract.newListing(
            context.any.txn.assetTransfer({
                xferAsset: asset,
                sender: seller,
                assetReceiver: testApp.address,
                assetAmount: 1
            }),
            price,
            context.any.txn.payment({
                sender: seller,
                receiver: testApp.address,
                amount: listingMbr
            })
        );

        //ASSERT

        //al bilancio dell'account NON e' sommato l'mbr
        expect(testApp.address.balance===startingBalance)

        //NON esiste un nuovo listing per l'asset dato con il prezzo dato
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })
        expect(!contract.assignedTicketlistings(key).exists);
    });

    
    //mbr deve essere sufficiente
    test('newListingInsufficentMbrFail', () => { //insufficient mbr
        const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        const price = new arc4.UintN64(1_234);

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                amount: optInMbr,
            })
        );
        contract.newListing(
            context.any.txn.assetTransfer({
                xferAsset: asset,
                sender: seller,
                assetReceiver: testApp.address,
                assetAmount: 1
            }),
            price,
            context.any.txn.payment({
                sender: seller,
                receiver: testApp.address,
                amount: listingMbr-2_00 //insufficient mbr
            })
        );

        //ASSERT

        //al bilancio dell'account NON e' sommato l'mbr
        expect(testApp.address.balance===startingBalance)

        //NON esiste un nuovo listing per l'asset dato con il prezzo dato
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })
        expect(!contract.assignedTicketlistings(key).exists);
    });
   

    //non devono esistere altri listing per questo asset
    test('newListingNotOptedInFail', ()=> {
        const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        const price = new arc4.UintN64(1_234);

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act (due newListing per stesso asset)
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                amount: optInMbr,
            })
        );
        contract.newListing(
            context.any.txn.assetTransfer({
                xferAsset: asset,
                sender: seller,
                assetReceiver: testApp.address,
                assetAmount: 1
            }),
            price,
            context.any.txn.payment({
                sender: seller,
                receiver: testApp.address,
                amount: listingMbr
            })
        );
         contract.newListing( //2
            context.any.txn.assetTransfer({
                xferAsset: asset,
                sender: seller,
                assetReceiver: testApp.address,
                assetAmount: 1
            }),
            price,
            context.any.txn.payment({
                sender: seller,
                receiver: testApp.address,
                amount: listingMbr
            })
        );

        //ASSERT

        //al bilancio dell'account e' sommato UNO SOLO mbr
        expect(testApp.address.balance===startingBalance+listingMbr)

        //esiste UN SOLO nuovo listing per l'asset dato con il prezzo dato
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })
        expect(contract.assignedTicketlistings(key).exists);
    });


    //in ogni caso verificare che un asset sia stato inviato dal chiamante 
    test('newListingWrongSenderFail', () => { //sender is not caller

         const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        const price = new arc4.UintN64(1_234);

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                amount: optInMbr,
            })
        );
        contract.newListing(
            context.any.txn.assetTransfer({
                xferAsset: asset,
                sender: context.any.account(), //wrong sender
                assetReceiver: testApp.address,
                assetAmount: 1
            }),
            price,
            context.any.txn.payment({
                sender: seller,
                receiver: testApp.address,
                amount: listingMbr
            })
        );

        //ASSERT

        //al bilancio dell'account NON e' sommato l'mbr
        expect(testApp.address.balance===startingBalance)

        //NON esiste un nuovo listing per l'asset dato con il prezzo dato
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })
        expect(!contract.assignedTicketlistings(key).exists);
    })

    //il ricevitore dell'asset non e' il contratto
    test('newListingWrongReceiverFail', () => { //reciever is not contract
         const contract = context.contract.create(TicketingPlatform);
        const asset = context.any.asset({decimals: TEST_DECIMALS});
        const seller = context.any.account();

        const price = new arc4.UintN64(1_234);

        //arrange
        const testApp = context.ledger.getApplicationForContract(contract);

        const startingBalance = testApp.address.balance;

        //act
        contract.optInToAsset(
            asset,
            context.any.txn.payment({
                receiver: testApp.address,
                amount: optInMbr,
            })
        );
        contract.newListing(
            context.any.txn.assetTransfer({
                xferAsset: asset,
                sender: seller,
                assetReceiver: context.any.account(), //wrong receiver
                assetAmount: 1
            }),
            price,
            context.any.txn.payment({
                sender: seller,
                receiver: testApp.address,
                amount: listingMbr
            })
        );

        //ASSERT

        //al bilancio dell'account NON e' sommato l'mbr
        expect(testApp.address.balance===startingBalance)

        //NON esiste un nuovo listing per l'asset dato con il prezzo dato
        const key = new AssignedTicketKey ({
            asset: new arc4.UintN64(asset.id)
        })
        expect(!contract.assignedTicketlistings(key).exists);
    })
    //come altro posso testare il fallimento della chiamata al contratto?
    */
})
