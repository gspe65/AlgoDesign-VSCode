// La logica dell'estensione, senza editor: il modello della pagina, l'appaiamento delle segnalazioni ai codici del nucleo nei due
// versi (E3), nessun id interno nei testi visibili, i colori del codice e la lettura dei temi. Sul file vero del nucleo, quello che
// va nel pacchetto, e sul corpus di AlgoDesign all'etichetta (nucleo/sorgenti, da `bun run nucleo`).
//
// Con E11 il disegno del pacchetto con la misura fissa: i bollini appaiati alle segnalazioni su tutto il corpus, la vista (zoom,
// divisore) e i nomi dei comandi dello zoom contro quelli di AlgoDesign.
//
// «Salva il codice come…»: il nome proposto, il primo nome libero, il confronto col file che c'è.
//
// Che cosa NON guarda: la pagina vera nel browser della webview e «Problemi» nell'editor (la prova con l'editor); i temi veri
// dell'editor (idem); l'ordine del tabulatore fra due bollini della stessa funzione su un file vero (nel corpus nessuna funzione
// ne ha due: si prova la regola, `blocchiSegnalati`).

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appaiamento, blocchiSegnalati, bolliniDellSvg } from "../src/bollini";
import { coloriDalleRegole, coloreDi, leggiJsonc, pezzi, regoleDelTema, TAVOLOZZE, type Pezzo } from "../src/colori";
import { limitaLaScala, MASSIMA, MINIMA, PASSO, scalaAdatta, valida } from "../src/vista";
import { linguaggiOfferti, modello, rigaDiMain, testiDellInterfaccia, testiVisibili, type Libreria, type Modello } from "../src/documento";
import { altroNome, confronto, ESTENSIONI, nomeDelCodice } from "../src/salva";

type Nucleo = typeof import("algodesign-core");
const RADICE = join(import.meta.dir, "..");
const vero = require(join(RADICE, "nucleo", "algodesign-core.cjs")) as Nucleo & Libreria;
const CASI = join(RADICE, "nucleo", "sorgenti", "app", "casi");

/** Il corpus, enumerato dal filesystem, col totale. */
const corpus: { nome: string; testo: string }[] = [];
(function giro(d: string) {
  for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(d, e.name);
    if (e.isDirectory()) giro(p);
    else if (e.name.endsWith(".algo")) corpus.push({ nome: p.slice(CASI.length + 1).replaceAll("\\", "/"), testo: readFileSync(p, "utf8") });
  }
})(CASI);
const caso = (nome: string) => corpus.find((c) => c.nome === nome)?.testo ?? "";

/** I denominatori, misurati sul corpus del contratto 1.1 (la conformità del nucleo): si confrontano, non si derivano. */
const FILE_DEL_CORPUS = 192;
const VOCI_NELLE_DUE_LINGUE = 74;
const PROGETTI_CON_VOCI = 37;

