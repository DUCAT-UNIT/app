#!/usr/bin/env node

/**
 * Refactor Progress Updater
 * Helper script to update REFACTOR.md progress
 *
 * Usage:
 *   node scripts/update-refactor-progress.js complete 1.1
 *   node scripts/update-refactor-progress.js start 1.2
 *   node scripts/update-refactor-progress.js block 1.3 "Waiting on API changes"
 */

const fs = require('fs');
const path = require('path');

const REFACTOR_FILE = path.join(__dirname, '..', 'REFACTOR.md');

const COMMANDS = {
  start: 'start',
  complete: 'complete',
  block: 'block',
  unblock: 'unblock',
  note: 'note',
  stats: 'stats',
};

const STATUSES = {
  NOT_STARTED: '⚪ Not Started',
  IN_PROGRESS: '🔵 In Progress',
  COMPLETED: '✅ Complete',
  BLOCKED: '⏸️ Blocked',
};

function readRefactorFile() {
  try {
    return fs.readFileSync(REFACTOR_FILE, 'utf8');
  } catch (error) {
    console.error('❌ Error reading REFACTOR.md:', error.message);
    process.exit(1);
  }
}

function writeRefactorFile(content) {
  try {
    fs.writeFileSync(REFACTOR_FILE, content, 'utf8');
    console.log('✅ REFACTOR.md updated successfully');
  } catch (error) {
    console.error('❌ Error writing REFACTOR.md:', error.message);
    process.exit(1);
  }
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function updateTaskStatus(content, taskId, status, note = '') {
  const taskRegex = new RegExp(
    `(### ✅ Task ${taskId.replace('.', '\\.')}:.*?\\n.*?\\*\\*Status\\*\\*:)([^\\n]+)`,
    's'
  );

  const noteRegex = new RegExp(
    `(### ✅ Task ${taskId.replace('.', '\\.')}:.*?\\*\\*Notes\\*\\*.*?\\n- \\*\\*Started\\*\\*:)([^\\n]+)(\\n- \\*\\*Completed\\*\\*:)([^\\n]+)`,
    's'
  );

  let updated = content;

  // Update status
  if (taskRegex.test(content)) {
    let newStatus;
    switch (status) {
      case COMMANDS.start:
        newStatus = STATUSES.IN_PROGRESS;
        break;
      case COMMANDS.complete:
        newStatus = STATUSES.COMPLETED;
        break;
      case COMMANDS.block:
        newStatus = STATUSES.BLOCKED;
        break;
      case COMMANDS.unblock:
        newStatus = STATUSES.IN_PROGRESS;
        break;
      default:
        newStatus = STATUSES.NOT_STARTED;
    }

    updated = updated.replace(taskRegex, `$1 ${newStatus}`);
  }

  // Update dates in notes
  if (noteRegex.test(content)) {
    const currentDate = getCurrentDate();

    if (status === COMMANDS.start) {
      updated = updated.replace(noteRegex, `$1 ${currentDate}$3$4`);
    } else if (status === COMMANDS.complete) {
      updated = updated.replace(noteRegex, `$1$2$3 ${currentDate}`);
    }
  }

  // Update checkbox in overview
  const checkboxRegex = new RegExp(`(- \\[ \\] ${taskId} )`);
  if (status === COMMANDS.complete && checkboxRegex.test(content)) {
    updated = updated.replace(checkboxRegex, `- [x] ${taskId} `);
  }

  // Add note if provided
  if (note && noteRegex.test(content)) {
    const issuesRegex = new RegExp(
      `(### ✅ Task ${taskId.replace('.', '\\.')}:.*?\\*\\*Issues Encountered\\*\\*:)([^\\n]*)`,
      's'
    );
    if (issuesRegex.test(updated)) {
      updated = updated.replace(issuesRegex, `$1 ${note}`);
    }
  }

  return updated;
}

function updateLastUpdated(content) {
  const regex = /\*\*Last Updated\*\*: \d{4}-\d{2}-\d{2}/;
  return content.replace(regex, `**Last Updated**: ${getCurrentDate()}`);
}

function calculateProgress(content) {
  // Phase 1
  const phase1Total = 5;
  const phase1Completed = (content.match(/### ✅ Task 1\.\d:.*?\*\*Status\*\*: ✅ Complete/gs) || []).length;
  const phase1Progress = Math.round((phase1Completed / phase1Total) * 100);

  // Phase 2
  const phase2Total = 6;
  const phase2Completed = (content.match(/### ✅ Task 2\.\d:.*?\*\*Status\*\*: ✅ Complete/gs) || []).length;
  const phase2Progress = Math.round((phase2Completed / phase2Total) * 100);

  // Phase 3
  const phase3Total = 8;
  const phase3Completed = (content.match(/### ✅ Task 3\.\d:.*?\*\*Status\*\*: ✅ Complete/gs) || []).length;
  const phase3Progress = Math.round((phase3Completed / phase3Total) * 100);

  // Phase 4
  const phase4Total = 5;
  const phase4Completed = (content.match(/### ✅ Task 4\.\d:.*?\*\*Status\*\*: ✅ Complete/gs) || []).length;
  const phase4Progress = Math.round((phase4Completed / phase4Total) * 100);

  return {
    phase1: { total: phase1Total, completed: phase1Completed, progress: phase1Progress },
    phase2: { total: phase2Total, completed: phase2Completed, progress: phase2Progress },
    phase3: { total: phase3Total, completed: phase3Completed, progress: phase3Progress },
    phase4: { total: phase4Total, completed: phase4Completed, progress: phase4Progress },
  };
}

function updateProgressOverview(content) {
  const progress = calculateProgress(content);

  // Update Phase 1
  content = content.replace(
    /### Phase 1:.*?\*\*Progress\*\*: \d+\/\d+ tasks/s,
    `### Phase 1: Critical Fixes (Week 1-3)\n**Status**: ${progress.phase1.completed === progress.phase1.total ? '✅ Complete' : progress.phase1.completed > 0 ? '🔵 In Progress' : '🔴 Not Started'} | **Progress**: ${progress.phase1.completed}/${progress.phase1.total} tasks`
  );

  // Update Phase 2
  content = content.replace(
    /### Phase 2:.*?\*\*Progress\*\*: \d+\/\d+ tasks/s,
    `### Phase 2: High Priority (Week 4-7)\n**Status**: ${progress.phase2.completed === progress.phase2.total ? '✅ Complete' : progress.phase2.completed > 0 ? '🔵 In Progress' : '⚪ Not Started'} | **Progress**: ${progress.phase2.completed}/${progress.phase2.total} tasks`
  );

  // Update Phase 3
  content = content.replace(
    /### Phase 3:.*?\*\*Progress\*\*: \d+\/\d+ tasks/s,
    `### Phase 3: Medium Priority (Week 8-12)\n**Status**: ${progress.phase3.completed === progress.phase3.total ? '✅ Complete' : progress.phase3.completed > 0 ? '🔵 In Progress' : '⚪ Not Started'} | **Progress**: ${progress.phase3.completed}/${progress.phase3.total} tasks`
  );

  // Update Phase 4
  content = content.replace(
    /### Phase 4:.*?\*\*Progress\*\*: \d+\/\d+ tasks/s,
    `### Phase 4: Polish & Production (Week 13+)\n**Status**: ${progress.phase4.completed === progress.phase4.total ? '✅ Complete' : progress.phase4.completed > 0 ? '🔵 In Progress' : '⚪ Not Started'} | **Progress**: ${progress.phase4.completed}/${progress.phase4.total} tasks`
  );

  return content;
}

function showStats(content) {
  const progress = calculateProgress(content);

  console.log('\n📊 Refactoring Progress Statistics\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log(`\n🔴 Phase 1: Critical Fixes`);
  console.log(`   Progress: ${progress.phase1.completed}/${progress.phase1.total} tasks (${progress.phase1.progress}%)`);
  console.log(`   Status: ${progress.phase1.completed === progress.phase1.total ? '✅ Complete' : progress.phase1.completed > 0 ? '🔵 In Progress' : '⚪ Not Started'}`);

  console.log(`\n🟡 Phase 2: High Priority`);
  console.log(`   Progress: ${progress.phase2.completed}/${progress.phase2.total} tasks (${progress.phase2.progress}%)`);
  console.log(`   Status: ${progress.phase2.completed === progress.phase2.total ? '✅ Complete' : progress.phase2.completed > 0 ? '🔵 In Progress' : '⚪ Not Started'}`);

  console.log(`\n🟡 Phase 3: Medium Priority`);
  console.log(`   Progress: ${progress.phase3.completed}/${progress.phase3.total} tasks (${progress.phase3.progress}%)`);
  console.log(`   Status: ${progress.phase3.completed === progress.phase3.total ? '✅ Complete' : progress.phase3.completed > 0 ? '🔵 In Progress' : '⚪ Not Started'}`);

  console.log(`\n🟢 Phase 4: Polish & Production`);
  console.log(`   Progress: ${progress.phase4.completed}/${progress.phase4.total} tasks (${progress.phase4.progress}%)`);
  console.log(`   Status: ${progress.phase4.completed === progress.phase4.total ? '✅ Complete' : progress.phase4.completed > 0 ? '🔵 In Progress' : '⚪ Not Started'}`);

  const totalTasks = progress.phase1.total + progress.phase2.total + progress.phase3.total + progress.phase4.total;
  const totalCompleted = progress.phase1.completed + progress.phase2.completed + progress.phase3.completed + progress.phase4.completed;
  const totalProgress = Math.round((totalCompleted / totalTasks) * 100);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📈 OVERALL PROGRESS: ${totalCompleted}/${totalTasks} tasks (${totalProgress}%)`);
  console.log(`   Remaining: ${totalTasks - totalCompleted} tasks\n`);
}

function main() {
  const [,, command, taskId, ...noteArgs] = process.argv;

  if (!command) {
    console.log(`
Usage: node scripts/update-refactor-progress.js <command> <taskId> [note]

Commands:
  start <taskId>              Mark task as started
  complete <taskId>           Mark task as completed
  block <taskId> [note]       Mark task as blocked
  unblock <taskId>            Mark task as unblocked
  note <taskId> <note>        Add note to task
  stats                       Show progress statistics

Examples:
  node scripts/update-refactor-progress.js start 1.1
  node scripts/update-refactor-progress.js complete 1.2
  node scripts/update-refactor-progress.js block 1.3 "Waiting on API"
  node scripts/update-refactor-progress.js stats
    `);
    process.exit(0);
  }

  if (command === COMMANDS.stats) {
    const content = readRefactorFile();
    showStats(content);
    return;
  }

  if (!taskId) {
    console.error('❌ Error: taskId required');
    process.exit(1);
  }

  const note = noteArgs.join(' ');
  let content = readRefactorFile();

  // Update task
  content = updateTaskStatus(content, taskId, command, note);

  // Update progress overview
  content = updateProgressOverview(content);

  // Update last updated date
  content = updateLastUpdated(content);

  writeRefactorFile(content);

  // Show current stats
  console.log('');
  showStats(content);

  // Git commit suggestion
  console.log(`\n💡 Suggested git commit:`);
  if (command === COMMANDS.complete) {
    console.log(`   git commit -m "refactor: complete task ${taskId}"`);
  } else if (command === COMMANDS.start) {
    console.log(`   git commit -m "refactor: start task ${taskId}"`);
  } else if (command === COMMANDS.block) {
    console.log(`   git commit -m "refactor: block task ${taskId} - ${note}"`);
  }
  console.log('');
}

main();
