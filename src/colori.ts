// I colori del codice nella pagina: le parti del codice generato riconosciute per linguaggio, e i colori di ciascuna presi dal
// tema dell'editor (le sue regole, con la catena di `include`) o, se il tema non si legge, da una tavolozza secondo il tipo di
// tema. Senza editor e senza DOM: lo usano la pagina e l'estensione, e si prova senza finestra.
//
// Il riconoscimento è nostro, non quello dell'editor: guarda il codice che il generatore scrive (commenti, parole chiave, tipi,
// stringhe, numeri, nomi di funzione), e su una parola rara il colore può differire da quello dell'editor.

export const SPECIE = ["commento", "parolaChiave", "tipo", "stringa", "numero", "funzione"] as const;
export type Specie = (typeof SPECIE)[number];
export type Pezzo = { readonly testo: string; readonly specie: Specie | null };
export type Colori = Readonly<Record<Specie, string>>;

const C_PAROLE = new Set(["if", "else", "while", "for", "do", "return", "switch", "case", "break", "continue", "goto", "sizeof", "static", "const", "struct", "typedef", "enum", "union", "default", "extern", "volatile", "register", "inline", "NULL", "true", "false"]);
const C_TIPI = new Set(["int", "char", "void", "long", "short", "float", "double", "unsigned", "signed", "bool", "size_t", "FILE", "int64_t", "uint64_t", "int32_t", "uint32_t", "uint8_t"]);
const PY_PAROLE = new Set(["def", "return", "if", "elif", "else", "while", "for", "in", "import", "from", "as", "pass", "break", "continue", "and", "or", "not", "is", "None", "True", "False", "lambda", "try", "except", "finally", "raise", "with", "class", "global", "nonlocal", "yield", "assert", "del"]);
const PY_TIPI = new Set(["int", "float", "str", "bool", "list", "dict", "tuple", "set", "bytes"]);
const PS_TIPI = new Set(["intero", "reale", "stringa", "carattere", "booleano", "vettore", "matrice", "integer", "real", "string", "character", "boolean", "array", "matrix"]);