describe("il modello della pagina", () => {
  test("il corpus c'è tutto", () => expect(corpus.length).toBe(FILE_DEL_CORPUS));
  test("lettura-intero in C: il codice del nucleo, aperto su main, nessuna segnalazione", () => {
    const m = modello(vero, caso("tappa-1/lettura-intero.algo"), "c", "it", "it");
    const a = vero.apri(caso("tappa-1/lettura-intero.algo"));
    if (!a.ok) throw new Error("non si apre");
    const g = vero.genera(a.progetto, "c", "it");
    expect(m.titolo).toBe("lettura-intero");
    expect(m.funzioni.map((f) => f.nome)).toEqual(["Programma principale"]);
    expect(m.segnalazioni).toEqual([]);
    expect(m.codice).toEqual({ testo: g.generato ? g.testo : "", rigaDiMain: 26 });
  });
  test("per-passo-zero: la segnalazione intera nella forma di AlgoDesign, e al posto del codice il rimando", () => {
    const m = modello(vero, caso("tappa-2/per-passo-zero.algo"), "c", "it", "it");
    expect(m.segnalazioni.length).toBe(1);
    const v = m.segnalazioni[0]!;
    expect(v.testo).toBe("Errore in «Per: i da 1 a 3 passo 0»: Il passo del ciclo «per» non è valido.");
    expect(v.spiegazione).toBe("Il passo di un ciclo «per» deve essere un numero intero scritto così com'è (un letterale, come 2 o -1), diverso da zero e fra -2147483648 e 2147483647: il verso del ciclo si deve sapere prima di eseguirlo. Scrivi un passo come 1, 2 o -1; per un passo che cambia durante il ciclo usa un «mentre».");
    expect([v.codice, v.blocco, v.funzione]).toEqual(["invalid_step", "b1", "f1"]);
    expect(m.codice).toEqual({ assente: "Il codice non c'è: il flowchart ha 1 errore da correggere in AlgoDesign. Lo trovi in «Errori e avvisi»." });
  });
  test("le segnalazioni nella lingua dell'interfaccia, non in quella del codice", () => {
    const m = modello(vero, caso("tappa-2/per-passo-zero.algo"), "c", "it", "en");
    expect(m.segnalazioni[0]!.testo).toBe("Error in “For: i from 1 to 3 step 0”: The step of the For loop is not valid.");
  });
  test("un testo che non è un file", () => {
    expect(modello(vero, "questo non è un file", "python", "it", "it").codice).toEqual({ assente: "Questo file non si apre: non contiene un flowchart di AlgoDesign valido." });
  });
  test("una lingua del codice fuori elenco è un errore col nome", () => {
    expect(() => modello(vero, caso("tappa-1/lettura-intero.algo"), "c", "IT" as "it", "it")).toThrow("lingua sconosciuta: IT");
  });
  test("col BOM e coi fine riga CRLF lo stesso modello", () => {
    const t = caso("tappa-1/lettura-intero.algo");
    expect(modello(vero, String.fromCharCode(0xfeff) + t.replaceAll("\n", "\r\n"), "python", "en", "it")).toEqual(modello(vero, t, "python", "en", "it"));
  });
  test("i linguaggi offerti: C e Python, Pseudocodice con l'impostazione, tutti nel registro del nucleo", async () => {
    expect(linguaggiOfferti(false)).toEqual(["python", "c"]);
    expect(linguaggiOfferti(true)).toEqual(["pseudocodice", "python", "c"]);
    const { linguaggi } = (await import(join(RADICE, "nucleo", "sorgenti", "app", "core", "genera", "linguaggi.ts"))) as { linguaggi: { id: string }[] };
    expect(linguaggiOfferti(true).filter((l) => !linguaggi.some((r) => r.id === l))).toEqual([]);
  });
  test("main: su tutto il corpus la riga indicata è quella del programma principale, in C e in Python", () => {
    let contati = 0;
    const sbagliati: string[] = [];
    for (const c of corpus) {
      const a = vero.apri(c.testo);
      if (!a.ok) continue;
      for (const l of ["c", "python"] as const) {
        const g = vero.genera(a.progetto, l, "it");
        if (!g.generato) continue;
        contati++;
        const riga = g.testo.split("\n")[rigaDiMain(g.testo, l) - 1] ?? "";
        if (!riga.startsWith(l === "c" ? "int main(" : "def main(")) sbagliati.push(`${c.nome} ${l}: ${riga}`);
      }
    }
    console.log(`main: ${contati} testi, sbagliati ${sbagliati.length}`);
    expect(contati).toBeGreaterThan(300);
    expect(sbagliati).toEqual([]);
  });
});

// --- E3: le voci della pagina appaiate ai codici di `controlla` (errori e avvisi), per file e lingua, nei due versi, con le ripetizioni.
type Coppia = { file: string; lingua: "it" | "en"; pagina: string[]; nucleo: string[] };
const fuoriTappa: string[] = [];
function coppie(costruisci: (testo: string, lingua: "it" | "en") => Modello): Coppia[] {
  const fuori: Coppia[] = [];
  for (const c of corpus) {
    const a = vero.apri(c.testo);
    if (!a.ok) continue;
    const k = vero.controlla(a.progetto);
    // «Fuori tappa» non ha elenchi: il corpus non ne ha (conformità), e la prova lo conta invece di supporlo.
    if (k.fuoriTappa) fuoriTappa.push(c.nome);
    const nucleo = k.fuoriTappa ? [] : [...k.errori, ...k.avvisi].map((e) => e.code).sort();
    for (const lingua of ["it", "en"] as const) fuori.push({ file: c.nome, lingua, pagina: costruisci(c.testo, lingua).segnalazioni.map((s) => s.codice).sort(), nucleo });
  }
  return fuori;
}
/** I motivi, uno per codice spaiato, col nome del file, la lingua e il verso. Vuoto è verde. */
function spaiati(cc: Coppia[]): string[] {
  const motivi: string[] = [];
  for (const c of cc) {
    const resto = [...c.nucleo];
    for (const p of c.pagina) {
      const i = resto.indexOf(p);
      if (i < 0) motivi.push(`${c.file} ${c.lingua}: ${p} sulla pagina e non nel nucleo`);
      else resto.splice(i, 1);
    }
    for (const r of resto) motivi.push(`${c.file} ${c.lingua}: ${r} nel nucleo e non sulla pagina`);
  }
  return motivi;
}

