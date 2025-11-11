/*import { Contract } from '@algorandfoundation/algorand-typescript'

export class TUno extends Contract {
  public hello(name: string): string {
    return `Hello, ${name}`
  }
}*/

//import {Contract} from "@algorandfoundation/tealscript"
/*npx --yes @algorandfoundation/algokit-client-generator generate 
-a ./contracts/artifacts/TicketingPlatform.arc56.json 
-o ./contracts/clients/TicketingPlatformClient.ts*/

import { Account, arc4, assert, Asset, BoxMap, Global, gtxn, itxn, op, Txn, uint64 } from "@algorandfoundation/algorand-typescript"


//gli asset sono unici, anche con un nonce si potrebbero avere piu' listing per lo stesso asset

//se si usa zkp, si puo' evitare di dover specificare il proprietario?

//sara' possibile fare un modo per cercare listing a partire da un asset? no
//  o da un concerto? sarebbe una stringa

export class AssignedTicketKey extends arc4.Struct<{
  asset: arc4.UintN64
}> {}
export class AssignedTicketValue extends arc4.Struct<{
  owner: arc4.Address,
  unitaryPrice: arc4.UintN64
}> {}

export class FreeAccessTicketKey extends arc4.Struct<{
  asset: arc4.UintN64,
  owner: arc4.Address,
  nonce: arc4.UintN64
}> {}
export class FreeAccessTicketValue extends arc4.Struct<{
  quantity: arc4.UintN64,
  unitaryPrice: arc4.UintN64
}> {}

//la quantita' venduta e' sempre 1, essendo gli asset unici

//(AssetId) -> (Address, price)
//(uint64) -> (Address, unit64)
//(8) -> (32 + 8) = 48b 
//2_500 creazione box; 4_00 per ogni byte nel box

//(asset, owner, nonce) -> quantity, price
//(uint64, address, unit64) -> uint64, uint64
//(8 + 32 + 8) -> 8 + 8
//48 -> 16 == 64b

//.TODO: 
//[FATTO] uso listing per biglietti non unici?
//- metodo/contratto creazione biglietti 
//[FATTO] metodo per ricevere asset come pagamento
//[FATTO] - eliminazione controlli sul appCall.sender se non necessari (o usare this.transaction.address)
/*this.txn.sender va bene? serve per verificare la proprieta' del box */
// - metodo swap?

//[FATTO] aggiustare uso di opt in implicito
/*la transazioni in argomento sono eseguite prima della chiamata alla app
  per cui se provo a comprare un asset senza opt in la transazione semplicemente fallisce.
  Rendere opt-in pubblico (wrappare in utils?)
*/
//si puo' evitare il controllo su overspending
//metodo di opt-out?
//rivedere relazione tra opt in e create listing

export class TicketingPlatform extends arc4.Contract {

  
  assignedTicketlistings = BoxMap<AssignedTicketKey, AssignedTicketValue>({keyPrefix: 'listings'});
  freeAcessTicketlisings = BoxMap<FreeAccessTicketKey, FreeAccessTicketValue>({keyPrefix: 'listings1'});

  listingBoxMbr(): uint64 {
    return (
      2_500 + (
        4_00 * 48
      )
    )
  }

  freeListingBoxMbr(): uint64 {
    return (
      2_500 + (
        4_00 * 64
      )
    )
  }

  

  @arc4.abimethod()
  public balance(): uint64 {
    const [balance, exists] = op.AcctParams.acctBalance(Global.currentApplicationAddress);
    return balance;
  }

  @arc4.abimethod()
  public mintNft(sender: Account, assetName: string, ticket_link: string): uint64{
    const result = itxn.assetConfig({
      sender: sender,
      assetName: assetName,
      url: ticket_link,
      total: 1,
      decimals: 0,
      manager: Txn.sender,
      reserve: Txn.sender,
      freeze: Txn.sender,
      clawback: Txn.sender,
      fee: Global.minTxnFee
    }).submit();

    return result.createdAsset.id;
  }

  

  //TODO. mint free access ticket

