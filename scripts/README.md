# Scripts

Helper scripts for the DUCAT wallet project.

## Refactor Progress Tracker

Track and update refactoring progress in `REFACTOR.md`.

### Usage

```bash
# Show progress statistics
node scripts/update-refactor-progress.js stats

# Mark task as started
node scripts/update-refactor-progress.js start 1.1

# Mark task as completed
node scripts/update-refactor-progress.js complete 1.1

# Mark task as blocked
node scripts/update-refactor-progress.js block 1.3 "Waiting on API changes"

# Mark task as unblocked
node scripts/update-refactor-progress.js unblock 1.3

# Add a note to a task
node scripts/update-refactor-progress.js note 1.1 "Fixed issue with test mocks"
```

### Using npm scripts

Shortcuts are available in `package.json`:

```bash
# Show stats
npm run refactor:stats

# Start a task
npm run refactor:start 1.1

# Complete a task
npm run refactor:complete 1.1

# Block a task
npm run refactor:block 1.3 "Reason for blocking"
```

### Features

- ✅ Automatically updates task status
- ✅ Updates dates (started/completed)
- ✅ Updates checkboxes in overview section
- ✅ Calculates progress percentages
- ✅ Shows statistics
- ✅ Suggests git commit messages

### Example Workflow

```bash
# Start working on task 1.1
npm run refactor:start 1.1

# (do the work...)

# Mark as complete
npm run refactor:complete 1.1

# Commit the progress update
git add REFACTOR.md
git commit -m "refactor: complete task 1.1 - fix failing tests"

# Check overall progress
npm run refactor:stats
```

### Output Example

```
📊 Refactoring Progress Statistics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 Phase 1: Critical Fixes
   Progress: 2/5 tasks (40%)
   Status: 🔵 In Progress

🟡 Phase 2: High Priority
   Progress: 0/6 tasks (0%)
   Status: ⚪ Not Started

🟡 Phase 3: Medium Priority
   Progress: 0/8 tasks (0%)
   Status: ⚪ Not Started

🟢 Phase 4: Polish & Production
   Progress: 0/5 tasks (0%)
   Status: ⚪ Not Started

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 OVERALL PROGRESS: 2/24 tasks (8%)
   Remaining: 22 tasks
```
