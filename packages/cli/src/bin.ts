#!/usr/bin/env node
// Design: lld/07 D12 (the `cutroom` bin)
import { runCli } from "./cli.js";

process.exitCode = await runCli(process.argv.slice(2));
