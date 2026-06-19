import type { FareOption, FlightOption, SearchSummary } from "./types";

const AIRLINES = [
  { name: "British Airways", code: "BA" },
  { name: "Lufthansa", code: "LH" },
  { name: "Air France", code: "AF" },
  { name: "KLM", code: "KL" },
  { name: "Swiss", code: "LX" },
  { name: "Austrian Airlines", code: "OS" },
  { name: "SAS", code: "SK" },
  { name: "Finnair", code: "AY" },
  { name: "Iberia", code: "IB" },
  { name: "TAP Portugal", code: "TP" },
];

const AIRPORT_CITIES: Record<string, string> = {
  LHR: "London",
  CDG: "Paris",
  FRA: "Frankfurt",
  AMS: "Amsterdam",
  MAD: "Madrid",
  BCN: "Barcelona",
  FCO: "Rome",
  MXP: "Milan",
  ZRH: "Zurich",
  VIE: "Vienna",
  CPH: "Copenhagen",
  ARN: "Stockholm",
  OSL: "Oslo",
  HEL: "Helsinki",
  WAW: "Warsaw",
  PRG: "Prague",
  BUD: "Budapest",
  ATH: "Athens",
  IST: "Istanbul",
  SFO: "San Francisco",
  LAX: "Los Angeles",
  SEA: "Seattle",
  LAS: "Las Vegas",
  JFK: "New York",
  MIA: "Miami",
};

function randInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function cityName(code: string): string {
  return AIRPORT_CITIES[code] ?? code;
}

function generatePnr(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pnr = "";
  for (let i = 0; i < 6; i++) pnr += chars[randInt(chars.length)];
  return pnr;
}

function createFareOptions(airlineName: string, basePrice: number): FareOption[] {
  const brands = ["Basic", "Standard", "Flex", "Premium"];
  const descriptions = [
    "Basic fare, non-refundable and non-changeable",
    "Standard fare, partial refund and change",
    "Flexible fare, free refund and change",
    "Premium fare, full service",
  ];
  return brands.map((brand, i) => ({
    fareId: `FARE${Date.now()}${i}${randInt(1000)}`,
    providerName: airlineName,
    cabinClass: "ECONOMY",
    price: Math.round((basePrice * (100 + i * 25)) / 100),
    currency: "USD",
    rating: 5,
    reviewCount: 200 + randInt(800),
    isRecommended: i === 2,
    paymentOption: null,
    fareBrand: brand,
    description: descriptions[i],
    baggageInfo: {
      cabinBags: 1,
      checkedBags: i === 0 ? 0 : i === 1 ? 1 : 2,
      cabinBagIncluded: true,
      checkedBagIncluded: i > 0,
    },
  }));
}

export function createMockFlight(from: string, to: string, departureDate: string): FlightOption {
  const airline = AIRLINES[randInt(AIRLINES.length)];
  const hour = randInt(24);
  const minute = randInt(60);
  const dep = `${departureDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const duration = 85 + randInt(30);
  const depMs = new Date(dep).getTime();
  const arr = new Date(depMs + duration * 60_000).toISOString().slice(0, 19);

  return {
    flightId: `FL${Date.now()}${randInt(1000)}`,
    airlineCode: airline.code,
    airlineName: airline.name,
    flightNumber: `${airline.code}${100 + randInt(900)}`,
    departureAirport: from,
    departureCity: cityName(from),
    departureTime: dep,
    arrivalAirport: to,
    arrivalCity: cityName(to),
    arrivalTime: arr,
    durationMinutes: duration,
    flightType: "DIRECT",
    hasWifi: true,
    hasPowerOutlet: true,
    co2Emission: "7% less CO2e than typical",
    fareOptions: createFareOptions(airline.name, 750 + randInt(100)),
  };
}

export function createSearchSummary(flights: FlightOption[], departureDate: string): SearchSummary {
  const prices = flights.flatMap((f) => f.fareOptions.map((fo) => fo.price));
  const datePrices = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(departureDate);
    d.setDate(d.getDate() + i);
    return {
      date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      minPrice: 795 + i * 5 + randInt(10),
      selected: i === 0,
    };
  });
  return {
    totalResults: flights.length,
    sortBy: "Best",
    lowestPrice: prices.length ? Math.min(...prices) : 0,
    highestPrice: prices.length ? Math.max(...prices) : 0,
    datePrices,
  };
}

export { generatePnr, cityName };
