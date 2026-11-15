// La costruzione, sempre da capo: l'estensione in dist/extension.cjs, accanto la copia del file del nucleo (dist/libreria.cjs),
// e il pacchetto dist/<name>-<version>.vsix fatto da vsce coi file che .vscodeignore lascia passare.
//
//   bun run costruisci    atteso: ESITO: VERDE e il nome del pacchetto
//
// Uscite: 0 verde, 1 rosso, 2 fermo. Il nucleo deve esserci già (bun run nucleo): qui se ne rilegge solo l'impronta.
//
// Che cosa NON guarda: il contenuto del pacchetto, che guarda prove/prova.ts.

import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { esegui, fermo, FILE_DEL_NUCLEO, impronta, NUCLEO, RADICE, rosso } from "./comune";

if (!existsSync(FILE_DEL_NUCLEO)) fermo("manca il file del nucleo: prima bun run nucleo");
if (impronta(readFileSync(FILE_DEL_NUCLEO)) !== NUCLEO.file.sha256) rosso("il file del nucleo non ha l'impronta di nucleo.json: si rifà bun run nucleo");

const DIST = join(RADICE, "dist");
rmSync(DIST, { recursive: true, force: true });
// Un esterno con il percorso relativo non si riconosce ("Could not resolve"): ci vuole la forma col segnaposto.
// Bun.build solleva un AggregateError quando non riesce: i suoi errori sono il motivo del rosso.
try {
  await Bun.build({
    entrypoints: [join(RADICE, "src", "extension.ts")],
    outdir: DIST,
    naming: "extension.cjs",
    target: "node",
    format: "cjs",
    minify: { whitespace: true },
    external: ["vscode", "*libreria.cjs"],
  });
} catch (e) {
  const errori = e instanceof AggregateError ? e.errors.map(String) : [String(e)];
  rosso(`la costruzione dell'estensione non è riuscita:\n${errori.join("\n")}`);
}
copyFileSync(FILE_DEL_NUCLEO, join(DIST, "libreria.cjs"));

const manifesto = JSON.parse(readFileSync(join(RADICE, "package.json"), "utf8")) as { name: string; version: string };
const vsix = join(DIST, `${manifesto.name}-${manifesto.version}.vsix`);
const vsce = join(RADICE, "node_modules", "@vscode", "vsce", "vsce");
if (!existsSync(vsce)) fermo("vsce non c'è: prima bun install --frozen-lockfile");
const p = esegui(["node", vsce, "package", "--no-dependencies", "-o", vsix]);
console.log(p.testo.trim());
if (p.uscita !== 0 || !existsSync(vsix)) rosso(`vsce non ha fatto il pacchetto, uscita ${p.uscita}`);
console.log(`pacchetto ${vsix}: ${readFileSync(vsix).length} byte, impronta ${impronta(readFileSync(vsix))}`);
console.log("ESITO: VERDE");