  //un utente paga perche' il contratto possa gestire un certo asset
  //dopo chiunque potra' mettere in vendita questo asset senza pagare
  //il costo puo' essere recuperato solo se tutti gli altri utenti chiudessero i propri listing con questo asset
  //ma l'asset e' unico...
  @arc4.abimethod()
  public optInToAsset(asset: Asset, mbrPay: gtxn.PaymentTxn): void {
    //posso farla chiamare sempre da newListing?

    //controllo che il contratto non abbia gia' fatto opt-in all'asset desiderato
    assert(!Global.currentApplicationAddress.isOptedIn(asset));

    assert(mbrPay.receiver===Global.currentApplicationAddress);
    assert(mbrPay.amount===Global.assetOptInMinBalance)

    //effettua una transazione di opt-in 
    // (asset transfer vuota da contratto a contratto per l'asset desiderato)
    itxn.assetTransfer({
      xferAsset: asset,
      assetSender: Global.callerApplicationAddress,
      assetReceiver: Global.currentApplicationAddress,
      assetAmount: 0,
    }).submit();

    
  }

  @arc4.abimethod()
  public newListing(xfer: gtxn.AssetTransferTxn, unitaryPrice: arc4.UintN64, mbrPay: gtxn.PaymentTxn): void {

    //si e' fatto opt-in per l'asset
    //assert(Global.currentApplicationAddress.isOptedIn(xfer.xferAsset));

    //il prezzo non puo' essere 0
    assert(unitaryPrice.native > 0);

    
    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(xfer.xferAsset.id)
    })

    //non devono esistere altri listing per questo asset
    assert(!this.assignedTicketlistings(key).exists, 'Listing for asset already exists');

    //se c'e' gia' stato opt-in l'utente paghi solo per creare il box
    assert(Global.currentApplicationId.address===mbrPay.receiver, 'Receiver for payment is not the application');

    //mbr sufficiente
    assert(mbrPay.amount>=this.listingBoxMbr(), 'Insufficient funds to create listing')

    //in ogni caso verificare che un asset sia stato inviato dal chiamante al contratto
    assert(xfer.assetReceiver===Global.currentApplicationId.address, 'Asset receiver is not the application');
    assert(xfer.assetAmount===1, 'Asset must be unique');

    //creare il box  
    // per l'asset dato  con il prezzo dato
    // Il proprieatario del listing e' il chiamante del metodo
    this.assignedTicketlistings(key).value = new AssignedTicketValue({
      owner: new arc4.Address(Txn.sender),
      unitaryPrice: unitaryPrice
    })
  }

  @arc4.abimethod()
  public newListingFreeAccess(xfer: gtxn.AssetTransferTxn, quantity: arc4.UintN64, price: arc4.UintN64, nonce: arc4.UintN64, mbrPay: gtxn.PaymentTxn) : void {

    //assert(Global.currentApplicationAddress.isOptedIn(xfer.xferAsset));

    //il prezzo fissato e' superiore a 0
    assert(price.native > 0);

    //la quantita' fissata e' superiore a 0
    assert(quantity.native > 0);

    const key = new FreeAccessTicketKey(
      {
        asset: new arc4.UintN64(xfer.xferAsset.id),
        owner: new arc4.Address(xfer.assetSender),
        nonce: nonce
      }
    );

    //non devono esistere altri listing con questa chiave
    assert(!this.freeAcessTicketlisings(key).exists);

    //il dest del pagamento e' il contratto
    assert(Global.currentApplicationId.address===mbrPay.receiver);

     //mbr sufficiente
    assert(this.freeListingBoxMbr()===mbrPay.amount)

    //in ogni caso verificare che un asset sia stato inviato dal chiamante al contratto
    assert(xfer.assetReceiver===Global.currentApplicationId.address);
    


    this.freeAcessTicketlisings(key).value = new FreeAccessTicketValue({
      quantity: quantity,
      unitaryPrice: price
    })

    

  }

    //cambiare il prezzo di un listing
  @arc4.abimethod()
  public changePrice(asset: Asset, newPrice: arc4.UintN64): void {

    //il nuovo prezzo non puo' essere 0
    assert(newPrice.native > 0, 'Price cannot be negative');

    //il prezzo puo' essere cambiato solo dal proprietario dell'asset
    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    assert(this.assignedTicketlistings(key).exists===true, 'Listing for given asset does not exist');

    const listing = this.assignedTicketlistings(key);

    assert(listing.value.owner.native === Txn.sender, 'Only the owner of this listing can change its price');

    //assegnato box con nuovo prezzo
    this.assignedTicketlistings(key).value = new AssignedTicketValue({
      owner: new arc4.Address(Txn.sender),
      unitaryPrice: newPrice //sovrascrizione prezzo
    });

    //se nessun listing per questo asset e per questo utente esiste, il metodo fallisce (?)

  }

  @arc4.abimethod()
  public changePriceFreeAccess(asset: Asset, nonce: arc4.UintN64, newPrice: arc4.UintN64): void {

    assert(newPrice.native > 0);

    //assert(Global.currentApplicationAddress.isOptedIn(asset));

    const key = new FreeAccessTicketKey({
      asset: new arc4.UintN64(asset.id),
      owner: new arc4.Address(Txn.sender),
      nonce: nonce
    })

    assert(this.freeAcessTicketlisings(key).exists, 'you do not posess a listing for this asset');

    const value = this.freeAcessTicketlisings(key).value.copy();

     this.freeAcessTicketlisings(key).value = new FreeAccessTicketValue({
      quantity: value.quantity,
      unitaryPrice: newPrice
    })
  }

  public deposit(quantity: arc4.UintN64, asset: Asset, nonce: arc4.UintN64): void {

    //assert(Global.currentApplicationAddress.isOptedIn(asset));

    const key = new FreeAccessTicketKey({
      asset: new arc4.UintN64(asset.id),
      owner: new arc4.Address(Txn.sender),
      nonce: nonce
    })

    const value = this.freeAcessTicketlisings(key).value.copy();

    this.freeAcessTicketlisings(key).value = new FreeAccessTicketValue({
      quantity: new arc4.UintN64(value.quantity.native + quantity.native),
      unitaryPrice: value.unitaryPrice
    });

  }



  //compra l'asset dato
  @arc4.abimethod()
  public buy(asset: Asset, buyPay: gtxn.PaymentTxn): void {

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })
    
    assert(this.assignedTicketlistings(key).exists, 'Listing for given asset does not exist');


    //estraggo prezzo attuale e proprietario dell'asset
    const owner = this.assignedTicketlistings(key).value.owner;
    const price = this.assignedTicketlistings(key).value.unitaryPrice;

    //verifica che il pagamento copra il prezzo del biglietto
    assert(buyPay.amount >= price.native, 'Insufficient payment');

    //resto del pagamento dell'asset
    const change: uint64 = buyPay.amount - price.native;

    //il destinatario e' il proprietario dell'asset
    assert(buyPay.receiver === owner.native, 'Pay receiver must be owner of the listing');

   

    //invia l'asset desiderato al chiamante del metodo (o al pagante?)
    itxn.assetTransfer({
      xferAsset: asset,
      assetReceiver: Txn.sender,
      assetAmount: 1,
      fee: 0
    }).submit()

    //invia l'eventuale resto al chiamante
    if(change>0) {
      itxn.payment({
        sender: owner.native,
        receiver: Txn.sender,
        amount: change,
        fee:0
      }).submit()
    }

    //recupero spese per spazio listing al proprietario del box
    itxn.payment({
      sender: Global.currentApplicationAddress,
      receiver: owner.native,
      amount: this.listingBoxMbr(),
      fee: 0
    }).submit();

    //eliminazione box dai listing
    this.assignedTicketlistings(key).delete();

  }

  public buyFreeAccessTicket(asset: Asset, owner: arc4.Address, nonce: arc4.UintN64, quantity: arc4.UintN64, payment: gtxn.PaymentTxn): void {

    const key = new FreeAccessTicketKey({
      asset: new arc4.UintN64(asset.id),
      owner: owner,
      nonce: nonce
    });

    assert(this.freeAcessTicketlisings(key).exists);

    const value = this.freeAcessTicketlisings(key).value.copy();

    assert(payment.receiver===owner.native);

    const amountToPay = new arc4.UintN64(quantity.native * value.unitaryPrice.native);

    assert(payment.amount===amountToPay.native);

    itxn.assetTransfer({
      assetSender: owner.native,
      assetReceiver: Txn.sender,
      assetAmount: quantity.native,
      xferAsset: asset
    }).submit();

    this.freeAcessTicketlisings(key).value = new FreeAccessTicketValue({
      unitaryPrice: value.unitaryPrice,
      quantity: new arc4.UintN64(value.quantity.native - quantity.native)
    })

  }

  

  @arc4.abimethod()
  public withdrawAsset(asset: Asset):void {

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id),
    })

    //assicurarsi che l'asset esista nei listing (ma e' necessario? dovevo farlo anche prima?)
    assert(this.assignedTicketlistings(key).exists, 'No listing exists for given asset');
    const owner = this.assignedTicketlistings(key).value.owner.native;

    //assicuarsi che owner sia il chiamante
    assert(Txn.sender===owner, 'Only owner can withdraw assets');

    //trasferire asset al proprietario
    itxn.assetTransfer({
      assetReceiver: owner,
      xferAsset: asset,
      assetAmount: 1
    }).submit();

    //eliminazione box 
    //.TODO: fare solo se rimangono 0 asset (per biglietti non unici)
    this.assignedTicketlistings(key).delete();

    //recupero mbr listing (e mbr opt in?)
    itxn.payment({
      receiver: owner,
      amount: this.listingBoxMbr()
    }).submit()



  }

  @arc4.abimethod()
  public withdrawFreeAccessTickets(asset: Asset, quantity: arc4.UintN64, nonce: arc4.UintN64): void {

    const key = new FreeAccessTicketKey({
      asset: new arc4.UintN64(asset.id),
      owner: new arc4.Address(Txn.sender),
      nonce: nonce
    })

    assert(this.freeAcessTicketlisings(key).exists);

    const value = this.freeAcessTicketlisings(key).value.copy()

    itxn.assetTransfer({
      xferAsset: asset,
      assetReceiver: Txn.sender,
      assetAmount: quantity.native
    }).submit();

    if(value.quantity.native - quantity.native>0) {

        this.freeAcessTicketlisings(key).value = new FreeAccessTicketValue({
          unitaryPrice: value.unitaryPrice,
          quantity: new arc4.UintN64(value.quantity.native - quantity.native)
        })

    }else{

      this.freeAcessTicketlisings(key).delete();
    }
  }

 
  @arc4.abimethod()
  public buyWithAssets(asset: Asset, xfer: gtxn.AssetTransferTxn): void {
    //.TODO buy given asset with given assetTrans
    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    const owner = this.assignedTicketlistings(key).value.owner
    

    //ricevi l'asset (non fa listing) e mettilo in bilancio
    
    //il mitt dell'asset e'il mitt della chiamata
    assert(xfer.assetSender===Txn.sender);

    //il dest dell'asset e' l'applicazione
    assert(xfer.assetReceiver===Global.currentApplicationAddress);

    //l'amount e' superiore a 0
    assert(xfer.assetAmount>0);

    //invia il biglietto al chiamante 
    itxn.assetTransfer({
      assetReceiver: Txn.sender,
      assetSender: owner.native,
      assetAmount: 1,
      xferAsset: asset
    }).submit();
    
    //rimuovi il listing
    

    const res = this.assignedTicketlistings(key).delete();
    assert(res===true);

    //recupero listing mbr (per asset unici?)
    itxn.payment({
      sender: Global.currentApplicationAddress,
      receiver: owner.native,
      amount: this.listingBoxMbr(),
      fee: 0
    }).submit();


    //TODO: opt-out asset venduto

  }

  public isOptedInTo(asset: Asset): boolean {
    return Global.currentApplicationAddress.isOptedIn(asset);
  }

 


  
  /*private optOut(asset: Asset): void { //quando?
    //.TODO
    assert(Global.currentApplicationAddress.isOptedIn(asset));

    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })

    assert(!this.assignedTicketlistings(key).exists);

    //TODO
    
    
  }*/




}


  

