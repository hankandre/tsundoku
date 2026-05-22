import { addMessages, init, getLocaleFromNavigator, locale } from "svelte-i18n";
import en from "./locales/en.json";

addMessages("en", en);

// Initialize once; future locales register their messages above. The
// browser locale is the default; falls back to "en" if none matches.
let initialized = false;
export function initI18n() {
  if (initialized) return;
  init({
    fallbackLocale: "en",
    initialLocale: getLocaleFromNavigator() ?? "en",
  });
  initialized = true;
}

export { locale };
