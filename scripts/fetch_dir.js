#!/usr/bin/env node
import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";

let [,, cmd, repo, branch="main", folder, dest] = process.argv;
if (!cmd || !repo || !folder) {
  console.log("usage: subtree.js add <repo> [branch] <folder> <dest>");
  process.exit(1);
}

if (!dest) {
  // if dest not provided, use folder name
  dest = folder;
}

const run = c => execSync(c, { stdio: "inherit" });

if (cmd === "add") {
  const tmp = ".tmp_sparse_repo";
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });

  // 1️ sparse clone of the folder
  run(`git clone --depth 1 --filter=blob:none --sparse ${repo} ${tmp}`);
  run(`cd ${tmp} && git sparse-checkout set ${folder}`);

  // 2️ add folder to main repo
  run(`mkdir -p ${dest}`);
  run(`cp -r ${tmp}/${folder}/. ${dest}/`);

  // 3️ cleanup
  rmSync(tmp, { recursive: true, force: true });

  console.log(`✅ ${folder} from ${repo} imported into ${dest}`);
} else {
  console.error("unknown command");
  process.exit(1);
}
