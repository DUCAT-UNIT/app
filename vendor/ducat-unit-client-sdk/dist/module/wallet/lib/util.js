export function create_manifest(inputs) {
    const manifest = {};
    for (const [key, value] of inputs) {
        if (manifest[key] === undefined) {
            manifest[key] = [];
        }
        manifest[key].push(...value);
    }
    return manifest;
}
