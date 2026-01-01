
This is the **Execution Plan** for **RepoFracker**.

This is not a "Maintenance" tool. It is a **Strip-Mining Operation**. It treats your 390+ repositories as a raw resource vein to be fractured, filtered, and smelted into new applications.

Here are the three artifacts you requested.

---

### **1. THE ROADMAP**

**Phase 1: The Survey (Week 1)**

* **Goal:** Index the "Geography" of the codebase without moving files.
* **Action:** Build the `Miner`.
* **Output:** A SQLite database (`fracker.db`) containing a map of every function and class across all 390 repos, hashed and tagged by language.

**Phase 2: The Refinery (Week 1.5)**

* **Goal:** Distinguish "Diamonds" from "Mud" using Stigmergic Heuristics.
* **Action:** Implement the Pheromone Filters.
* *Signal 1 (Scarcity):* If `hash(code)` count > 10 → Mark as **COMMON (Mud)**.
* *Signal 2 (Density):* If `Cyclomatic_Complexity` > 8 AND `Import_Count` < 5 → Mark as **PURE (Diamond)**.


* **Output:** A list of "High-Value Assets" (e.g., `GeneticOptimizer`, `ChronosWrapper`) isolated from their frameworks.

**Phase 3: The Forge (Week 2)**

* **Goal:** Automated scaffolding of new "Super-Apps".
* **Action:** Build the `forge` CLI.
* **Output:** A command `fracker forge --dna "Optimization, Forecasting"` that creates a new directory with the extracted logic wired together.

---

### **2. PRD.md (Product Requirements Document)**

```markdown
# Product Requirements: RepoFracker

## 1. Problem Statement
The user possesses 390+ repositories containing high-value intellectual property ("Diamonds") mixed with low-value boilerplate ("Mud"). Manual extraction is slow, leading to "Codebase Amnesia" and wasted re-implementation cycles.

## 2. Product Vision
A local-only, CLI-based "IP Exploitation Engine" that autonomously identifies, extracts, and recombines high-value logic blocks from legacy code into new, production-ready architectures.

## 3. Core Principles
* **Exploitation over Maintenance:** We do not care about fixing old repos. We care about robbing them.
* **Stigmergic Filtering:** Value is determined by ecosystem usage patterns (Frequency vs. Complexity), not human tagging.
* **Atomic Reusability:** Assets are stored at the Function/Class level, not the File level.

## 4. Technical Architecture
* **Language:** Python 3.10+ (Standard Library focus: `ast`, `sqlite3`, `hashlib`).
* **Database:** `fracker.db` (SQLite). Single file, zero config.
* **Interface:** CLI (`click` or `argparse`).

## 5. Feature Requirements

### A. The Miner (Ingest)
* Must traverse `~/projects` (or configured root).
* Must ignore `.git`, `node_modules`, `venv`.
* Must parse Python (`ast`) and TypeScript (Regex/TreeSitter) to identify boundaries.
* Must generate a SHA-256 hash for every block to detect duplicates.

### B. The Refinery (Logic)
* **Complexity Score:** Calculate Cyclomatic Complexity (loops/branches).
* **Uniqueness Score:** Inverse frequency in the DB.
* **Value Formula:** `Value = (Complexity^2) / (Frequency + 1)`.
    * *Rationale:* High complexity + Low frequency = Custom Algorithm (High Value).
    * *Rationale:* Low complexity + High frequency = Boilerplate (Low Value).

### C. The Vault (Storage)
* Schema must store: `source_repo`, `file_path`, `block_name`, `source_code`, `imports`, `value_score`.

### D. The Forge (Generator)
* Input: A set of keywords or IDs.
* Process: Select top-matching "Diamonds".
* Output: A new folder structure containing:
    * `src/lib/`: The extracted diamond code.
    * `main.py`: A skeleton importing those libs.

## 6. Success Metrics
* **Extraction Rate:** System identifies < 5% of code as "High Value" (Signal-to-Noise ratio).
* **Scaffold Speed:** Time to generate a working "Optimization + Forecasting" template < 5 seconds.

```