describe("E3: l'appaiamento delle segnalazioni ai codici del nucleo", () => {
  const vere = coppie((t, l) => modello(vero, t, "c", "it", l));
  test("nei due versi, coi denominatori", () => {
    const voci = vere.reduce((n, c) => n + c.pagina.length, 0);
    const progetti = new Set(vere.filter((c) => c.pagina.length > 0).map((c) => c.file)).size;
    const motivi = spaiati(vere);
    console.log(`appaiamento: ${vere.length} coppie file-lingua, ${voci} voci sulla pagina, ${progetti} progetti con voci; fuori tappa ${fuoriTappa.length}; spaiati ${motivi.length}`);
    expect([voci, progetti, fuoriTappa.length]).toEqual([VOCI_NELLE_DUE_LINGUE, PROGETTI_CON_VOCI, 0]);
    expect(motivi).toEqual([]);
  });
  test("controllo positivo: un codice tolto dalla pagina è rosso col suo nome, e lui solo", () => {
    let tolto = false;
    const mutate = coppie((t, l) => {
      const m = modello(vero, t, "c", "it", l);
      if (tolto || l !== "en" || !m.segnalazioni.some((s) => s.codice === "invalid_step")) return m;
      tolto = true;
      return { ...m, segnalazioni: m.segnalazioni.filter((s) => s.codice !== "invalid_step") };
    });
    expect(tolto).toBe(true);
    expect(spaiati(mutate)).toEqual(["tappa-2/per-passo-zero.algo en: invalid_step nel nucleo e non sulla pagina"]);
  });
  test("controllo positivo: un codice in più sulla pagina è rosso col suo nome, e lui solo", () => {
    const mutate = coppie((t, l) => {
      const m = modello(vero, t, "c", "it", l);
      return l === "it" && m.titolo === "lettura-intero" ? { ...m, segnalazioni: [...m.segnalazioni, { genere: "avviso", testo: "x", spiegazione: "x", dove: "x", numero: "A999", codice: "codice_finto", blocco: null, funzione: null }] } : m;
    });
    expect(spaiati(mutate)).toEqual(["tappa-1/lettura-intero.algo it: codice_finto sulla pagina e non nel nucleo"]);
  });
});

// --- Nessun id interno nei testi visibili: gli `id` del progetto e i codici del nucleo, come parole intere.
function idDelProgetto(p: unknown, fuori = new Set<string>()): Set<string> {
  if (Array.isArray(p)) for (const x of p) idDelProgetto(x, fuori);
  else if (p !== null && typeof p === "object")
    for (const [k, v] of Object.entries(p)) {
      if (k === "id" && typeof v === "string") fuori.add(v);
      else idDelProgetto(v, fuori);
    }
  return fuori;
}
const CODICI_DEL_NUCLEO = new Set<string>();
for (const c of corpus) {
  const a = vero.apri(c.testo);
  if (a.ok) for (const s of vero.segnalazioni(a.progetto, "it")) CODICI_DEL_NUCLEO.add(s.codice);
}
/** Le parole interne trovate nei testi visibili che non sono codice generato (lì una variabile può chiamarsi b1). */
function interni(m: Modello, testi: ReturnType<typeof testiDellInterfaccia>, ids: Set<string>): string[] {
  const codice = "assente" in m.codice ? null : m.codice.testo;
  const trovati: string[] = [];
  for (const t of testiVisibili(m, testi)) {
    if (t === codice) continue;
    for (const parola of t.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) if (ids.has(parola) || CODICI_DEL_NUCLEO.has(parola)) trovati.push(parola);
  }
  return trovati;
}

