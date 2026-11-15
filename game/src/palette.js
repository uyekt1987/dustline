// Dusk-foundry palette. Same names are the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#161a21', surface: '#232a33', hairline: '#39424d', ink: '#e8e4d8',
  muted: '#8b98a5', accent: '#f0a830', rust: '#b45a32', hazard: '#e8c832',
  enemy: '#d8544a', ally: '#7fb069',
};

export function shade(name) {
  return PALETTE[name];
}
