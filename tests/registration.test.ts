import { describe, expect, it } from "vitest";
import { registrationAlreadyExists, registrationErrorMessage } from "../src/registration";

describe("dynamic script registration", () => {
  it("treats Chrome's duplicate script result as an idempotent success", () => {
    expect(registrationAlreadyExists(new Error("Duplicate script ID 'mmw_main_1234'"))).toBe(true);
    expect(registrationAlreadyExists("duplicate script id 'mmw_isolated_1234'")).toBe(true);
  });

  it("does not hide unrelated registration failures", () => {
    const error = new Error("Invalid value for matches[0]");
    expect(registrationAlreadyExists(error)).toBe(false);
    expect(registrationErrorMessage(error)).toBe("Invalid value for matches[0]");
  });
});
