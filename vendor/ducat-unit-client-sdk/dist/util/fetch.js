import { normalize_obj, parse_error } from '../util/helpers.js';
export var Fetch;
(function (Fetch) {
    async function json(input, init, fetcher = fetch) {
        const res = await fetcher(input, init);
        return resolve_json(res);
    }
    Fetch.json = json;
    async function text(input, init, fetcher = fetch) {
        const res = await fetcher(input, init);
        return resolve_text(res);
    }
    Fetch.text = text;
    async function resolve_json(res) {
        if (!res.ok) {
            return resolve_error(res);
        }
        else {
            const data = await res.json();
            return { status: res.status, ok: true, data };
        }
    }
    async function resolve_text(res) {
        if (!res.ok) {
            return resolve_error(res);
        }
        else {
            const data = await res.text();
            return { status: res.status, ok: true, data };
        }
    }
    async function resolve_error(res) {
        const { status, statusText } = res;
        let error;
        try {
            error = await res.text();
        }
        catch {
            error = statusText;
        }
        return { error, status, ok: false };
    }
})(Fetch || (Fetch = {}));
export var Resolve;
(function (Resolve) {
    function data(data, status = 200) {
        data = (data !== null && data !== undefined)
            ? normalize_obj(data)
            : data;
        return { ok: true, status, data };
    }
    Resolve.data = data;
    function schema(data, schema, err_code = 600) {
        const parsed = schema.safeParse(data);
        return parsed.success
            ? { ok: true, status: 200, data: parsed.data }
            : { ok: false, status: err_code, error: parsed.error.toString() };
    }
    Resolve.schema = schema;
    function error(error, status = 600) {
        const msg = parse_error(error);
        return { ok: false, status, error: msg };
    }
    Resolve.error = error;
    function fail(reason, status = 600) {
        return { ok: false, status, error: reason };
    }
    Resolve.fail = fail;
})(Resolve || (Resolve = {}));
