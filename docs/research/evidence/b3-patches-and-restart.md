# B3 — Patch authoring at project scale (`R3-K2`) and segment restart (`R6-S10`)

14 November 2026. Throwaway spikes; the code was deleted, only these results are kept.

## Summary

| Spike | Question | Answer |
|---|---|---|
| 1 | Can MiniMax write and repair the full patch operation set on a realistic project? | **Not as designed, yes with one change.** With the patch sent as ordinary structured tool arguments and a strict validator, 54 of 70 runs (77%) ended in the right project state and 49 of 69 first patches (71%) were valid. The cause is not the operation set. The MiniMax endpoint loses the JSON type of any value the tool schema does not type: numbers arrive as strings, arrays as `{"item": ...}`, and some keys land one level too high. With `ops` sent as one string of JSON text, 199 of 210 runs (95%) were right, 182 of 208 first patches (88%) were valid, 96% were valid within one repair and 98% within two. |
| 1 | How does RFC 6902 compare on 10 of the tasks? | About the same accuracy, at higher cost. On 48 runs each (JSON-text transport): entity operations 45 right, RFC 6902 41 right. Six of the seven RFC misses are one extra copied field on one task. RFC 6902 needed 0.5 to 0.8 more turns and 75% to 85% more uncached input per task. |
| 2 | Does a segment restart lose working state? | **No loss seen in 9 restart runs over 3 sessions.** No step was repeated or skipped, no patch contradicted an earlier decision, every open job handle and finding id was used correctly. Progress in the ten turns was the same as in the 6 control runs to within two turns. Without the model's working notes (4 extra runs) the result was worse when a step was half done at the boundary. At this context size (13,000 to 17,000 tokens) a restart saves little money once the notes request is counted. |

Total spend: **$1.09** at list prices as billed from the `usage` fields (2,888 requests). It would have been $3.17 if no input had been served from the cache. The cap was $3.50.

The surprise: **the "99% schema-valid tool calls" result from S5 does not carry over to a tool whose arguments contain untyped nested values.** The models appear to emit tool calls in an XML-like form (it was seen twice, when a call came back unconverted), and the endpoint turns that into JSON using the tool's `input_schema`. Where the schema says nothing, types are lost.

## Setup common to both spikes

- Endpoint: `POST https://api.minimax.io/anthropic/v1/messages`, Anthropic Messages format, `stream: true` on every request.
- Models: `MiniMax-M3` (thinking off in spike 1, `thinking: {type: "adaptive"}` in spike 2) and `MiniMax-M3.1-Flash` with `output_config: {effort: "low"}`.
- At most 4 requests in flight. The main spike 1 batches logged 546 retries after HTTP 429 and 7 after other errors; every request succeeded in the end. With at most 4 of this spike's requests in flight, that many 429s suggests the key was in use by other work at the same time. Spike 2 did not record its retries.
- Cost is computed from the `usage` fields at list prices: M3 $0.30 input, $1.20 output, $0.06 cached input per million tokens; Flash $0.15, $0.60, $0.015. `input_tokens` excludes cached tokens. Output includes thinking.
- Assistant turns were replayed unchanged, thinking blocks included.

### The synthetic project

A 90-second explainer film ("Heat pumps in 90 seconds"), 184 entities, all with short handles:

| Kind | Count | Kind | Count |
|---|---|---|---|
| project, brief, quality intent, delivery profile | 1 each | control track | 20 |
| beat | 6 | event | 25 |
| shot | 14 | time constraint | 15 |
| layer | 48 | voice line | 8 |
| object | 12 | take | 14 |
| component (stub with `meta.controls`) | 10 | caption track | 1 |
| scene context | 2 | claim, source | 3, 2 |

The project was built through the validator itself in three revisions (P1 to P3), so that a `restore` task had a history to restore from.

### The validator

A small in-memory version of R3 sections 2.2 to 2.4: handles (accepting `@handle` or `handle`, rename history, no reuse), typed references with allowed kinds, the eight operations (`create` with `into`, `update` with `set` and `unset` by dot path, `delete` with `cascade`, `rename_handle`, `list_insert`, `list_move`, `list_remove`, `restore`), ordered application, all-or-nothing, and staged validation in which only the earliest failing stage reports. Diagnostics carry `code`, `op_index`, `target`, `path`, `message`, `expected`, `got`, `candidates` and sometimes `fix`.

Codes implemented: `MALFORMED_PATCH`, `UNKNOWN_OP`, `UNKNOWN_REVISION`, `STALE_BASE`, `UNKNOWN_ENTITY` (five nearest handles), `HANDLE_TAKEN`, `HANDLE_INVALID`, `HANDLE_RENAMED`, `UNKNOWN_FIELD`, `TYPE_MISMATCH`, `VALUE_OUT_OF_RANGE`, `MISSING_REQUIRED`, `IMMUTABLE_FIELD`, `BAD_TIME_LITERAL`, `NOT_A_REF_LIST`, `PATH_INTO_ARRAY`, `REF_KIND_MISMATCH`, `DANGLING_REF`, `STILL_REFERENCED`, `UNKNOWN_MEMBER` (a control the component does not declare), `DUPLICATE_OWNER`, `DUPLICATE_LIST_ITEM`, `ANCHOR_NOT_IN_LIST`, `CONSTRAINT_BOUNDS`, `KEYS_NOT_SORTED`, `NO_CHANGE`, `ORPHAN` (warning).

Choices made for the spike, where the design leaves room:

