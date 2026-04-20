# Transport: Flights, Trains & Cars

Log flights, trains, car rentals, and cruises with departure and arrival endpoints, times, and transit-specific details.

## Where to create

Open the **Transports** tab in the trip planner and click **Add**, or open the planner from a day view and use the transport shortcut. Transport records appear in the [Reservations](Reservations-and-Bookings) panel alongside other bookings.

## Transport types

Four types are available: **Flight**, **Train**, **Car**, **Cruise**.

## Common fields

All transport types share these fields:

| Field | Notes |
|-------|-------|
| Title | Required |
| Departure day | Linked to a trip day |
| Departure time | Optional |
| Arrival day | Linked to a trip day (can differ from departure day) |
| Arrival time | Optional |
| Booking / confirmation code | Optional |
| Status | Pending or Confirmed |
| Notes | Optional free text |

## Endpoints

### Flights

The departure and arrival fields use the **Airport picker** — type a city name or IATA code (minimum two characters) to search. Results show the IATA code, airport name, city, and country.

Once you select an airport, the **timezone** for that airport appears next to the time field. This lets you enter local departure and arrival times without confusion across time zones.

<!-- TODO: screenshot: Transport modal for a flight with airport picker and timezone -->

### Trains, cars, and cruises

Departure and arrival fields use the **generic location picker** — search by place name or enter a free-text location. Results come from the maps search service.

For **car rentals**, the departure field is labelled **Pickup date/time** and the arrival field is labelled **Return date/time**.

## Flight-specific fields

When the type is set to Flight, two additional fields appear:

- **Airline** — carrier name (e.g. Lufthansa)
- **Flight number** — (e.g. LH 123)

## Train-specific fields

When the type is set to Train, three additional fields appear:

- **Train number** — (e.g. ICE 123)
- **Platform** — platform or track number
- **Seat** — seat or coach assignment

## On the map

Transport records with both endpoints set appear as lines on the trip map:

- **Flights** and **cruises** render as geodesic great-circle curves that follow the curvature of the Earth.
- **Trains** and **cars** render as straight polylines between the two endpoints.

Confirmed bookings are drawn as solid lines; pending bookings use a dashed line. Endpoint markers are shown at each location. For flights, a midpoint label appears along the arc showing the route codes (e.g. ZRH → JFK) and flight duration and distance when enough screen space is available.

See [Map-Features](Map-Features) for details on how these overlays work.

## In the day plan

When a transport is assigned to a day, it appears inline in the day timeline between places. Multi-day transports show phase labels depending on the type:

| Type | Start day | Middle days | End day |
|------|-----------|-------------|---------|
| Flight | Departure | In transit | Arrival |
| Car rental | Pickup | Active | Return |
| Train / Cruise | Start | Ongoing | End |

See [Day-Plans-and-Notes](Day-Plans-and-Notes) for details.

---

**See also:** [Reservations-and-Bookings](Reservations-and-Bookings) · [Accommodations](Accommodations) · [Map-Features](Map-Features) · [Day-Plans-and-Notes](Day-Plans-and-Notes)
