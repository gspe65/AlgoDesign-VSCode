// Gli aggiornamenti della pagina in ordine. Un aggiornamento legge il file dal disco (un'attesa): due in volo (un salvataggio di
// AlgoDesign e un cambio di linguaggio, o due salvataggi vicini) possono finire nell'ordine opposto, e il vecchio coprirebbe il
// nuovo. Ognuno prende un numero quando comincia; alla fine vale solo se nessuno è cominciato dopo di lui. Senza editor: si prova
// senza finestra.

export type Ordine = {
  /** Il numero dell'aggiornamento che comincia ora. */
  comincia(): number;
  /** Vero se dopo l'aggiornamento `n` ne è cominciato un altro: il risultato di `n` si scarta. */
  superato(n: number): boolean;
};

export function inOrdine(): Ordine {
  let ultimo = 0;
  return {
    comincia: () => ++ultimo,
    superato: (n) => n !== ultimo,
  };
}
