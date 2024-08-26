import { Elysia, NotFoundError } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { createRequestHandler, initialBuild } from "./remix-elysia";
import { broadcastDevReady } from "@remix-run/node";

const app = new Elysia()
  .get("/api", () => "Hello Elysia")
  .onStart(async () => {
    if (process.env.NODE_ENV === "development") {
      broadcastDevReady(initialBuild);
    }
  })
  .onError(async (context) => {
    if (context.error instanceof NotFoundError) {
      const handler = createRequestHandler();

      return handler(context.request);
    }
  })
  // Serve public files
  .use(
    staticPlugin({
      prefix: "/",
      directive: "immutable",
      maxAge: 31556952000,
      alwaysStatic: false,
      noCache: true, // see https://github.com/elysiajs/elysia/issues/739
    })
  )
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
