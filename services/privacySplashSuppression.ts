/**
 * Coordinates native prompts that temporarily move the app to `inactive`.
 *
 * The privacy splash should still show when the app actually backgrounds, but
 * native auth prompts can emit `inactive` while the app is still in front.
 */

let suppressionDepth = 0;

export function beginPrivacySplashSuppression(): () => void {
  suppressionDepth += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    suppressionDepth = Math.max(0, suppressionDepth - 1);
  };
}

export function isPrivacySplashSuppressed(): boolean {
  return suppressionDepth > 0;
}

export function _resetPrivacySplashSuppressionForTests(): void {
  suppressionDepth = 0;
}