describe("E3: nessun id interno sullo schermo", () => {
  test("su tutto il corpus, nelle due lingue dell'interfaccia e in ogni linguaggio offerto", () => {
    let modelli = 0;
    const trovati: string[] = [];
    for (const c of corpus) {
      const a = vero.apri(c.testo);
      const ids = a.ok ? idDelProgetto(a.progetto) : new Set<string>();
      for (const interfaccia of ["it", "en"] as const)
        for (const l of linguaggiOfferti(true)) {
          const m = modello(vero, c.testo, l, "it", interfaccia);
          modelli++;
          for (const t of interni(m, testiDellInterfaccia(interfaccia), ids)) trovati.push(`${c.nome} ${interfaccia} ${l}: ${t}`);
        }
    }
    console.log(`id interni: ${modelli} modelli, codici del nucleo cercati ${CODICI_DEL_NUCLEO.size}, trovati ${trovati.length}`);
    expect(CODICI_DEL_NUCLEO.size).toBeGreaterThan(10);
    expect(trovati).toEqual([]);
  });
  test("controllo positivo: un b1 e un invalid_step messi in una voce si vedono", () => {
    const a = vero.apri(caso("tappa-2/per-passo-zero.algo"));
    if (!a.ok) throw new Error("non si apre");
    const m = modello(vero, caso("tappa-2/per-passo-zero.algo"), "c", "it", "it");
    const v = m.segnalazioni[0]!;
    const mutato = { ...m, segnalazioni: [{ ...v, testo: `${v.testo} (b1)`, spiegazione: `${v.spiegazione} invalid_step` }] };
    expect(interni(mutato, testiDellInterfaccia("it"), idDelProgetto(a.progetto))).toEqual(["b1", "invalid_step"]);
  });
});

// --- E11 senza finestra: il disegno del pacchetto con la misura fissa della conformità, i bollini appaiati alle segnalazioni.
const misuraFissa = (t: string, stile?: string) => t.length * 7 + (stile === "grassetto" ? t.length : stile === "corsivo" ? t.length / 2 : 0);
/** Misurati sul corpus del contratto 1.1 (le funzioni come la conformità; i bollini per lingua: 56 nelle due). */
const FUNZIONI_DEL_CORPUS = 335;
const BOLLINI_PER_LINGUA = 28;

