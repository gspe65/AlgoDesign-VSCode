# AlgoDesign-VSCode

Un'estensione per VSCodium e Visual Studio Code che apre i flowchart di [AlgoDesign](https://github.com/gilan65/AlgoDesign) (i file `.algo`) in una pagina in sola lettura, col codice generato e gli errori del flowchart.

> **Versione di prova (0.0.5).** La pagina del flowchart, ancora senza il disegno, che arriverà in una prossima versione. Il pacchetto è costruito dalle GitHub Actions.

## Che cosa fa

Aprendo un file `.algo` (un clic nell'elenco dei file) si apre la **pagina del flowchart**:

- a destra il **codice** generato da AlgoDesign, aperto sul programma principale e colorato coi colori del tema dell'editor; sopra, i pulsanti **Linguaggio** (Python, C) e **Lingua** (italiano, inglese) dei nomi e dei commenti del codice. La prima volta il codice è in C e in italiano; poi ogni flowchart si riapre con l'ultima scelta fatta per lui;
- a sinistra le **schede delle funzioni** e il posto del disegno, e sotto **«Errori e avvisi»**: gli errori e gli avvisi del flowchart con le frasi di AlgoDesign (che cosa non va, che cosa è successo, come correggere). Gli stessi errori stanno anche nel pannello «Problemi». Quando il flowchart ha un errore, il codice non c'è e la pagina dice perché;
- **«Apri come testo»** mostra il file così com'è (JSON), anche questo in sola lettura.

La pagina si aggiorna da sola quando AlgoDesign salva il flowchart: legge il file dal disco. Nella pagina non si scrive nulla: il flowchart si modifica in AlgoDesign.

L'impostazione **`algo.pseudocodifica`** (spenta di partenza) aggiunge ai linguaggi lo Pseudocodice.

## Installarla

Dalla [pagina delle release](https://github.com/gspe65/AlgoDesign-VSCode/releases) si scarica `AlgoDesign-Code-0.0.5.vsix`, poi nell'editor: «Estensioni», menu «···», «Installa da VSIX…». Da riga di comando:

```
codium --install-extension AlgoDesign-Code-0.0.5.vsix
```

(`code` al posto di `codium` per Visual Studio Code.)

## Da dove viene il pacchetto

Il pacchetto lo costruisce la corsa delle GitHub Actions di questo repository, a ogni etichetta, **una volta sola**. Lo stesso file viene provato con VSCodium 1.143.17232 su Windows, Ubuntu (con uno schermo virtuale) e macOS. La release si crea solo se le tre prove sono verdi, e il file porta un'attestazione della sua provenienza, che si verifica con:

```
gh attestation verify AlgoDesign-Code-0.0.5.vsix -R gspe65/AlgoDesign-VSCode
```

Il codice e gli errori li dà il nucleo di AlgoDesign, `algodesign-core.cjs`, non copiato in questo repository: in questa versione è costruito dai sorgenti di AlgoDesign all'etichetta `algodesign-core-contract-1.1`, con le opzioni del pacchetto di AlgoDesign, e confrontato con i byte e l'impronta sha256 scritti in `nucleo.json`. Quando AlgoDesign pubblicherà la release che lo contiene, si userà il file di quella release.

## Costruirla e provarla dai sorgenti

Servono [Bun](https://bun.sh) 1.4.2 (la versione con cui il nucleo dà quei byte), git e la rete (la prima volta).

```
bun install --frozen-lockfile
bun run nucleo
bun run costruisci
bun prove/prova.ts
bun prove/prova.ts --editor <percorso dell'eseguibile di VSCodium>
```

`bun run nucleo` prende i sorgenti di AlgoDesign all'etichetta (servono anche per i tipi, l'icona e i file di prova) e ne costruisce il nucleo; `bun run costruisci` scrive in `dist/` l'estensione, la pagina e il pacchetto. `bun prove/prova.ts` prova il pacchetto e la logica senza aprire nulla; con `--editor` apre l'editor indicato per pochi secondi, con un profilo temporaneo, e prova la pagina dentro.

## Licenza

MIT (`LICENSE`). Il nucleo e l'icona sono di AlgoDesign, dello stesso autore, con licenza MIT (`LICENZA-ALGODESIGN.txt`).
