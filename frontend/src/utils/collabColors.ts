/**
 * Google Docs-style collaboration color palette.
 * Each color is distinct and readable as a cursor/selection highlight.
 */
export const COLLAB_COLORS = [
  { name: 'Blue',    color: '#4285F4', light: 'rgba(66,133,244,0.15)' },
  { name: 'Red',     color: '#EA4335', light: 'rgba(234,67,53,0.15)' },
  { name: 'Green',   color: '#34A853', light: 'rgba(52,168,83,0.15)' },
  { name: 'Purple',  color: '#A142F4', light: 'rgba(161,66,244,0.15)' },
  { name: 'Orange',  color: '#FA7B17', light: 'rgba(250,123,23,0.15)' },
  { name: 'Teal',    color: '#24C1E0', light: 'rgba(36,193,224,0.15)' },
  { name: 'Pink',    color: '#F538A0', light: 'rgba(245,56,160,0.15)' },
  { name: 'Brown',   color: '#795548', light: 'rgba(121,85,72,0.15)' },
  { name: 'Indigo',  color: '#3F51B5', light: 'rgba(63,81,181,0.15)' },
  { name: 'Lime',    color: '#7CB342', light: 'rgba(124,179,66,0.15)' },
];

/**
 * Deterministic color assignment based on username.
 * Same name always gets the same color.
 */
export function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit int
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length].color;
}

/**
 * Get initials from a name (up to 2 characters).
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}
