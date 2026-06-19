/** Internal mock models (mirrors demo-ota travel-ota DTO shapes). */

export interface BaggageInfo {
  cabinBags: number;
  checkedBags: number;
  cabinBagIncluded: boolean;
  checkedBagIncluded: boolean;
}

export interface FareOption {
  fareId: string;
  providerName: string;
  price: number;
  currency: string;
  cabinClass: string;
  baggageInfo: BaggageInfo;
  rating: number;
  reviewCount: number;
  isRecommended: boolean;
  paymentOption: string | null;
  fareBrand: string;
  description: string;
}

export interface FlightOption {
  flightId: string;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  departureAirport: string;
  departureCity: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalCity: string;
  arrivalTime: string;
  durationMinutes: number;
  flightType: string;
  fareOptions: FareOption[];
  hasWifi: boolean;
  hasPowerOutlet: boolean;
  co2Emission: string;
}

export interface SearchSummary {
  totalResults: number;
  lowestPrice: number;
  highestPrice: number;
  sortBy: string;
  datePrices: { date: string; minPrice: number; selected: boolean }[];
}

export interface PassengerInfo {
  passengerId: string;
  passengerType: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  seatNumber: string;
  mealPreference: string;
}

export interface FlightInfo {
  flightId: string;
  flightNumber: string;
  departureAirport: string;
  departureCity: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalCity: string;
  arrivalTime: string;
  cabinClass: string;
}

export interface PaymentInfo {
  paymentId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentDate: string;
}

export interface BookingRecord {
  bookingId: string;
  status: string;
  confirmationNumber: string;
  bookingDate: string;
  flightInfo: FlightInfo;
  passengers: PassengerInfo[];
  paymentInfo: PaymentInfo;
}

export interface StoredOffer {
  offerId: string;
  flight: FlightOption;
  pricedAt?: string;
}

export interface StoreState {
  offers: Record<string, StoredOffer>;
  bookings: Record<string, BookingRecord>;
}

export type StoreAction =
  | { op: "airshopping"; from: string; to: string; departureDate: string; cabinClass?: string }
  | { op: "offerprice"; offerId: string; offerItemId: string }
  | {
      op: "ordercreate";
      offerId: string;
      offerItemId: string;
      passengers: {
        passengerType: string;
        firstName: string;
        lastName: string;
        documentType: string;
        documentNumber: string;
      }[];
    }
  | { op: "orderchange_payment"; bookingId: string; amount: number; currency: string; paymentMethod: string }
  | { op: "orderretrieve"; confirmationNumber: string; passengerLastName: string }
  | {
      op: "ordercancel";
      bookingId?: string;
      confirmationNumber?: string;
      passengerLastName: string;
      refundReason: string;
    }
  | {
      op: "orderchange_flight";
      originalBookingId?: string;
      confirmationNumber?: string;
      passengerLastName: string;
      newOfferId: string;
      newOfferItemId: string;
      changeReason: string;
    }
  | {
      op: "servicelist";
      bookingId?: string;
      confirmationNumber?: string;
    }
  | {
      op: "orderchange_baggage";
      bookingId?: string;
      confirmationNumber?: string;
      passengerLastName: string;
      passengerId: string;
      additionalBags: number;
      baggageType: string;
      equipmentType?: string;
    };

export type StoreResult = Record<string, unknown>;
