import { describe, expect, it } from "vitest";
import { csvNumber, escapeCsv } from "./csv-cell";

describe("CSV cell serialization", () => {
  it.each(["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "＝1+1", "＋1", "－1", "＠SUM(A1)", " =1", "\u0000=1", "\ttext", "\rtext", "\ntext", " \ttext", "\u00a0@SUM(A1)"])("prefixes formula-like text %j", value => {
    expect(escapeCsv(value)).toBe(`"'${value}"`);
  });

  it.each(["-2", "+2.50", "-.5", "-1.20e-3", "48.900", "0", "3."])("preserves a decimal only in a numeric column: %s", value => {
    expect(escapeCsv(csvNumber(value))).toBe(`"${value}"`);
  });

  it.each(["=1+1", "-2+3", "+1/2", "-2;=1", "-1e999", "\t-2", "－2"])("treats invalid numeric input as text: %j", value => {
    expect(escapeCsv(csvNumber(value))).toBe(`"'${value}"`);
  });

  it("protects numeric-looking names and retains standard CSV quoting", () => {
    expect(escapeCsv("-2")).toBe('"\'-2"');
    expect(escapeCsv('=1,"two"\r\nthree')).toBe('"\'=1,""two""\r\nthree"');
    expect(escapeCsv('Entry, then "exit"\n好')).toBe('"Entry, then ""exit""\n好"');
    expect(escapeCsv(null)).toBe('""');
    expect(escapeCsv(csvNumber(-2))).toBe('"-2"');
    expect(escapeCsv(csvNumber(""))).toBe('""');
  });
});