- Times are accepted only as strings such as `"650ms"` or `"5.15s"`.
- `cascade` deletes the members of owned lists and also the entities that belong to the target through a reference of their own (a layer's control tracks, a shot's events, a line's takes).
- Views show handles for references and times as literals. `full` prints one entity as JSON with the field names `update` accepts. Empty optional fields are not shown.
- The page cap is 2,000 tokens, estimated as characters divided by 3.5, cut at an entity boundary, with a cursor.

---

## Spike 1 — patch authoring at project scale (`R3-K2`)

### Method

- Tools: `project_read` (views `outline`, `card`, `summary`, `full`, `timeline`; by handles; 2,000-token page cap and cursor), `project_find` (by kind, text, field values) and `project_patch` (`{base, branch, intent, ops[]}`).
- 40 tasks with a known correct end state, produced by applying a hand-written correct patch: 11 single-field updates, 10 multi-entity edits, 6 list operations, 6 edits that need reading first, 1 rename, 1 restore, 5 impossible as stated (a missing layer, a missing take, a field `strength`, a field `z_index`, a control `wink` that the component does not declare).
- Each run is a fresh conversation. The first user message holds the `outline` view (436 tokens) and the task. Up to 8 turns (model requests) per task. A rejected patch returns its diagnostics and the model may try again.
- A run counts as correct only if the final project state equals the expected state exactly, entity by entity and field by field. For an impossible task the expected state is the unchanged project.
- **System prompt size** (from the `count_tokens` endpoint): 1,282 tokens, plus 828 tokens of tool definitions. In the JSON-text variant: 1,296 and 624. The first request of a run was about 2,800 tokens in total (2,620 in the JSON-text variant). For the RFC 6902 arm: 1,122 and 579 (1,132 and 552).
- The system prompt says: if a request cannot be carried out as stated, do not guess, substitute or invent; say what is wrong and stop.

Three ways of carrying the patch were tested, because the first one failed:

| Name | How `ops` reaches the validator | Runs per model |
|---|---|---|
| **Structured, strict** (as designed) | `ops` is an array of objects in the tool schema; `set` and `fields` are objects with no further typing; the validator accepts exact JSON types only | 40 (1 trial) |
| **Structured, lenient decode** | Same schema. The validator repairs what it can from the entity schema: numeric strings where a number is expected, `"true"`/`"false"`, `{"item": ...}` where an array is expected, `""` where an object or array is expected, and control key values by the control's declared type | 80 (2 trials) |
| **JSON text** | `ops` is declared as a string that holds a JSON array; the validator parses it and is strict | 120 (3 trials) |

Sample sizes in the tables are runs. "Possible tasks" are the 35 that can be done.

### Finding 1: structured tool arguments lose JSON types

In the two structured modes, a large share of patch calls arrived damaged:

| Mode, model | Patch calls | Damaged | Numbers as strings | Arrays as `{"item": ...}` | Empty object or array as `""` | Keys moved to the wrong level |
|---|---|---|---|---|---|---|
| Structured, strict — M3 | 60 | 28 (47%) | 24 | 3 | 4 | 4 |
| Structured, strict — Flash | 79 | 47 (59%) | 41 | 14 | 0 | 5 |
| Structured, lenient — M3 | 91 | 28 (31%) | 18 | 5 | 1 | 9 |
| Structured, lenient — Flash | 85 | 34 (40%) | 26 | 6 | 4 | 6 |
| JSON text — M3 | 133 | 0 | 0 | 0 | 0 | 0 |
| JSON text — Flash | 128 | 0 | 0 | 0 | 0 | 0 |

A call can show more than one kind of damage. Damage was detected by pattern (a purely numeric string, `"true"`, `"false"`, `"null"`, an object whose only key is `item`, an empty string where a container belongs, an operation with members that belong inside a nested object), so the counts may be slightly off. The strict rows count more damage per call partly because a model that is rejected sends the same damaged call again.

What the damage looks like:

- `"set": {"transform.x": "120", "transform.opacity": "0.5"}` instead of numbers.
- `"channels.controls.fan_speed.keys": {"item": [{"at": "0ms", "value": "0"}, ...]}` instead of an array of keys with numeric values.
- `"params": ""` instead of `{}`.
- `{"op": "create", "kind": "control_track", "fields": {}, "target": "s2_title", "layer": "base", "label": ..., "origin": ..., "channels": ...}`: the whole content of `fields` moved up to the operation. This happened in 19 of the 24 structured calls that created a control track (M3 13 of 13, Flash 6 of 11). `target` is also the name of an operation-level parameter in the tool schema. In the first Director session of spike 2, `"into": {"parent": "b3", "list": "shots"}, "after": "s8"` appeared the same way: `after` is an operation-level parameter of the list operations.

The model cannot repair this. After `TYPE_MISMATCH, expected number, got "960"` it sent the identical call again, up to five times, and then gave up or tried to work around it ("Let me create the entities without the transform").

Evidence for the cause:

- In two Flash runs the tool call was not converted and came back as text. It was XML-like: `<invoke name="project_patch">`, then `<base>P3</base>`, `<ops>`, `<item>`, `<op>update</op>`, `<target>...</target>`, `<set>`, with a `]<]minimax[>[` separator between elements. So the model writes elements, and the endpoint builds JSON from them using the tool schema. Leaf text has no type unless the schema gives one, a list is a run of `<item>` elements, and an element name that matches a declared parameter can be attached to the wrong object.
- A probe of 15 single requests ("call `project_patch` with exactly this input") tried five ways of declaring `set` in the schema (plain object, `additionalProperties: true`, untyped items, an `anyOf` union of value types, a description only). Numbers arrived as strings in all 11 structured requests. Flash also turned booleans into strings in all 6 of its requests, wrapped arrays in `{"item": ...}` in 5 of 6, and 2 of the 6 were not valid JSON at all. Declaring `ops` as a string kept every type on Flash (1 of 1) and on M3 in 2 of 3 requests; the third was not parseable.
- In real tasks the damage is intermittent on M3: in the strict runs some calls carried numbers and arrays intact (for example the transform task T03 and the key-array task T29) and others did not.

This would explain why S5 saw 99% valid calls with a simpler patch tool, though S5's tool schema was not re-examined here. The path-to-value map `set` and the free-form `fields` object cannot be typed by a JSON Schema, so they are exactly where the loss happens.

Lenient decoding fixes the scalar and wrapper damage (0 `TYPE_MISMATCH` left on M3, 2 on Flash) but not the misplaced keys: creating a control track failed in 3 of 4 lenient runs and in both strict runs, and passed in 6 of 6 JSON-text runs.

JSON text has its own failure: 6 of 312 patch calls (1.9%) were not valid JSON (an extra closing brace five times, a missing quote once). Four of the six were the same broken string sent again in one run, in spite of a parser message with the position.

### Results on the 40 tasks

Final state and patch validity, possible tasks only:

| Transport, model | Runs | Final state correct | First patch valid | Valid within 1 repair | Within 2 repairs | Never valid | Patch calls accepted | Hit the 8-turn limit |
|---|---|---|---|---|---|---|---|---|
| Structured, strict — M3 | 35 | 28/35 (80%) | 26/35 (74%) | 28/35 (80%) | 28/35 (80%) | 6 | 29/56 (52%) | 3 |
| Structured, strict — Flash | 35 | 26/35 (74%) | 23/34 (68%) | 24/34 (71%) | 25/34 (74%) | 8 | 26/79 (33%) | 11 |
| Structured, lenient — M3 | 70 | 66/70 (94%) | 60/70 (86%) | 66/70 (94%) | 66/70 (94%) | 4 | 67/86 (78%) | 1 |
| Structured, lenient — Flash | 70 | 67/70 (96%) | 63/69 (91%) | 66/69 (96%) | 68/69 (99%) | 1 | 69/83 (83%) | 5 |
| JSON text — M3 | 105 | 98/105 (93%) | 90/104 (87%) | 100/104 (96%) | 102/104 (98%) | 2 | 103/119 (87%) | 4 |
| JSON text — Flash | 105 | 101/105 (96%) | 92/104 (88%) | 100/104 (96%) | 102/104 (98%) | 2 | 102/119 (86%) | 4 |

The validity columns are out of the runs that sent at least one patch. "First patch valid" means the first `project_patch` call of the run was accepted. "Within 1 repair" means the first or the second call was accepted. A patch rejected as `NO_CHANGE` counts as not accepted.

By category (correct / runs):

| Transport, model | Single field | Multi-entity | List | Read first | Rename | Restore |
|---|---|---|---|---|---|---|
| Structured, strict — M3 | 8/11 | 8/10 | 6/6 | 4/6 | 1/1 | 1/1 |
| Structured, strict — Flash | 8/11 | 7/10 | 6/6 | 3/6 | 1/1 | 1/1 |
| Structured, lenient — M3 | 22/22 | 18/20 | 10/12 | 12/12 | 2/2 | 2/2 |
| Structured, lenient — Flash | 20/22 | 19/20 | 12/12 | 12/12 | 2/2 | 2/2 |
| JSON text — M3 | 29/33 | 30/30 | 15/18 | 18/18 | 3/3 | 3/3 |
| JSON text — Flash | 33/33 | 27/30 | 17/18 | 18/18 | 3/3 | 3/3 |

Cost per task, all 40 tasks:

| Transport, model | Runs | Turns | Input, uncached | Input, cache-read | Output | Cost per task | Time per task |
|---|---|---|---|---|---|---|---|
| Structured, strict — M3 | 40 | 4.3 | 890 | 13,664 | 478 | $0.0017 | 8 s |
| Structured, strict — Flash | 40 | 4.9 | 1,906 | 15,883 | 1,000 | $0.0011 | 14 s |
| Structured, lenient — M3 | 80 | 4.0 | 1,696 | 11,775 | 392 | $0.0017 | 6 s |
| Structured, lenient — Flash | 80 | 4.3 | 2,016 | 12,609 | 492 | $0.0008 | 11 s |
| JSON text — M3 | 120 | 4.0 | 1,580 | 11,165 | 333 | $0.0015 | 6 s |
| JSON text — Flash | 120 | 4.1 | 1,589 | 11,360 | 392 | $0.0006 | 9 s |

Token counts are sums over the turns of a run, averaged over runs. About 87% of input was read from the cache, across separate conversations that share the system prompt.

How the operations were used (406 accepted patches in the entity arm): 316 `update`, 106 `create`, 63 `list_insert`, 58 `delete`, 38 `list_remove`, 32 `list_move`, 12 `rename_handle`, 12 `restore`. 146 accepted patches had more than one operation; the largest had 8.

- **Moving a shot between beats** (T13): 12 of 12 runs used `list_remove` and `list_insert` in one patch. No run met `DUPLICATE_OWNER`.
- **Deleting a layer that tracks reference** (T14): 12 of 12 correct; 4 used `cascade`, 8 deleted the tracks first in the same patch. No run met `STILL_REFERENCED`. The same holds for deleting an event with its constraint (T15, 12 of 12).
- **Adding keys to a control channel** (T28, T29, lenient and JSON text): 20 of 20 correct, first patch valid in all 20. The models re-sent the whole key array; none tried to index into it.
- **Restore** (T35): 12 of 12 correct, all with the `restore` operation.

### Which diagnostics occurred

Rejected patch calls that carried the code, possible tasks only:

| Code | Strict M3 | Strict Flash | Lenient M3 | Lenient Flash | JSON text M3 | JSON text Flash |
|---|---|---|---|---|---|---|
| `TYPE_MISMATCH` | 21 | 43 | 0 | 2 | 3 | 3 |
| `UNKNOWN_FIELD` | 2 | 1 | 6 | 2 | 8 | 8 |
| `MALFORMED_PATCH` | 4 | 5 | 11 | 6 | 0 | 0 |
| `UNKNOWN_ENTITY` | 1 | 0 | 1 | 3 | 2 | 4 |
| `NO_CHANGE` | 0 | 2 | 1 | 0 | 1 | 1 |
| `MISSING_REQUIRED` | 0 | 2 | 0 | 0 | 0 | 0 |
| `ANCHOR_NOT_IN_LIST` | 0 | 0 | 0 | 0 | 1 | 1 |
| `UNKNOWN_OP` | 0 | 1 | 0 | 0 | 0 | 0 |
| `HANDLE_TAKEN` | 0 | 0 | 0 | 0 | 1 | 0 |
| Tool input not valid JSON | 0 | 0 | 0 | 1 | 0 | 0 |
| Rejected patch calls in total | 27 | 53 | 19 | 14 | 16 | 17 |

- In the structured modes almost every `TYPE_MISMATCH` and `MALFORMED_PATCH` is transport damage. In JSON-text mode they are real model errors: `null` for an empty filter list, 0.8 for an integer.
- With the transport fixed, **`UNKNOWN_FIELD` is the most common diagnostic** (16 of 33 rejected calls), then `UNKNOWN_ENTITY` (6) and `TYPE_MISMATCH` (6).
- **Never produced by a model in the entity arm:** `STALE_BASE`, `PATH_INTO_ARRAY`, `NOT_A_REF_LIST`, `BAD_TIME_LITERAL`, `STILL_REFERENCED`, `DANGLING_REF`, `DUPLICATE_OWNER`, `DUPLICATE_LIST_ITEM`, `CONSTRAINT_BOUNDS`, `KEYS_NOT_SORTED`, `REF_KIND_MISMATCH`, `VALUE_OUT_OF_RANGE`. They were checked by hand only, so their repair messages are untested on models.

### Invented handles and fields

Runs on possible tasks in which a patch named a handle, field or control that does not exist:

| Transport, model | Runs | What was invented (runs) | Task still ended correct |
|---|---|---|---|
| Structured, strict — M3 | 3/35 (9%) | T05 `opacity` (1); T11 `filters`, `layers` (1); T25 `film project` (1) | 2 of 3 |
| Structured, strict — Flash | 1/35 (3%) | T05 `opacity` (1) | 0 of 1 |
| Structured, lenient — M3 | 6/70 (9%) | T11 `filters`, `layers` (2); T17 `events` (1); T25 `project`, `beats` (2); T32 `opacity` (1) | 4 of 6 |
| Structured, lenient — Flash | 5/70 (7%) | T11 `name`, `filters`, `layers` (1); T12 layers used before they existed (1); T09 `max_chars` (1); T13 empty handle (1); T25 `project` (1) | 4 of 5 |
| JSON text — M3 | 10/105 (10%) | T11 `filters`, `layers` (2); T32 `opacity` (2); T10 `budget_usd` (1); T12 layers used before they existed (2); T18 `takes` (2); T17 `events` (1) | 8 of 10 |
| JSON text — Flash | 11/105 (10%) | T11 `filters`, `layers`, `name` (3); T25 `project`, `film project`, `proj`, `index` (3); T12 (1); T18 `takes` (1); T05 `opacity` (1); T17 `events` (1); T09 `max_chars` (1) | 9 of 11 |

About one run in ten guessed a name. The diagnostic with near matches repaired it in 27 of 36 cases. The guesses fall into four groups:

1. **A shape with no example in the project.** No shot has an effect group, so `groups` shows as `{}`. Asked to add one (T11), the models guessed `filters` and `layers`. M3 first spent 5 to 7 turns searching the project for an example and ran out of turns in all 3 JSON-text runs.
2. **An optional field that is not set.** Views hide empty fields, so `layout.max_chars_per_line` (T09) cannot be found by reading. The models guessed `max_chars`, or went looking for it in other entities.
3. **A short path.** `opacity` for `transform.opacity` (T05, T32), `budget_usd` for `policy.budget_usd` (T10). Repaired every time.
4. **The project's own handle.** The project entity has the handle `film`. The outline line reads `film project "Heat pumps in 90 seconds" ...`, and several runs took `project` to be the handle (T25: 0 of 2 correct on lenient M3, 2 of 3 on JSON-text Flash).

The models also assumed reverse lists that do not exist: `voice_line.takes` (T18) and `shot.events` (T17).

### The five impossible tasks

| Transport, model | Runs | State unchanged | Reported the problem and stopped | Changed the project | Hit the turn limit | Other |
|---|---|---|---|---|---|---|
| Structured, strict — M3 | 5 | 5 | 5 | 0 | 0 | 0 |
| Structured, strict — Flash | 5 | 5 | 4 | 0 | 1 | 0 |
| Structured, lenient — M3 | 10 | 8 | 8 | 2 | 0 | 0 |
| Structured, lenient — Flash | 10 | 10 | 7 | 0 | 1 | 2 |
| JSON text — M3 | 15 | 15 | 13 | 0 | 2 | 0 |
| JSON text — Flash | 15 | 15 | 14 | 0 | 1 | 0 |
| All | 60 | 58 (97%) | 51 (85%) | 2 (3%) | 5 | 2 |

- **51 of 60 runs** named the problem correctly and left the project alone. Most also listed what does exist ("vl4 only has `vl4_t1` and `vl4_t2`") and offered an alternative without acting on it.
- **2 of 60 substituted**, both M3: it selected `vl4_t2` "as the nearest available alternative" to the missing `vl4_t3`, and it set `priority` to 1 because there is no `strength` ("the nearest representable integer to 0.8"). Both said so in the answer.
- **18 of 60 sent a patch** before answering, usually with the name from the task. Apart from the two substitutions every such patch was rejected (`UNKNOWN_FIELD`, `UNKNOWN_MEMBER`, `TYPE_MISMATCH`), and the model then reported.
- 5 hit the turn limit: 4 on the `z_index` task, still reading, and 1 on the `wink` task after sending the same broken JSON four times. The 2 "other" runs are the Flash runs in which the tool call came back as text.
- By task, entity arm, 12 runs each: missing layer 12 reported; missing take 11; `strength` 11; `wink` control 9; `z_index` 8.

### Reads and paging

| Arm | Runs | Read and find calls | Results cut at the 2,000-token cap | Calls that passed a cursor |
|---|---|---|---|---|
| Entity operations (40 tasks) | 480 | 1,291 | **0** | 0 |
| Entity operations (paging probes) | 8 | 35 | **0** | 0 |
| RFC 6902 document | 100 | 360 | 4 | 0 |

- **No `project_read` or `project_find` result was ever paged.** Estimated result sizes: `full` reads median 99 tokens, largest 438; `timeline` median 248; `project_find` median 37, largest 1,470 (all 48 layers as one line each).
- The models read by handle in small sets. In the lenient runs (430 calls) about 49% were `full` reads, 37% `project_find`, 11% `timeline`. `card` and `summary` were almost never used.
- Two extra tasks were added to force large reads (change every control track whose last key is 1; add a param to every layer that has a `text` param). All 8 runs were correct, and none was paged: the models split the work themselves into calls of 5 to 23 handles, each just under the cap.
- In the RFC 6902 arm 4 reads of the whole `/takes` array were cut. The model never used the cursor; it carried on with the first page, and 3 of those 4 runs were still correct.
- So the cursor path was not exercised by any model in this spike.

### Comparison with RFC 6902 JSON Patch

Ten tasks were repeated against one whole-project JSON document: beats, shots and layers nested as arrays, other kinds as top-level arrays, references as handles. Tools: `doc_read` (a path and a depth, 2,000-token cap), `doc_find` (matches with their paths) and `doc_patch` (`{base, intent, ops}` with `add`, `remove`, `replace`, `move`, `copy`, `test`). The result is validated with the same schema, reference and invariant checks. The tasks: two single-field updates, add a shot with two layers and an event, move a shot between beats, delete a layer with its tracks, reorder layers, insert a voice line, find a track and add two keys, and two impossible tasks.

Possible tasks (8 tasks), same transport on both sides:

| Format, transport, model | Runs | Final state correct | First patch valid | Valid within 1 repair | Within 2 repairs | Hit the turn limit |
|---|---|---|---|---|---|---|
| Entity operations, JSON text — M3 | 24 | 22/24 (92%) | 20/24 (83%) | 23/24 (96%) | 24/24 (100%) | 0 |
| RFC 6902, JSON text — M3 | 24 | 21/24 (88%) | 20/24 (83%) | 24/24 (100%) | 24/24 (100%) | 0 |
| Entity operations, JSON text — Flash | 24 | 23/24 (96%) | 23/24 (96%) | 23/24 (96%) | 23/24 (96%) | 1 |
| RFC 6902, JSON text — Flash | 24 | 20/24 (83%) | 23/23 (100%) | 23/23 (100%) | 23/23 (100%) | 1 |
| Entity operations, lenient — M3 | 16 | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 0 |
| RFC 6902, lenient — M3 | 16 | 15/16 (94%) | 13/16 (81%) | 16/16 (100%) | 16/16 (100%) | 0 |
| Entity operations, lenient — Flash | 16 | 16/16 (100%) | 13/16 (81%) | 14/16 (88%) | 16/16 (100%) | 0 |
| RFC 6902, lenient — Flash | 16 | 14/16 (88%) | 15/16 (94%) | 16/16 (100%) | 16/16 (100%) | 0 |

Cost per task, all 10 tasks:

| Format, transport, model | Runs | Turns | Input, uncached | Input, cache-read | Output | Cost per task |
|---|---|---|---|---|---|---|
| Entity operations, JSON text — M3 | 30 | 3.8 | 1,677 | 10,693 | 390 | $0.0016 |
| RFC 6902, JSON text — M3 | 30 | 4.3 | 2,943 | 12,661 | 378 | $0.0021 |
| Entity operations, JSON text — Flash | 30 | 3.8 | 1,505 | 10,483 | 392 | $0.0006 |
| RFC 6902, JSON text — Flash | 30 | 4.6 | 2,794 | 13,581 | 531 | $0.0009 |

- **Accuracy is about the same.** On the JSON-text transport: entity operations 45 of 48, RFC 6902 41 of 48.
- **Six of the seven RFC misses are one thing.** Asked to insert a voice line with a speaker, two texts and a duration (T24), the model copied `direction: {style: "warm", pace: "normal"}` from the neighbouring lines it had just read. This happened in 6 of 6 RFC runs and in 2 of 6 entity runs. If that extra field is accepted, both formats score 47 of 48.
- **First-patch validity is no worse for RFC 6902** (43 of 47 against 43 of 48). The index shift that the design names as the risk did appear: in 3 of 90 RFC patch calls the model removed `/control_tracks/11` and then `/control_tracks/12` in one patch, and the second index had moved (`DANGLING_REF`). A fourth `DANGLING_REF` came from an `add` that replaced a whole `shots` array. Each was repaired on the next attempt.
- **RFC 6902 costs more to read for.** 0.5 to 0.8 more turns and 75% to 85% more uncached input per task, so about 30% (M3) to 50% (Flash) more money, because the model reads larger parts of the document to find positions.
- The structured transport damages RFC 6902 patches as well: 16 of 39 lenient-mode `doc_patch` calls had numbers as strings or `""` for an empty container.
- Impossible tasks, RFC arm: 20 runs, 18 reported the problem, 2 hit the turn limit, none changed the document.

### Failures on possible tasks

JSON text, 11 of 210 runs:

| Task | Model | Runs | What happened |
|---|---|---|---|
| T11 add an effect group and put a layer in it | M3 | 3 | Searched for an example of a group for 5 to 7 turns, guessed `filters`/`layers`, ran out of turns |
| T24 insert a voice line | M3 | 2 | Added an unrequested `direction` copied from other lines |
| T09 caption limits | M3 | 1 | Set `max_lines`, could not find the unset field `max_chars_per_line`, ran out of turns |
| T23 put a layer on top of the stack | M3 | 1 | Moved it "before" the top layer, got `NO_CHANGE`, concluded it was already on top |
| T12 add a shot with two layers and an event | Flash | 1 | Three rejected patches (`UNKNOWN_ENTITY`, `ANCHOR_NOT_IN_LIST`, `TYPE_MISMATCH`), ran out of turns |
| T16 add a time constraint | Flash | 1 | Added an unrequested `priority: 1` |
| T21 set a param on two layers | Flash | 1 | Eight turns of reading, no patch |
| T25 reorder beats | Flash | 1 | Did not find the project handle `film` |

Structured, lenient, 7 of 140 runs: creating a control track with misplaced keys (T20: M3 2 of 2 runs, Flash 1 of 2); the project handle (T25: M3 2); T09 and T11 on Flash (1 each).

Structured, strict, 16 of 70 runs: 15 had transport damage that the model could not repair (T03, T05, T09, T10, T11, T12, T18, T20, T28, T29, T32); the other ran out of turns without sending a patch.

No run ended in an API error. No response stopped at `max_tokens`.

### Limits of spike 1

- One synthetic project and 40 hand-written tasks. Most tasks name their handles. Vague requests, as a Director would write them, were not tested.
- The validator is a spike. Scopes, locks, branches, merge, member references and data bindings were left out. The semantics of `cascade` and of time literals are choices made here.
- A run is correct only on exact state equality, which is strict: a harmless extra field fails it.
- 1 trial per task for the strict mode, 2 for lenient, 3 for JSON text. A difference of a few points between modes or models is within noise. The difference between strict and the other two is not.
- 18 of the 400 lenient and JSON-text runs stopped at the 8-turn limit (14 of them on possible tasks), and 15 of the 80 strict runs. A higher limit would turn some of them into successes.
- Paging was never triggered, so `project_read` paging and cursors are untested.
- Token counts for the page cap are estimates (characters divided by 3.5).
- The transport damage was measured on one day on one endpoint. It may depend on the provider's current tool-call conversion.
- The first user message carried the outline view. Without it the models would have needed one more read.

---

## Spike 2 — segment restart (`R6-S10`)

### Method

- Model: `MiniMax-M3`, `thinking: {type: "adaptive"}`. Same project and project tools. `project_patch` took its `ops` as JSON text, for the reason given under "First session" below.
- Other tools, with canned results: `compile`, `render_request` (returns a job handle such as `job_r_c5h8`), `job_status`, `review_request` (a review job whose result lists findings with ids such as `fd_k3m7`), plus two that the test needed: `decision_record` and `finding_resolve`. An unknown job handle or finding id returns an error with no suggestions.
- **Sizes:** system prompt 1,548 tokens, tool definitions 1,104. The first message of a session (brief, the plan, the outline view, an empty digest) is about 1,190 tokens.
- The first message gives a fixed plan of 12 steps: (1) retime the reaction in shot s4; (2) choose the hook wording from two options, record the decision, set the title text; (3) add a Spanish caption track; (4) request a preview of beat b1 and do not wait; (5) select the take of line vl2 closest to -16 LUFS; (6) check the preview, request its review, read the findings; (7) add a shot with two layers and an event, request its preview and do not wait; (8) fix the major findings and close them; (9) fix or waive the minor finding and close it; (10) set the end-card text to match the hook decision of step 2; (11) check the step-7 preview, compile, request a full preview and wait; (12) review it and record an acceptance decision.
- A turn is one model request. When the model answered without a tool call, the harness replied "Continue with the plan."
- Jobs finish a fixed number of turns after the request. The step-7 preview stays running until turn 27, so that a job is open at the boundary. The b1 review returns two major findings and one minor one, each with an exact fix.
- **At turn 25** the session is frozen. From that state:
  - **Restart arm:** one more request in the old conversation asks for working notes. A new conversation then starts from one message: the brief with the plan, a fresh outline view, a state digest generated by code (revision, open jobs with status, open findings with their text, a budget line, up to ten recent decisions) and the notes. Ten turns follow.
  - **Control arm:** the original conversation continues for ten turns.
  - **No-notes arm (extra):** as the restart arm, with "(no notes were written)" in place of the notes.
- Each arm was scored by code (the state each step should produce, the jobs requested, the findings closed) and by reading the transcripts.
- Three sessions with JSON-text patches (p2, p3, p4), each with 3 restart runs and 2 control runs. Two sessions also have 2 no-notes runs.

### First session: structured patches stalled the Director

The first session (p1) sent patches as structured tool arguments with lenient decoding. It reached step 7 at turn 21 and then had **five rejected patches in a row** (turns 21 to 25). The position key of `into` arrived at the operation level (`"into": {"parent": "b3", "list": "shots"}, "after": "s8"`), and the model sent the same call again. 4 of its 9 patches were accepted. This session was not used for the restart test. The three sessions with JSON-text patches had 17 of 18 patches accepted in their first 25 turns; the one rejection, an unknown field, was repaired on the next turn.

### State at the boundary

| Session | Steps done at turn 25 | Open jobs | Open findings | Decisions | Context at turn 25 | Cost of the 25 turns |
|---|---|---|---|---|---|---|
| p2 | 1 to 8; step 9 half done (fix patched at turn 25, finding not yet closed) | 1 (step-7 preview) | 1 (minor) | 2 | 13,474 tokens | $0.024 |
| p3 | 1 to 7 | 1 | 3 | 1 | 16,358 tokens | $0.027 |
| p4 | 1 to 7 | 1 | 3 | 2 | 13,027 tokens | $0.022 |

The hook decision was option A in every session.

### Results of the ten turns

| | Restart (9 runs) | Control (6 runs) | No notes (4 runs) |
|---|---|---|---|
| Steps repeated that were already done | 0 | 0 | 0 by the automatic check; 2 runs redid part of earlier work (below) |
| Steps skipped | 0 | 0 | 0 |
| Patches that contradict an earlier decision | 0 | 0 | 0 |
| End-card text matches the hook decision | 9 of 9 | 6 of 6 | 4 of 4 |
| Open job polled with the right handle | 9 of 9 | 6 of 6 | 4 of 4 |
| Calls with an unknown job handle or finding id | 0 | 0 | 0 |
| Open findings at the boundary closed by the end | all, 9 of 9 | all, 6 of 6 | all, 4 of 4 |
| Render or review requested twice | 0 | 0 | 0 |
| Earlier results undone | 0 | 0 | 0 |
| Patches rejected / sent | 1 / 22 | 0 / 14 | 1 / 10 |

Progress and cost per session (ranges over the runs):

| Session, arm | n | Steps finished in the 10 turns | Uncached input | Cache-read input | Output | Cost of the 10 turns | Notes request: output tokens; cost | Context, first turn / last turn |
|---|---|---|---|---|---|---|---|---|
| p2 restart | 3 | 9, 10, 11 | 5,808–6,273 | 51,456–53,633 | 708–784 | $0.0058–0.0060 | 853–1,055; $0.0019–0.0021 | 5,039–5,277 / 6,199–6,448 |
| p2 control | 2 | 9, 10, 11 | 1,085–1,146 | 140,899–141,348 | 703–735 | $0.0096–0.0097 | – | 13,610 / 14,722–14,754 |
| p2 no notes | 2 | 9, 10 | 8,450–14,169 | 76,485–89,467 | 5,466–7,912 | $0.0137–0.0191 | – | 4,207 / 12,656–14,353 |
| p3 restart | 3 | 8, 9, 10 | 6,566–7,229 | 55,617–58,347 | 956–1,292 | $0.0065–0.0072 | 1,152–1,309; $0.0024–0.0027 | 5,435–5,592 / 6,750–7,413 |
| p3 control | 2 | 8, 9, 10 | 1,840–2,206 | 178,026–179,910 | 1,410–1,774 | $0.0129–0.0136 | – | 16,870 / 18,710–19,074 |
| p3 no notes | 2 | 8, 9, 10 | 2,652–5,629 | 61,056–75,008 | 2,359–2,870 | $0.0082–0.0087 | – | 4,277 / 7,667–9,134 |
| p4 restart | 3 | 8, 9, 10 | 2,806–7,551 | 59,308–88,576 | 1,277–4,739 | $0.0073–0.0118 | 1,097–2,421; $0.0021–0.0037 | 5,408–6,731 / 7,588–10,978 |
| p4 control | 2 | 8, 9, 10 | 2,198–2,347 | 144,644–145,458 | 1,650–1,782 | $0.0114–0.0115 | – | 13,360 / 15,563–15,705 |

Token columns are sums over the ten turns. Means over all runs: restart $0.0073 for the ten turns plus $0.0024 for the notes request, $0.0097 together; control $0.0115; no notes $0.0124.

What the comparison shows:

- **Fidelity.** In all 9 restart runs the first action was the right next one. In p2 the notes said "patch already applied (rev P10) ... still to do: call finding_resolve", and all three restart runs closed the finding without patching again. The job handle and the finding ids were copied exactly from the digest and the notes.
- **Spread.** The 3 restart runs of a session finished the same steps as its 2 control runs. Within step 11 or 12, at turn 35, the restart run was at the same point as the control in 3 of 9 runs, one turn ahead in 2 and one or two turns behind in 4. The lag came from one to three orienting reads at the start of the new segment, and in one run from a patch with a JSON syntax error (an extra closing brace, repaired on the next turn).
- **Tokens.** A restart turn reads about 6,100 cached tokens against 15,500 for a control turn, but the first request of the new segment is mostly uncached (4,900 to 6,600 tokens in 8 of 9 runs) and the notes request costs about 1,200 output tokens. At this context size the restart is about 15% cheaper over ten turns; with the notes request excluded, 36% cheaper.
- **The notes.** 2,771 to 8,141 characters; the one measured was 849 tokens. Each listed the steps as done, in progress or remaining, with handles, revision numbers, the decision and its consequence for step 10. The whole segment-start message was about 2,250 tokens in that run.

### The no-notes runs (extra, 4 runs)

- **p3, where no step was half done at the boundary:** both runs finished the same steps as the restart runs, with no rework, at $0.0082 to $0.0087. The digest was enough: it lists the open findings with their fix text and the open job.
- **p2, where step 9 was half done:** both runs spent five to six turns re-reading the project to work out what had been done, and finished one step fewer.
  - One sent the opacity fix again (rejected as `NO_CHANGE`), then recorded a waiver decision calling the finding "stale: s2_title already sits at opacity 1" and closed it as waived. The fix was its own, from the previous segment.
  - The other pinned event `ev_s4_react` at 2.45s, an edit that step 1 never asked for, and sent the opacity fix again inside a patch that also set the end card.
  - They cost $0.0191 and $0.0137, two to three times a restart run.
- So the notes carry what is in neither the project nor the digest: which step the Director is in, and what has been patched but not yet closed.

### Other observations

- In session p3 the model, in step 1, also pinned the reaction event at 2.45s without being asked ("matching the project convention"). This is over-reach in the first segment and has nothing to do with the restart.
- With adaptive thinking M3 wrote almost no visible text between tool calls. The "Step N done" lines that the system prompt asked for were rare. The record of progress was the tool calls, not the prose.
- No tool input was invalid JSON in any spike 2 request. Patches with JSON-text `ops`: 3 of 64 rejected in sessions p2 to p4 including all arms (one unknown field, one JSON syntax error, one `NO_CHANGE` in a no-notes run).

### Limits of spike 2

- **The context was small.** 13,000 to 17,000 tokens at the boundary. A real compaction threshold would be many times higher. The test shows that the restart mechanism carries state. It does not show how a model behaves after a very long segment, or how good its notes are when written from a 150,000-token context.
- The session was 25 turns as specified, not the 30 of the claim's original wording, and the task was a numbered linear plan that the brief repeats in the new segment. That makes "where am I" easy to write down and easy to recover. Open-ended production work is harder.
- Only 1 or 2 decisions existed at the boundary, so the limit of ten recent decisions was never reached. Only one decision (the hook) had a later consequence.
- All arms of a session share one first segment. Three sessions were run; in all three the model chose option A and the boundary fell at step 7 to 9.
- The tool results were canned and deterministic. No job failed, no finding conflicted with a decision, and nothing changed in the project between the old segment and the new one.
- The ten turns did not reach the end of the plan in any arm, so the final acceptance step was not observed.
- One model, with thinking on. Flash was not tested.
- The repeat and skip checks are rules written for this plan. They missed the rework in the no-notes runs, which was found by reading the transcripts.

---

## Spend

| Part | Requests | Spend |
|---|---|---|
| Spike 1 (588 recorded runs, plus 20 pilot runs not in the tables) | 2,574 | $0.78 |
| Spike 2 (4 first segments, 19 arms, 9 notes requests) | 299 | $0.30 |
| Schema probe | 15 | $0.01 |
| Total | 2,888 | **$1.09** |

Totals over all requests: 1.32 million uncached input tokens, 10.36 million cache-read input tokens, 0.37 million output tokens. At list prices with no caching the same work would have cost $3.17. Token counts for the prompt sizes came from the `count_tokens` endpoint (15 requests), which returns only a count and is assumed to be free.

## What this means for the two claims

**`R3-K2` (MiniMax can write and repair the full patch format at project scale).**

- The operation set holds up. By-value list addressing, cascading deletes, whole-array replacement of keyframes, rename and restore were all used correctly, mostly on the first attempt. With a transport that keeps JSON types: 95% of runs correct, 88% of first patches valid, 96% within one repair, 98% within two, at $0.0006 (Flash) to $0.0015 (M3) per edit.
- It does not hold as written, with patches as plain structured tool arguments. The tool boundary changes the patch before the validator sees it, and the model cannot repair that. Either `ops` travels as JSON text (measured: no type damage in 312 calls, 1.9% JSON syntax errors), or the validator decodes by schema and no field inside `fields`, `set` or `into` shares a name with a tool parameter (lenient decoding alone still failed 3 of 4 control-track creations).
- The remaining errors are mostly about discovery, not about the operations: fields that views hide because they are empty, shapes with no example in the project, and the project's own handle. A way to read a kind's field list would address the first two.
- The first-try rate is 88%, not the 99% of S5. Validate-and-repair is needed and it works: one repair closes most of the gap.
- RFC 6902 is not less accurate on these 10 tasks. Its measured costs are more reading, index-shift errors on multi-item removals, and a stronger pull to copy neighbouring fields. The design's other reasons for rejecting it (entity identity for scopes and locks, merge) were not tested here.

**`R6-S10` (a new segment loses no working state).**

- Supported at small scale: 9 of 9 restart runs continued without repeating, skipping or contradicting anything, and used every handle correctly.
- The working notes are needed, not optional: without them, a step that was half done at the boundary led to rework and a wrongly reasoned waiver in 2 of 2 runs.
- The saving in tokens is small at 15,000 tokens of context. The case for restarting rests on large contexts, which this spike did not reach.
- Tool-call validity over the long session depended on the transport: the session with structured patches stalled on five rejected patches in a row.
