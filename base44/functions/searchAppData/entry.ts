import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Dynamic application-wide data search used by the "search_report" agent.
 *
 * Because it runs under the service role and reads entities BY NAME (passed in
 * by the caller), any entity that exists in the app — including ones created
 * after this function was deployed — is automatically searchable. New forms
 * and fields require no agent reconfiguration.
 *
 * Actions:
 *   - list_entities  → returns every entity name + its JSON schema (field list)
 *   - schema         → { entity_name } → returns one entity's schema
 *   - search         → { entity_name, filter?, limit?, sort? } → returns records
 */
// All entities currently in the app. Add new entity names here when created
// so the agent's "list_entities" discovery stays complete. (Search works for
// any entity name automatically — this list only powers discovery.)
const ENTITY_NAMES = [
  "Firm", "Contact", "Product", "Portfolio", "DueDiligence", "FirmNews",
  "ContactActivity", "FollowUpTask", "Benchmark", "FirmDocument", "Analysis",
  "ReturnSeries", "CustomReport", "ClientType", "OrgChart",
  "ExternalProductSubmission", "FundingStatusHistory", "Questionnaire",
  "Template", "Ownership", "ChatConversation", "ImportJob", "FirmOwner",
  "ActivityCategory", "ActivitySubject", "ActivityType", "ContactRoleOption",
  "ContactTypeOption", "ContactDepartmentOption", "JobTitleOption",
  "CompanyNameOption", "DocumentCategory", "DocumentSubCategory",
  "DueDiligenceStatusOption", "DdNotification", "DdStageNoteVersion",
  "EnrichmentLog", "ExternalChat", "ExternalPartyRequest", "FormType",
  "InvitationHistory", "NewsScrubSettings", "PendingInvitation",
  "PhoneType", "QuestionBank", "ResponseMapping", "TemplateType",
  "ZipCode", "DuplicateReview", "ContactPipelineStage", "User",
];

// In-memory fallback matcher used when the database rejects a filter.
// Supports the operators the app actually sends (equality, null, $in/$nin,
// $ne, $or, $regex) plus dotted paths into nested objects/arrays.
const getPath = (record: any, path: string): any => {
  const parts = path.split(".");
  const walk = (value: any, idx: number): any => {
    if (value == null) return undefined;
    if (idx === parts.length) return value;
    if (Array.isArray(value)) {
      return value
        .map((v) => walk(v, idx))
        .filter((v) => v !== undefined);
    }
    return walk(value[parts[idx]], idx + 1);
  };
  const result = walk(record, 0);
  return Array.isArray(result) && result.length === 1 ? result[0] : result;
};

const equalsValue = (actual: any, expected: any): boolean => {
  if (Array.isArray(actual)) return actual.some((v) => equalsValue(v, expected));
  if (expected === null) return actual === null || actual === undefined || actual === "";
  return actual === expected || String(actual) === String(expected);
};

const matchesCondition = (actual: any, condition: any): boolean => {
  if (condition && typeof condition === "object" && !Array.isArray(condition)) {
    return Object.entries(condition).every(([op, operand]) => {
      if (op === "$in") return (operand as any[]).some((v) => equalsValue(actual, v));
      if (op === "$nin") return !(operand as any[]).some((v) => equalsValue(actual, v));
      if (op === "$ne") return !equalsValue(actual, operand);
      if (op === "$regex") {
        const flags = (condition as any).$options || "";
        try {
          return new RegExp(String(operand), flags).test(String(actual ?? ""));
        } catch {
          return false;
        }
      }
      if (op === "$in" || op === "$options") return true;
      return false;
    });
  }
  return equalsValue(actual, condition);
};

const matchesFilter = (record: any, filter: any): boolean =>
  Object.entries(filter || {}).every(([key, condition]) => {
    if (key === "$or") return (condition as any[]).some((c) => matchesFilter(record, c));
    if (key === "$and") return (condition as any[]).every((c) => matchesFilter(record, c));
    return matchesCondition(getPath(record, key), condition);
  });

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body: any = await req.json().catch(() => ({}));
    const action = body.action || "search";

    const entitiesProxy = base44.asServiceRole.entities;

    if (action === "list_entities") {
      // The SDK entities proxy does not expose its keys, so we keep a
      // comprehensive list of the app's entities here for discovery. Searching
      // (the "search" action) works for ANY entity by name — including ones
      // added after deployment — so new forms are automatically searchable;
      // this list only powers the "list_entities" discovery helper.
      const names = ENTITY_NAMES;
      const out = [];
      for (const name of names) {
        try {
          const schema = await entitiesProxy[name].schema();
          out.push({ name, fields: Object.keys(schema.properties || {}) });
        } catch {
          out.push({ name });
        }
      }
      return Response.json({ entities: out });
    }

    if (action === "schema") {
      const { entity_name } = body;
      if (!entity_name) return Response.json({ error: "entity_name required" }, { status: 400 });
      try {
        const schema = await entitiesProxy[entity_name].schema();
        return Response.json({ entity: entity_name, schema });
      } catch {
        return Response.json({ error: `entity '${entity_name}' not found` }, { status: 404 });
      }
    }

    if (action === "search") {
      const { entity_name, filter, limit, sort } = body;
      if (!entity_name) return Response.json({ error: "entity_name required" }, { status: 400 });
      const entity = entitiesProxy[entity_name];
      if (!entity) return Response.json({ error: `entity '${entity_name}' not found` }, { status: 404 });

      const hasFilter = filter && typeof filter === "object" && Object.keys(filter).length > 0;
      const rowLimit = limit || 100;

      let records: any[] = [];
      let warning: string | undefined;
      try {
        records = hasFilter
          ? await entity.filter(filter, sort, rowLimit)
          : await entity.list(sort, rowLimit);
      } catch (filterError) {
        // A query the database rejects must not fail the whole request — a 500
        // here breaks callers such as the contact report generator. Retry
        // without the filter and match the records in code instead.
        warning = `filter not supported: ${(filterError as Error).message}`;
        try {
          const all = await entity.list(sort, 500);
          const matched = hasFilter ? all.filter((r: any) => matchesFilter(r, filter)) : all;
          records = matched.slice(0, rowLimit);
        } catch (listError) {
          return Response.json({
            entity: entity_name,
            count: 0,
            records: [],
            warning: (listError as Error).message,
          });
        }
      }

      // Trim large/nested payloads so the agent context stays manageable.
      const slim = records.map((r: any) => {
        const { aum_history, stages, sub_stages, messages, ...rest } = r;
        return rest;
      });
      return Response.json({
        entity: entity_name,
        count: records.length,
        records: slim,
        ...(warning ? { warning } : {}),
      });
    }

    return Response.json({ error: `unknown action '${action}'` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}