// Wire-compatible with the API's `MagicShelfRulesType` (arktype). The API
// re-validates on write, so divergence surfaces as a 400 rather than silent
// corruption — but keep these in lockstep with
// apps/api/src/services/magic-shelf-rules.ts when adding new fields.

export type RuleJoin = "and" | "or";

export type FieldName =
  | "title"
  | "subtitle"
  | "description"
  | "publisher"
  | "language"
  | "isbn10"
  | "isbn13"
  | "asin"
  | "ageRating"
  | "seriesName"
  | "publishedDate"
  | "pageCount"
  | "rating"
  | "seriesNumber"
  | "addedOn"
  | "bookType"
  | "libraryId"
  | "authors"
  | "categories";

export type OperatorName =
  | "equals"
  | "not_equals"
  | "contains"
  | "does_not_contain"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "greater_than_equal_to"
  | "less_than"
  | "less_than_equal_to"
  | "in_between"
  | "is_empty"
  | "is_not_empty"
  | "includes_any"
  | "includes_all"
  | "excludes_all";

export type FieldKind = "string" | "number" | "date" | "enum" | "uuid" | "collection";

export type FieldMeta = {
  name: FieldName;
  label: string;
  kind: FieldKind;
  // For "enum" kinds, the allowed values shown in the value picker.
  options?: ReadonlyArray<{ value: string; label: string }>;
};

export const FIELDS: ReadonlyArray<FieldMeta> = [
  { name: "title", label: "Title", kind: "string" },
  { name: "subtitle", label: "Subtitle", kind: "string" },
  { name: "description", label: "Description", kind: "string" },
  { name: "publisher", label: "Publisher", kind: "string" },
  { name: "language", label: "Language", kind: "string" },
  { name: "isbn10", label: "ISBN-10", kind: "string" },
  { name: "isbn13", label: "ISBN-13", kind: "string" },
  { name: "asin", label: "ASIN", kind: "string" },
  { name: "ageRating", label: "Age rating", kind: "string" },
  { name: "seriesName", label: "Series", kind: "string" },
  { name: "publishedDate", label: "Published (text)", kind: "string" },
  { name: "pageCount", label: "Page count", kind: "number" },
  { name: "rating", label: "Rating", kind: "number" },
  { name: "seriesNumber", label: "Series #", kind: "number" },
  { name: "addedOn", label: "Added on", kind: "date" },
  {
    name: "bookType",
    label: "Format",
    kind: "enum",
    options: [
      { value: "PDF", label: "PDF" },
      { value: "EPUB", label: "EPUB" },
      { value: "CBX", label: "Comic (CBX)" },
      { value: "MOBI", label: "MOBI" },
      { value: "AZW3", label: "AZW3" },
      { value: "FB2", label: "FB2" },
      { value: "AUDIOBOOK", label: "Audiobook" },
    ],
  },
  { name: "libraryId", label: "Library", kind: "uuid" },
  { name: "authors", label: "Authors", kind: "collection" },
  { name: "categories", label: "Categories", kind: "collection" },
];

// Operators each field kind supports. The rule builder uses this to filter
// the operator <Select>; the API evaluator rejects mismatches with a logged
// no-op (returns true), so a stale UI degrades gracefully rather than
// crashing requests.
export const OPERATORS_BY_KIND: Record<FieldKind, OperatorName[]> = {
  string: [
    "equals",
    "not_equals",
    "contains",
    "does_not_contain",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
  ],
  number: [
    "equals",
    "not_equals",
    "greater_than",
    "greater_than_equal_to",
    "less_than",
    "less_than_equal_to",
    "in_between",
    "is_empty",
    "is_not_empty",
  ],
  date: [
    "greater_than",
    "greater_than_equal_to",
    "less_than",
    "less_than_equal_to",
    "in_between",
    "is_empty",
    "is_not_empty",
  ],
  enum: ["equals", "not_equals", "includes_any", "excludes_all"],
  uuid: ["equals", "not_equals", "includes_any", "excludes_all"],
  collection: [
    "includes_any",
    "includes_all",
    "excludes_all",
    "contains",
    "does_not_contain",
    "is_empty",
    "is_not_empty",
  ],
};

export const OPERATOR_LABELS: Record<OperatorName, string> = {
  equals: "equals",
  not_equals: "is not",
  contains: "contains",
  does_not_contain: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: ">",
  greater_than_equal_to: ">=",
  less_than: "<",
  less_than_equal_to: "<=",
  in_between: "between",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  includes_any: "includes any of",
  includes_all: "includes all of",
  excludes_all: "excludes all of",
};

export type LeafRule = {
  type: "rule";
  field: FieldName;
  operator: OperatorName;
  value?: unknown;
  valueStart?: unknown;
  valueEnd?: unknown;
};

export type GroupRule = {
  type: "group";
  join: RuleJoin;
  rules: Array<LeafRule | GroupRule>;
};

export const EMPTY_RULES: GroupRule = { type: "group", join: "and", rules: [] };

export function fieldMeta(name: FieldName | string): FieldMeta | undefined {
  return FIELDS.find((f) => f.name === name);
}

export function isLeaf(r: LeafRule | GroupRule): r is LeafRule {
  return r.type === "rule";
}

// Compact operator glyphs for the ledger view. Reads as math where there's
// an obvious symbol; falls back to a short word otherwise. Stays parseable
// at a glance without the full word "greater_than_equal_to" eating the row.
const OPERATOR_SYMBOL: Record<OperatorName, string> = {
  equals: "=",
  not_equals: "≠",
  contains: "contains",
  does_not_contain: "! contains",
  starts_with: "starts",
  ends_with: "ends",
  greater_than: ">",
  greater_than_equal_to: "≥",
  less_than: "<",
  less_than_equal_to: "≤",
  in_between: "between",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  includes_any: "any of",
  includes_all: "all of",
  excludes_all: "none of",
};

function formatValue(v: unknown): string {
  if (v == null || v === "") return '""';
  if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(", ");
  if (typeof v === "number") return String(v);
  return `"${String(v)}"`;
}

function formatLeaf(rule: LeafRule): string {
  const sym = OPERATOR_SYMBOL[rule.operator] ?? rule.operator;
  if (rule.operator === "is_empty" || rule.operator === "is_not_empty") {
    return `${rule.field} ${sym}`;
  }
  if (rule.operator === "in_between") {
    return `${rule.field} ${sym} ${formatValue(rule.valueStart)}..${formatValue(rule.valueEnd)}`;
  }
  return `${rule.field} ${sym} ${formatValue(rule.value)}`;
}

/**
 * One-line, mono-friendly rendering of a rule tree. Used by the magic-shelves
 * ledger to show what each shelf actually filters by. Returns "every book"
 * for an empty group, which is the evaluator's actual behaviour.
 */
export function formatRules(rules: GroupRule | LeafRule | null | undefined): string {
  if (!rules) return "every book";
  if (isLeaf(rules)) return formatLeaf(rules);
  if (!rules.rules.length) return "every book";
  const join = rules.join === "or" ? " or " : " and ";
  const parts = rules.rules.map((r) => {
    if (isLeaf(r)) return formatLeaf(r);
    return `(${formatRules(r)})`;
  });
  return parts.join(join);
}
