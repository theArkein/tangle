import type { Env } from "../index";

export class GameRoom implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return Response.json({ roomId: this.state.id.toString(), status: "waiting" });
    }

    return new Response("Not found", { status: 404 });
  }
}
