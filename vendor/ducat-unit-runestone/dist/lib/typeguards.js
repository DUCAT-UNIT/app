export function isRunestone(artifact) {
    return !('flaws' in artifact);
}
