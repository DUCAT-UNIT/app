# Session Prompts

Quick copy/paste prompts for starting and ending development sessions.

---

## 🚀 SESSION START PROMPT

Copy everything below this line:

```
# Ducat App Development Session

## Context
- **Project:** React Native Bitcoin wallet app (Ducat)
- **Current State:** v1 pre-refactor
- **Architecture Docs:**
  - `ARCHITECTURE_STANDARDS.md` - Aspirational target (follow for new code)
  - `REFACTORING_PLAN.md` - Current state + refactoring roadmap

## Instructions
1. Read `ARCHITECTURE_STANDARDS.md` to understand target architecture
2. Read `REFACTORING_PLAN.md` to understand current state and priorities
3. When working on tasks:
   - **New code:** Follow ARCHITECTURE_STANDARDS.md strictly
   - **Refactoring:** Use REFACTORING_PLAN.md for prioritization
   - **Always check the Agent Checklist** after completing work
4. Use TodoWrite tool to track multi-step tasks
5. Never add Claude attribution to commits (per my global .claude/CLAUDE.md)

## Ready
I'm ready to work on: [DESCRIBE YOUR TASK HERE]
```

---

## 🏁 SESSION END PROMPT

Copy everything below this line:

```
# End Session Summary

Please provide a clean handoff summary with:

## 1. What Was Completed
- [ ] List of completed tasks with file paths
- [ ] Tests added/updated
- [ ] Any new patterns or decisions made

## 2. What's In Progress
- [ ] Incomplete tasks (if any)
- [ ] Blockers or issues encountered
- [ ] Next logical steps

## 3. Architecture Compliance Check
Run through the Agent Checklist:
- File sizes within limits?
- Component complexity within bounds?
- Code quality standards met?
- Tests passing?
- Architecture standards followed?

## 4. Update Tracking Docs
- [ ] Update `REFACTORING_PLAN.md` if any sprint tasks completed
- [ ] Mark progress metrics if applicable
- [ ] Document any architecture decisions made

## 5. Next Session Priorities
What should be tackled next based on:
- REFACTORING_PLAN.md priorities
- Any issues discovered during this session
- Dependencies for future work

Please format this as a clean markdown summary I can save for the next session.
```

---

## 🔥 QUICK START (Minimal Version)

If you want a faster start (I already know the project):

```
Read ARCHITECTURE_STANDARDS.md and REFACTORING_PLAN.md, then help me with: [YOUR TASK]
```

---

## 💡 Example Usage

### Starting Sprint 1
```
# Ducat App Development Session

## Context
- **Project:** React Native Bitcoin wallet app (Ducat)
- **Current State:** v1 pre-refactor
- **Architecture Docs:**
  - `ARCHITECTURE_STANDARDS.md` - Aspirational target (follow for new code)
  - `REFACTORING_PLAN.md` - Current state + refactoring roadmap

## Instructions
1. Read `ARCHITECTURE_STANDARDS.md` to understand target architecture
2. Read `REFACTORING_PLAN.md` to understand current state and priorities
3. When working on tasks:
   - **New code:** Follow ARCHITECTURE_STANDARDS.md strictly
   - **Refactoring:** Use REFACTORING_PLAN.md for prioritization
   - **Always check the Agent Checklist** after completing work
4. Use TodoWrite tool to track multi-step tasks
5. Never add Claude attribution to commits (per my global .claude/CLAUDE.md)

## Ready
I'm ready to work on: Sprint 1 - Move screens from components/ to screens/
```

### Starting a Bug Fix
```
Read ARCHITECTURE_STANDARDS.md and REFACTORING_PLAN.md, then help me with: Fix the loading state bug in ReceiveScreen
```

---

## 📋 Mid-Session Commands

**Check progress:**
```
Where are we on the current task? Show me the todo list.
```

**Verify standards:**
```
Run the Agent Checklist on the files we just changed.
```

**Check sprint status:**
```
How much of Sprint 1 is complete? What's left?
```

---

## 📝 Tips

- **Always describe your task clearly** in the "I'm ready to work on:" section
- **Use the END prompt** to get a clean summary before closing the session
- **Save the end summary** to SESSION_LOG.md for your records
- **Start fresh contexts** with the START prompt to ensure I have full context
