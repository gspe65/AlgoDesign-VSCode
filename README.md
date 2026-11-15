# AlgoDesign-VSCode

Un'estensione per VSCodium e Visual Studio Code che mostra, in sola lettura, il codice generato da un flowchart di [AlgoDesign](https://github.com/gilan65/AlgoDesign) (i file `.algo`).

> **Versione di prova (0.0.2).** È il prototipo dell'estensione, nel suo repository e con il pacchetto costruito dalle GitHub Actions. La versione per l'uso a scuola, con la pagina del flowchart, è in preparazione.

## Che cosa fa

Con un file `.algo` aperto, il comando **«Mostra il codice generato»** (Ctrl+Maiusc+P, poi il nome del comando) apre accanto il codice del flowchart, in sola lettura. Il linguaggio (pseudocodice, Python, C, Accademico, TypeScript) e la lingua dei nomi e dei commenti (italiano o inglese) si scelgono nelle impostazioni `algo.linguaggio` e `algo.lingua`.

Il codice è quello del file **salvato**: con modifiche non salvate il comando lo dice. Dopo un cambiamento del file il comando si rilancia.

## Installarla

Dalla [pagina delle release](https://github.com/gspe65/AlgoDesign-VSCode/releases) si scarica `AlgoDesign-Code-0.0.2.vsix`, poi nell'editor: «Estensioni», menu «···», «Installa da VSIX…». Da riga di comando:

```
codium --install-extension AlgoDesign-Code-0.0.2.vsix
```

(`code` al posto di `codium` per Visual Studio Code.)

## Da dove viene il pacchetto

Il pacchetto lo costruisce la corsa delle GitHub Actions di questo repository, a ogni etichetta, **una volta sola**. Lo stesso file viene provato con VSCodium 1.143.17232 su Windows, Ubuntu (con uno schermo virtuale) e macOS. La release si crea solo se le tre prove sono verdi, e il file porta un'attestazione della sua provenienza, che si verifica con:

```
gh attestation verify AlgoDesign-Code-0.0.2.vsix -R gspe65/AlgoDesign-VSCode
```

Il codice lo genera il nucleo di AlgoDesign: il file `algodesign-core.cjs` della release `v1.0.0` di AlgoDesign, scaricato e confrontato con la sua impronta sha256 (scritta in `nucleo.json`), non copiato in questo repository.

## Costruirla e provarla dai sorgenti

Servono [Bun](https://bun.sh) 1.4.2, git e la rete (la prima volta).

```
bun install --frozen-lockfile
bun run nucleo
bun run costruisci
bun prove/prova.ts
bun prove/prova.ts --editor <percorso dell'eseguibile di VSCodium>
```

`bun run nucleo` scarica il pacchetto del nucleo e i sorgenti di AlgoDesign al commit dell'etichetta (servono per i tipi, l'icona e i file di prova); `bun run costruisci` scrive in `dist/` l'estensione e il pacchetto. `bun prove/prova.ts` prova il pacchetto e la logica senza aprire nulla; con `--editor` apre l'editor indicato per pochi secondi, con un profilo temporaneo, e prova l'estensione dentro.

## Licenza

MIT (`LICENSE`). Il nucleo e l'icona sono di AlgoDesign, dello stesso autore, con licenza MIT (`LICENZA-ALGODESIGN.txt`).