/** Le parti di un testo, nell'ordine: la loro concatenazione è il testo, carattere per carattere. */
export function pezzi(testo: string, linguaggio: string): Pezzo[] {
  const fuori: Pezzo[] = [];
  const metti = (t: string, specie: Specie | null) => {
    if (t === "") return;
    const ultimo = fuori[fuori.length - 1];
    if (ultimo !== undefined && ultimo.specie === specie) fuori[fuori.length - 1] = { testo: ultimo.testo + t, specie };
    else fuori.push({ testo: t, specie });
  };
  let i = 0;
  const resto = () => testo.slice(i);
  const prendi = (rx: RegExp): string | null => {
    const m = rx.exec(resto());
    return m !== null && m.index === 0 ? m[0] : null;
  };
  // Un identificatore seguito (dopo eventuali spazi) da una parentesi aperta è un nome di funzione.
  const chiamata = (dopo: number) => /^[ \t]*\(/.test(testo.slice(dopo));
  while (i < testo.length) {
    let t: string | null = null;
    let specie: Specie | null = null;
    if (linguaggio === "c") {
      if ((t = prendi(/\/\*[\s\S]*?(\*\/|$)/)) !== null || (t = prendi(/\/\/[^\n]*/)) !== null) specie = "commento";
      else if ((t = prendi(/#[ \t]*[a-z]+/)) !== null) specie = "parolaChiave";
      else if ((t = prendi(/"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/)) !== null) specie = "stringa";
      else if ((t = prendi(/<[A-Za-z0-9_./]+\.h>/)) !== null && /#[ \t]*include[ \t]*$/.test(testo.slice(Math.max(0, testo.lastIndexOf("\n", i - 1) + 1), i))) specie = "stringa";
      else t = null;
    } else if (linguaggio === "python") {
      if ((t = prendi(/#[^\n]*/)) !== null) specie = "commento";
      else if ((t = prendi(/[rRbBfFuU]{0,2}("""[\s\S]*?("""|$)|'''[\s\S]*?('''|$)|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)/)) !== null && /^[rRbBfFuU]{0,2}["']/.test(t)) specie = "stringa";
      else t = null;
    } else if (linguaggio === "pseudocodice") {
      if ((t = prendi(/\/\/[^\n]*/)) !== null) specie = "commento";
      else if ((t = prendi(/"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/)) !== null) specie = "stringa";
      else t = null;
    }
    if (t === null) {
      const numero = prendi(/0[xX][0-9a-fA-F_]+[uUlL]*|\d[\d_]*(\.\d+)?([eE][+-]?\d+)?[uUlLfF]*/);
      const parola = numero === null ? prendi(/[A-Za-z_À-ÿ][A-Za-z0-9_À-ÿ]*/) : null;
      if (numero !== null && (i === 0 || !/[A-Za-z0-9_À-ÿ]/.test(testo[i - 1]!))) {
        t = numero;
        specie = "numero";
      } else if (parola !== null) {
        t = parola;
        const dopo = i + parola.length;
        if (linguaggio === "c") specie = C_PAROLE.has(parola) ? "parolaChiave" : C_TIPI.has(parola) ? "tipo" : chiamata(dopo) ? "funzione" : null;
        else if (linguaggio === "python")
          specie = PY_PAROLE.has(parola) ? "parolaChiave" : PY_TIPI.has(parola) ? "tipo" : chiamata(dopo) || /(^|[^\w])def[ \t]+$/.test(testo.slice(Math.max(0, i - 8), i)) ? "funzione" : null;
        else if (linguaggio === "pseudocodice")
          // Le parole chiave sono maiuscole e senza trattino basso: MAX_VOTI è una costante.
          specie = /^[A-ZÀ-Þ]{2,}$/.test(parola) ? "parolaChiave" : PS_TIPI.has(parola) ? "tipo" : chiamata(dopo) ? "funzione" : null;
        else specie = null;
      } else {
        t = numero ?? testo[i]!;
        specie = null;
      }
    }
    metti(t, specie);
    i += t.length;
  }
  return fuori;
}

/** La tavolozza quando il tema non si legge: i colori dei temi predefiniti dell'editor, per tipo di tema. */
export const TAVOLOZZE: Readonly<Record<"chiaro" | "scuro" | "contrasto" | "contrastoChiaro", Colori>> = {
  scuro: { commento: "#6A9955", parolaChiave: "#C586C0", tipo: "#569CD6", stringa: "#CE9178", numero: "#B5CEA8", funzione: "#DCDCAA" },
  chiaro: { commento: "#008000", parolaChiave: "#AF00DB", tipo: "#0000FF", stringa: "#A31515", numero: "#098658", funzione: "#795E26" },
  contrasto: { commento: "#7CA668", parolaChiave: "#C586C0", tipo: "#569CD6", stringa: "#CE9178", numero: "#B5CEA8", funzione: "#DCDCAA" },
  contrastoChiaro: { commento: "#515151", parolaChiave: "#B5200D", tipo: "#0F4A85", stringa: "#0F4A85", numero: "#096D48", funzione: "#5E2CBC" },
};

/** Per ogni specie, gli ambiti dei temi (TextMate) da cercare, dal più preciso. */
const AMBITI: Readonly<Record<Specie, readonly string[]>> = {
  commento: ["comment.line.double-slash", "comment.block", "comment"],
  parolaChiave: ["keyword.control", "keyword"],
  tipo: ["storage.type", "support.type", "entity.name.type"],
  stringa: ["string.quoted.double", "string"],
  numero: ["constant.numeric"],
  funzione: ["entity.name.function", "support.function"],
};

/** Un JSON coi commenti e le virgole in coda, come i file dei temi. Un testo che non si legge è un'eccezione. */
export function leggiJsonc(testo: string): unknown {
  let fuori = "";
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i]!;
    if (c === '"') {
      let j = i + 1;
      while (j < testo.length && testo[j] !== '"') j += testo[j] === "\\" ? 2 : 1;
      fuori += testo.slice(i, j + 1);
      i = j;
    } else if (c === "/" && testo[i + 1] === "/") {
      while (i < testo.length && testo[i] !== "\n") i++;
      fuori += "\n";
    } else if (c === "/" && testo[i + 1] === "*") {
      const fine = testo.indexOf("*/", i + 2);
      i = fine < 0 ? testo.length : fine + 1;
    } else fuori += c;
  }
  return JSON.parse(fuori.replace(/,(\s*[}\]])/g, "$1"));
}

export type Regola = { readonly ambiti: readonly string[]; readonly colore: string };

/** Le regole dei colori di un tema, dalla base della catena di `include` al tema stesso (l'ultima vince a parità). `leggi`
 *  dà il testo di un file del tema, risolto rispetto al file che lo include. Un `tokenColors` che rimanda a un altro formato
 *  (una stringa) o una catena circolare sono un'eccezione col motivo: chi chiama usa la tavolozza. */
export function regoleDelTema(leggi: (percorso: string, rispettoA?: string) => { percorso: string; testo: string }, percorso: string, visti = new Set<string>()): Regola[] {
  const f = leggi(percorso);
  if (visti.has(f.percorso)) throw new Error(`catena di include circolare: ${f.percorso}`);
  visti.add(f.percorso);
  const tema = leggiJsonc(f.testo) as { include?: string; tokenColors?: unknown };
  const base = typeof tema.include === "string" ? regoleDelTema((p, r) => leggi(p, r ?? f.percorso), tema.include, visti) : [];
  if (typeof tema.tokenColors === "string") throw new Error(`tokenColors in un altro file: ${tema.tokenColors}`);
  const proprie: Regola[] = [];
  for (const r of Array.isArray(tema.tokenColors) ? tema.tokenColors : []) {
    const regola = r as { scope?: string | string[]; settings?: { foreground?: string } };
    const colore = regola.settings?.foreground;
    if (typeof colore !== "string" || regola.scope === undefined) continue;
    const ambiti = (Array.isArray(regola.scope) ? regola.scope : regola.scope.split(",")).map((s) => s.trim().split(/\s+/).pop() ?? "").filter((s) => s !== "");
    proprie.push({ ambiti, colore });
  }
  return [...base, ...proprie];
}

/** Il colore di una specie secondo le regole: per il primo ambito che ha una regola, la regola più precisa (il prefisso più
 *  lungo a confine di punto), e a parità l'ultima. `null` se nessun ambito ha una regola. */
export function coloreDi(regole: readonly Regola[], specie: Specie): string | null {
  for (const ambito of AMBITI[specie]) {
    let migliore: { lunghezza: number; colore: string } | null = null;
    for (const r of regole)
      for (const a of r.ambiti)
        if ((ambito === a || ambito.startsWith(`${a}.`)) && (migliore === null || a.length >= migliore.lunghezza)) migliore = { lunghezza: a.length, colore: r.colore };
    if (migliore !== null) return migliore.colore;
  }
  return null;
}

/** I colori delle sei specie da un tema: quelli che il tema non ha li dà la tavolozza. */
export function coloriDalleRegole(regole: readonly Regola[], riserva: Colori): { colori: Colori; dalTema: Specie[] } {
  const colori = {} as Record<Specie, string>;
  const dalTema: Specie[] = [];
  for (const s of SPECIE) {
    const c = coloreDi(regole, s);
    colori[s] = c ?? riserva[s];
    if (c !== null) dalTema.push(s);
  }
  return { colori, dalTema };
}