describe("E11: i bollini del disegno appaiati alle segnalazioni", () => {
  type Giro = { disegni: number; bollini: Record<"it" | "en", number>; motivi: string[] };
  function giro(cambia?: (svg: string, file: string, funzione: string, lingua: "it" | "en") => string): Giro {
    const g: Giro = { disegni: 0, bollini: { it: 0, en: 0 }, motivi: [] };
    for (const c of corpus) {
      const a = vero.apri(c.testo);
      if (!a.ok) continue;
      const errori = vero.controlla(a.progetto);
      const voci = modello(vero, c.testo, "c", "it", "it").segnalazioni;
      for (const f of a.progetto.functions)
        for (const lingua of ["it", "en"] as const) {
          let svg = vero.disegna(a.progetto, f.id, lingua, misuraFissa, "system-ui, sans-serif", { errori }).svg;
          if (cambia !== undefined) svg = cambia(svg, c.nome, f.id, lingua);
          g.disegni++;
          const bollini = bolliniDellSvg(svg);
          g.bollini[lingua] += bollini.length;
          for (const m of appaiamento(bollini, voci, f.id)) g.motivi.push(`${c.nome} ${lingua} ${m}`);
        }
    }
    return g;
  }
  test("su tutto il corpus, ogni funzione nelle due lingue, nei due versi, coi denominatori", () => {
    const g = giro();
    console.log(`E11: ${g.disegni} disegni, bollini it ${g.bollini.it} en ${g.bollini.en}, spaiati ${g.motivi.length}`);
    expect([g.disegni, g.bollini.it, g.bollini.en]).toEqual([FUNZIONI_DEL_CORPUS * 2, BOLLINI_PER_LINGUA, BOLLINI_PER_LINGUA]);
    expect(g.motivi).toEqual([]);
  });
  test("controllo positivo: un bollino tolto dal disegno è rosso col suo blocco, e lui solo", () => {
    let tolto = 0;
    const g = giro((svg, file, _f, lingua) => {
      if (file !== "tappa-2/per-passo-zero.algo" || lingua !== "en") return svg;
      tolto++;
      return svg.replace('<g data-bollino="" data-id="b1"', '<g data-tolto="" data-id="b1"');
    });
    expect(tolto).toBe(1);
    expect(g.motivi).toEqual(["tappa-2/per-passo-zero.algo en f1/b1: 0 bollini per E034"]);
  });
  test("controllo positivo: un bollino in più, o con un altro numero, è rosso col suo motivo", () => {
    const voci = modello(vero, caso("tappa-2/per-passo-zero.algo"), "c", "it", "it").segnalazioni;
    expect(appaiamento([{ id: "b1", segno: "errore", codici: "E034" }, { id: "b2", segno: "avviso", codici: "A001" }], voci, "f1")).toEqual(["f1/b2: un bollino senza segnalazione (A001)"]);
    expect(appaiamento([{ id: "b1", segno: "avviso", codici: "E035" }], voci, "f1")).toEqual(["f1/b1: il bollino dice E035, l'elenco E034", "f1/b1: il bollino è «avviso», l'elenco «errore»"]);
  });
  test("l'ordine del tabulatore fra i bollini è quello dell'elenco, un blocco una volta", () => {
    const v = (blocco: string, funzione = "f1") => ({ numero: "E001", genere: "errore" as const, blocco, funzione });
    expect(blocchiSegnalati([v("b3"), v("b1"), v("b3"), v("b2", "f2"), { ...v("x"), blocco: null }], "f1")).toEqual(["b3", "b1"]);
  });
});

describe("la vista del disegno: lo zoom e il divisore", () => {
  test("i passi e i limiti di AlgoDesign; «Adatta» mai oltre il 100%", () => {
    expect([PASSO, MINIMA, MASSIMA]).toEqual([1.25, 1 / 3, 4]);
    expect([limitaLaScala(10), limitaLaScala(0.01), limitaLaScala(Number.NaN)]).toEqual([4, 1 / 3, 1]);
    expect(scalaAdatta(400, 600, 800, 300)).toBe(0.5);
    expect(scalaAdatta(100, 100, 800, 800)).toBe(1);
  });
  test("una vista ricordata si riporta nei limiti; «Torna indietro» c'è solo dopo «Adatta» scelto", () => {
    expect(valida({ scala: 9, adattata: false, scalaPrima: 2, chiuso: true, divisore: 95 })).toEqual({ scala: 4, adattata: false, scalaPrima: null, chiuso: true, divisore: 80 });
    expect(valida(undefined)).toEqual({ scala: 1, adattata: true, scalaPrima: null, chiuso: false, divisore: 50 });
    expect(valida({ adattata: true, scalaPrima: 0.8 }).scalaPrima).toBe(0.8);
  });
  test("i nomi dei comandi dello zoom sono quelli di AlgoDesign, nelle due lingue", async () => {
    const { it } = (await import(join(RADICE, "nucleo", "sorgenti", "app", "i18n", "it.ts"))) as { it: Record<string, string> };
    const { en } = (await import(join(RADICE, "nucleo", "sorgenti", "app", "i18n", "en.ts"))) as { en: Record<string, string> };
    const chiavi = ["zoom", "zoomRiduci", "zoomCento", "zoomIngrandisci", "zoomAdatta", "zoomTornaIndietro", "zoomTornaIndietroSuggerimento"] as const;
    for (const [nostri, loro] of [[testiDellInterfaccia("it"), it], [testiDellInterfaccia("en"), en]] as const) expect(chiavi.map((k): string => nostri[k])).toEqual(chiavi.map((k): string => loro[k] ?? `manca ${k}`));
  });
});

// --- I colori del codice.
const ricompone = (testo: string, pz: readonly Pezzo[]) => pz.map((p) => p.testo).join("") === testo;
/** La specie della parte che copre la prima occurrenza della parola nel testo ricomposto; `undefined` se la parola non c'è o se
 *  attraversa due parti (allora non è stata riconosciuta come un pezzo solo). */
