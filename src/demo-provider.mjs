// Explicit fictional navigation sample. Never selected as a live-provider fallback.
const places = [
  {
    id: "romsey",
    name: "Romsey",
    locality: "Hampshire",
    label: "Romsey, Hampshire",
    coordinates: [-1.499, 50.989],
  },
  {
    id: "abbey",
    name: "Romsey Abbey",
    locality: "Romsey, Hampshire",
    label: "Romsey Abbey, Church Lane, Romsey, Hampshire",
    coordinates: [-1.4999, 50.9896],
  },
  {
    id: "station",
    name: "Romsey Railway Station",
    locality: "Romsey, Hampshire",
    label: "Romsey Railway Station, Station Approach, Romsey, Hampshire",
    coordinates: [-1.493, 50.993],
  },
  {
    id: "belfast",
    name: "Belfast City Hall",
    locality: "Belfast",
    label: "Belfast City Hall, Donegall Square, Belfast",
    coordinates: [-5.93, 54.597],
  },
  {
    id: "london",
    name: "London Waterloo",
    locality: "London",
    label: "Waterloo Station, London",
    coordinates: [-0.113, 51.503],
  },
];
export function createDemoProvider() {
  return {
    async search(text) {
      const q = text.trim().toLowerCase();
      if (q.includes("romsey")) return structuredClone(places.slice(0, 3));
      return structuredClone(
        places
          .filter((p) => (p.name + " " + p.locality).toLowerCase().includes(q))
          .slice(0, 3),
      );
    },
    async route() {
      return {
        routes: [
          {
            segments: [
              {
                steps: [
                  {
                    type: 11,
                    duration: 300,
                    instruction: "Head north on Church Lane",
                    name: "Church Lane",
                  },
                  {
                    type: 7,
                    duration: 90,
                    instruction:
                      "Take the third exit onto Albany Wissey Biddlibong Way",
                    name: "Albany Wissey Biddlibong Way",
                    exit_number: 3,
                  },
                  {
                    type: 0,
                    duration: 45,
                    instruction: "Turn left onto Market Place",
                    name: "Market Place",
                  },
                  {
                    type: 6,
                    duration: 120,
                    instruction: "Continue straight on The Hundred",
                    name: "The Hundred",
                  },
                  {
                    type: 5,
                    duration: 60,
                    instruction: "Bear right onto Station Approach",
                    name: "Station Approach",
                  },
                  {
                    type: 10,
                    duration: 0,
                    instruction: "Arrive at your destination",
                    name: "",
                  },
                ],
              },
            ],
          },
        ],
      };
    },
  };
}
