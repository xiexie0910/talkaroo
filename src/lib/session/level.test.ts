import { describe, expect, it } from "vitest";
import { coachAffordance, shouldRunCoach } from "@/lib/session/level";

describe("coachAffordance", () => {
  it("beginner: partner + polish on tap", () => {
    expect(coachAffordance("beginner")).toEqual({
      partnerAssist: true,
      learnerImprove: true,
    });
  });

  it("intermediate: partner only", () => {
    expect(coachAffordance("intermediate")).toEqual({
      partnerAssist: true,
      learnerImprove: false,
    });
  });

  it("advanced: conversation only", () => {
    expect(coachAffordance("advanced")).toEqual({
      partnerAssist: false,
      learnerImprove: false,
    });
  });
});

describe("shouldRunCoach", () => {
  it("matches affordances", () => {
    expect(shouldRunCoach("beginner", "partner_assist")).toBe(true);
    expect(shouldRunCoach("beginner", "learner_improve")).toBe(true);
    expect(shouldRunCoach("intermediate", "partner_assist")).toBe(true);
    expect(shouldRunCoach("intermediate", "learner_improve")).toBe(false);
    expect(shouldRunCoach("advanced", "partner_assist")).toBe(false);
    expect(shouldRunCoach("advanced", "learner_improve")).toBe(false);
  });
});
