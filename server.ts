import { Elysia, NotFoundError } from "elysia";
import { createRemixPlugin } from "./remix-elysia";

const remixPlugin = await createRemixPlugin();

const app = new Elysia()
  .onError(({ error }: { error: unknown }) => {
    if (!(error instanceof NotFoundError)) {
      if (error instanceof Error) {
        return new Response(error.toString());
      }

      return new Response(null, { status: 500 });
    }
  })
  .get("/api", () => "Hello Elysia")
  .use(remixPlugin)
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
