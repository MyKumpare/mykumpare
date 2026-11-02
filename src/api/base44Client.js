import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
const client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: appBaseUrl || '',
  requiresAuth: false,
  appBaseUrl
});

/**
 * Soft-delete guard.
 *
 * Deleting a record in MyKumpare sets `deleted_at` (it moves to Deleted
 * Records and can be restored), so the row still exists in the database.
 * Every entity read therefore drops soft-deleted rows unless the caller
 * explicitly asks for them (a query that mentions `deleted_at`, e.g. the
 * Deleted Records views). This keeps deleted firms, products, contacts and
 * portfolios out of every list, picker, dashboard, report and search at once.
 */
const asksForDeleted = (query) =>
  !!query && typeof query === 'object' && Object.prototype.hasOwnProperty.call(query, 'deleted_at');

const stripDeleted = (result) => {
  if (Array.isArray(result)) return result.filter((r) => !r || !r.deleted_at);
  if (result && Array.isArray(result.items)) {
    return { ...result, items: result.items.filter((r) => !r || !r.deleted_at) };
  }
  return result;
};

const guardEntity = (entity) =>
  new Proxy(entity, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value !== 'function') return value;

      if (prop === 'list') {
        return (...args) => {
          const options = args[0] && typeof args[0] === 'object' ? args[0] : null;
          // `distinct` returns field values, not records — nothing to filter.
          if (asksForDeleted(options) || (options && options.distinct)) return value.apply(target, args);
          return Promise.resolve(value.apply(target, args)).then(stripDeleted);
        };
      }

      if (prop === 'filter') {
        return (...args) => {
          if (asksForDeleted(args[0])) return value.apply(target, args);
          return Promise.resolve(value.apply(target, args)).then(stripDeleted);
        };
      }

      return value.bind(target);
    },
  });

const entities = new Proxy(client.entities, {
  get(target, prop) {
    const entity = Reflect.get(target, prop);
    if (!entity || typeof entity !== 'object') return entity;
    return guardEntity(entity);
  },
});

export const base44 = new Proxy(client, {
  get(target, prop) {
    if (prop === 'entities') return entities;
    const value = Reflect.get(target, prop);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});