function specieDi(pz: readonly Pezzo[], parola: string): Pezzo["specie"] | undefined {
  const inizio = pz.map((p) => p.testo).join("").indexOf(parola);
  if (inizio < 0) return undefined;
  let posizione = 0;
  for (const p of pz) {
    if (inizio >= posizione && inizio < posizione + p.testo.length) return inizio + parola.length <= posizione + p.testo.length ? p.specie : undefined;
    posizione += p.testo.length;
  }
  return undefined;
}

describe("i colori: le parti del codice", () => {
  test("su tutto il corpus le parti ricompongono il codice, carattere per carattere", () => {
    let testi = 0;
    const rotti: string[] = [];
    for (const c of corpus) {
      const a = vero.apri(c.testo);
      if (!a.ok) continue;
      for (const l of linguaggiOfferti(true))
        for (const lingua of ["it", "en"] as const) {
          const g = vero.genera(a.progetto, l, lingua);
          if (!g.generato) continue;
          testi++;
          if (!ricompone(g.testo, pezzi(g.testo, l))) rotti.push(`${c.nome} ${l} ${lingua}`);
        }
    }
    console.log(`colori: ${testi} testi, non ricomposti ${rotti.length}`);
    expect(testi).toBeGreaterThan(1000);
    expect(rotti).toEqual([]);
  });
  test("controllo positivo: una parte persa non ricompone", () => {
    const t = "int main(void) {\n";
    expect(ricompone(t, pezzi(t, "c").slice(1))).toBe(false);
  });
  test("C: tipo, funzione, commento, direttiva, stringa, numero", () => {
    const t = '/* a */\n#include <stdio.h>\nint main(void) {\n    printf("%d\\n", n * 2);\n    return 0;\n}\n';
    const pz = pezzi(t, "c");
    expect([specieDi(pz, "/* a */"), specieDi(pz, "#include"), specieDi(pz, "<stdio.h>"), specieDi(pz, "int"), specieDi(pz, "main"), specieDi(pz, "printf"), specieDi(pz, '"%d\\n"'), specieDi(pz, "2"), specieDi(pz, "return")]).toEqual(["commento", "parolaChiave", "stringa", "tipo", "funzione", "funzione", "stringa", "numero", "parolaChiave"]);
  });
  test("Python: parola chiave, funzione, tipo, commento, stringa con prefisso", () => {
    const pz = pezzi('def main() -> None:\n    n: int  # input\n    print(f"{n}")\n', "python");
    expect([specieDi(pz, "def"), specieDi(pz, "main"), specieDi(pz, "None"), specieDi(pz, "int"), specieDi(pz, "# input"), specieDi(pz, "print"), specieDi(pz, 'f"{n}"')]).toEqual(["parolaChiave", "funzione", "parolaChiave", "tipo", "commento", "funzione", "stringa"]);
  });
  test("pseudocodice: parole maiuscole, tipi, commento; una costante col trattino basso no", () => {
    const pz = pezzi("PROGRAMMA x\nDATI\n    n: intero  // input\n    MAX_VOTI ← 8\n    SCRIVI come_carattere(0)\n", "pseudocodice");
    expect([specieDi(pz, "PROGRAMMA"), specieDi(pz, "intero"), specieDi(pz, "// input"), specieDi(pz, "MAX_VOTI"), specieDi(pz, "SCRIVI"), specieDi(pz, "come_carattere")]).toEqual(["parolaChiave", "tipo", "commento", null, "parolaChiave", "funzione"]);
  });
});

