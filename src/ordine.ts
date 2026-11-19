// Gli aggiornamenti della pagina in ordine. Un aggiornamento legge il file dal disco (un'attesa): due in volo (un salvataggio di
// AlgoDesign e un cambio di linguaggio, o due salvataggi vicini) possono finire nell'ordine opposto, e il vecchio coprirebbe il
// nuovo. Ognuno prende un numero quando comincia; alla fine vale solo se nessuno è cominciato dopo di lui. `aggiornamentiInOrdine`
// è l'aggiornamento della pagina (src/pagina.ts lo usa così com'è): senza editor si prova la stessa funzione.

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

/** L'aggiornamento: `leggi` (l'attesa) e poi `applica` sul risultato, solo se nessun aggiornamento è cominciato dopo. */
export function aggiornamentiInOrdine<L>(leggi: () => Promise<L>, applica: (letto: L) => void, ordine: Ordine = inOrdine()): () => Promise<void> {
  return async () => {
    const numero = ordine.comincia();
    const letto = await leggi();
    if (ordine.superato(numero)) return;
    applica(letto);
  };
}
