/** Os textos do motor de aparência: a preferência, os pontos de extensão e os dois temas do sistema. */
export const CORE_THEME_MESSAGES: Record<string, string> = {
  'section.title': 'Appearance',
  'section.description':
    'How this organization looks. A personal preference, when set, wins over the organization default.',
  'setting.label': 'Theme',
  'setting.description':
    'Available themes come from the installed theme extensions. Automatic follows the light or dark setting of the device.',

  'theme.automatic': 'Automatic',
  'theme.dark': 'Dark',
  'theme.white': 'White',

  'category.theme': 'Theme',

  'point.definition.title': 'Theme',
  'point.definition.description':
    'A palette the organization can choose. Colors, fonts and spacing only — no code, so any theme file can be installed as it is.',
  'point.tokens.title': 'Theme colors',
  'point.tokens.description':
    'Named colors an extension brings for its own vocabulary, in a light and a dark variant. They exist under every theme, and any theme may override them.',

  'package.dark.summary':
    'The dark theme that ships with the system. It cannot be removed — download it, rename it and import it back to build your own.',
  'package.white.summary':
    'The light theme that ships with the system. It cannot be removed — download it, rename it and import it back to build your own.',

  'package.indigo.summary': 'A dark theme built around a deep indigo, with the Inter typeface.',
  'package.indigo-light.summary': 'The light counterpart of Indigo: white surfaces and the same indigo accent.',
  'package.claude.summary': 'Warm paper tones and a serif typeface, for long reading sessions.',
  'package.teams.summary': 'The dark theme with the blue-violet accent of corporate messaging tools.',
  'package.kindle.summary': 'Aged paper and brown ink, with a serif typeface — an e-reader on screen.',
  'package.themis.summary': 'A light theme in burgundy and gold, with the Lora typeface — sober, for a law office.',
  'package.themis-night.summary': 'Themis after dark: the same burgundy and gold over deep, warm surfaces.',
};
