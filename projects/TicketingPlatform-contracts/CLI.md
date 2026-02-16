# TicketingPlatform CLI


Interfaccia a riga di comando per interagire con lo scmart contract TicketingPlatform.

## Installazione

```bash
npm install
```

## Configurazione

Impostare le seguenti variabili d'ambiente:

```bash
export ALGOD_URL=http://localhost
export ALGOD_PORT=4001
export ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export MNEMONIC="mnemonic"
export APP_ID=12345 
```


### Struttura comandi

```bash
npm run platform -- [GLOBAL OPTIONS] <command> [command options]
```

**Opzioni:**
- `-a, --app <id>`: Application ID (required)
- `-m, --mnemonic <phrase>`: Sender mnemonic (or use MNEMONIC env var)



#### Mint an NFT

da projects/TicketingPlatform-contracts

```bash
npm run platform -- -a 12345 nft mint "Biglietto 1" "https://example.com/ticket/1"
```

**Argomenti:**
- `name`: nome da dare all'nft mintato
- `link`: link ai metadati dell'nft



#### Creare un listing

```bash
npm run platform -- -a 12345 listing create 1000 5000000
```

**Arguments:**
- `assetId`: ID dell'asset per cui si vuole creare un listing
- `price`: prezzo di vendita in microalgo


#### Cambio prezzo

```bash
npm run platform -- -a 12345 listing price 1000 6000000
```

**Arguments:**
- `assetId`: Asset ID
- `newPrice`: nuovo prezzo in microAlgo

#### Ritira Asset da un listing

```bash
npm run platform -- -a 12345 listing withdraw 1000
```

**Arguments:**
- `assetId`: ID dell'asset da ritirare

Restituisce il mimum balance requirement al seller

#### Opt-in del contrato a un asset

```bash
npm run platform -- -a 12345 listing optin 1000
```

**Argomenti:**
- `assetId`: ID dell'asset a cui fare opt-in



#### Comprare un biglietto

```bash
npm run platform -- -a 12345 buy ticket 1000 5000000
```

**Arguments:**
- `assetId`: ID dell'asset da acquistare
- `price`: prezzo in microAlgo



#### Get Contract Balance

```bash
npm run platform -- -a 12345 info balance
```

Restituisce il bilnacio attuale del contratto in microAlgo

#### Controlla opt-in

```bash
npm run platform -- -a 12345 info opted-in 1000
```

**Arguments:**
- `assetId`: ID dell'asset da verificare

Restituisce: Vero se il contratto ha fatto opt-in all'asset dato, falso altrimenti

#### Ottenere il valore del box

```bash
npm run platform -- -a 12345 info box-value 1000
```

**Arguments:**
- `assetId`: Asset ID

Returns:
- Indirizzo del proprietario
- Prezzo di vendita

#### Controlla se un box esiste

```bash
npm run platform -- -a 12345 info box-exists 1000
```

**Arguments:**
- `assetId`: Asset ID

#### Ottieni minimum balance requirement
```bash
npm run platform -- -a 12345 info mbr
```

Restituisce il minimum balance requirement per creare un listing nel contratto

