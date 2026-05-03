import unit_reserve_api from './reserve.js';
export default function (client) {
    return {
        reserve: unit_reserve_api(client),
    };
}
