# AlgoDesign-VSCode

Un'estensione per VSCodium e Visual Studio Code che apre i flowchart di [AlgoDesign](https://github.com/gilan65/AlgoDesign) (i file `.algo`) in una pagina in sola lettura, col disegno, il codice generato e gli errori del flowchart.

## Che cosa fa

Aprendo un file `.algo` (un clic nell'elenco dei file) si apre la **pagina del flowchart**:

- a sinistra il **disegno** del flowchart, lo stesso che esporta AlgoDesign, con una **scheda per ogni funzione** (un clic sulla scheda porta anche il codice a quella funzione) e, sopra, lo **zoom** coi comandi di AlgoDesign (Riduci, la percentuale che torna al 100%, Ingrandisci, «Adatta alla finestra»); la prima volta il disegno è adattato alla finestra. Sotto, **«Errori e avvisi»**: gli errori e gli avvisi del flowchart con le frasi di AlgoDesign (che cosa non va, che cosa è successo, come correggere). Ogni blocco segnalato ha il suo **bollino** nel disegno: un clic sul bollino porta alla sua segnalazione, un clic sulla segnalazione porta al blocco e lo evidenzia. Gli stessi errori stanno anche nel pannello «Problemi»;
- a destra, sotto il titolo **«Codice generato dal flowchart»**, il **codice** generato da AlgoDesign, aperto sul programma principale e colorato coi colori del tema dell'editor; una riga che non ci sta va a capo, col rientro della riga che continua. Sopra, i pulsanti **Linguaggio** (Python, C) e **Lingua** (italiano, inglese), che cambiano i nomi e i commenti del codice e le parole del disegno. La prima volta il codice è in C e in italiano; poi ogni flowchart si riapre con l'ultima scelta fatta per lui. Quando il flowchart ha un errore, il codice non c'è e la pagina dice perché;
- fra disegno e codice un **divisore** che si trascina (o, col fuoco, si sposta con le frecce); **«Nascondi il flowchart»** lascia tutta la larghezza al codice, **«Mostra il flowchart»** lo rimette. Lo zoom, il divisore e il riquadro si ricordano per ogni flowchart;
- **«Salva il codice come…»**, sopra il codice, apre la finestra «Salva con nome» del sistema nella cartella del flowchart, col nome del flowchart e l'estensione del linguaggio (`lettura-intero.c`, `.py`); il file salvato si apre accanto alla pagina ed è un file normale, da modificare e compilare. Se un file con quel nome c'è già ed è diverso dal codice (lo si era salvato e poi modificato), la pagina lo dice **prima** di aprire la finestra: sostituendolo si perdono le modifiche, e propone **«Salva con un altro nome»** (oppure «Sostituisci», o «Annulla»);
- **«Apri il file come testo»** mostra il file così com'è (JSON), anche questo in sola lettura.

La pagina si usa anche da tastiera: il tabulatore passa dalle schede allo zoom, al disegno coi suoi bollini, alle segnalazioni, al divisore e al codice; la lettura dello schermo dice il nome del disegno col numero degli errori, e di ogni bollino la sua segnalazione.

La pagina si aggiorna da sola quando AlgoDesign salva il flowchart: legge il file dal disco. Nella pagina non si scrive nulla: il flowchart si modifica in AlgoDesign.

L'impostazione **`algo.pseudocodifica`** (spenta di partenza) aggiunge ai linguaggi lo Pseudocodice.

## Installarla

Dalla [pagina delle release](https://github.com/gspe65/AlgoDesign-VSCode/releases) si scarica il file `AlgoDesign-Code-<versione>.vsix` dell'ultima release, poi nell'editor: «Estensioni», menu «···», «Installa da VSIX…». Da riga di comando:

```
codium --install-extension AlgoDesign-Code-<versione>.vsix
```

(`code` al posto di `codium` per Visual Studio Code.)

## Da dove viene il pacchetto

Il pacchetto lo costruisce la corsa delle GitHub Actions di questo repository, a ogni etichetta, **una volta sola**. Lo stesso file viene provato con VSCodium (la versione è scritta nella nota di ogni release) su Windows, Ubuntu (con uno schermo virtuale) e macOS. La release si crea solo se le prove sono verdi su Windows, Ubuntu e macOS; se GitHub non dà la macchina di uno dei sistemi, la release può uscire senza quel sistema, e la sua nota lo dice. Il file porta un'attestazione della sua provenienza, che si verifica con:

```
gh attestation verify AlgoDesign-Code-<versione>.vsix -R gspe65/AlgoDesign-VSCode
```

Il codice, gli errori e il disegno li dà il nucleo di AlgoDesign, `algodesign-core.cjs`, non copiato in questo repository: è il file della release di AlgoDesign che `nucleo.json` nomina, confrontato con le impronte dello zip e del file scritte lì. La pagina esegue lo stesso file che usa l'estensione, e il browser dell'editor lo esegue solo se ha l'impronta di `nucleo.json`.

## Costruirla e provarla dai sorgenti

Servono [Bun](https://bun.sh) 1.4.2, git e la rete (la prima volta).

```
bun install --frozen-lockfile
bun run nucleo
bun run costruisci
bun prove/prova.ts
bun prove/prova.ts --editor <percorso dell'eseguibile di VSCodium>
```

`bun run nucleo` scarica il file del nucleo dalla release di AlgoDesign e ne confronta le impronte, e prende i sorgenti all'etichetta per i tipi, l'icona e i file di prova; `bun run costruisci` scrive in `dist/` l'estensione, la pagina e il pacchetto. `bun prove/prova.ts` prova il pacchetto e la logica senza aprire nulla; con `--editor` apre l'editor indicato per pochi secondi, con un profilo temporaneo, e prova la pagina dentro.

## Licenza

MIT (`LICENSE`). Il nucleo e l'icona sono di AlgoDesign, dello stesso autore, con licenza MIT (`LICENZA-ALGODESIGN.txt`).
