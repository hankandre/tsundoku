<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import * as Select from "$lib/components/ui/select";
  import { cn } from "$lib/utils";
  import RuleValueInput from "./RuleValueInput.svelte";
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
  // group. Nested groups can come later; the JSON shape already supports them.
  const leaves = $derived(rules.rules.filter(isLeaf));

  type ValueMode = "none" | "single" | "range" | "list";

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

  function operatorNeedsValue(op: OperatorName): ValueMode {
    if (op === "is_empty" || op === "is_not_empty") return "none";
    if (op === "in_between") return "range";
    if (op === "includes_any" || op === "includes_all" || op === "excludes_all") return "list";
    return "single";
  }

  function joinLabel(join: "and" | "or"): string {
    if (join === "and") return "all";
    return "any";
  }

  function joinButtonClass(join: "and" | "or"): string {
    if (rules.join === join) return "bg-primary text-primary-foreground";
    return "text-muted-foreground hover:bg-muted hover:text-foreground";
  }

  if (!rules || !rules.type) {
    rules = { ...EMPTY_RULES };
  }
</script>

<div class="space-y-3">
  <!-- Row-header strip: AND/ANY toggle inline with the "match … of" copy, +rule on the right. -->
  <div class="flex flex-wrap items-baseline justify-between gap-3">
    <div class="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      <span>match</span>
      <div class="inline-flex h-7 overflow-hidden rounded-md border border-border bg-background">
        {#each ["and", "or"] as const as j (j)}
          <button
            type="button"
            class={cn(
              "px-3 text-[10px] font-medium uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              joinButtonClass(j),
            )}
            onclick={() => setJoin(j)}
            aria-pressed={rules.join === j}
          >
            {joinLabel(j)}
          </button>
        {/each}
      </div>
      <span>of the following</span>
    </div>
    <button
      type="button"
      onclick={addRule}
      class="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus size={13} /> Add rule
      <kbd class="ml-1 hidden font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 sm:inline">⌘N</kbd>
    </button>
  </div>

  {#if leaves.length === 0}
    <p class="border-y border-dashed border-border py-4 text-center text-xs italic text-muted-foreground">
      No rules yet — every book in your libraries matches. Add a rule to narrow it down.
    </p>
  {:else}
    <!-- Tabular grid: field / operator / value / delete. The eye reads down
         columns; per the operator-console brief, no per-row card surface. -->
    <div
      class="grid grid-cols-[minmax(140px,1fr)_minmax(120px,1fr)_minmax(160px,2fr)_auto] gap-x-3 gap-y-2"
      role="list"
    >
      <!-- Column headers as mono captions. Hidden visually on narrow widths
           (the field labels reappear inline on each row instead). -->
      <span class="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 sm:block">Field</span>
      <span class="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 sm:block">Op</span>
      <span class="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 sm:block">Value</span>
      <span aria-hidden="true"></span>

      {#each leaves as rule, i (i)}
        {@const meta = fieldMeta(rule.field)}
        {@const valueMode = operatorNeedsValue(rule.operator)}
        <!-- Field -->
        <Select.Root type="single" value={rule.field} onValueChange={(v) => v && changeField(i, v)}>
          <Select.Trigger class="h-8 w-full text-xs">
            {meta?.label ?? rule.field}
          </Select.Trigger>
          <Select.Content>
            {#each FIELDS as f (f.name)}
              <Select.Item value={f.name} label={f.label}>{f.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>

        <!-- Operator -->
        <Select.Root
          type="single"
          value={rule.operator}
          onValueChange={(v) => v && updateRule(i, { operator: v as OperatorName })}
        >
          <Select.Trigger class="h-8 w-full text-xs">
            {OPERATOR_LABELS[rule.operator] ?? rule.operator}
          </Select.Trigger>
          <Select.Content>
            {#each operatorsFor(rule.field) as op (op)}
              <Select.Item value={op} label={OPERATOR_LABELS[op]}>{OPERATOR_LABELS[op]}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>

        <!-- Value cell — morphs by operator + field kind. -->
        <div class="min-w-0">
          <RuleValueInput
            {rule}
            {meta}
            mode={valueMode}
            onPatch={(patch) => updateRule(i, patch)}
          />
        </div>

        <button
          type="button"
          onclick={() => removeRule(i)}
          aria-label="Remove rule"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          <Trash2 size={14} />
        </button>
      {/each}
    </div>
  {/if}
</div>
