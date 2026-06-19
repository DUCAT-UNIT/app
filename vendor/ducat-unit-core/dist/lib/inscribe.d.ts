import type { InscriptionData } from '../types/index.js';
export declare function has_inscription(script: string): boolean;
export declare function decode_inscriptions(script: string): InscriptionData[];
export declare function encode_inscriptions(data: InscriptionData[]): string;
