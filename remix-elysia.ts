import type { ServerBuild } from "@remix-run/node";
import {
  broadcastDevReady,
  createRequestHandler as createRemixRequestHandler,
} from "@remix-run/node";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import chokidar from "chokidar";
import Elysia, { Context, NotFoundError } from "elysia";
import staticPlugin from "@elysiajs/static";

export interface RemixElysiaOptions {
  /**
   * Remix build directory.
   * @default "build"
   */
  buildDirectory?: string;

  /**
   * Configure [static plugin](https://elysiajs.com/plugins/static) options
   *
   * @default
   * {
   *		assets: clientDirectory,
   *		prefix: "/",
   *		directive: "immutable",
   *		maxAge: 31556952000
   * }
   */
  static?: Parameters<typeof staticPlugin>[0];
}

async function reimportServer(buildPath: string): Promise<ServerBuild> {
  if (!fs.existsSync(buildPath)) {
    throw new Error(
      `Build file not found: ${buildPath}. Make sure to build your Remix app before starting the server.`
    );
  }

  const stat = fs.statSync(buildPath);

  // convert build path to URL for Windows compatibility with dynamic `import`
  const BUILD_URL = url.pathToFileURL(buildPath).href;

  // use a timestamp query parameter to bust the import cache
  return import(BUILD_URL + "?t=" + stat.mtimeMs);
}

export function createRequestHandler(build: ServerBuild) {
  const mode = process.env.NODE_ENV;

  return async (request: Request) => {
    let handleRequest = createRemixRequestHandler(build, mode);
    let response = await handleRequest(request);

    return response;
  };
}

export async function createRemixPlugin(options?: RemixElysiaOptions) {
  const buildDirectory = path.join(
    process.cwd(),
    options?.buildDirectory ?? "build"
  );
  const indexPath = path.join(buildDirectory, "index.js");
  const versionPath = path.join(buildDirectory, "version.txt");

  const initialBuild = await reimportServer(indexPath);
  let build = initialBuild;

  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(initialBuild);

    async function handleServerUpdate(buildPath: string) {
      build = await reimportServer(buildPath);
    }

    chokidar
      .watch(versionPath, { ignoreInitial: true })
      .on("add", handleServerUpdate)
      .on("change", handleServerUpdate);
  }

  const remixPlugin = new Elysia({
    name: "elysia-remix",
    seed: options,
  });

  return remixPlugin
    .use(
      staticPlugin({
        prefix: "/",
        directive: "immutable",
        maxAge: 31556952000,
        alwaysStatic: false,
        noCache: true, // see https://github.com/elysiajs/elysia/issues/739,
        ...options?.static,
      })
    )
    .onError(async (context: Context) => {
      if ((context as any).error instanceof NotFoundError) {
        const handler = createRequestHandler(build);

        return handler(context.request);
      }
    });
}
