// «Salva il codice come…»: il nome proposto, il nome alternativo e il confronto col file che c'è già. Non importa l'editor: si
// prova senza finestra. Il collegamento con la finestra di Windows e col disco sta in `pagina.ts`.
//
// Il nome viene dal file del flowchart (lettura-intero.algo → lettura-intero.c), non dal titolo dentro il file: lo studente
// ritrova il codice accanto al flowchart da cui nasce. Se il file c'è già ed è diverso dal codice di adesso, la pagina lo dice
// PRIMA di aprire la finestra: dopo, Windows chiederebbe da sé «Sostituire?» (misurato), e un secondo avviso sarebbe un passo in più.

/** L'estensione del file per ogni linguaggio della pagina; un linguaggio senza la sua è testo. */
export const ESTENSIONI: Readonly<Record<string, string>> = { c: "c", python: "py", pseudocodice: "txt" };

export function estensioneDel(linguaggio: string): string {
  return Object.hasOwn(ESTENSIONI, linguaggio) ? ESTENSIONI[linguaggio]! : "txt";
}

/** Il nome proposto: quello del file del flowchart, con l'estensione del linguaggio al posto di `.algo`. */
export function nomeDelCodice(nomeDelFlowchart: string, linguaggio: string): string {
  const base = nomeDelFlowchart.replace(/\.algo$/i, "");
  return `${base === "" ? "codice" : base}.${estensioneDel(linguaggio)}`;
}

/** Il primo nome libero dopo quello dato: `lettura-intero-2.c`, poi `-3`… */
export function altroNome(nome: string, esiste: (nome: string) => boolean): string {
  const punto = nome.lastIndexOf(".");
  const base = punto > 0 ? nome.slice(0, punto) : nome;
  const coda = punto > 0 ? nome.slice(punto) : "";
  for (let n = 2; n < 1000; n++) {
    const candidato = `${base}-${n}${coda}`;
    if (!esiste(candidato)) return candidato;
  }
  throw new Error(`nessun nome libero dopo ${nome}`);
}

/** Il file che c'è (null se non c'è) contro il codice di adesso. I fine riga non contano: lo stesso codice salvato da un editor
 *  con CRLF è uguale. */
export function confronto(testoDelFile: string | null, codice: string): "nuovo" | "uguale" | "diverso" {
  if (testoDelFile === null) return "nuovo";
  const lf = (t: string) => t.replace(/\r\n/g, "\n");
  return lf(testoDelFile) === lf(codice) ? "uguale" : "diverso";
}
