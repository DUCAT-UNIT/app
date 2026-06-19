/**
 * @fileoverview runestone-ts/src/lib/decode.ts
 */

import { Runestone } from '../runestone.js';
import { SpacedRune } from '../spacedrune.js';
import type { RunestoneTx } from '../runestone.js';
import type { Cenotaph, RunestoneSpec } from '../types/index.js';
import { getFlawString } from './shared.js';

/** Decode runestone artifact from transaction, returning null on hard decode failure. */
export function tryDecodeRunestone(tx: RunestoneTx): RunestoneSpec | Cenotaph | null {
  let optionArtifact: ReturnType<typeof Runestone.decipher>;
  try {
    optionArtifact = Runestone.decipher(tx);
  } catch {
    return null;
  }
  if (optionArtifact.isNone()) {
    return null;
  }

  const artifact = optionArtifact.unwrap();
  if (artifact.type === 'runestone') {
    const runestone = artifact;

    const etching = () => runestone.etching.unwrap();
    const terms = () => etching().terms.unwrap();

    return {
      ...(runestone.etching.isSome()
        ? {
            etching: {
              ...(etching().divisibility.isSome()
                ? { divisibility: etching().divisibility.map(Number).unwrap() }
                : {}),
              ...(etching().premine.isSome() ? { premine: etching().premine.unwrap() } : {}),
              ...(etching().rune.isSome()
                ? {
                    runeName: new SpacedRune(
                      etching().rune.unwrap(),
                      etching().spacers.map(Number).unwrapOr(0)
                    ).toString(),
                  }
                : {}),
              ...(etching().symbol.isSome() ? { symbol: etching().symbol.unwrap() } : {}),
              ...(etching().terms.isSome()
                ? {
                    terms: {
                      ...(terms().amount.isSome() ? { amount: terms().amount.unwrap() } : {}),
                      ...(terms().cap.isSome() ? { cap: terms().cap.unwrap() } : {}),
                      ...(terms().height.find((option) => option.isSome())
                        ? {
                            height: {
                              ...(terms().height[0].isSome()
                                ? { start: terms().height[0].unwrap() }
                                : {}),
                              ...(terms().height[1].isSome() ? { end: terms().height[1].unwrap() } : {}),
                            },
                          }
                        : {}),
                      ...(terms().offset.find((option) => option.isSome())
                        ? {
                            offset: {
                              ...(terms().offset[0].isSome()
                                ? { start: terms().offset[0].unwrap() }
                                : {}),
                              ...(terms().offset[1].isSome() ? { end: terms().offset[1].unwrap() } : {}),
                            },
                          }
                        : {}),
                    },
                  }
                : {}),
              turbo: etching().turbo,
            },
          }
        : {}),
      ...(runestone.mint.isSome()
        ? {
            mint: {
              block: runestone.mint.unwrap().block,
              tx: Number(runestone.mint.unwrap().tx),
            },
          }
        : {}),
      ...(runestone.pointer.isSome() ? { pointer: Number(runestone.pointer.unwrap()) } : {}),
      ...(runestone.edicts.length
        ? {
            edicts: runestone.edicts.map((edict) => ({
              id: {
                block: edict.id.block,
                tx: Number(edict.id.tx),
              },
              amount: edict.amount,
              output: Number(edict.output),
            })),
          }
        : {}),
    };
  }

  const cenotaph = artifact;
  return {
    flaws: cenotaph.flaws.map(getFlawString),
    ...(cenotaph.etching.isSome() ? { etching: cenotaph.etching.unwrap().toString() } : {}),
    ...(cenotaph.mint.isSome()
      ? { mint: { block: cenotaph.mint.unwrap().block, tx: Number(cenotaph.mint.unwrap().tx) } }
      : {}),
  };
}
