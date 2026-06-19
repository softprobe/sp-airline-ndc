import type { StoreAction } from "./types";

type Json = Record<string, unknown>;

function correlationId(body: Json): string | undefined {
  const attrs = body.PayloadAttributes as Json | undefined;
  return typeof attrs?.CorrelationID === "string" ? attrs.CorrelationID : undefined;
}

function parseAirShopping(body: Json): StoreAction {
  const req = (body.IATA_AirShoppingRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const od = ((request.FlightCriteria as Json)?.OriginDestCriteria ??
    request.OriginDestCriteria) as Json;
  const dep = (od?.OriginDepCriteria ?? od) as Json;
  const arr = (od?.DestArrivalCriteria ?? {}) as Json;
  const from =
    (dep.IATA_LocationCode as string) ??
    (dep.Departure as Json)?.CityCode ??
    (dep as Json).fromCity ??
    "SFO";
  const to =
    (arr.IATA_LocationCode as string) ??
    (arr.Arrival as Json)?.CityCode ??
    (arr as Json).toCity ??
    "LAX";
  const date =
    (dep.Date as string) ??
    (dep.DepartureDate as string) ??
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return { op: "airshopping", from: String(from), to: String(to), departureDate: String(date).slice(0, 10) };
}

function parseOfferPrice(body: Json): StoreAction {
  const req = (body.IATA_OfferPriceRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const selected = ((request.PricedOffer ?? request.SelectedOffer) as Json) ?? {};
  return {
    op: "offerprice",
    offerId: String(selected.OfferRefID ?? selected.offerId ?? selected.OfferID ?? ""),
    offerItemId: String(
      selected.OfferItemRefID ??
        selected.offerItemId ??
        (Array.isArray(selected.SelectedOfferItem)
          ? (selected.SelectedOfferItem[0] as Json)?.OfferItemRefID
          : ""),
    ),
  };
}

function parseOrderCreate(body: Json): StoreAction {
  const req = (body.IATA_OrderCreateRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const create = (request.CreateOrder ?? request) as Json;
  const selected = ((create.SelectedOffer ?? create.AcceptSelectedQuotedOfferList) as Json) ?? {};
  const priced = (selected.SelectedPricedOffer ?? selected) as Json;
  const paxList = ((request.DataLists as Json)?.PaxList ?? request.Passengers ?? []) as Json[];
  const passengers = (Array.isArray(paxList) ? paxList : [paxList]).map((p) => {
    const ind = (p.Individual ?? p) as Json;
    return {
      passengerType: String(p.PTC ?? p.passengerType ?? "ADULT"),
      firstName: String(ind.GivenName ?? ind.firstName ?? "Guest"),
      lastName: String(ind.Surname ?? ind.lastName ?? "User"),
      documentType: String(p.documentType ?? "PASSPORT"),
      documentNumber: String(p.documentNumber ?? "UNKNOWN"),
    };
  });
  return {
    op: "ordercreate",
    offerId: String(priced.OfferRefID ?? priced.offerId ?? ""),
    offerItemId: String(
      priced.OfferItemRefID ??
        (Array.isArray(priced.SelectedOfferItem)
          ? (priced.SelectedOfferItem[0] as Json)?.OfferItemRefID
          : priced.offerItemId ?? ""),
    ),
    passengers: passengers.length ? passengers : [{ passengerType: "ADULT", firstName: "Guest", lastName: "User", documentType: "PASSPORT", documentNumber: "UNKNOWN" }],
  };
}

function parseOrderChangePayment(body: Json): StoreAction {
  const req = (body.IATA_OrderChangeRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const change = (request.OrderChange ?? request) as Json;
  const payment = ((change.PaymentFunctions ?? change.PaymentInfo) as Json[])?.[0] ?? change;
  const order = (change.Order ?? request.Order) as Json;
  return {
    op: "orderchange_payment",
    bookingId: String(order.OrderID ?? order.bookingId ?? change.bookingId ?? ""),
    amount: Number(payment.Amount ?? payment.amount ?? 0),
    currency: String(payment.Currency ?? payment.currency ?? "USD"),
    paymentMethod: String(payment.PaymentMethod ?? payment.paymentMethod ?? "CREDIT_CARD"),
  };
}

function parseOrderRetrieve(body: Json): StoreAction {
  const req = (body.IATA_OrderRetrieveRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const order = (request.OrderValidationFilterCriteria ?? request.Order) as Json;
  return {
    op: "orderretrieve",
    confirmationNumber: String(order.BookingRefID ?? order.confirmationNumber ?? ""),
    passengerLastName: String(order.PassengerLastName ?? order.passengerLastName ?? ""),
  };
}

function parseOrderCancel(body: Json): StoreAction {
  const req = (body.IATA_OrderCancelRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const order = (request.Order ?? request) as Json;
  return {
    op: "ordercancel",
    bookingId: order.OrderID ? String(order.OrderID) : undefined,
    confirmationNumber: order.BookingRefID ? String(order.BookingRefID) : undefined,
    passengerLastName: String(order.PassengerLastName ?? ""),
    refundReason: String(order.RefundReason ?? order.refundReason ?? "PERSONAL_REASON"),
  };
}

function parseOrderChangeFlight(body: Json): StoreAction {
  const req = (body.IATA_OrderChangeRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const change = (request.OrderChange ?? request) as Json;
  const selected = (change.SelectedOffer ?? change) as Json;
  return {
    op: "orderchange_flight",
    originalBookingId: change.OriginalBookingID ? String(change.OriginalBookingID) : undefined,
    confirmationNumber: change.ConfirmationNumber ? String(change.ConfirmationNumber) : undefined,
    passengerLastName: String(change.PassengerLastName ?? ""),
    newOfferId: String(selected.OfferRefID ?? selected.newOfferId ?? ""),
    newOfferItemId: String(selected.OfferItemRefID ?? selected.newOfferItemId ?? ""),
    changeReason: String(change.ChangeReason ?? change.changeReason ?? "PERSONAL_REASON"),
  };
}

function parseServiceList(body: Json): StoreAction {
  const req = (body.IATA_ServiceListRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const order = (request.Order ?? request) as Json;
  return {
    op: "servicelist",
    bookingId: order.OrderID ? String(order.OrderID) : undefined,
    confirmationNumber: order.BookingRefID ? String(order.BookingRefID) : undefined,
  };
}

function parseOrderChangeBaggage(body: Json): StoreAction {
  const req = (body.IATA_OrderChangeRQ ?? body) as Json;
  const request = (req.Request ?? req) as Json;
  const change = (request.OrderChange ?? request) as Json;
  return {
    op: "orderchange_baggage",
    bookingId: change.bookingId ? String(change.bookingId) : undefined,
    confirmationNumber: change.confirmationNumber ? String(change.confirmationNumber) : undefined,
    passengerLastName: String(change.PassengerLastName ?? change.passengerLastName ?? ""),
    passengerId: String(change.PassengerID ?? change.passengerId ?? ""),
    additionalBags: Number(change.AdditionalBags ?? change.additionalBags ?? 1),
    baggageType: String(change.BaggageType ?? change.baggageType ?? "CHECKED"),
    equipmentType: change.equipmentType ? String(change.equipmentType) : undefined,
  };
}

export function parseNdcAction(path: string, body: Json): StoreAction {
  switch (path) {
    case "airshopping":
      return parseAirShopping(body);
    case "offerprice":
      return parseOfferPrice(body);
    case "ordercreate":
      return parseOrderCreate(body);
    case "orderchange":
      if (body._ndcChangeType === "baggage" || (body.IATA_OrderChangeRQ as Json)?.Request?.OrderChange?.BaggageType) {
        return parseOrderChangeBaggage(body);
      }
      if (body._ndcChangeType === "payment" || (body.IATA_OrderChangeRQ as Json)?.Request?.OrderChange?.PaymentFunctions) {
        return parseOrderChangePayment(body);
      }
      return parseOrderChangeFlight(body);
    case "orderretrieve":
      return parseOrderRetrieve(body);
    case "ordercancel":
      return parseOrderCancel(body);
    case "servicelist":
      return parseServiceList(body);
    default:
      throw new Error(`Unknown NDC path: ${path}`);
  }
}

export function wrapNdcResponse(path: string, result: Json, corr?: string): Json {
  const attrs = { CorrelationID: corr ?? `CORR-${Date.now()}` };
  if (result.error) {
    return { PayloadAttributes: attrs, Error: { Code: result.code ?? "ERROR", DescText: result.error } };
  }
  switch (path) {
    case "airshopping": {
      const offers = (result.offers as Json[]) ?? [];
      return {
        IATA_AirShoppingRS: {
          PayloadAttributes: attrs,
          Response: {
            OffersGroup: {
              CarrierOffers: offers.map((o) => {
                const flight = o.flight as Json;
                const fareOptions = flight.fareOptions as Json[];
                return {
                  Offer: {
                    OfferID: o.offerId,
                    OwnerCode: flight.airlineCode,
                    OfferItem: fareOptions.map((f) => ({
                      OfferItemID: f.fareId,
                      Price: { TotalAmount: { Value: f.price, CurCode: f.currency } },
                      FareDetail: { FareBrand: f.fareBrand, CabinClass: f.cabinClass },
                    })),
                    JourneyOverview: {
                      FlightNumber: flight.flightNumber,
                      Departure: { IATA_LocationCode: flight.departureAirport, CityName: flight.departureCity, DateTime: flight.departureTime },
                      Arrival: { IATA_LocationCode: flight.arrivalAirport, CityName: flight.arrivalCity, DateTime: flight.arrivalTime },
                    },
                  },
                };
              }),
            },
            DataLists: { Summary: result.summary },
          },
        },
      };
    }
    case "offerprice":
      return {
        IATA_OfferPriceRS: {
          PayloadAttributes: attrs,
          Response: {
            PricedOffer: {
              OfferRefID: (result.offer as Json)?.offerId,
              OfferItemRefID: result.pricedOfferItemId,
              TotalPrice: { TotalAmount: { Value: result.totalAmount, CurCode: result.currency } },
            },
          },
        },
      };
    case "ordercreate":
    case "orderretrieve":
      return {
        IATA_OrderViewRS: {
          PayloadAttributes: attrs,
          Response: { Order: mapBookingToOrder(result.booking as Json) },
        },
      };
    case "orderchange":
      if (result.paymentId) {
        return { IATA_OrderViewRS: { PayloadAttributes: attrs, Response: { Payment: result } } };
      }
      if (result.baggageOrderId) {
        return { IATA_OrderViewRS: { PayloadAttributes: attrs, Response: { Baggage: result } } };
      }
      if (result.changeId) {
        return { IATA_OrderViewRS: { PayloadAttributes: attrs, Response: { OrderChange: result } } };
      }
      return { IATA_OrderViewRS: { PayloadAttributes: attrs, Response: result } };
    case "ordercancel":
      return { IATA_OrderViewRS: { PayloadAttributes: attrs, Response: { Refund: result } } };
    case "servicelist":
      return { IATA_ServiceListRS: { PayloadAttributes: attrs, Response: { Service: result.services } } };
    default:
      return { PayloadAttributes: attrs, Response: result };
  }
}

function mapBookingToOrder(booking: Json): Json {
  if (!booking) return {};
  return {
    OrderID: booking.bookingId,
    BookingRefID: booking.confirmationNumber,
    StatusCode: booking.status,
    CreationDateTime: booking.bookingDate,
    FlightInfo: booking.flightInfo,
    Passengers: booking.passengers,
    PaymentInfo: booking.paymentInfo,
  };
}

export { correlationId };