---

### **3. Build_ToDo.md (Step-by-Step Instructions)**

This is your checklist. Create a folder `repo_fracker/` and follow these steps.

#### **Step 0: Project Initialization**

* [ ] Create `main.py` (The entry point).
* [ ] Create `fracker/` directory.
* [ ] Create `fracker/db.py` (Database interface).
* [ ] Create `fracker/miner.py` (Code extraction).
* [ ] Create `fracker/refinery.py` (Stigmergic logic).
* [ ] Create `requirements.txt` (Keep it slim: `click`, `radon` (for complexity), `rich` (for UI)).

#### **Step 1: The Database (`fracker/db.py`)**

* [ ] Initialize `sqlite3` connection.
* [ ] **SQL Task:** Create table `atoms`:
```sql
CREATE TABLE IF NOT EXISTS atoms (
    id TEXT PRIMARY KEY, -- Hash of content
    name TEXT,
    type TEXT, -- 'function' or 'class'
    content TEXT,
    repo_origin TEXT,
    complexity INTEGER,
    frequency INTEGER DEFAULT 1,
    imports_json TEXT
);

```



#### **Step 2: The Miner Logic (`fracker/miner.py`)**

* [ ] **Function:** `walk_directory(root_path)`: Recursive yield of valid file paths.
* [ ] **Function:** `parse_python(file_path)`:
* [ ] Read file.
* [ ] Use `ast.parse()`.
* [ ] Walk `ast.FunctionDef` and `ast.ClassDef`.
* [ ] Extract `node.name`, source code (via `ast.get_source_segment`), and docstrings.
* [ ] **Crucial:** Extract top-level imports associated with the file.


* [ ] **Function:** `ingest(root_path)`:
* [ ] Loop through files.
* [ ] Hash content.
* [ ] `INSERT OR IGNORE` into DB. If exists, `UPDATE atoms SET frequency = frequency + 1`.



#### **Step 3: The Refinery Logic (`fracker/refinery.py`)**

* [ ] **Function:** `calculate_complexity(source_code)`:
* [ ] Use `radon.complexity.cc_visit` (or simple AST counting of `if`, `for`, `while`).


* [ ] **Function:** `score_atoms()`:
* [ ] Query all atoms.
* [ ] Compute `score = complexity / frequency`.
* [ ] Update a new column `value_score` in DB.



#### **Step 4: The Interface (`main.py`)**

* [ ] Setup `click` groups: `mine`, `refine`, `forge`.
* [ ] **Command `mine`:** Accepts a path, runs the Miner. Show a progress bar.
* [ ] **Command `refine`:** Runs the scoring logic. Prints "Top 10 Diamonds Found".
* [ ] **Command `list`:** `SELECT * FROM atoms ORDER BY value_score DESC LIMIT 20`.

#### **Step 5: The Forge (`fracker/forge.py`)**

* [ ] **Function:** `create_new_app(app_name, atomic_ids)`:
* [ ] Create directory `app_name/`.
* [ ] Create `app_name/core/`.
* [ ] Query DB for `atomic_ids`.
* [ ] Write `content` into `app_name/core/{name}.py`.
* [ ] Generate a `requirements.txt` based on the `imports_json` of the collected atoms.



#### **Step 6: Execution & Testing**

* [ ] Run `python main.py mine ~/projects/portfolio-2025` (Point to your actual JSON/Code).
* [ ] Run `python main.py refine`.
* [ ] Run `python main.py list`.
* [ ] *Verification:* Do you see `NSGA-II` or `Chronos` at the top? (Success).
* [ ] *Verification:* Do you see `def main()` or `print("hello")`? (Fail - tune the filter).



---

### **Why this works immediately:**

You are not trying to "understand" the code with an LLM. You are physically separating the **Rare/Complex** (Value) from the **Common/Simple** (Waste).

