// "Trending now" destinations shown on the globe. This is a hand-curated list, NOT live analytics.
// Photos live in /public/img/places (Wikimedia Commons, CC licences; see /credits.html).
export const PLACES = [
  // --- India (6)
  { id: 'shillong', name: 'Shillong', country: 'India', region: 'india', lat: 25.57, lon: 91.88, tag: 'Meghalaya hills, waterfalls, cafés', img: 'shillong', prompt: '4 days in Shillong, Meghalaya: waterfalls, living root bridges and cosy cafés, mid budget' },
  { id: 'darjeeling', name: 'Darjeeling', country: 'India', region: 'india', lat: 27.04, lon: 88.26, tag: 'Tea gardens and Kanchenjunga', img: 'darjeeling', prompt: '3 days in Darjeeling: tea gardens, the toy train and a Kanchenjunga sunrise, budget-friendly' },
  { id: 'jaipur', name: 'Jaipur', country: 'India', region: 'india', lat: 26.91, lon: 75.79, tag: 'Forts, bazaars, Rajasthani food', img: 'jaipur', prompt: '3 days in Jaipur: forts, bazaars and Rajasthani food, mid budget' },
  { id: 'goa', name: 'Goa', country: 'India', region: 'india', lat: 15.3, lon: 74.12, tag: 'Quiet beaches, seafood shacks', img: 'goa', prompt: '4 days in South Goa: quiet beaches, seafood shacks and old Portuguese quarters, relaxed pace' },
  { id: 'leh', name: 'Leh-Ladakh', country: 'India', region: 'india', lat: 34.15, lon: 77.58, tag: 'Pangong Lake, monasteries', img: 'leh', prompt: '6 days in Leh-Ladakh: Pangong Lake and monasteries, acclimatise slowly, mid budget' },
  { id: 'munnar', name: 'Munnar', country: 'India', region: 'india', lat: 10.09, lon: 77.06, tag: 'Tea estates, misty viewpoints', img: 'munnar', prompt: '3 days in Munnar, Kerala: tea estates and misty viewpoints, slow mornings' },
  // --- Abroad (7)
  { id: 'kyoto', name: 'Kyoto', country: 'Japan', region: 'world', lat: 35.01, lon: 135.77, tag: 'Torii gates, temples, food', img: 'kyoto', prompt: 'A cosy 4-day food trip to Kyoto in spring, mid budget' },
  { id: 'lisbon', name: 'Lisbon', country: 'Portugal', region: 'world', lat: 38.72, lon: -9.14, tag: 'Trams, tiles, custard tarts', img: 'lisbon', prompt: '3 days in Lisbon with a toddler, slow mornings' },
  { id: 'bali', name: 'Bali', country: 'Indonesia', region: 'world', lat: -8.41, lon: 115.19, tag: 'Rice terraces, temples, surf', img: 'bali', prompt: '5 days in Bali: rice terraces, temples and a beach day, mid budget' },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', region: 'world', lat: 13.75, lon: 100.5, tag: 'Temples, street food, markets', img: 'bangkok', prompt: 'Budget-friendly 4 days in Bangkok: temples, street food and night markets' },
  { id: 'dubai', name: 'Dubai', country: 'UAE', region: 'world', lat: 25.2, lon: 55.27, tag: 'Skyline, desert, souks', img: 'dubai', prompt: '4 days in Dubai: skyline views, a desert evening and the old souks, mid budget' },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', region: 'world', lat: 1.35, lon: 103.82, tag: 'Gardens, hawker food, bay', img: 'singapore', prompt: '3 days in Singapore: gardens, hawker centres and the bay at night, mid budget' },
  { id: 'santorini', name: 'Santorini', country: 'Greece', region: 'world', lat: 36.39, lon: 25.46, tag: 'Blue domes, caldera sunsets', img: 'santorini', prompt: '4 days in Santorini: caldera views, blue-domed Oia and a sunset dinner, splurge a little' },
];

export const photo = (p) => `/img/places/${p.img}.jpg`;
export const COUNTS = {
  india: PLACES.filter((p) => p.region === 'india').length,
  world: PLACES.filter((p) => p.region === 'world').length,
};
