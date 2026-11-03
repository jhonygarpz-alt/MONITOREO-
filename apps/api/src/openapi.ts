import type { Router } from 'express';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: { perms?: string[] } }[] }; name: string; handle: { stack?: Layer[] }; regexp: RegExp }

function mountPath(l: Layer) {
  const m = l.regexp.source.match(/^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)/);
  return m ? '/' + m[1].replace(/\\\//g, '/') : '';
}

/** Genera la especificación OpenAPI a partir de las rutas registradas (siempre sincronizada con el código). */
export function buildOpenApi(api: Router) {
  const paths: Record<string, Record<string, unknown>> = {};
  const walk = (stack: Layer[], prefix: string) => {
    for (const l of stack) {
      if (l.route) {
        const p = (prefix + l.route.path).replace(/:(\w+)/g, '{$1}');
        const perms = l.route.stack.flatMap((s) => s.handle.perms ?? []);
        for (const method of Object.keys(l.route.methods)) {
          paths[`/api${p}`] = paths[`/api${p}`] ?? {};
          paths[`/api${p}`][method] = {
            tags: [p.split('/')[1]], 'x-permissions': perms, security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            responses: { 200: { description: 'OK' }, 400: { description: 'Datos inválidos' }, 401: { description: 'No autenticado' }, 403: { description: 'Sin permiso' }, 409: { description: 'Conflicto de concurrencia' }, 422: { description: 'Regla de negocio/seguridad violada' } },
          };
        }
      } else if (l.name === 'router' && l.handle.stack) walk(l.handle.stack, prefix + mountPath(l));
    }
  };
  walk((api as unknown as { stack: Layer[] }).stack, '');
  return {
    openapi: '3.0.3',
    info: { title: 'Centro Inteligente de Monitoreo API', version: '1.0.0', description: 'API modular. Todas las operaciones mutables requieren el encabezado X-CIM-Client: web cuando se autentica por cookie. Las fechas se intercambian en ISO-8601 UTC.' },
    components: { securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'cim_session' }, bearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: { '/api/auth/login': { post: { tags: ['auth'], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { 200: { description: 'Sesión iniciada (cookie httpOnly)' } } } }, ...paths },
  };
}
