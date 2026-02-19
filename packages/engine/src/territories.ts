import { TerritoryDefinition } from './types';

// Classic Risk board — 42 territories
export const TERRITORIES: TerritoryDefinition[] = [
  // North America (9)
  { id: 'alaska', name: 'Alaska', continent: 'north_america', neighbors: ['northwest_territory', 'alberta', 'kamchatka'], x: 60, y: 80 },
  { id: 'northwest_territory', name: 'Northwest Territory', continent: 'north_america', neighbors: ['alaska', 'alberta', 'ontario', 'greenland'], x: 140, y: 80 },
  { id: 'greenland', name: 'Greenland', continent: 'north_america', neighbors: ['northwest_territory', 'ontario', 'quebec', 'iceland'], x: 300, y: 40 },
  { id: 'alberta', name: 'Alberta', continent: 'north_america', neighbors: ['alaska', 'northwest_territory', 'ontario', 'western_united_states'], x: 130, y: 130 },
  { id: 'ontario', name: 'Ontario', continent: 'north_america', neighbors: ['northwest_territory', 'greenland', 'alberta', 'quebec', 'western_united_states', 'eastern_united_states'], x: 200, y: 130 },
  { id: 'quebec', name: 'Quebec', continent: 'north_america', neighbors: ['greenland', 'ontario', 'eastern_united_states'], x: 270, y: 130 },
  { id: 'western_united_states', name: 'Western United States', continent: 'north_america', neighbors: ['alberta', 'ontario', 'eastern_united_states', 'central_america'], x: 140, y: 190 },
  { id: 'eastern_united_states', name: 'Eastern United States', continent: 'north_america', neighbors: ['ontario', 'quebec', 'western_united_states', 'central_america'], x: 220, y: 190 },
  { id: 'central_america', name: 'Central America', continent: 'north_america', neighbors: ['western_united_states', 'eastern_united_states', 'venezuela'], x: 170, y: 250 },

  // South America (4)
  { id: 'venezuela', name: 'Venezuela', continent: 'south_america', neighbors: ['central_america', 'peru', 'brazil'], x: 220, y: 310 },
  { id: 'peru', name: 'Peru', continent: 'south_america', neighbors: ['venezuela', 'brazil', 'argentina'], x: 210, y: 380 },
  { id: 'brazil', name: 'Brazil', continent: 'south_america', neighbors: ['venezuela', 'peru', 'argentina', 'north_africa'], x: 280, y: 370 },
  { id: 'argentina', name: 'Argentina', continent: 'south_america', neighbors: ['peru', 'brazil'], x: 230, y: 450 },

  // Europe (7)
  { id: 'iceland', name: 'Iceland', continent: 'europe', neighbors: ['greenland', 'great_britain', 'scandinavia'], x: 390, y: 70 },
  { id: 'great_britain', name: 'Great Britain', continent: 'europe', neighbors: ['iceland', 'scandinavia', 'northern_europe', 'western_europe'], x: 390, y: 140 },
  { id: 'scandinavia', name: 'Scandinavia', continent: 'europe', neighbors: ['iceland', 'great_britain', 'northern_europe', 'ukraine'], x: 460, y: 90 },
  { id: 'northern_europe', name: 'Northern Europe', continent: 'europe', neighbors: ['great_britain', 'scandinavia', 'western_europe', 'southern_europe', 'ukraine'], x: 450, y: 160 },
  { id: 'western_europe', name: 'Western Europe', continent: 'europe', neighbors: ['great_britain', 'northern_europe', 'southern_europe', 'north_africa'], x: 410, y: 210 },
  { id: 'southern_europe', name: 'Southern Europe', continent: 'europe', neighbors: ['northern_europe', 'western_europe', 'ukraine', 'middle_east', 'egypt', 'north_africa'], x: 460, y: 210 },
  { id: 'ukraine', name: 'Ukraine', continent: 'europe', neighbors: ['scandinavia', 'northern_europe', 'southern_europe', 'ural', 'afghanistan', 'middle_east'], x: 520, y: 150 },

  // Africa (6)
  { id: 'north_africa', name: 'North Africa', continent: 'africa', neighbors: ['brazil', 'western_europe', 'southern_europe', 'egypt', 'east_africa', 'central_africa'], x: 430, y: 300 },
  { id: 'egypt', name: 'Egypt', continent: 'africa', neighbors: ['southern_europe', 'north_africa', 'middle_east', 'east_africa'], x: 500, y: 280 },
  { id: 'central_africa', name: 'Central Africa', continent: 'africa', neighbors: ['north_africa', 'east_africa', 'south_africa'], x: 480, y: 370 },
  { id: 'east_africa', name: 'East Africa', continent: 'africa', neighbors: ['north_africa', 'egypt', 'middle_east', 'central_africa', 'south_africa', 'madagascar'], x: 530, y: 340 },
  { id: 'south_africa', name: 'South Africa', continent: 'africa', neighbors: ['central_africa', 'east_africa', 'madagascar'], x: 490, y: 430 },
  { id: 'madagascar', name: 'Madagascar', continent: 'africa', neighbors: ['east_africa', 'south_africa'], x: 570, y: 420 },

  // Asia (12)
  { id: 'ural', name: 'Ural', continent: 'asia', neighbors: ['ukraine', 'siberia', 'afghanistan', 'china'], x: 600, y: 120 },
  { id: 'siberia', name: 'Siberia', continent: 'asia', neighbors: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'], x: 660, y: 100 },
  { id: 'yakutsk', name: 'Yakutsk', continent: 'asia', neighbors: ['siberia', 'kamchatka', 'irkutsk'], x: 730, y: 80 },
  { id: 'kamchatka', name: 'Kamchatka', continent: 'asia', neighbors: ['yakutsk', 'irkutsk', 'mongolia', 'japan', 'alaska'], x: 800, y: 90 },
  { id: 'irkutsk', name: 'Irkutsk', continent: 'asia', neighbors: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'], x: 720, y: 140 },
  { id: 'mongolia', name: 'Mongolia', continent: 'asia', neighbors: ['siberia', 'kamchatka', 'irkutsk', 'china', 'japan'], x: 740, y: 190 },
  { id: 'japan', name: 'Japan', continent: 'asia', neighbors: ['kamchatka', 'mongolia'], x: 820, y: 180 },
  { id: 'afghanistan', name: 'Afghanistan', continent: 'asia', neighbors: ['ukraine', 'ural', 'china', 'india', 'middle_east'], x: 600, y: 200 },
  { id: 'china', name: 'China', continent: 'asia', neighbors: ['ural', 'siberia', 'mongolia', 'afghanistan', 'india', 'siam'], x: 680, y: 230 },
  { id: 'middle_east', name: 'Middle East', continent: 'asia', neighbors: ['ukraine', 'southern_europe', 'egypt', 'east_africa', 'afghanistan', 'india'], x: 560, y: 260 },
  { id: 'india', name: 'India', continent: 'asia', neighbors: ['afghanistan', 'china', 'middle_east', 'siam'], x: 640, y: 290 },
  { id: 'siam', name: 'Siam', continent: 'asia', neighbors: ['china', 'india', 'indonesia'], x: 710, y: 300 },

  // Australia (4)
  { id: 'indonesia', name: 'Indonesia', continent: 'australia', neighbors: ['siam', 'new_guinea', 'western_australia'], x: 730, y: 380 },
  { id: 'new_guinea', name: 'New Guinea', continent: 'australia', neighbors: ['indonesia', 'western_australia', 'eastern_australia'], x: 790, y: 370 },
  { id: 'western_australia', name: 'Western Australia', continent: 'australia', neighbors: ['indonesia', 'new_guinea', 'eastern_australia'], x: 760, y: 440 },
  { id: 'eastern_australia', name: 'Eastern Australia', continent: 'australia', neighbors: ['new_guinea', 'western_australia'], x: 820, y: 440 },
];

export const TERRITORY_MAP: Record<string, TerritoryDefinition> = Object.fromEntries(
  TERRITORIES.map(t => [t.id, t])
);

export const CONTINENT_BONUSES: Record<string, number> = {
  north_america: 5,
  south_america: 2,
  europe: 5,
  africa: 3,
  asia: 7,
  australia: 2,
};

export const CONTINENT_TERRITORIES: Record<string, string[]> = TERRITORIES.reduce(
  (acc, t) => {
    if (!acc[t.continent]) acc[t.continent] = [];
    acc[t.continent].push(t.id);
    return acc;
  },
  {} as Record<string, string[]>
);

export function areNeighbors(a: TerritoryId, b: TerritoryId): boolean {
  const def = TERRITORY_MAP[a];
  return def ? def.neighbors.includes(b) : false;
}

export function getContinent(territoryId: TerritoryId): string {
  return TERRITORY_MAP[territoryId]?.continent ?? '';
}
