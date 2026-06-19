import { AirlineStore } from "./airline-store";
import { correlationId, parseNdcAction, wrapNdcResponse } from "./ndc";

export { AirlineStore };

export interface Env {
  AIRLINE_STORE: DurableObjectNamespace;
}

const NDC_PREFIX = "/ndc/v21.3/";
const STORE_ID = "global";

async function callStore(env: Env, action: unknown): Promise<Record<string, unknown>> {
  const id = env.AIRLINE_STORE.idFromName(STORE_ID);
  const stub = env.AIRLINE_STORE.get(id);
  const resp = await stub.fetch("https://store/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  return (await resp.json()) as Record<string, unknown>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("Airline NDC Mock Service is running", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (request.method !== "POST" || !url.pathname.startsWith(NDC_PREFIX)) {
      return json({ error: "Not found" }, 404);
    }

    const ndcPath = url.pathname.slice(NDC_PREFIX.length);
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const action = parseNdcAction(ndcPath, body);
      const result = await callStore(env, action);
      const wrapped = wrapNdcResponse(ndcPath, result, correlationId(body));
      return json(wrapped, result.error ? 400 : 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bad request";
      return json({ error: message }, 400);
    }
  },
};

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