describe("i colori: il tema", () => {
  // Una catena come quella dei temi dell'editor: il tema include la sua base, coi commenti e le virgole in coda.
  const FILE: Record<string, string> = {
    "/t/scuro.json": '{ "include": "./base.json", // la base\n "tokenColors": [ { "scope": "keyword.control", "settings": { "foreground": "#C586C0" } }, ] }',
    "/t/base.json": '{ /* base */ "tokenColors": [ { "scope": ["keyword", "comment"], "settings": { "foreground": "#569CD6" } }, { "scope": "string", "settings": { "foreground": "#CE9178" } }, { "scope": "meta.x entity.name.function, support.function", "settings": { "foreground": "#DCDCAA" } } ] }',
    "/t/altro.json": '{ "tokenColors": "./colori.tmTheme" }',
    "/t/giro.json": '{ "include": "./giro.json" }',
  };
  const leggi = (p: string, rispettoA?: string) => {
    const pieno = rispettoA === undefined ? p : `${rispettoA.slice(0, rispettoA.lastIndexOf("/"))}/${p.replace(/^\.\//, "")}`;
    const testo = FILE[pieno];
    if (testo === undefined) throw new Error(`non c'è ${pieno}`);
    return { percorso: pieno, testo };
  };
  test("JSON coi commenti e le virgole in coda", () => {
    expect(leggiJsonc('{ "a": "//x", /* c */ "b": [1, 2,], }')).toEqual({ a: "//x", b: [1, 2] });
  });
  test("la catena di include: la regola più precisa vince, il selettore discendente conta per l'ultimo ambito", () => {
    const regole = regoleDelTema(leggi, "/t/scuro.json");
    expect([coloreDi(regole, "parolaChiave"), coloreDi(regole, "commento"), coloreDi(regole, "stringa"), coloreDi(regole, "funzione"), coloreDi(regole, "numero")]).toEqual(["#C586C0", "#569CD6", "#CE9178", "#DCDCAA", null]);
    const { colori, dalTema } = coloriDalleRegole(regole, TAVOLOZZE.scuro);
    expect(colori.numero).toBe(TAVOLOZZE.scuro.numero);
    expect(dalTema).toEqual(["commento", "parolaChiave", "stringa", "funzione"]);
  });
  test("un tema coi colori in un altro formato, o una catena circolare: eccezione col motivo", () => {
    expect(() => regoleDelTema(leggi, "/t/altro.json")).toThrow("tokenColors in un altro file");
    expect(() => regoleDelTema(leggi, "/t/giro.json")).toThrow("catena di include circolare");
  });
});

describe("«Salva il codice come…»", () => {
  test("il nome proposto è quello del flowchart con l'estensione del linguaggio; ogni linguaggio offerto ha la sua", () => {
    expect(nomeDelCodice("lettura-intero.algo", "c")).toBe("lettura-intero.c");
    expect(nomeDelCodice("lettura-intero.algo", "python")).toBe("lettura-intero.py");
    expect(nomeDelCodice("lettura-intero.algo", "pseudocodice")).toBe("lettura-intero.txt");
    expect(nomeDelCodice("Il Mio  Flowchart.ALGO", "c")).toBe("Il Mio  Flowchart.c");
    expect(nomeDelCodice(".algo", "c")).toBe("codice.c");
    expect(linguaggiOfferti(true).filter((l) => !Object.hasOwn(ESTENSIONI, l))).toEqual([]);
    // Ogni linguaggio offerto ha il nome del suo tipo di file nella finestra, nelle due lingue dell'interfaccia.
    expect(linguaggiOfferti(true).filter((l) => testiDellInterfaccia("it").tipiDelCodice[l] === undefined || testiDellInterfaccia("en").tipiDelCodice[l] === undefined)).toEqual([]);
  });
  test("il nome alternativo è il primo libero dopo quello proposto", () => {
    const presi = new Set(["lettura-intero.c", "lettura-intero-2.c"]);
    expect(altroNome("lettura-intero.c", (n) => presi.has(n))).toBe("lettura-intero-3.c");
    expect(altroNome("lettura-intero.c", () => false)).toBe("lettura-intero-2.c");
    expect(altroNome("Makefile", () => false)).toBe("Makefile-2");
  });
  test("il confronto col file che c'è: nuovo, uguale (anche coi fine riga CRLF), diverso per un carattere", () => {
    const codice = "int main(void) {\n  return 0;\n}\n";
    expect(confronto(null, codice)).toBe("nuovo");
    expect(confronto(codice, codice)).toBe("uguale");
    expect(confronto(codice.replace(/\n/g, "\r\n"), codice)).toBe("uguale");
    // Controllo positivo: un carattere in più è «diverso», anche in fondo.
    expect(confronto(`${codice} `, codice)).toBe("diverso");
    expect(confronto("", codice)).toBe("diverso");
  });
});
