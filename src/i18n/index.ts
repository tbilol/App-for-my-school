import { uz, type Dictionary } from './uz'

const dictionaries: Record<string, Dictionary> = { uz }
const locale = 'uz'

/** Usage: const t = useT(); t.nav.home */
export const t: Dictionary = dictionaries[locale]
export const useT = () => t

/** fmt('yana {n} coin kerak', { n: 50 }) → 'yana 50 coin kerak' */
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
}
