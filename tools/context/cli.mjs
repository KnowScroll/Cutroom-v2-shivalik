// Design: U31; impl/01 §4. Usage: npm run wp-context -- <work package ID>
//                              npm run wp-context -- decision <ID>
// Built-in modules and Git only, no model, no network.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContext, buildDecision } from "./build.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const [first, second] = process.argv.slice(2);

if (!first) {
  console.error(
    "usage: npm run wp-context -- <work package ID, for example M0-02>\n       npm run wp-context -- decision <ID, for example G15 or A:M0-3>",
  );
  process.exit(2);
}
const result = first === "decision" ? buildDecision(root, second ?? "") : buildContext(root, first);
if (!result.found) {
  console.error(result.text.trimEnd());
  process.exit(1);
}
process.stdout.write(result.text);
