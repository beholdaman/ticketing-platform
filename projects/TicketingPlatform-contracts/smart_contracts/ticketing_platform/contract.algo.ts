

import { Account, arc4, assert, Asset, BoxMap, Global, gtxn, itxn, op, Txn, uint64 } from "@algorandfoundation/algorand-typescript"



export class AssignedTicketKey extends arc4.Struct<{
  asset: arc4.UintN64
}> {}
export class AssignedTicketValue extends arc4.Struct<{
  owner: arc4.Address,
  unitaryPrice: arc4.UintN64
}> {}






export class TicketingPlatform extends arc4.Contract {

  
  assignedTicketlistings = BoxMap<AssignedTicketKey, AssignedTicketValue>({keyPrefix: 'listings'});

  listingBoxMbr(): uint64 {
    return (
      2_500 + (
        4_00 * 48
      )
    )
  }

  

  

  @arc4.abimethod()
  public balance(): uint64 {
    const [balance, exists] = op.AcctParams.acctBalance(Global.currentApplicationAddress);
    return balance;
  }

  @arc4.abimethod()
  public mintNft(assetName: string, ticket_link: string): uint64{
    const result = itxn.assetConfig({
      sender: Global.currentApplicationAddress,
      assetName: assetName,
      url: ticket_link,
      total: 1,
      decimals: 0,
      manager: Txn.sender,
      reserve: Txn.sender,
      freeze: Txn.sender,
      clawback: Txn.sender,
      fee: 1_000
    }).submit();

    return result.createdAsset.id;
  }

  

 
  @arc4.abimethod()
  public optInToAsset(asset: Asset, mbrPay: gtxn.PaymentTxn): void {
   

    //controllo che il contratto non abbia gia' fatto opt-in all'asset desiderato
    assert(!Global.currentApplicationAddress.isOptedIn(asset), 'contract already opted in to asset');

    assert(mbrPay.receiver===Global.currentApplicationAddress, 'receiver of the payment is not the contract');
    assert(mbrPay.amount===Global.assetOptInMinBalance, 'minimum balance requirement for opt in is not met')

    //effettua una transazione di opt-in 
    // (asset transfer vuota da contratto a contratto per l'asset desiderato)
    itxn.assetTransfer({
      xferAsset: asset,
      assetSender: Global.currentApplicationAddress,
      assetReceiver: Global.currentApplicationAddress,
      assetAmount: 0,
      fee: 0
    }).submit();

    
  }

  @arc4.abimethod()
  public newListing(xfer: gtxn.AssetTransferTxn, unitaryPrice: arc4.UintN64, mbrPay: gtxn.PaymentTxn): void {

    //si e' fatto opt-in per l'asset
    //assert(Global.currentApplicationAddress.isOptedIn(xfer.xferAsset), 'contract is not opted in to asset');

    //il prezzo non puo' essere 0
    assert(unitaryPrice.native > 0, 'price cannot be negative');

    
    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(xfer.xferAsset.id)
    })

    //non devono esistere altri listing per questo asset
    assert(!this.assignedTicketlistings(key).exists, 'Listing for asset already exists');

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

    //se nessun listing per questo asset e per questo utente esiste, il metodo fallisce 

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
    //il destinatario e' il proprietario dell'asset
    assert(buyPay.receiver === owner.native, 'Pay receiver must be owner of the listing');

    //resto del pagamento dell'asset
    const change: uint64 = buyPay.amount - price.native;

    //invia l'asset desiderato al chiamante del metodo (o al pagante?)
    itxn.assetTransfer({
      xferAsset: asset,
      assetSender: owner.native,
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

    //eliminazione box 
    //.TODO: fare solo se rimangono 0 asset (per biglietti non unici)
    this.assignedTicketlistings(key).delete();

    //recupero mbr listing (e mbr opt in?)
    itxn.payment({
      sender: Global.currentApplicationAddress,
      receiver: owner,
      amount: this.listingBoxMbr()
    }).submit()

  }

     
  public isOptedInTo(asset: Asset): boolean {
    return Global.currentApplicationAddress.isOptedIn(asset);
  }

  public getBoxValue(asset: Asset): AssignedTicketValue {
    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })
    return this.assignedTicketlistings(key).value;
  }

  public boxExists(asset: Asset): boolean {
    const key = new AssignedTicketKey({
      asset: new arc4.UintN64(asset.id)
    })
    return this.assignedTicketlistings(key).exists
  }


 
 
  

  

}


  

