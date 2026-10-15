import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Small icons come from the simple Z mark; the detailed crest doesn't survive at 64px.
// Maskable/Apple icons get a full-bleed crest-blue background instead of white padding.
const background = '#0B4DB5'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background } },
    apple: { ...preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon-z.svg'],
})
