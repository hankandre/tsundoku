import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware class merger — handles conflicting classes correctly. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** shadcn-svelte component helper: lets primitives expose a bindable `ref`. */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

/** shadcn-svelte component helper: strip `children` from a primitive's props. */
export type WithoutChildren<T> = Omit<T, "children">;

/** shadcn-svelte component helper: strip `child` (bits-ui asChild) from a primitive's props. */
export type WithoutChild<T> = Omit<T, "child">;

/** shadcn-svelte component helper: strip both `children` and `child`. */
export type WithoutChildrenOrChild<T> = Omit<T, "child" | "children">;
