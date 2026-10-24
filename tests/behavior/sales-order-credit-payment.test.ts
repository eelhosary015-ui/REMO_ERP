import { describe, expect, it } from "vitest";
import { isCreditPaymentMethod } from "../../modules/sales/utils/payment-method.js";

describe("sales order credit payment detection", () => {
  it.each(["أجل", "آجل", "اجل", "Credit", "credit sale"])(
    "recognizes %s as a credit payment",
    (paymentMethod) => {
      expect(isCreditPaymentMethod(paymentMethod)).toBe(true);
    },
  );

  it.each(["نقدي", "كاش", "شبكة", "تحويل بنكي"])(
    "does not recognize %s as a credit payment",
    (paymentMethod) => {
      expect(isCreditPaymentMethod(paymentMethod)).toBe(false);
    },
  );
});
