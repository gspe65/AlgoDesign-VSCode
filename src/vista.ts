// La vista del disegno: lo zoom coi passi di AlgoDesign (×1,25, fra un terzo e 4 volte; «Adatta alla finestra» mai oltre il
// 100%) e il divisore fra disegno e codice. Senza DOM e senza editor: la usano la pagina, l'estensione e le prove.

import type { Vista } from "./messaggi";

export const PASSO = 1.25;
/** La dimensione del carattere del disegno, in pixel al 100%: è `geometriaPredefinita.carattere` del nucleo
 *  (app/core/disegno/tema.ts di AlgoDesign), che il punto d'ingresso del nucleo non esporta; la prova senza editor la confronta
 *  con quella dei sorgenti all'etichetta. Il canvas misura il testo a questa dimensione, e l'SVG lo scrive così. */
export const DIMENSIONE_DEL_CARATTERE = 15;
/** La scala minima porta il carattere del disegno a 5 pixel, come in AlgoDesign. */
export const MINIMA = 5 / DIMENSIONE_DEL_CARATTERE;
export const MASSIMA = 4;
export const DIVISORE_MINIMO = 20;
export const DIVISORE_MASSIMO = 80;
/** Il passo del divisore con le frecce, in percento della larghezza. */
export const PASSO_DEL_DIVISORE = 5;

export const limitaLaScala = (s: number): number => (Number.isFinite(s) ? Math.min(Math.max(s, MINIMA), MASSIMA) : 1);
export const limitaIlDivisore = (d: number): number => (Number.isFinite(d) ? Math.min(Math.max(d, DIVISORE_MINIMO), DIVISORE_MASSIMO) : 50);

/** La scala che fa stare il disegno nell'area, mai oltre il 100%. */
export function scalaAdatta(larghezza: number, altezza: number, areaLarga: number, areaAlta: number): number {
  if (larghezza <= 0 || altezza <= 0 || areaLarga <= 0 || areaAlta <= 0) return 1;
  return limitaLaScala(Math.min(areaLarga / larghezza, areaAlta / altezza, 1));
}

/** I tre stili del testo che il nucleo misura, con ciò che il canvas scrive davanti alla dimensione (come in AlgoDesign). */
export const STILI = [
  { stile: "normale", davanti: [""] },
  { stile: "grassetto", davanti: ["bold ", "700 "] },
  { stile: "corsivo", davanti: ["italic "] },
] as const;

/** Il carattere chiesto al canvas in uno stile, e se il canvas l'ha tenuto: riletto uguale (per il grassetto anche col peso in
 *  numero). Un carattere o uno stile che il canvas non sa leggere vengono ignorati in silenzio, e la misura sarebbe di un altro. */
export function stileTenuto(stile: (typeof STILI)[number], famiglia: string, riletto: string): { chiesto: string; tenuto: boolean } {
  const base = `${DIMENSIONE_DEL_CARATTERE}px ${famiglia}`;
  return { chiesto: `${stile.davanti[0]}${base}`, tenuto: stile.davanti.some((d) => riletto === `${d}${base}`) };
}

/** Una vista ricordata (anche scritta da una versione vecchia, o a mano) riportata nei suoi limiti. */
export function valida(v: Partial<Vista> | undefined): Vista {
  return {
    scala: limitaLaScala(Number(v?.scala ?? 1)),
    adattata: v?.adattata !== false,
    scalaPrima: v?.scalaPrima === null || v?.scalaPrima === undefined || v.adattata === false ? null : limitaLaScala(Number(v.scalaPrima)),
    chiuso: v?.chiuso === true,
    divisore: limitaIlDivisore(Number(v?.divisore ?? 50)),
  };
}
