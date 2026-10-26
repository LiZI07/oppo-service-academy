import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import {privateGateway} from './private-gateway';

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (!import.meta.env.DEV) {
      const denied = await privateGateway(request, env);
      if (denied) return denied;
    }
    // Static files contain internal learning content too. run_worker_first is
    // required, and the identity gate must run before this asset binding.
    if (env.ASSETS && ['GET', 'HEAD'].includes(request.method) &&
        !new URL(request.url).pathname.startsWith('/api/')) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) {
        const response = new Response(asset.body, asset);
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
      }
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
