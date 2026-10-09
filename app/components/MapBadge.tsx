import { Building2, Factory, Landmark, Map, Mountain, Trees, Waves } from 'lucide-react';

const themes = {
  mirage: { icon: Landmark, tone: 'sand', label: 'Mirage' },
  dust2: { icon: Mountain, tone: 'sand', label: 'Dust2' },
  ancient: { icon: Trees, tone: 'forest', label: 'Ancient' },
  anubis: { icon: Waves, tone: 'teal', label: 'Anubis' },
  nuke: { icon: Factory, tone: 'steel', label: 'Nuke' },
  train: { icon: Factory, tone: 'copper', label: 'Train' },
  inferno: { icon: Landmark, tone: 'copper', label: 'Inferno' },
  vertigo: { icon: Building2, tone: 'steel', label: 'Vertigo' },
  overpass: { icon: Waves, tone: 'forest', label: 'Overpass' },
  cache: { icon: Factory, tone: 'forest', label: 'Cache' },
};
export default function MapBadge({ map, compact = false }: { map: string | null; compact?: boolean }) {
  const key = (map || '').toLowerCase().replace(/^de_/, '');
  const theme = themes[key as keyof typeof themes] || { icon: Map, tone: 'steel', label: map || 'CS2' };
  const Icon = theme.icon;
  return <span className={`map-badge map-${theme.tone} ${compact ? 'map-compact' : ''}`}><span className="map-emblem" aria-hidden="true"><Icon size={19}/></span><span>{theme.label}</span></span>;
}
