import { describe, expect, it } from "vitest";
import { runAction, emptyState } from "../src/airline-store";
import type { StoreState } from "../src/types";

function fresh(): StoreState {
  return JSON.parse(JSON.stringify(emptyState));
}

describe("airshopping + book + pay flow", () => {
  it("creates offers and completes booking payment", () => {
    const state = fresh();
    const shop = runAction(state, {
      op: "airshopping",
      from: "SFO",
      to: "LAX",
      departureDate: "2026-07-01",
    });
    expect(shop.offers).toBeDefined();
    const offers = shop.offers as { offerId: string; flight: { fareOptions: { fareId: string; price: number }[] } }[];
    expect(offers.length).toBe(10);
    const offerId = offers[0].offerId;
    const fareId = offers[0].flight.fareOptions[0].fareId;

    const priced = runAction(state, { op: "offerprice", offerId, offerItemId: fareId });
    expect(priced.totalAmount).toBeGreaterThan(0);

    const created = runAction(state, {
      op: "ordercreate",
      offerId,
      offerItemId: fareId,
      passengers: [
        {
          passengerType: "ADULT",
          firstName: "E2E",
          lastName: "SoftProbe",
          documentType: "PASSPORT",
          documentNumber: "SP123",
        },
      ],
    });
    const booking = created.booking as { bookingId: string; paymentInfo: { paymentStatus: string } };
    expect(booking.bookingId).toMatch(/^BK/);
    expect(booking.paymentInfo.paymentStatus).toBe("PENDING");

    const paid = runAction(state, {
      op: "orderchange_payment",
      bookingId: booking.bookingId,
      amount: 800,
      currency: "USD",
      paymentMethod: "CREDIT_CARD",
    });
    expect(paid.status).toBe("SUCCESS");
  });
});

describe("refund rules", () => {
  it("rejects unpaid booking refund", () => {
    const state = fresh();
    const shop = runAction(state, {
      op: "airshopping",
      from: "JFK",
      to: "MIA",
      departureDate: "2026-08-01",
    });
    const offer = (shop.offers as { offerId: string; flight: { fareOptions: { fareId: string }[] } }[])[0];
    const created = runAction(state, {
      op: "ordercreate",
      offerId: offer.offerId,
      offerItemId: offer.flight.fareOptions[0].fareId,
      passengers: [{ passengerType: "ADULT", firstName: "A", lastName: "B", documentType: "P", documentNumber: "1" }],
    });
    const booking = created.booking as { bookingId: string; confirmationNumber: string };
    const refund = runAction(state, {
      op: "ordercancel",
      bookingId: booking.bookingId,
      confirmationNumber: booking.confirmationNumber,
      passengerLastName: "B",
      refundReason: "PERSONAL_REASON",
    });
    expect(refund.status).toBe("FAILED");
  });
});
