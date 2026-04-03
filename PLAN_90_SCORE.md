# Plan: 73 → 90+ Score

**Goal:** Improve codebase score from 73/100 to 90+/100
**Estimated effort:** 3-4 days
**Current blockers:** Duplicate code, large files, weak test typing

---

## Phase 1: Remove Duplicate PSBT Signing (Day 1)

### Problem
Two PSBT signing implementations exist:
- `utils/wallet/psbtSigning.ts` (600 lines) - DEPRECATED
- `services/signing/psbtService.ts` (549 lines) - NEW

### Tasks

**1.1 Audit all imports of deprecated module**
```bash
grep -r "from.*utils/wallet/psbtSigning" --include="*.ts" --include="*.tsx" | grep -v node_modules
```

**1.2 Migrate each consumer to new service**
- Update imports from `utils/wallet/psbtSigning` → `services/signing`
- Functions have same signatures, should be drop-in

**1.3 Delete deprecated file**
- Remove `utils/wallet/psbtSigning.ts`
- Remove `utils/wallet/__tests__/psbtSigning.test.ts`
- Update `utils/wallet/index.ts` barrel export

**1.4 Verify**
```bash
npm test -- --testPathPatterns="psbt|signing|transaction" --no-coverage
```

**Impact:** -600 lines, removes duplication, cleaner architecture

---

## Phase 2: Split Large Files (Day 1-2)

### Target Files (>400 lines, excluding styles/storybook)

| File | Lines | Split Into |
|------|-------|------------|
| `services/signing/psbtService.ts` | 549 | `segwitSigning.ts`, `taprootSigning.ts`, `vaultSigning.ts` |
| `components/assetDetail/VaultHealthGauge.tsx` | 573 | `VaultHealthGauge.tsx`, `GaugeAnimations.ts`, `GaugeCalculations.ts` |
| `screens/send/ConfirmationScreen.tsx` | 525 | `ConfirmationScreen.tsx`, `useConfirmationData.ts`, `ConfirmationSummary.tsx` |
| `components/vaultDetail/VaultActivityList.tsx` | 512 | `VaultActivityList.tsx`, `VaultActivityItem.tsx`, `useVaultActivity.ts` |
| `services/feeEstimationService.ts` | 484 | `feeEstimationService.ts`, `feeCalculations.ts` |
| `components/vaultAction/AmountSlider.tsx` | 478 | `AmountSlider.tsx`, `SliderTrack.tsx`, `useSliderLogic.ts` |
| `services/pinService.ts` | 468 | `pinService.ts`, `pinValidation.ts`, `pinStorage.ts` |

### Pattern for each split

1. Extract pure logic → `use*.ts` hook or `*Utils.ts`
2. Extract sub-components → `*Component.tsx`
3. Keep orchestrator thin (<250 lines)

**Impact:** All files under 300 lines, +15 maintainability points

---

## Phase 3: Fix @ts-nocheck Tests (Day 2-3)

### Problem
146 test files have `@ts-nocheck` - hiding type errors

### Approach

**3.1 Categorize the 146 files**
```bash
grep -l "@ts-nocheck" **/__tests__/*.ts **/__tests__/*.tsx | head -20
```

**3.2 Fix pattern by pattern**

| Pattern | Fix | Est. Files |
|---------|-----|------------|
| Missing mock types | Add to `testUtils/mockTypes.ts` | ~40 |
| Store selector mocks | Use `jest.fn((sel) => sel ? sel(state) : state)` | ~30 |
| SDK type mismatches | Create typed wrappers | ~20 |
| React hook returns | Add proper `ReturnType<typeof useX>` | ~30 |
| Misc | Case-by-case | ~26 |

**3.3 Create shared test utilities**
```
services/__tests__/testUtils/
├── mockTypes.ts        # Already exists
├── fetchMock.ts        # Already exists
├── storeMocks.ts       # NEW - typed store mocks
├── contextMocks.ts     # NEW - typed context mocks
├── sdkMocks.ts         # NEW - typed SDK mocks
└── index.ts
```

**3.4 Fix files in batches of 10-15**
- Remove `@ts-nocheck`
- Fix type errors using shared utilities
- Run tests after each batch

**Impact:** 146 → 0 `@ts-nocheck`, +10 code quality points

---

## Phase 4: Remove Remaining `as any` (Day 3)

### Current: 66 `as any` in tests

**4.1 Audit remaining casts**
```bash
grep -rn "as any" --include="*.test.ts" --include="*.test.tsx" | grep -v node_modules
```

**4.2 Fix by category**

| Category | Fix |
|----------|-----|
| SDK function calls | Create typed mock wrappers |
| Store state | Use `Partial<StoreState>` with defaults |
| Event handlers | Use `React.SyntheticEvent` types |
| Unknown error types | Use `unknown` + type guard |

**Target:** 66 → <20 (SDK interop exceptions only)

**Impact:** +5 code quality points

---

## Phase 5: Final Cleanup (Day 4)

**5.1 Remove unused exports**
```bash
npx ts-prune | head -50
```

**5.2 Run full test suite**
```bash
npm test -- --coverage
```

**5.3 Verify metrics**
- Branch coverage ≥ 90%
- All files < 300 lines (excluding styles)
- `@ts-nocheck` = 0
- `as any` < 20

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Score | 73/100 | 90+/100 |
| Branch coverage | 88.1% | 90%+ |
| `@ts-nocheck` in tests | 146 | 0 |
| `as any` in tests | 66 | <20 |
| Max file size | 600 | <300 |
| Duplicate signing code | 2 files | 1 file |

---

## Rollback Plan

Each phase is independent. If any phase breaks things:
1. Revert that phase's commits
2. Continue with next phase
3. Revisit failed phase later

---

## Verification Commands

```bash
# After each phase
npm test -- --no-coverage

# Final verification
npm test -- --coverage
grep -r "@ts-nocheck" --include="*.test.ts" --include="*.test.tsx" | wc -l
grep -r "as any" --include="*.test.ts" --include="*.test.tsx" | wc -l
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v storybook | grep -v __tests__ | xargs wc -l | sort -rn | head -10
```
