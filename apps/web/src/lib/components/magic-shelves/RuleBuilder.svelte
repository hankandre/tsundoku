<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import * as Select from "$lib/components/ui/select";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { cn } from "$lib/utils";
  import {
    EMPTY_RULES,
    FIELDS,
    OPERATORS_BY_KIND,
    OPERATOR_LABELS,
    fieldMeta,
    isLeaf,
    type FieldName,
    type GroupRule,
    type LeafRule,
    type OperatorName,
  } from "$lib/magic-shelves/types";

  type Props = {
    /** The current rule tree. Mutated in place via the standard Svelte 5
     *  binding convention so the parent's prop reflects edits. */
    rules: GroupRule;
  };

  let { rules = $bindable() }: Props = $props();

  // Foundation scope: the builder is flat — only leaf rules under the top
  // group. Nested groups can come later; the API + JSON shape already
  // support them.
  const leaves = $derived(rules.rules.filter(isLeaf));

  function setJoin(j: "and" | "or") {
    rules = { ...rules, join: j };
  }

  function addRule() {
    const first = FIELDS[0]!;
    const op = OPERATORS_BY_KIND[first.kind][0]!;
    const newRule: LeafRule = { type: "rule", field: first.name, operator: op, value: "" };
    rules = { ...rules, rules: [...rules.rules, newRule] };
  }

  function removeRule(index: number) {
    const next = rules.rules.slice();
    next.splice(index, 1);
    rules = { ...rules, rules: next };
  }

  function updateRule(index: number, patch: Partial<LeafRule>) {
    const next = rules.rules.slice();
    const existing = next[index];
    if (!existing || !isLeaf(existing)) return;
    next[index] = { ...existing, ...patch };
    rules = { ...rules, rules: next };
  }

  // When the field changes, snap to the first valid operator for its kind so
  // the row never sits in an unsupported (field, operator) state. The
  // evaluator silently returns true for unsupported pairs, so leaving stale
  // state would quietly produce wrong matches.
  function changeField(index: number, fieldName: string) {
    const meta = fieldMeta(fieldName as FieldName);
    if (!meta) return;
    const currentRule = leaves[index];
    if (!currentRule) return;
    const allowedOps = OPERATORS_BY_KIND[meta.kind];
    const nextOp = allowedOps.includes(currentRule.operator) ? currentRule.operator : allowedOps[0]!;
    updateRule(index, {
      field: meta.name,
      operator: nextOp,
      value: "",
      valueStart: undefined,
      valueEnd: undefined,
    });
  }

  function operatorsFor(field: FieldName): OperatorName[] {
    const meta = fieldMeta(field);
    return meta ? OPERATORS_BY_KIND[meta.kind] : [];
  }

  function operatorNeedsValue(op: OperatorName): "none" | "single" | "range" | "list" {
    if (op === "is_empty" || op === "is_not_empty") return "none";
    if (op === "in_between") return "range";
    if (op === "includes_any" || op === "includes_all" || op === "excludes_all") return "list";
    return "single";
  }

  // Comma-separated list values are split client-side so the evaluator gets a
  // plain string[] — the alternative (multi-select) needs server-fed
  // suggestions we don't have plumbed yet.
  function setListValue(index: number, raw: string) {
    const items = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateRule(index, { value: items });
  }

  function listValueDisplay(rule: LeafRule): string {
    if (Array.isArray(rule.value)) return rule.value.join(", ");
    if (rule.value == null) return "";
    return String(rule.value);
  }

  if (!rules || !rules.type) {
    rules = { ...EMPTY_RULES };
  }
</script>

