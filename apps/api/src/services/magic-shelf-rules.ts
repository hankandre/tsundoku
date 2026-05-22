import { type } from "arktype";
import { sql, type SQL } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { logger } from "../logger.ts";

// The field/operator vocabulary intentionally tracks upstream booklore's
// `RuleField` / `RuleOperator` JSON keys so saved shelves survive an
// import/export against the original. The current rewrite only evaluates a
// subset that maps to columns we already have — unsupported fields
// short-circuit to TRUE rather than throwing, so a shelf authored against a
// later schema still loads.

export const FIELD_NAMES = [
  // string fields on book_metadata
  "title",
  "subtitle",
  "description",
  "publisher",
  "language",
  "isbn10",
  "isbn13",
  "asin",
  "ageRating",
  "seriesName",
  "publishedDate",
  // numeric fields on book_metadata
  "pageCount",
  "rating",
  "seriesNumber",
  // timestamp on books
  "addedOn",
  // enum / uuid on books
  "bookType",
  "libraryId",
  // collections via mapping tables
  "authors",
  "categories",
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export const OPERATOR_NAMES = [
  "equals",
  "not_equals",
  "contains",
  "does_not_contain",
  "starts_with",
  "ends_with",
  "greater_than",
  "greater_than_equal_to",
  "less_than",
  "less_than_equal_to",
  "in_between",
  "is_empty",
  "is_not_empty",
  "includes_any",
  "includes_all",
  "excludes_all",
] as const;

export type OperatorName = (typeof OPERATOR_NAMES)[number];

// arktype recursive schema. The two-step `type.module` lets `group.rules`
// reference `rule | group` without forward-declaration headaches. Field /
// operator unions are written as string literals here (not joined dynamically
// from FIELD_NAMES) because arktype needs them at TS literal-type level.
const ruleModule = type.module({
  joinKind: "'and'|'or'",
  fieldName:
    "'title'|'subtitle'|'description'|'publisher'|'language'|'isbn10'|'isbn13'|'asin'|'ageRating'|'seriesName'|'publishedDate'|'pageCount'|'rating'|'seriesNumber'|'addedOn'|'bookType'|'libraryId'|'authors'|'categories'",
  operatorName:
    "'equals'|'not_equals'|'contains'|'does_not_contain'|'starts_with'|'ends_with'|'greater_than'|'greater_than_equal_to'|'less_than'|'less_than_equal_to'|'in_between'|'is_empty'|'is_not_empty'|'includes_any'|'includes_all'|'excludes_all'",
  rule: {
    type: "'rule'",
    field: "fieldName",
    operator: "operatorName",
    "value?": "unknown",
    "valueStart?": "unknown",
    "valueEnd?": "unknown",
  },
  group: {
    type: "'group'",
    join: "joinKind",
    rules: "(rule | group)[]",
  },
});

export const MagicShelfRulesType = ruleModule.group;
export type MagicShelfRulesInput = typeof MagicShelfRulesType.infer;

// Static check that the runtime validator matches the structural type baked
// into the schema's `$type<MagicShelfRules>()` brand. If these drift, the
// jsonb read sites will silently mis-type.
const _typeCheck = (
  x: MagicShelfRulesInput,
): import("@tsundoku/db/schema").MagicShelfRules => x;
void _typeCheck;

type FieldKind = "string" | "number" | "date" | "enum" | "uuid" | "collection";

type FieldSpec =
  | { kind: "string" | "number" | "date"; col: SQL.Aliased | SQL | unknown }
  | { kind: "enum"; col: SQL.Aliased | SQL | unknown; allowed: readonly string[] }
  | { kind: "uuid"; col: SQL.Aliased | SQL | unknown }
  | { kind: "collection"; collection: "authors" | "categories" };

// Column references are passed straight to `sql` template strings — Drizzle
// inlines them with the right quoting / table aliasing.
const FIELDS: Record<FieldName, FieldSpec> = {
  title: { kind: "string", col: schema.bookMetadata.title },
  subtitle: { kind: "string", col: schema.bookMetadata.subtitle },
  description: { kind: "string", col: schema.bookMetadata.description },
  publisher: { kind: "string", col: schema.bookMetadata.publisher },
  language: { kind: "string", col: schema.bookMetadata.language },
  isbn10: { kind: "string", col: schema.bookMetadata.isbn10 },
  isbn13: { kind: "string", col: schema.bookMetadata.isbn13 },
  asin: { kind: "string", col: schema.bookMetadata.asin },
  ageRating: { kind: "string", col: schema.bookMetadata.ageRating },
  seriesName: { kind: "string", col: schema.bookMetadata.seriesName },
  // published_date is stored as varchar in the rewrite (booklore quirk: dates
  // arrive as partial strings like "2019" or "2019-03"). String compares still
  // work for equals/contains; range operators are best-effort.
  publishedDate: { kind: "string", col: schema.bookMetadata.publishedDate },
  pageCount: { kind: "number", col: schema.bookMetadata.pageCount },
  rating: { kind: "number", col: schema.bookMetadata.rating },
  seriesNumber: { kind: "number", col: schema.bookMetadata.seriesNumber },
  addedOn: { kind: "date", col: schema.books.addedOn },
  bookType: { kind: "enum", col: schema.books.bookType, allowed: schema.bookType },
  libraryId: { kind: "uuid", col: schema.books.libraryId },
  authors: { kind: "collection", collection: "authors" },
  categories: { kind: "collection", collection: "categories" },
};

type Rule = MagicShelfRulesInput["rules"][number];

function isGroup(r: Rule): r is Extract<Rule, { type: "group" }> {
  return (r as { type?: string }).type === "group";
}

/**
 * Compile a magic-shelf rule tree into a Drizzle SQL fragment. The result
 * assumes the outer query has `books` in scope, with `book_metadata`
 * left-joined on `book_metadata.book_id = books.id`.
 */
export function compileMagicShelfWhere(rules: MagicShelfRulesInput): SQL {
  return compileGroup(rules);
}

function compileGroup(group: Extract<Rule, { type: "group" }>): SQL {
  if (!group.rules.length) return sql`true`;
  const parts: SQL[] = [];
  for (const child of group.rules) {
    const compiled = isGroup(child) ? compileGroup(child) : compileRule(child);
    parts.push(compiled);
  }
  const joiner = group.join === "or" ? " OR " : " AND ";
  return sql`(${sql.join(parts, sql.raw(joiner))})`;
}

function compileRule(rule: Extract<Rule, { type: "rule" }>): SQL {
  const field = rule.field as FieldName;
  const spec = FIELDS[field];
  if (!spec) {
    logger.warn({ field, operator: rule.operator }, "magic-shelf: unknown field, skipping");
    return sql`true`;
  }
  const op = rule.operator as OperatorName;
  try {
    return compileOperator(spec, op, rule);
  } catch (err) {
    logger.warn({ field, operator: op, err }, "magic-shelf: operator failed, skipping");
    return sql`true`;
  }
}

function compileOperator(spec: FieldSpec, op: OperatorName, rule: Extract<Rule, { type: "rule" }>): SQL {
  if (spec.kind === "collection") return compileCollectionOperator(spec, op, rule);

  const col = spec.col as SQL;
  const value = rule.value;

  switch (op) {
    case "is_empty":
      return spec.kind === "string"
        ? sql`(${col} IS NULL OR ${col} = '')`
        : sql`${col} IS NULL`;
    case "is_not_empty":
      return spec.kind === "string"
        ? sql`(${col} IS NOT NULL AND ${col} <> '')`
        : sql`${col} IS NOT NULL`;
  }

  if (op === "includes_any" || op === "excludes_all") {
    if (spec.kind !== "enum" && spec.kind !== "uuid") {
      // includes_any on a scalar string/number field reduces to equals-any.
      const list = asArray(value);
      if (!list.length) return sql`true`;
      const fragment = sql`${col} IN (${sql.join(list.map((v) => sql`${v}`), sql.raw(","))})`;
      return op === "excludes_all" ? sql`(${col} IS NULL OR NOT (${fragment}))` : fragment;
    }
    const list = asArray(value).map((v) => String(v));
    if (!list.length) return sql`true`;
    const fragment = sql`${col} IN (${sql.join(list.map((v) => sql`${v}`), sql.raw(","))})`;
    return op === "excludes_all" ? sql`(${col} IS NULL OR NOT (${fragment}))` : fragment;
  }

  if (op === "includes_all") {
    // includes_all on a scalar field is only satisfiable if exactly one value
    // is given — degenerate, but keep the door open so the UI can be uniform.
    const list = asArray(value);
    if (list.length === 0) return sql`true`;
    if (list.length === 1) return sql`${col} = ${list[0]}`;
    return sql`false`;
  }

  if (spec.kind === "string") return compileStringOperator(col, op, value);
  if (spec.kind === "number" || spec.kind === "date")
    return compileScalarOperator(col, op, rule);
  if (spec.kind === "enum" || spec.kind === "uuid") {
    if (op === "equals") return sql`${col} = ${String(value ?? "")}`;
    if (op === "not_equals") return sql`${col} IS DISTINCT FROM ${String(value ?? "")}`;
    logger.warn({ kind: spec.kind, operator: op }, "magic-shelf: operator not supported for field kind");
    return sql`true`;
  }
  return sql`true`;
}

function compileStringOperator(col: SQL, op: OperatorName, value: unknown): SQL {
  const s = value == null ? "" : String(value);
  switch (op) {
    case "equals":
      return sql`${col} = ${s}`;
    case "not_equals":
      // IS DISTINCT FROM treats NULL as distinct — "not equal X" still
      // matches rows where the column is NULL, which is what users expect.
      return sql`${col} IS DISTINCT FROM ${s}`;
    case "contains":
      return sql`${col} ILIKE ${"%" + escapeLike(s) + "%"}`;
    case "does_not_contain":
      return sql`(${col} IS NULL OR ${col} NOT ILIKE ${"%" + escapeLike(s) + "%"})`;
    case "starts_with":
      return sql`${col} ILIKE ${escapeLike(s) + "%"}`;
    case "ends_with":
      return sql`${col} ILIKE ${"%" + escapeLike(s)}`;
    default:
      logger.warn({ operator: op }, "magic-shelf: string operator unsupported, skipping");
      return sql`true`;
  }
}

function compileScalarOperator(col: SQL, op: OperatorName, rule: Extract<Rule, { type: "rule" }>): SQL {
  const value = rule.value;
  switch (op) {
    case "equals":
      return sql`${col} = ${value}`;
    case "not_equals":
      return sql`${col} IS DISTINCT FROM ${value}`;
    case "greater_than":
      return sql`${col} > ${value}`;
    case "greater_than_equal_to":
      return sql`${col} >= ${value}`;
    case "less_than":
      return sql`${col} < ${value}`;
    case "less_than_equal_to":
      return sql`${col} <= ${value}`;
    case "in_between":
      return sql`${col} BETWEEN ${rule.valueStart} AND ${rule.valueEnd}`;
    default:
      logger.warn({ operator: op }, "magic-shelf: scalar operator unsupported, skipping");
      return sql`true`;
  }
}

function compileCollectionOperator(
  spec: Extract<FieldSpec, { kind: "collection" }>,
  op: OperatorName,
  rule: Extract<Rule, { type: "rule" }>,
): SQL {
  // authors / categories live in mapping tables joined to a name table. The
  // EXISTS form is cheaper than a JOIN at this scope because the outer query
  // already pages rows and we want one boolean per outer row.
  const mapping =
    spec.collection === "authors" ? "book_metadata_author_mapping" : "book_metadata_category_mapping";
  const fkCol = spec.collection === "authors" ? "author_id" : "category_id";
  const nameTable = spec.collection === "authors" ? "authors" : "categories";

  const values = asArray(rule.value).map((v) => String(v));

  switch (op) {
    case "is_empty":
      return sql.raw(
        `NOT EXISTS (SELECT 1 FROM ${mapping} m WHERE m.book_id = books.id)`,
      );
    case "is_not_empty":
      return sql.raw(
        `EXISTS (SELECT 1 FROM ${mapping} m WHERE m.book_id = books.id)`,
      );
    case "contains":
    case "equals": {
      if (!rule.value) return sql`true`;
      const s = String(rule.value);
      const matchCol = op === "contains" ? sql`n.name ILIKE ${"%" + escapeLike(s) + "%"}` : sql`n.name = ${s}`;
      return sql`EXISTS (
        SELECT 1 FROM ${sql.raw(mapping)} m
        JOIN ${sql.raw(nameTable)} n ON n.id = m.${sql.raw(fkCol)}
        WHERE m.book_id = ${schema.books.id} AND ${matchCol}
      )`;
    }
    case "does_not_contain":
    case "not_equals": {
      if (!rule.value) return sql`true`;
      const s = String(rule.value);
      const matchCol = op === "does_not_contain" ? sql`n.name ILIKE ${"%" + escapeLike(s) + "%"}` : sql`n.name = ${s}`;
      return sql`NOT EXISTS (
        SELECT 1 FROM ${sql.raw(mapping)} m
        JOIN ${sql.raw(nameTable)} n ON n.id = m.${sql.raw(fkCol)}
        WHERE m.book_id = ${schema.books.id} AND ${matchCol}
      )`;
    }
    case "includes_any": {
      if (!values.length) return sql`true`;
      return sql`EXISTS (
        SELECT 1 FROM ${sql.raw(mapping)} m
        JOIN ${sql.raw(nameTable)} n ON n.id = m.${sql.raw(fkCol)}
        WHERE m.book_id = ${schema.books.id} AND n.name IN (${sql.join(values.map((v) => sql`${v}`), sql.raw(","))})
      )`;
    }
    case "excludes_all": {
      if (!values.length) return sql`true`;
      return sql`NOT EXISTS (
        SELECT 1 FROM ${sql.raw(mapping)} m
        JOIN ${sql.raw(nameTable)} n ON n.id = m.${sql.raw(fkCol)}
        WHERE m.book_id = ${schema.books.id} AND n.name IN (${sql.join(values.map((v) => sql`${v}`), sql.raw(","))})
      )`;
    }
    case "includes_all": {
      if (!values.length) return sql`true`;
      // Each required value must exist on its own row in the mapping. Compose
      // one EXISTS per required value and AND them together.
      const exists = values.map(
        (v) => sql`EXISTS (
          SELECT 1 FROM ${sql.raw(mapping)} m
          JOIN ${sql.raw(nameTable)} n ON n.id = m.${sql.raw(fkCol)}
          WHERE m.book_id = ${schema.books.id} AND n.name = ${v}
        )`,
      );
      return sql`(${sql.join(exists, sql.raw(" AND "))})`;
    }
    default:
      logger.warn({ operator: op }, "magic-shelf: collection operator unsupported, skipping");
      return sql`true`;
  }
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}
