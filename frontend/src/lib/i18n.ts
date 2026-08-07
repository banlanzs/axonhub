import { useEffect, useState } from 'react';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// Eager: base only (~33KB combined) — covers layout, sidebar, common.errors
// needed by main.tsx QueryCache.onError and MutationCache.onError.
import enBase from '../locales/en/base.json';
import zhBase from '../locales/zh-CN/base.json';

// Non-eager: all namespace files become their own Vite chunk, loaded on demand.
// Using `import.meta.glob` WITHOUT `{ eager: true }` so every matched file is
// a separate dynamic import that Vite code-splits away from the entry bundle.
type LazyModule = { default: Record<string, unknown> };

const enLoaders = import.meta.glob<LazyModule>('../locales/en/*.json');
const zhCNLoaders = import.meta.glob<LazyModule>('../locales/zh-CN/*.json');

const LOADERS: Record<string, Record<string, () => Promise<LazyModule>>> = {
  en: enLoaders,
  zh: zhCNLoaders,
  'zh-CN': zhCNLoaders,
};

const SUPPORTED_LANGS = ['en', 'zh', 'zh-CN'];

function normalizeLang(lng: string): string {
  const n = lng.toLowerCase();
  if (n === 'zh-cn' || n.startsWith('zh-')) return 'zh';
  return lng;
}

function nsFromPath(path: string): string {
  return (path.split('/').pop() || path).replace(/\.json$/, '');
}

// Track which (lang, namespace) bundles have been added so we never
// re-load the same chunk (idempotent across calls / route changes).
const loaded = new Set<string>();

async function loadNamespace(lng: string, ns: string): Promise<void> {
  const nLng = normalizeLang(lng);
  const key = `${nLng}:${ns}`;
  if (loaded.has(key)) return;
  if (!SUPPORTED_LANGS.includes(nLng)) return;

  const loaders = LOADERS[nLng];
  if (!loaders) return;

  const entry = Object.entries(loaders).find(([path]) => nsFromPath(path) === ns);
  if (!entry) return;

  const [, loader] = entry;
  // eslint-disable-next-line require-atomic-updates
  loaded.add(key); // mark loaded before await so concurrent calls don't double-load
  try {
    const mod = await loader();
    const content = mod?.default ?? (mod as unknown as Record<string, unknown>);
    // Merge into the single 'translation' bundle (keySeparator '.' turns
    // 'sidebar.items.dashboard' → nested path), keeping all existing t() calls
    // unchanged — no namespace prefix needed.
    i18n.addResourceBundle(nLng, 'translation', content, true, true);
  } catch {
    loaded.delete(key);
  }
}

async function preloadAllForLang(lng: string): Promise<void> {
  const nLng = normalizeLang(lng);
  const loaders = LOADERS[nLng];
  if (!loaders) return;
  const namespaces = Object.keys(loaders).map(nsFromPath).filter((ns) => ns !== 'base');
  await Promise.allSettled(namespaces.map((ns) => loadNamespace(lng, ns)));
}

// Init with base only — synchronous, no flash for layout / errors.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enBase },
      zh: { translation: zhBase },
      'zh-CN': { translation: zhBase },
    },
    fallbackLng: 'en',
    debug: false,
    supportedLngs: SUPPORTED_LANGS,
    interpolation: {
      escapeValue: false, // React 已经默认转义了
      format: (value, format, lng, options) => {
        if (format === 'currency') {
          return new Intl.NumberFormat(options?.locale || lng, {
            style: 'currency',
            currency: options?.currency || 'USD',
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: options?.minimumFractionDigits,
            maximumFractionDigits: options?.maximumFractionDigits,
          }).format(value);
        }
        return value;
      },
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        const n = lng.toLowerCase();
        if (n === 'zh-cn' || n.startsWith('zh-')) return 'zh';
        return lng;
      },
    },
  });

// Preload all remaining namespaces for the current language in background.
// This covers every route without per-file changes, avoiding key-flash for
// the common navigation case. The first render shows base-only (layout
// strings are present), then route content fills in within the same frame.
preloadAllForLang(i18n.language || 'en');

// When the user switches language, preload everything for the new language
// so any route is ready without further lazy loading.
i18n.on('languageChanged', (lng: string) => {
  preloadAllForLang(lng);
});

/**
 * Optional per-route locale guard.  Calling `useEnsureLocale('channels')` in a
 * route component ensures the given namespaces are loaded before rendering
 * content, preventing key-flash for deep-linked routes.
 *
 * In the common case `preloadAllForLang` has already loaded everything, so
 * `ready` starts as `true` and the guard is a no-op — zero overhead.
 */
export function useEnsureLocale(...namespaces: string[]): { ready: boolean } {
  const [ready, setReady] = useState(() =>
    namespaces.every((ns) => loaded.has(`${normalizeLang(i18n.language)}:${ns}`))
  );

  useEffect(() => {
    const lng = i18n.language || 'en';
    const nLng = normalizeLang(lng);
    const missing = namespaces.filter((ns) => !loaded.has(`${nLng}:${ns}`));
    if (missing.length === 0) {
      if (!ready) setReady(true);
      return;
    }
    let cancelled = false;
    Promise.all(missing.map((ns) => loadNamespace(lng, ns))).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, namespaces.join(',')]);

  return { ready };
}

export default i18n;
