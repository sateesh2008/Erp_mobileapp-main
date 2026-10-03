import { apiRequest, isApiConfigured } from './api';

const recordsFrom = (payload, keys = []) => {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  return Array.isArray(payload) ? payload : [];
};

export const transportApi = {
  async getOverview(session, studentId) {
    if (!isApiConfigured || !studentId) {
      return { buses: [], routes: [], mappings: [], stops: [], fares: [] };
    }

    const [busesResult, routesResult, mappingsResult, faresResult] = await Promise.allSettled([
      apiRequest('/transport/buses', { token: session?.token }),
      apiRequest('/transport/routes', { token: session?.token }),
      apiRequest('/transport/mappings', {
        token: session?.token,
        query: { student_id: studentId },
      }),
      apiRequest('/transport/fares', { token: session?.token }),
    ]);

    const value = (result) => result.status === 'fulfilled' ? result.value : null;
    const mappings = recordsFrom(value(mappingsResult), ['mappings', 'assignments']);
    const routes = recordsFrom(value(routesResult), ['routes']);
    const buses = recordsFrom(value(busesResult), ['buses']);
    const fares = recordsFrom(value(faresResult), ['fares']);
    const routeIds = new Set(mappings.map((mapping) => mapping.route_id || mapping.routeId));
    const stops = [];

    for (const route of routes) {
      const routeId = route.id;
      if (!routeId || (routeIds.size && !routeIds.has(routeId))) continue;
      try {
        const result = await apiRequest(`/transport/routes/${routeId}/stops`, { token: session?.token });
        stops.push(...recordsFrom(result, ['stops']).map((stop) => ({ ...stop, route_id: routeId })));
      } catch {
      }
    }

    return { buses, routes, mappings, stops, fares };
  },
};
