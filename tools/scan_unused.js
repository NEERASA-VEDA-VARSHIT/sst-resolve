const fs = require('fs');
const path = require('path');

function listFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of list) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) results = results.concat(listFiles(full));
    else results.push(full);
  }
  return results;
}

const repoRoot = process.cwd();
const srcDir = path.join(repoRoot, 'src');

function readAllTextFiles() {
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];
  const files = listFiles(srcDir).filter(f => exts.includes(path.extname(f)));
  const contents = {};
  for (const f of files) {
    try {
      contents[f] = fs.readFileSync(f, 'utf8');
    } catch (e) {
      contents[f] = '';
    }
  }
  return contents;
}

const contents = readAllTextFiles();
const allPaths = Object.keys(contents);

// Gather API files
const apiDir = path.join(srcDir, 'app', 'api');
const apiFiles = listFiles(apiDir).filter(f => f.endsWith('route.ts'));

function routeCandidatesForFile(file) {
  const rel = path.relative(apiDir, file).replace(/\\/g, '/');
  // remove route.ts
  let route = '/api/' + rel.replace(/route\.ts$/, '');
  // strip dynamic segments
  route = route.replace(/\[.*?\]/g, '');
  // collapse slashes
  route = route.replace(/\/+/g, '/');
  // remove trailing slash
  if (route.endsWith('/')) route = route.slice(0, -1);
  const parts = route.split('/').filter(Boolean);
  const candidates = new Set();
  candidates.add(route);
  // add progressively shorter prefixes
  for (let i = parts.length; i >= 1; i--) {
    candidates.add('/' + parts.slice(0, i).join('/'));
  }
  // also add base two segments if available
  if (parts.length >= 2) candidates.add('/' + parts.slice(0, 2).join('/'));
  return Array.from(candidates);
}

const apiUsage = [];
for (const file of apiFiles) {
  const cands = routeCandidatesForFile(file);
  let found = false;
  for (const p of allPaths) {
    const txt = contents[p];
    for (const cand of cands) {
      if (txt.includes(`"${cand}`) || txt.includes(`'${cand}`) || txt.includes(cand + '"') || txt.includes(cand + "'") || txt.includes(cand + '/') || txt.includes(cand + '?')) {
        found = true; break;
      }
      // also check template usage like `/api/tickets/${id}/status` by checking prefix
      if (txt.includes(cand + '/${') || txt.includes(cand + '/${')) { found = true; break; }
    }
    if (found) break;
  }
  apiUsage.push({ file: path.relative(repoRoot, file), routeCandidates: cands, used: found });
}

// Components
const compsDir = path.join(srcDir, 'components');
let compFiles = [];
try { compFiles = listFiles(compsDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.js')); } catch (e) { compFiles = []; }

const compUsage = [];
for (const file of compFiles) {
  const name = path.basename(file).replace(/\.(tsx|ts|jsx|js)$/, '');
  let found = false;
  for (const p of allPaths) {
    if (p === file) continue;
    const txt = contents[p];
    // search for import by alias path (e.g. @/components/...) or relative path
    const aliasPath = '@/'+ path.relative(srcDir, file).replace(/\\/g, '/').replace(/\.(tsx|ts|jsx|js)$/, '');
    const relImport = path.relative(path.dirname(p), file).replace(/\\/g, '/').replace(/\.(tsx|ts|jsx|js)$/, '');
    if (txt.includes(aliasPath) || txt.includes(`from "${relImport}`) || txt.includes(`from '${relImport}`) ) { found = true; break; }

    // Also look for JSX usage by PascalCase name (file may export PascalCase component)
    const pascal = name.replace(/(^|[-_])(\w)/g, (_, __, ch) => ch.toUpperCase()).replace(/[-_]/g, '');
    if (txt.includes(`<${pascal} `) || txt.includes(`<${pascal}>`) || txt.includes(`import ${pascal}`) || txt.includes(`import { ${pascal}`)) { found = true; break; }

    // Check re-exports
    if (txt.includes(`export * from "${aliasPath}`) || txt.includes(`export {`) && txt.includes(aliasPath)) { found = true; break; }
  }
  compUsage.push({ file: path.relative(repoRoot, file), name, used: found });
}

const unusedApis = apiUsage.filter(a => !a.used).map(a => ({ file: a.file, candidates: a.routeCandidates }));
const unusedComps = compUsage.filter(c => !c.used).map(c => ({ file: c.file, name: c.name }));

console.log(JSON.stringify({ unusedApis, unusedComps, counts: { apiFiles: apiFiles.length, compFiles: compFiles.length } }, null, 2));
