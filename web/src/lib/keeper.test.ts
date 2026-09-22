import { describe, expect, it, vi } from "vitest";
import {
  clearKeeperProfile,
  dedupeAreas,
  loadKeeperProfile,
  saveKeeperProfile,
  subscribeKeeperProfile,
  validateKeeperProfile,
} from "./keeper";

const input = { name: " Mehedi ", phone: "019 1234 5678", areas: ["Mirpur", " mirpur ", "", "Uttara"], note: " 5 yrs in goal " };

describe("validateKeeperProfile", () => {
  it("trims, normalises the phone and dedupes areas", () => {
    expect(validateKeeperProfile(input)).toEqual({
      ok: true,
      value: { name: "Mehedi", phone: "8801912345678", areas: ["Mirpur", "Uttara"], note: "5 yrs in goal" },
    });
  });

  it("reports each bad field", () => {
    const r = validateKeeperProfile({
      name: "  ",
      phone: "123",
      areas: ["A", "B", "C", "D", "E", "F"],
      note: "x".repeat(201),
    });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["areas", "name", "note", "phone"]);
  });
});

describe("dedupeAreas", () => {
  it("keeps the first spelling and drops blanks", () => {
    expect(dedupeAreas(["Mirpur", "MIRPUR", " ", "Agrabad "])).toEqual(["Mirpur", "Agrabad"]);
  });
});

describe("on-device store", () => {
  const profile = { name: "Mehedi", phone: "8801912345678", areas: ["Mirpur"], note: "" };

  it("saves, loads and clears", () => {
    expect(loadKeeperProfile()).toBeNull();
    expect(saveKeeperProfile(profile)).toBe(true);
    expect(loadKeeperProfile()).toEqual(profile);
    clearKeeperProfile();
    expect(loadKeeperProfile()).toBeNull();
  });

  it("ignores corrupt or foreign data", () => {
    window.localStorage.setItem("khelbinaki.keeper.v1", "{");
    expect(loadKeeperProfile()).toBeNull();
    window.localStorage.setItem("khelbinaki.keeper.v1", JSON.stringify({ name: 1 }));
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
