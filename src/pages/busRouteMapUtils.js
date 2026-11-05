export const point = (item) => ({ lat: Number(item.latitude), lng: Number(item.longitude) });
export const distance = (a, b) => {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export const uniqueStops = (stops) => {
  const grouped = new Map();
  stops.forEach((stop) => {
    const key = `${Number(stop.latitude).toFixed(6)},${Number(stop.longitude).toFixed(6)}`;
    if (!grouped.has(key)) grouped.set(key, { ...stop, key, passengers: 0, studentCount: 0, people: [], passengerTypes: new Set(), personIds: [] });
    const item = grouped.get(key);
    if (item.people.some(person => person.person_type === stop.person_type && String(person.person_id) === String(stop.person_id))) return;
    item.people.push({ person_id: stop.person_id, person_type: stop.person_type, name: stop.person_name });
    item.passengers += 1;
    if (stop.person_type === "student") item.studentCount += 1;
    item.passengerTypes.add(stop.person_type);
    item.personIds.push(stop.person_id);
  });
  return [...grouped.values()].map((stop) => ({
    ...stop,
    passengerTypes: [...stop.passengerTypes],
  }));
};


// Build a stable, sensible sequence even though assignments do not currently
// store stop order: nearest-neighbour from school, reversed for pickup.
export const orderStops = (stops, school, tripType) => {
  const remaining = [...uniqueStops(stops)];
  const ordered = [];
  let cursor = point(school);
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i += 1) {
      if (distance(cursor, point(remaining[i])) < distance(cursor, point(remaining[best]))) best = i;
    }
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    cursor = point(next);
  }
  return tripType === "pickup" ? ordered.reverse() : ordered;
};


export const durationLabel = millis => millis == null || !Number.isFinite(millis) ? "Unavailable" : `${Math.round(millis / 60000)} min`;

// GPS proximity is evidence of a visit, not confirmation of boarding/alighting.
export const estimatedNextStop = (ordered, school, location, trail = []) => {
  if (!location || !ordered.length) return null;
  let visited = -1;
  let trailIndex = 0;
  for (let i = 0; i < ordered.length; i += 1) {
    const fromIndex = trailIndex;
    const match = trail.findIndex((sample, index) => index >= fromIndex && distance(point(sample), point(ordered[i])) < 0.15);
    if (match >= 0) { visited = i; trailIndex = match; }
  }
  if (visited >= 0) return ordered[visited + 1] || school;
  // With no visit history, only the nearest candidate can be inferred.
  return ordered.reduce((best, stop) => distance(point(location), point(stop)) < distance(point(location), point(best)) ? stop : best, ordered[0]);
};
