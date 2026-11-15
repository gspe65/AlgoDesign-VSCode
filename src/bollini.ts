// I bollini del disegno e le segnalazioni dell'elenco, appaiati: ogni blocco con una segnalazione ha il suo bollino nel disegno
// della sua funzione, col segno del genere più grave e i numeri delle sue segnalazioni, e ogni bollino ha almeno una
// segnalazione. Senza DOM: la pagina lo usa per l'ordine del tabulatore, la prova senza finestra sull'SVG di tutto il corpus.

export type Bollino = { readonly id: string; readonly segno: string; readonly codici: string };
type Voce = { readonly numero: string; readonly genere: "errore" | "avviso"; readonly blocco: string | null; readonly funzione: string | null };

/** I bollini di un SVG di `disegna`, nell'ordine del testo. */
export function bolliniDellSvg(svg: string): Bollino[] {
  return [...svg.matchAll(/<g data-bollino="" data-id="([^"]*)" data-segno="([^"]*)" data-codici="([^"]*)">/g)].map((m) => ({ id: m[1]!, segno: m[2]!, codici: m[3]! }));
}

/** I blocchi della funzione con una segnalazione, nell'ordine dell'elenco (il primo posto in cui ciascuno compare). */
export function blocchiSegnalati(voci: readonly Voce[], funzione: string): string[] {
  const fuori: string[] = [];
  for (const v of voci) if (v.funzione === funzione && v.blocco !== null && !fuori.includes(v.blocco)) fuori.push(v.blocco);
  return fuori;
}

/** I motivi per cui bollini e segnalazioni della funzione non si appaiano, nei due versi; vuoto se si appaiano. */
export function appaiamento(bollini: readonly Bollino[], voci: readonly Voce[], funzione: string): string[] {
  const motivi: string[] = [];
  for (const blocco of blocchiSegnalati(voci, funzione)) {
    const sue = voci.filter((v) => v.funzione === funzione && v.blocco === blocco);
    const b = bollini.filter((x) => x.id === blocco);
    if (b.length !== 1) {
      motivi.push(`${funzione}/${blocco}: ${b.length} bollini per ${sue.map((v) => v.numero).join(" ")}`);
      continue;
    }
    const numeri = [...new Set(sue.map((v) => v.numero))];
    const codici = b[0]!.codici.split(" ").filter(Boolean);
    if ([...codici].sort().join(" ") !== [...numeri].sort().join(" ")) motivi.push(`${funzione}/${blocco}: il bollino dice ${codici.join(" ")}, l'elenco ${numeri.join(" ")}`);
    const segno = sue.some((v) => v.genere === "errore") ? "errore" : "avviso";
    if (b[0]!.segno !== segno) motivi.push(`${funzione}/${blocco}: il bollino è «${b[0]!.segno}», l'elenco «${segno}»`);
  }
  for (const b of bollini) if (!voci.some((v) => v.funzione === funzione && v.blocco === b.id)) motivi.push(`${funzione}/${b.id}: un bollino senza segnalazione (${b.codici})`);
  return motivi;
}