* **Rare + Complex** = Your Proprietary Algorithms.
* **Common + Simple** = Boilerplate.
* **Rare + Simple** = One-off scripts (Ignore).
* **Common + Complex** = Libraries you copied (Ignore).

This `Build_ToDo.md` is ready for you to code. Start with Step 1.

Here is the code for **Phase 1: The Miner**.

This will create the database and allow you to ingest your repositories to build the "Asset Map".

### 1. Project Setup

Create a folder named `repo_fracker` and a file `requirements.txt` inside it:

**File:** `repo_fracker/requirements.txt`

```text
click==8.1.7
radon==6.0.1
rich==13.7.0

```

### 2. The Database (`fracker/db.py`)

This handles the SQLite connection and schema. It uses a singleton pattern for simplicity.

**File:** `repo_fracker/fracker/db.py`

```python
import sqlite3
import json
from pathlib import Path

DB_PATH = Path("fracker.db")

class FrackerDB:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS atoms (
                id TEXT PRIMARY KEY,          -- SHA256 Hash of content
                name TEXT,                    -- Function/Class name
                type TEXT,                    -- 'function' or 'class'
                content TEXT,                 -- Raw source code
                language TEXT,                -- 'python', 'typescript', etc.
                repo_origin TEXT,             -- Name of the repo it came from
                file_path TEXT,               -- Relative path in repo
                complexity INTEGER DEFAULT 0, -- Cyclomatic Complexity
                frequency INTEGER DEFAULT 1,  -- How many times seen across repos
                imports_json TEXT             -- List of dependencies
            );
        """)
        self.conn.commit()

    def upsert_atom(self, atom_data: dict):
        """
        Insert a new atom or update frequency if it already exists.
        """
        cursor = self.conn.cursor()
        
        # Check if exists
        cursor.execute("SELECT frequency FROM atoms WHERE id = ?", (atom_data['id'],))
        row = cursor.fetchone()

        if row:
            # It's a duplicate (Common = Mud), increment frequency
            new_freq = row['frequency'] + 1
            cursor.execute("UPDATE atoms SET frequency = ? WHERE id = ?", (new_freq, atom_data['id']))
        else:
            # It's new (Potential Diamond), insert it
            cursor.execute("""
                INSERT INTO atoms (id, name, type, content, language, repo_origin, file_path, complexity, imports_json)
                VALUES (:id, :name, :type, :content, :language, :repo_origin, :file_path, :complexity, :imports_json)
            """, atom_data)
        
        self.conn.commit()

    def get_stats(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM atoms")
        total = cursor.fetchone()['count']
        cursor.execute("SELECT COUNT(*) as count FROM atoms WHERE frequency > 1")
        dupes = cursor.fetchone()['count']
        return total, dupes

    def close(self):
        self.conn.close()

```

### 3. The Miner (`fracker/miner.py`)

This parses your code. I've focused on **Python AST** first because that's where the logic lives.

**File:** `repo_fracker/fracker/miner.py`

