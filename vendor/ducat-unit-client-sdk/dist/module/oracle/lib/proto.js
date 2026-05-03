export function get_contract_pointers(ctx) {
    const pointers = [];
    for (const key of Object.keys(ctx)) {
        const record = ctx[key];
        if (record !== undefined) {
            pointers.push(...record.ptr);
        }
    }
    return pointers;
}
