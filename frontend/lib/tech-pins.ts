/** Downtown Austin tech offices — coordinates from OSM / public records. */
export type TechPin = {
  name: string;
  address: string;
  lat: number;
  lon: number;
  color: string;
};

export const DOWNTOWN_TECH_PINS: TechPin[] = [
  {
    name: "Google",
    address: "601 W 2nd St (Sail Tower)",
    lat: 30.265617,
    lon: -97.750409,
    color: "#4285f4",
  },
  {
    name: "Meta",
    address: "400 W 6th St (Sixth & Guadalupe)",
    lat: 30.269654,
    lon: -97.746655,
    color: "#0668e1",
  },
  {
    name: "Indeed",
    address: "200 W 6th St (Indeed Tower)",
    lat: 30.269008,
    lon: -97.74426,
    color: "#2164f3",
  },
  {
    name: "Oracle",
    address: "2300 Oracle Way (Waterfront)",
    lat: 30.24324,
    lon: -97.72155,
    color: "#c74634",
  },
];
