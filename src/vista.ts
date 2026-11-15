// La vista del disegno: lo zoom coi passi di AlgoDesign (×1,25, fra un terzo e 4 volte; «Adatta alla finestra» mai oltre il
// 100%) e il divisore fra disegno e codice. Senza DOM e senza editor: la usano la pagina, l'estensione e le prove.

import type { Vista } from "./messaggi";

export const PASSO = 1.25;
/** Il carattere del disegno è a 15 pixel: la scala minima lo porta a 5 pixel, come in AlgoDesign. */
export const MINIMA = 5 / 15;
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