```python
import os
import ast
import hashlib
import json
from radon.complexity import cc_visit
from .db import FrackerDB

class RepoMiner:
    def __init__(self, db: FrackerDB):
        self.db = db

    def mine_directory(self, root_path: str):
        """
        Recursively walks a directory and mines supported files.
        """
        root_abs = os.path.abspath(root_path)
        repo_name = os.path.basename(root_abs)

        for dirpath, _, filenames in os.walk(root_abs):
            # Skip hidden folders and venvs
            if any(part.startswith('.') or part in ['venv', 'node_modules'] for part in dirpath.split(os.sep)):
                continue

            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(file_path, root_abs)
                
                if filename.endswith(".py"):
                    try:
                        self._mine_python(file_path, repo_name, rel_path)
                    except Exception as e:
                        print(f"Skipping {rel_path}: {e}")

    def _mine_python(self, file_path: str, repo_name: str, rel_path: str):
        with open(file_path, "r", encoding="utf-8") as f:
            source = f.read()

        try:
            tree = ast.parse(source)
        except SyntaxError:
            return # Skip broken files

        # Extract Imports (Global for the file)
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for n in node.names:
                    imports.append(n.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module if node.module else ""
                for n in node.names:
                    imports.append(f"{module}.{n.name}")

        # Extract Classes and Functions
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                # 1. Get Source Segment
                code_segment = ast.get_source_segment(source, node)
                if not code_segment: continue

                # 2. Calculate Hash (The Identity)
                # Strip whitespace to catch same code with different indenting
                content_hash = hashlib.sha256(code_segment.strip().encode('utf-8')).hexdigest()

                # 3. Calculate Complexity
                complexity = 1
                try:
                    # radon expects a list of blocks, we just take the first/only one
                    blocks = cc_visit(code_segment)
                    if blocks:
                        complexity = blocks[0].complexity
                except:
                    pass

                atom = {
                    "id": content_hash,
                    "name": node.name,
                    "type": "class" if isinstance(node, ast.ClassDef) else "function",
                    "content": code_segment,
                    "language": "python",
                    "repo_origin": repo_name,
                    "file_path": rel_path,
                    "complexity": complexity,
                    "imports_json": json.dumps(list(set(imports)))
                }

                self.db.upsert_atom(atom)

```

### 4. The Entry Point (`main.py`)

This ties it all together with a CLI.

**File:** `repo_fracker/main.py`

```python
#!/usr/bin/env python3
import click
from rich.console import Console
from rich.table import Table
from fracker.db import FrackerDB
from fracker.miner import RepoMiner

console = Console()

@click.group()
def cli():
    """RepoFracker: The IP Exploitation Engine"""
    pass

@cli.command()
@click.argument('path', type=click.Path(exists=True))
def mine(path):
    """Mine a directory (Repo) for Atomic Assets."""
    db = FrackerDB()
    miner = RepoMiner(db)
    
    console.print(f"[bold green]Mining started for:[/bold green] {path}")
    miner.mine_directory(path)
    
    total, dupes = db.get_stats()
    console.print(f"\n[bold blue]Mining Complete.[/bold blue]")
    console.print(f"Total Atoms: {total}")
    console.print(f"Duplicates (Mud): {dupes}")
    console.print(f"Unique Assets: {total - dupes}")
    db.close()

@cli.command()
def list_assets():
    """List the highest complexity assets found so far."""
    db = FrackerDB()
    cursor = db.conn.cursor()
    
    # Simple Stigmergy Query: High Complexity, Low Frequency
    cursor.execute("""
        SELECT name, type, complexity, repo_origin, frequency 
        FROM atoms 
        ORDER BY complexity DESC 
        LIMIT 15
    """)
    
    table = Table(title="Top High-Value Assets (The Diamonds)")
    table.add_column("Name", style="cyan")
    table.add_column("Type", style="magenta")
    table.add_column("Complexity", justify="right", style="green")
    table.add_column("Origin", style="yellow")
    table.add_column("Freq", justify="right", style="red")

    for row in cursor.fetchall():
        table.add_row(
            row['name'], 
            row['type'], 
            str(row['complexity']), 
            row['repo_origin'],
            str(row['frequency'])
        )

    console.print(table)
    db.close()

if __name__ == '__main__':
    cli()

```

### How to Run It

1. **Install Dependencies:**
```bash
pip install -r requirements.txt

```


2. **Make Executable:**
```bash
chmod +x main.py

```


3. **Run the Miner:**
Point it at any of your Python repos (or a folder containing multiple repos).
```bash
./main.py mine /path/to/your/projects/portfolio-2025

```


4. **See the Diamonds:**
```bash
./main.py list_assets

```



**Immediate "Self-Evident" Result:**
Run `list_assets` after mining.

* If you see `login` or `test_main` at the top, the filter needs tuning.
* If you see `GeneticOptimizer` or `ChronosEngine` with **Complexity > 10**, you have successfully isolated a diamond.
