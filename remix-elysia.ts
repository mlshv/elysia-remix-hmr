// TODO: make this a remix package `@remix-run/elysia`

import type { ServerBuild } from "@remix-run/node";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import chokidar from "chokidar";

const BUILD_PATH = path.resolve("./build/index.js");
const VERSION_PATH = path.resolve("./build/version.txt");
export const initialBuild = await reimportServer();
let build = initialBuild;

async function handleServerUpdate() {
  build = await reimportServer();
}

chokidar
  .watch(VERSION_PATH, { ignoreInitial: true })
  .on("add", handleServerUpdate)
  .on("change", handleServerUpdate);

async function reimportServer(): Promise<ServerBuild> {
  const stat = fs.statSync(BUILD_PATH);

  // convert build path to URL for Windows compatibility with dynamic `import`
  const BUILD_URL = url.pathToFileURL(BUILD_PATH).href;

  // use a timestamp query parameter to bust the import cache
  return import(BUILD_URL + "?t=" + stat.mtimeMs);
}

export function createRequestHandler() {
  const mode = process.env.NODE_ENV;

  return async (request: Request) => {
    let handleRequest = createRemixRequestHandler(build, mode);
    let response = await handleRequest(request);

    return response;
  };
}
