import { uz, type Dictionary } from './uz'

const dictionaries: Record<string, Dictionary> = { uz }
const locale = 'uz'

/** Usage: const t = useT(); t.nav.home */
export const t: Dictionary = dictionaries[locale]
export const useT = () => t
