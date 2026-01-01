
import { PrismaClient } from '@prisma/client';
import { Project, SyntaxKind, Node } from 'ts-morph';
import * as glob from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Configuration
const MIN_COMPLEXITY = 3; // Ignore very simple getters/setters
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/*.d.ts',
  '**/test/**',
  '**/*.test.ts',
  '**/*.spec.ts',
];

// Complexity weights
const COMPLEXITY_WEIGHTS: Record<string, number> = {
  [SyntaxKind.IfStatement]: 1,
  [SyntaxKind.ElseKeyword]: 1,
  [SyntaxKind.ForStatement]: 1,
  [SyntaxKind.ForInStatement]: 1,
  [SyntaxKind.ForOfStatement]: 1,
  [SyntaxKind.WhileStatement]: 1,
  [SyntaxKind.DoStatement]: 1,
  [SyntaxKind.SwitchStatement]: 1,
  [SyntaxKind.CaseClause]: 1,
  [SyntaxKind.CatchClause]: 1,
  [SyntaxKind.ConditionalExpression]: 1, // Ternary
  [SyntaxKind.BinaryExpression]: 0.5, // slightly less for && / ||
};

function calculateComplexity(node: Node): number {
  let complexity = 1; // Base complexity
  
  node.forEachDescendant((descendant) => {
    const kind = descendant.getKind();
    
    // Check direct weights
    if (COMPLEXITY_WEIGHTS[kind] !== undefined) {
      complexity += COMPLEXITY_WEIGHTS[kind];
    }
    
    // Special case for BinaryExpression (check for && and ||)
    if (kind === SyntaxKind.BinaryExpression) {
      const text = descendant.getText();
      if (text.includes('&&') || text.includes('||')) {
        complexity += 0.5;
      } else {
        complexity -= 0.5; // Remove the default add if it wasn't a logical operator
      }
    }
  });

  return Math.round(complexity);
}

function normalizeCode(code: string): string {
  // Remove whitespace/newlines to handle formatting differences
  return code.replace(/\s+/g, ' ').trim();
}

function getFingerprint(code: string): string {
  const normalized = normalizeCode(code);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function mineDirectory(targetPath: string) {
  const rootPath = path.resolve(targetPath);
  console.log(`⛏️  Mining diamonds in: ${rootPath}`);
  
  const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
    cwd: rootPath,
    ignore: IGNORE_PATTERNS,
    absolute: true,
  });

  console.log(`Found ${files.length} files to scan.`);

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  let atomsFound = 0;
  
  // Use the folder name as the repository name
  const repoName = path.basename(rootPath);
  console.log(`📦 Repo Name detected: ${repoName}`);

  for (const filePath of files) {
    try {
      const sourceFile = project.addSourceFileAtPath(filePath);
      const relativePath = path.relative(rootPath, filePath);

      // Extract Classes
      const classes = sourceFile.getClasses();
      for (const cls of classes) {
        const name = cls.getName();
        if (!name) continue;

        const content = cls.getText();
        const complexity = calculateComplexity(cls);

        if (complexity < MIN_COMPLEXITY) continue;

        await upsertAtom(name, 'class', content, 'typescript', complexity, repoName, relativePath);
        atomsFound++;
      }

      // Extract Functions
      const functions = sourceFile.getFunctions();
      for (const fn of functions) {
        const name = fn.getName();
        if (!name) continue;

        const content = fn.getText();
        const complexity = calculateComplexity(fn);

        if (complexity < MIN_COMPLEXITY) continue;

        await upsertAtom(name, 'function', content, 'typescript', complexity, repoName, relativePath);
        atomsFound++;
      }
      
      // Variable Declarations (often arrow functions)
      const variables = sourceFile.getVariableDeclarations();
      for (const v of variables) {
        const name = v.getName();
        const initializer = v.getInitializer();
        
        if (initializer && Node.isArrowFunction(initializer)) {
            const content = `const ${name} = ${initializer.getText()}`;
            const complexity = calculateComplexity(initializer);
             if (complexity < MIN_COMPLEXITY) continue;
             
             await upsertAtom(name, 'function', content, 'typescript', complexity, repoName, relativePath);
             atomsFound++;
        }
      }

      // Cleanup to save memory
      project.removeSourceFile(sourceFile);

    } catch (e) {
      console.warn(`Failed to parse ${filePath}:`, e);
    }
  }

  console.log(`\n💎 Mining Complete!`);
  console.log(`Total Atoms Processed: ${atomsFound}`);
}

async function upsertAtom(
  name: string,
  type: string,
  content: string,
  language: string,
  complexity: number,
  repoName: string,
  filePath: string
) {
  const fingerprint = getFingerprint(content);

  // 1. Find or Create the Asset
  let asset = await prisma.codeAsset.findUnique({
    where: { fingerprint },
  });

  if (asset) {
    // It exists! Increment frequency (it's "Mud" / Boilerplate potentially)
    asset = await prisma.codeAsset.update({
      where: { id: asset.id },
      data: {
        frequency: { increment: 1 },
      },
    });
  } else {
    // It's new! Potential Diamond.
    asset = await prisma.codeAsset.create({
      data: {
        fingerprint,
        name,
        type,
        content,
        language,
        complexity,
        frequency: 1,
      },
    });
  }

  // 2. Record the Occurrence
  try {
    await prisma.codeAssetOccurrence.upsert({
      where: {
        codeAssetId_repoName_filePath: {
          codeAssetId: asset.id,
          repoName,
          filePath,
        },
      },
      update: {}, // No change needed if exact same location
      create: {
        codeAssetId: asset.id,
        repoName,
        filePath,
      },
    });
  } catch (e) {
    // Ignore race conditions on unique constraint
  }

  // 3. Update Stigmergic Value Score
  // Value = (Complexity^2) / (Frequency + 1)
  const valueScore = (Math.pow(asset.complexity, 2)) / (asset.frequency + 1);
  
  await prisma.codeAsset.update({
    where: { id: asset.id },
    data: { valueScore },
  });
}

// CLI Entrypoint
const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Please provide a directory path to mine.');
  console.error('Usage: yarn tsx scripts/mine-diamonds.ts <path-to-repo>');
  process.exit(1);
}

mineDirectory(targetDir)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
