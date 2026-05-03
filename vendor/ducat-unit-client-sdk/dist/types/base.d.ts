export type Json = JsonVal | JsonObj;
export type JsonObj = {
    [key: string]: Json;
} | Json[];
export type JsonVal = string | number | boolean | null;
