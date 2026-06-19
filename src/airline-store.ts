import { createMockFlight, createSearchSummary, generatePnr } from "./mock/flights";
import type {
  BookingRecord,
  StoreAction,
  StoreResult,
  StoreState,
  StoredOffer,
} from "./types";

const EMPTY: StoreState = { offers: {}, bookings: {} };

function nowIso(): string {
  return new Date().toISOString().slice(0, 19);
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

function findBooking(state: StoreState, bookingId?: string, confirmationNumber?: string) {
  if (bookingId && state.bookings[bookingId]) return state.bookings[bookingId];
  if (confirmationNumber && state.bookings[confirmationNumber]) return state.bookings[confirmationNumber];
  return undefined;
}

function lastNameMatch(stored: string, provided: string): boolean {
  return (
    stored.toLowerCase() === provided.toLowerCase() ||
    provided.toLowerCase().startsWith(stored.toLowerCase())
  );
}

function calcCancellationFee(hours: number, reason: string, total: number): number {
  if (reason === "SCHEDULE_CHANGE") return 0;
  if (reason === "EMERGENCY") return total * 0.1;
  if (hours > 72) return total * 0.15;
  if (hours > 24) return total * 0.3;
  return total * 0.5;
}

function calcChangeFee(hours: number, reason: string): number {
  if (reason === "SCHEDULE_CHANGE") return 0;
  if (reason === "EMERGENCY") return 50;
  if (hours > 72) return 75;
  if (hours > 24) return 150;
  return 250;
}

export function runAction(state: StoreState, action: StoreAction): StoreResult {
  switch (action.op) {
    case "airshopping":
      return airShopping(state, action);
    case "offerprice":
      return offerPrice(state, action);
    case "ordercreate":
      return orderCreate(state, action);
    case "orderchange_payment":
      return orderChangePayment(state, action);
    case "orderretrieve":
      return orderRetrieve(state, action);
    case "ordercancel":
      return orderCancel(state, action);
    case "orderchange_flight":
      return orderChangeFlight(state, action);
    case "servicelist":
      return serviceList(state, action);
    case "orderchange_baggage":
      return orderChangeBaggage(state, action);
    default:
      return { error: "unknown op" };
  }
}

function airShopping(
  state: StoreState,
  action: Extract<StoreAction, { op: "airshopping" }>,
): StoreResult {
  const flights = Array.from({ length: 10 }, () =>
    createMockFlight(action.from, action.to, action.departureDate),
  );
  const offers: StoredOffer[] = flights.map((flight) => {
    const offerId = flight.flightId;
    const stored: StoredOffer = { offerId, flight };
    state.offers[offerId] = stored;
    return stored;
  });
  const summary = createSearchSummary(flights, action.departureDate);
  return { offers, summary };
}

function offerPrice(
  state: StoreState,
  action: Extract<StoreAction, { op: "offerprice" }>,
): StoreResult {
  const offer = state.offers[action.offerId];
  if (!offer) return { error: "Offer not found", code: "OFFER_NOT_FOUND" };
  const fare = offer.flight.fareOptions.find((f) => f.fareId === action.offerItemId);
  if (!fare) return { error: "Offer item not found", code: "OFFER_ITEM_NOT_FOUND" };
  offer.pricedAt = nowIso();
  return { offer, pricedOfferItemId: fare.fareId, totalAmount: fare.price, currency: fare.currency };
}

function orderCreate(
  state: StoreState,
  action: Extract<StoreAction, { op: "ordercreate" }>,
): StoreResult {
  const offer = state.offers[action.offerId];
  if (!offer) return { error: "Offer not found" };
  const fare = offer.flight.fareOptions.find((f) => f.fareId === action.offerItemId);
  const bookingId = `BK${Date.now()}`;
  const confirmationNumber = generatePnr();
  const passengers = action.passengers.map((p, i) => ({
    passengerId: `P${Date.now()}${i}`,
    passengerType: p.passengerType,
    firstName: p.firstName.slice(0, 10),
    lastName: p.lastName.slice(0, 10),
    documentType: p.documentType,
    documentNumber: p.documentNumber,
    seatNumber: `${1 + (i % 30)}${String.fromCharCode(65 + (i % 6))}`,
    mealPreference: "Standard",
  }));
  const booking: BookingRecord = {
    bookingId,
    status: "CONFIRMED",
    confirmationNumber,
    bookingDate: nowIso(),
    flightInfo: {
      flightId: offer.flight.flightId,
      flightNumber: offer.flight.flightNumber,
      departureAirport: offer.flight.departureAirport,
      departureCity: offer.flight.departureCity,
      departureTime: offer.flight.departureTime,
      arrivalAirport: offer.flight.arrivalAirport,
      arrivalCity: offer.flight.arrivalCity,
      arrivalTime: offer.flight.arrivalTime,
      cabinClass: fare?.cabinClass ?? "ECONOMY",
    },
    passengers,
    paymentInfo: {
      paymentId: "PENDING",
      amount: fare?.price ?? 0,
      currency: fare?.currency ?? "USD",
      paymentMethod: "PENDING",
      paymentStatus: "PENDING",
      paymentDate: nowIso(),
    },
  };
  state.bookings[bookingId] = booking;
  state.bookings[confirmationNumber] = booking;
  return { booking };
}

function orderChangePayment(
  state: StoreState,
  action: Extract<StoreAction, { op: "orderchange_payment" }>,
): StoreResult {
  const booking = state.bookings[action.bookingId];
  if (!booking) return { error: "Booking not found" };
  const paymentId = `PAY${Date.now()}`;
  booking.paymentInfo = {
    ...booking.paymentInfo,
    paymentId,
    paymentStatus: "PAID",
    paymentMethod: action.paymentMethod,
    paymentDate: nowIso(),
    amount: action.amount,
    currency: action.currency,
  };
  return {
    paymentId,
    status: "SUCCESS",
    bookingId: booking.bookingId,
    amount: action.amount,
    currency: action.currency,
    paymentMethod: action.paymentMethod,
    paymentDate: nowIso(),
    transactionId: `TXN${Date.now()}`,
    message: "Payment processed successfully",
  };
}

function orderRetrieve(
  state: StoreState,
  action: Extract<StoreAction, { op: "orderretrieve" }>,
): StoreResult {
  const booking = state.bookings[action.confirmationNumber];
  if (!booking) return { error: "Booking not found" };
  const storedLast = booking.passengers[0]?.lastName ?? "";
  if (!lastNameMatch(storedLast, action.passengerLastName)) {
    return { error: "Passenger last name does not match" };
  }
  return { booking };
}

function orderCancel(
  state: StoreState,
  action: Extract<StoreAction, { op: "ordercancel" }>,
): StoreResult {
  const booking = findBooking(state, action.bookingId, action.confirmationNumber);
  if (!booking) {
    return { status: "FAILED", failureReason: "Booking not found", message: "Unable to find booking" };
  }
  const storedLast = booking.passengers[0]?.lastName ?? "";
  if (!lastNameMatch(storedLast, action.passengerLastName)) {
    return { status: "FAILED", failureReason: "Passenger name mismatch", message: "Passenger last name does not match" };
  }
  if (booking.status === "CANCELLED") {
    return { status: "FAILED", failureReason: "Already cancelled", message: "Already cancelled" };
  }
  if (booking.paymentInfo.paymentStatus !== "PAID") {
    return { status: "FAILED", failureReason: "Payment not completed", message: "Not paid yet" };
  }
  const hrs = hoursUntil(booking.flightInfo.departureTime);
  if (hrs < 0) {
    return { status: "FAILED", failureReason: "Flight already departed", message: "Flight departed" };
  }
  if (hrs < 2) {
    return { status: "FAILED", failureReason: "Too close to departure", message: "Within 2 hours" };
  }
  const cn = action.confirmationNumber ?? booking.confirmationNumber;
  if (cn.startsWith("NO")) {
    return { status: "FAILED", failureReason: "Non-refundable fare", message: "Non-refundable" };
  }
  const total = booking.paymentInfo.amount;
  const fee = calcCancellationFee(hrs, action.refundReason, total);
  booking.status = "CANCELLED";
  return {
    status: "SUCCESS",
    refundId: `RF${Date.now()}`,
    bookingId: booking.bookingId,
    confirmationNumber: booking.confirmationNumber,
    refundAmount: total,
    currency: booking.paymentInfo.currency,
    cancellationFee: fee,
    netRefundAmount: total - fee,
    refundMethod: "ORIGINAL_PAYMENT",
    refundDate: nowIso(),
    estimatedRefundDays: 7,
    message: "Refund processed successfully",
  };
}

function orderChangeFlight(
  state: StoreState,
  action: Extract<StoreAction, { op: "orderchange_flight" }>,
): StoreResult {
  const original = findBooking(state, action.originalBookingId, action.confirmationNumber);
  if (!original) {
    return { status: "FAILED", failureReason: "Booking not found", message: "Unable to find booking" };
  }
  const storedLast = original.passengers[0]?.lastName ?? "";
  if (!lastNameMatch(storedLast, action.passengerLastName)) {
    return { status: "FAILED", failureReason: "Passenger name mismatch", message: "Name mismatch" };
  }
  const hrs = hoursUntil(original.flightInfo.departureTime);
  if (hrs < 0) {
    return { status: "FAILED", failureReason: "Flight already departed", message: "Departed" };
  }
  if (hrs < 4) {
    return { status: "FAILED", failureReason: "Too close to departure", message: "Within 4 hours" };
  }
  if (action.newOfferId.includes("FULL")) {
    return { status: "FAILED", failureReason: "Flight fully booked", message: "Fully booked" };
  }
  const newOffer = state.offers[action.newOfferId];
  if (!newOffer) {
    return { status: "FAILED", failureReason: "New flight not found", message: "Search again" };
  }
  const newFare = newOffer.flight.fareOptions.find((f) => f.fareId === action.newOfferItemId);
  if (!newFare) {
    return { status: "FAILED", failureReason: "New fare not found", message: "Fare unavailable" };
  }
  const changeFee = calcChangeFee(hrs, action.changeReason);
  const priceDiff = newFare.price - original.paymentInfo.amount;
  const totalAdditional = changeFee + Math.max(0, priceDiff);
  const newBookingId = `BK${Date.now()}CHG`;
  const newConfirmation = generatePnr();
  original.status = "CHANGED";
  const newBooking: BookingRecord = {
    bookingId: newBookingId,
    status: "CONFIRMED",
    confirmationNumber: newConfirmation,
    bookingDate: nowIso(),
    flightInfo: {
      flightId: newOffer.flight.flightId,
      flightNumber: newOffer.flight.flightNumber,
      departureAirport: newOffer.flight.departureAirport,
      departureCity: newOffer.flight.departureCity,
      departureTime: newOffer.flight.departureTime,
      arrivalAirport: newOffer.flight.arrivalAirport,
      arrivalCity: newOffer.flight.arrivalCity,
      arrivalTime: newOffer.flight.arrivalTime,
      cabinClass: newFare.cabinClass,
    },
    passengers: original.passengers,
    paymentInfo: {
      paymentId: `PAY${Date.now()}`,
      amount: newFare.price,
      currency: newFare.currency,
      paymentMethod: "CREDIT_CARD",
      paymentStatus: "PAID",
      paymentDate: nowIso(),
    },
  };
  state.bookings[newBookingId] = newBooking;
  state.bookings[newConfirmation] = newBooking;
  return {
    status: "SUCCESS",
    changeId: `CH${Date.now()}`,
    originalBookingId: original.bookingId,
    newBookingId,
    newConfirmationNumber: newConfirmation,
    originalFlight: original.flightInfo,
    newFlight: newBooking.flightInfo,
    originalPrice: original.paymentInfo.amount,
    newPrice: newFare.price,
    changeFee,
    priceDifference: priceDiff,
    totalAdditionalPayment: totalAdditional,
    currency: original.paymentInfo.currency,
    changeDate: nowIso(),
    message: "Flight change successful",
  };
}

function serviceList(
  state: StoreState,
  action: Extract<StoreAction, { op: "servicelist" }>,
): StoreResult {
  const booking = findBooking(state, action.bookingId, action.confirmationNumber);
  if (!booking) return { error: "Booking not found" };
  return {
    services: [
      { serviceId: "SVC-CHECKED", name: "Checked baggage", type: "CHECKED", unitPrice: 35 },
      { serviceId: "SVC-OVERWEIGHT", name: "Overweight baggage", type: "OVERWEIGHT", unitPrice: 75 },
      { serviceId: "SVC-OVERSIZED", name: "Oversized baggage", type: "OVERSIZED", unitPrice: 100 },
      { serviceId: "SVC-SPORTS", name: "Sports equipment", type: "SPORTS_EQUIPMENT", unitPrice: 150 },
    ],
  };
}

function orderChangeBaggage(
  state: StoreState,
  action: Extract<StoreAction, { op: "orderchange_baggage" }>,
): StoreResult {
  const booking = findBooking(state, action.bookingId, action.confirmationNumber);
  if (!booking) {
    return { status: "FAILED", failureReason: "Booking not found", message: "Booking not found" };
  }
  const storedLast = booking.passengers[0]?.lastName ?? "";
  if (!lastNameMatch(storedLast, action.passengerLastName)) {
    return { status: "FAILED", failureReason: "Passenger name mismatch", message: "Name mismatch" };
  }
  if (!booking.passengers.some((p) => p.passengerId === action.passengerId)) {
    return { status: "FAILED", failureReason: "Passenger not found", message: "Passenger not found" };
  }
  if (action.additionalBags > 5) {
    return { status: "FAILED", failureReason: "Exceeds maximum limit", message: "Max 5 bags" };
  }
  const prices: Record<string, number> = {
    CHECKED: 35,
    OVERWEIGHT: 75,
    OVERSIZED: 100,
    SPORTS_EQUIPMENT: 150,
  };
  const unit = prices[action.baggageType] ?? 35;
  const total = unit * action.additionalBags;
  if (total > 500) {
    return { status: "FAILED", failureReason: "Payment processing failed", message: "Over $500" };
  }
  const items = Array.from({ length: action.additionalBags }, (_, i) => ({
    itemId: `BAG${Date.now()}${i}`,
    baggageType: action.baggageType,
    unitPrice: unit,
    quantity: 1,
    totalPrice: unit,
    description: "Additional baggage",
  }));
  return {
    status: "SUCCESS",
    baggageOrderId: `BO${Date.now()}`,
    bookingId: booking.bookingId,
    confirmationNumber: booking.confirmationNumber,
    passengerId: action.passengerId,
    baggageItems: items,
    totalAmount: total,
    currency: "USD",
    purchaseDate: nowIso(),
    paymentStatus: "PAID",
    message: "Baggage purchase successful",
  };
}

export class AirlineStore implements DurableObject {
  private state: StoreState = { ...EMPTY };

  constructor(private ctx: DurableObjectState) {
    void this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get<StoreState>("state");
      if (saved) this.state = saved;
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("state", this.state);
  }

  async fetch(request: Request): Promise<Response> {
    const action = (await request.json()) as StoreAction;
    const result = runAction(this.state, action);
    await this.persist();
    return Response.json(result);
  }
}

export { EMPTY as emptyState };
