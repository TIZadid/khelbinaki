import { describe, expect, it, vi } from "vitest";
import {
  clearKeeperProfile,
  dedupeRegions,
  loadKeeperProfile,
  saveKeeperProfile,
  subscribeKeeperProfile,
  validateKeeperProfile,
} from "./keeper";

const input = { name: " Mehedi ", phone: "019 1234 5678", regions: ["Dhaka", " dhaka ", "", "div-sylhet", "atlantis"], note: " 5 yrs in goal " };

describe("validateKeeperProfile", () => {
  it("trims, normalises the phone and dedupes areas", () => {
    expect(validateKeeperProfile(input)).toEqual({
      ok: true,
      value: { name: "Mehedi", phone: "8801912345678", regions: ["dhaka", "div-sylhet"], note: "5 yrs in goal" },
    });
  });

  it("reports each bad field", () => {
    const r = validateKeeperProfile({
      name: "  ",
      phone: "123",
      regions: ["dhaka", "sylhet", "khulna", "rangpur", "barishal", "chattogram"],
      note: "x".repeat(201),
    });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["name", "note", "phone", "regions"]);
  });

  it("lets a keeper leave the WhatsApp number out", () => {
    const r = validateKeeperProfile({ ...input, phone: "  " });
    expect(r.ok && r.value.phone).toBe("");
  });
});

describe("dedupeRegions", () => {
  it("keeps known places once, in the order picked", () => {
    expect(dedupeRegions(["Dhaka", "DHAKA", " ", "coxs-bazar", "atlantis"])).toEqual(["dhaka", "coxs-bazar"]);
  });
});

describe("on-device store", () => {
  const profile = { name: "Mehedi", phone: "8801912345678", regions: ["dhaka"], note: "" };

  it("saves, loads and clears", () => {
    expect(loadKeeperProfile()).toBeNull();
    expect(saveKeeperProfile(profile)).toBe(true);
    expect(loadKeeperProfile()).toEqual(profile);
    clearKeeperProfile();
    expect(loadKeeperProfile()).toBeNull();
  });

  it("ignores corrupt or foreign data", () => {
    window.localStorage.setItem("khelbinaki.keeper.v2", "{");
    expect(loadKeeperProfile()).toBeNull();
    window.localStorage.setItem("khelbinaki.keeper.v2", JSON.stringify({ name: 1 }));
    expect(loadKeeperProfile()).toBeNull();
  });

  it("notifies subscribers on save and clear", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeKeeperProfile(onChange);
    saveKeeperProfile(profile);
    clearKeeperProfile();
    unsubscribe();
    saveKeeperProfile(profile);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("reports failure when storage throws", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveKeeperProfile(profile)).toBe(false);
    setItem.mockRestore();
  });
});