<div class="space-y-3 rounded-md border border-border bg-card p-4">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Match
      </span>
      <div class="inline-flex overflow-hidden rounded-md border border-border">
        {#each ["and", "or"] as const as j (j)}
          <button
            type="button"
            class={cn(
              "px-2.5 py-1 text-xs font-medium uppercase",
              rules.join === j
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
            onclick={() => setJoin(j)}
          >
            {j === "and" ? "all" : "any"}
          </button>
        {/each}
      </div>
      <span class="text-xs text-muted-foreground">of the following rules</span>
    </div>
    <button
      type="button"
      onclick={addRule}
      class="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Plus size={13} /> Add rule
    </button>
  </div>

  {#if leaves.length === 0}
    <p class="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
      No rules yet — every book in your libraries will match. Add a rule to narrow it down.
    </p>
  {:else}
    <ul class="space-y-2">
      {#each leaves as rule, i (i)}
        {@const meta = fieldMeta(rule.field)}
        {@const valueMode = operatorNeedsValue(rule.operator)}
        <li class="flex flex-wrap items-end gap-2">
          <div class="space-y-1">
            <Label class="text-[10px] uppercase tracking-wider text-muted-foreground">Field</Label>
            <Select.Root type="single" value={rule.field} onValueChange={(v) => v && changeField(i, v)}>
              <Select.Trigger class="h-8 w-44 text-xs">
                {meta?.label ?? rule.field}
              </Select.Trigger>
              <Select.Content>
                {#each FIELDS as f (f.name)}
                  <Select.Item value={f.name} label={f.label}>{f.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <div class="space-y-1">
            <Label class="text-[10px] uppercase tracking-wider text-muted-foreground">Op</Label>
            <Select.Root
              type="single"
              value={rule.operator}
              onValueChange={(v) => v && updateRule(i, { operator: v as OperatorName })}
            >
              <Select.Trigger class="h-8 w-40 text-xs">
                {OPERATOR_LABELS[rule.operator] ?? rule.operator}
              </Select.Trigger>
              <Select.Content>
                {#each operatorsFor(rule.field) as op (op)}
                  <Select.Item value={op} label={OPERATOR_LABELS[op]}>{OPERATOR_LABELS[op]}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          {#if valueMode === "single"}
            <div class="space-y-1 flex-1 min-w-[180px]">
              <Label class="text-[10px] uppercase tracking-wider text-muted-foreground">Value</Label>
              {#if meta?.kind === "enum"}
                <Select.Root
                  type="single"
                  value={String(rule.value ?? "")}
                  onValueChange={(v) => v != null && updateRule(i, { value: v })}
                >
                  <Select.Trigger class="h-8 w-full text-xs">
                    {meta.options?.find((o) => o.value === String(rule.value ?? ""))?.label ?? "—"}
                  </Select.Trigger>
                  <Select.Content>
                    {#each meta.options ?? [] as opt (opt.value)}
                      <Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else if meta?.kind === "number"}
                <Input
                  type="number"
                  step="any"
                  class="h-8 text-xs"
                  value={rule.value == null ? "" : String(rule.value)}
                  oninput={(e) => {
                    const raw = (e.currentTarget as HTMLInputElement).value;
                    updateRule(i, { value: raw === "" ? null : Number(raw) });
                  }}
                />
              {:else if meta?.kind === "date"}
                <Input
                  type="date"
                  class="h-8 text-xs"
                  value={typeof rule.value === "string" ? rule.value : ""}
                  oninput={(e) => updateRule(i, { value: (e.currentTarget as HTMLInputElement).value })}
                />
              {:else}
                <Input
                  type="text"
                  class="h-8 text-xs"
                  value={rule.value == null ? "" : String(rule.value)}
                  oninput={(e) => updateRule(i, { value: (e.currentTarget as HTMLInputElement).value })}
                />
              {/if}
            </div>
          {:else if valueMode === "range"}
            <div class="space-y-1">
              <Label class="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
              <Input
                type={meta?.kind === "date" ? "date" : "number"}
                step="any"
                class="h-8 w-32 text-xs"
                value={rule.valueStart == null ? "" : String(rule.valueStart)}
                oninput={(e) => {
                  const raw = (e.currentTarget as HTMLInputElement).value;
                  const v = meta?.kind === "date" ? raw : raw === "" ? null : Number(raw);
                  updateRule(i, { valueStart: v });
                }}
              />
            </div>
            <div class="space-y-1">
              <Label class="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
              <Input
                type={meta?.kind === "date" ? "date" : "number"}
                step="any"
                class="h-8 w-32 text-xs"
                value={rule.valueEnd == null ? "" : String(rule.valueEnd)}
                oninput={(e) => {
                  const raw = (e.currentTarget as HTMLInputElement).value;
                  const v = meta?.kind === "date" ? raw : raw === "" ? null : Number(raw);
                  updateRule(i, { valueEnd: v });
                }}
              />
            </div>
          {:else if valueMode === "list"}
            <div class="space-y-1 flex-1 min-w-[200px]">
              <Label class="text-[10px] uppercase tracking-wider text-muted-foreground">
                Values (comma-separated)
              </Label>
              <Input
                type="text"
                class="h-8 text-xs"
                placeholder="e.g. Alice, Bob"
                value={listValueDisplay(rule)}
                oninput={(e) => setListValue(i, (e.currentTarget as HTMLInputElement).value)}
              />
            </div>
          {/if}

          <button
            type="button"
            onclick={() => removeRule(i)}
            aria-label="Remove rule"
            class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={14} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
