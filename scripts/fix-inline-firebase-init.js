/**
 * Codemod v2: Remove inline Firebase Admin initialization blocks from API routes.
 * Uses line-by-line processing to handle Windows CRLF line endings.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiDir = join(__dirname, '..', 'app', 'api');

let totalFixed = 0;

function getAllJsFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            files.push(...getAllJsFiles(full));
        } else if (extname(entry) === '.js') {
            files.push(full);
        }
    }
    return files;
}

function fixFile(content) {
    // Normalize to LF for processing, we'll restore CRLF at the end if needed
    const hasCRLF = content.includes('\r\n');
    let text = content.replace(/\r\n/g, '\n');
    let changed = false;

    // Step 1: Remove single-line dynamic import of firebase-admin/app
    const importAppRegex = /^[ \t]*const \{[^}]+\} = await import\(['"]firebase-admin\/app['"]\);?\s*$/gm;
    if (importAppRegex.test(text)) {
        text = text.replace(importAppRegex, '');
        changed = true;
    }

    // Step 2: Remove single-line dynamic import of firebase-admin/auth (getAuth only)
    const importAuthRegex = /^[ \t]*const \{ getAuth \} = await import\(['"]firebase-admin\/auth['"]\);?\s*$/gm;
    if (importAuthRegex.test(text)) {
        text = text.replace(importAuthRegex, '');
        changed = true;
    }

    // Step 3: Remove entire `if (getApps().length === 0) { ... }` blocks using brace counting
    let safetyLimit = 30;
    while (safetyLimit-- > 0) {
        const match = text.match(/[ \t]*if \(getApps\(\)\.length === 0\) \{/);
        if (!match) break;

        const startIdx = text.indexOf(match[0]);
        if (startIdx === -1) break;

        const braceStart = text.indexOf('{', startIdx);
        if (braceStart === -1) break;

        let depth = 1;
        let i = braceStart + 1;
        while (i < text.length && depth > 0) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}') depth--;
            i++;
        }

        // Eat trailing newline
        if (text[i] === '\n') i++;

        text = text.slice(0, startIdx) + text.slice(i);
        changed = true;
    }

    // Step 4: Clean up multiple consecutive blank lines left by removals
    text = text.replace(/\n{3,}/g, '\n\n');

    if (hasCRLF) text = text.replace(/\n/g, '\r\n');
    return { result: text, changed };
}

const files = getAllJsFiles(apiDir);

for (const file of files) {
    let content;
    try {
        content = readFileSync(file, 'utf-8');
    } catch {
        continue;
    }

    if (!content.includes('firebase-admin/app') && !content.includes('firebase-admin/auth')) {
        continue;
    }

    const { result, changed } = fixFile(content);

    if (changed) {
        writeFileSync(file, result, 'utf-8');
        const shortPath = file.replace(join(__dirname, '..'), '').replace(/\\/g, '/');
        console.log('✅ Fixed:', shortPath);
        totalFixed++;
    }
}

console.log(`\n🎯 Done! Fixed ${totalFixed} files.`);

