<script lang="ts">
  import * as Select from "$lib/components/ui/select";
  import { Input } from "$lib/components/ui/input";
  import type { FieldMeta, LeafRule } from "$lib/magic-shelves/types";

  type ValueMode = "none" | "single" | "range" | "list";

  type Props = {
    rule: LeafRule;
    meta: FieldMeta | undefined;
    mode: ValueMode;
    onPatch: (patch: Partial<LeafRule>) => void;
  };

  let { rule, meta, mode, onPatch }: Props = $props();

  function enumLabel(value: unknown): string {
    const selectedValue = String(value ?? "");
    return meta?.options?.find((option) => option.value === selectedValue)?.label ?? "-";
  }

  function scalarInputType(): "date" | "number" {
    if (meta?.kind === "date") return "date";
    return "number";
  }

  function displayValue(value: unknown): string {
    if (value == null) return "";
    return String(value);
  }

  function parseNumericInput(raw: string): number | null {
    if (raw === "") return null;
    return Number(raw);
  }

  function parseScalarInput(raw: string): string | number | null {
    if (meta?.kind === "date") return raw;
    return parseNumericInput(raw);
  }

  function updateSingle(raw: string) {
    if (meta?.kind === "number") {
      onPatch({ value: parseNumericInput(raw) });
      return;
    }
    onPatch({ value: raw });
  }

  function updateList(raw: string) {
    onPatch({
      value: raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
  }

  function displayList(): string {
    if (Array.isArray(rule.value)) return rule.value.join(", ");
    return displayValue(rule.value);
  }
</script>

{#if mode === "none"}
  <span class="font-mono text-[11px] italic text-muted-foreground/70">- no value -</span>
{:else if mode === "range"}
  <div class="flex items-center gap-2">
    <Input
      type={scalarInputType()}
      step="any"
      class="h-8 flex-1 text-xs"
      value={displayValue(rule.valueStart)}
      oninput={(event) => onPatch({ valueStart: parseScalarInput(event.currentTarget.value) })}
      aria-label="From"
    />
    <span class="font-mono text-xs text-muted-foreground">to</span>
    <Input
      type={scalarInputType()}
      step="any"
      class="h-8 flex-1 text-xs"
      value={displayValue(rule.valueEnd)}
      oninput={(event) => onPatch({ valueEnd: parseScalarInput(event.currentTarget.value) })}
      aria-label="To"
    />
  </div>
{:else if mode === "list"}
  <Input
    type="text"
    class="h-8 text-xs"
    placeholder="comma-separated"
    value={displayList()}
    oninput={(event) => updateList(event.currentTarget.value)}
    aria-label="Values"
  />
{:else if meta?.kind === "enum"}
  <Select.Root
    type="single"
    value={String(rule.value ?? "")}
    onValueChange={(value) => value != null && onPatch({ value })}
  >
    <Select.Trigger class="h-8 w-full text-xs">
      {enumLabel(rule.value)}
    </Select.Trigger>
    <Select.Content>
      {#each meta.options ?? [] as option (option.value)}
        <Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{:else if meta?.kind === "number"}
  <Input
    type="number"
    step="any"
    class="h-8 text-xs"
    value={displayValue(rule.value)}
    oninput={(event) => updateSingle(event.currentTarget.value)}
    aria-label="Value"
  />
{:else if meta?.kind === "date"}
  <Input
    type="date"
    class="h-8 text-xs"
    value={typeof rule.value === "string" ? rule.value : ""}
    oninput={(event) => onPatch({ value: event.currentTarget.value })}
    aria-label="Value"
  />
{:else}
  <Input
    type="text"
    class="h-8 text-xs"
    value={displayValue(rule.value)}
    oninput={(event) => onPatch({ value: event.currentTarget.value })}
    aria-label="Value"
  />
{/if}
