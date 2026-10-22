import fs from "node:fs";
import path from "node:path";
import { emptyStatus, type Db, type Status } from "./types";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const target = path.join(DATA_DIR, file);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, target);
}

export const readDb = () => readJson<Db>("listings.json", { updatedAt: null, listings: [] });
export const writeDb = (db: Db) => writeJson("listings.json", db);

export const readStatus = () => readJson<Status>("status.json", emptyStatus);
export const writeStatus = (s: Status) => writeJson("status.json", s);

export type GeoCache = Record<string, { lat: number; lng: number } | null>;
export const readGeoCache = () => readJson<GeoCache>("geocache.json", {});
export const writeGeoCache = (c: GeoCache) => writeJson("geocache.json", c);
