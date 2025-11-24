# Refactoring Quickstart Guide

This guide will help you get started with the refactoring process.

## 📚 Documents Overview

1. **REFACTOR.md** - Complete refactoring plan with all tasks
2. **REFACTOR_QUICKSTART.md** (this file) - Quick start guide
3. **scripts/update-refactor-progress.js** - Progress tracking script

## 🚀 Getting Started

### 1. Review the Plan

```bash
# Open the main refactoring document
open REFACTOR.md
```

Key sections to read:
- Progress Overview (top of file)
- Phase 1: Critical Fixes (start here)
- Metrics Tracking (see current state)

### 2. Check Current Progress

```bash
npm run refactor:stats
```

This shows:
- Progress for each phase
- Number of completed tasks
- Overall completion percentage

### 3. Start Working on a Task

When you start working on a task (e.g., Task 1.1):

```bash
# Mark task as started
npm run refactor:start 1.1

# This will:
# - Update task status to "In Progress"
# - Set the start date
# - Update the progress overview
# - Show current statistics
```

### 4. Complete a Task

When you finish a task:

```bash
# Mark task as completed
npm run refactor:complete 1.1

# This will:
# - Update task status to "Complete"
# - Set the completion date
# - Check the checkbox in overview
# - Update progress percentages
```

### 5. Commit Your Progress

```bash
# Commit the progress update
git add REFACTOR.md
git commit -m "refactor: complete task 1.1 - fix failing tests"
git push
```

## 📋 Workflow Example

Here's a complete workflow for Task 1.1 (Fix Failing Tests):

```bash
# 1. Start the task
npm run refactor:start 1.1

# 2. Do the work
npm test                    # Run tests
# ... fix the failing tests ...
npm test                    # Verify all tests pass

# 3. Mark as complete
npm run refactor:complete 1.1

# 4. Commit the work
git add .
git commit -m "fix: resolve API response shape mismatches in runesUtxoSelection tests"

# 5. Commit the progress update
git add REFACTOR.md
git commit -m "refactor: complete task 1.1 - fix failing tests"

# 6. Push
git push

# 7. Check progress
npm run refactor:stats
```

## 🎯 Phase 1 Priority Order

Work on Phase 1 tasks in this order for best results:

1. **Task 1.1**: Fix All Failing Tests (2-3 days)
   - Highest priority - blocks everything else
   - Start here immediately

2. **Task 1.2**: Remove Console.log Statements (2-3 days)
   - Security critical
   - Easy to parallelize with other work

3. **Task 1.3**: Split cashuWalletService.js (4-5 days)
   - Most complex task in Phase 1
   - Security audit blocker
   - Requires focused time

4. **Task 1.4**: Add Error Boundaries (2 days)
   - App stability
   - Independent of other tasks

5. **Task 1.5**: Split WalletPage.js (3-4 days)
   - Improves maintainability
   - Can be done while testing other changes

**Total Phase 1 Time**: 2-3 weeks

## 🛠️ Useful Commands

### Progress Tracking
```bash
npm run refactor:stats              # Show statistics
npm run refactor:start <taskId>     # Start a task
npm run refactor:complete <taskId>  # Complete a task
npm run refactor:block <taskId>     # Mark as blocked
npm run refactor:unblock <taskId>   # Unblock a task
```

### Development
```bash
npm test                            # Run all tests
npm run test:watch                  # Run tests in watch mode
npm run test:coverage               # Run tests with coverage
npm run lint                        # Run linter
npm run lint:fix                    # Fix linting issues
npm start                           # Start development server
```

### Checking Progress
```bash
# Check test status
npm test

# Check for console.log statements
grep -r "console\.(log|debug|info)" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=coverage

# Check file sizes
find . -name "*.js" -o -name "*.jsx" | \
  xargs wc -l | \
  awk '$1 > 300 { print }' | \
  sort -rn

# Check ESLint warnings
npm run lint
```

## 📊 Success Criteria by Phase

### Phase 1 (Weeks 1-3) - Ready for Private Testnet
- ✅ 100% test pass rate
- ✅ Zero console.log in production code
- ✅ cashuWalletService.js split into modules
- ✅ Error boundaries implemented
- ✅ WalletPage.js refactored

### Phase 2 (Weeks 4-7) - Ready for Public Testnet
- ✅ RootNavigator.js refactored
- ✅ OnboardingPage.js split
- ✅ Large contexts modularized
- ✅ Styles co-located with components
- ✅ utils/wallet.js split

### Phase 3 (Weeks 8-12) - Production Quality
- ✅ TypeScript 100% coverage
- ✅ All files under 300 lines
- ✅ Zero ESLint warnings
- ✅ Dead code removed
- ✅ Performance optimized

### Phase 4 (Weeks 13+) - Production Ready
- ✅ Security audit complete
- ✅ Performance benchmarks met
- ✅ Documentation updated
- ✅ CI/CD pipeline running
- ✅ Deployment checklist complete

## 🚨 Important Notes

### Before Starting Any Task:
1. Read the full task description in REFACTOR.md
2. Review the testing checklist
3. Understand the success criteria
4. Check the break risk assessment

### During the Task:
1. Follow the implementation steps in order
2. Run tests frequently
3. Commit often (small commits)
4. Update progress regularly

### After Completing a Task:
1. Run the full test suite
2. Run the linter
3. Do manual testing
4. Update REFACTOR.md
5. Commit and push

### If You Get Blocked:
```bash
# Mark task as blocked with reason
npm run refactor:block 1.3 "Waiting for API team to fix response format"

# Update REFACTOR.md with details
# Notify the team
# Move to another task if possible
```

## 📞 Getting Help

If you encounter issues:

1. **Check REFACTOR.md** - Detailed instructions for each task
2. **Check scripts/README.md** - Script documentation
3. **Run stats** - `npm run refactor:stats` to see what's blocking
4. **Review the task notes** - Look at "Issues Encountered" section
5. **Ask the team** - Don't get stuck, reach out!

## 🎯 Quick Wins

If you want to make quick progress, start with these easier tasks:

1. **Task 1.2** (2-3 days) - Remove console.log
   - Low risk, high impact
   - Can be done in parallel with other work
   - Just find-and-replace with logger utility

2. **Task 1.4** (2 days) - Add Error Boundaries
   - Low risk, additive only
   - Significantly improves app stability
   - Independent of other tasks

3. **Task 2.5** (3-4 days) - Break Up Style Files
   - Low risk, safe refactor
   - Makes component development easier
   - Good for newer team members

## 📈 Tracking Progress

The script automatically tracks:
- ✅ Task status (Not Started, In Progress, Complete, Blocked)
- ✅ Start and completion dates
- ✅ Progress percentages by phase
- ✅ Overall completion percentage
- ✅ Checkbox status in overview

You can always see the current state by running:
```bash
npm run refactor:stats
```

## 🎉 Celebrating Milestones

When you complete a phase:
1. Run `npm run refactor:stats` to see your progress
2. Review what you've accomplished
3. Share with the team
4. Take a break before starting the next phase!

---

**Remember**: Quality over speed. It's better to do each task thoroughly than to rush and create technical debt.

Good luck! 🚀
