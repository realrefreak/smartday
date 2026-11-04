import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("writes rows with commas and Windows line endings", () => {
    expect(toCsv([["Title", "Done"], ["Buy milk", "No"]])).toBe("Title,Done\r\nBuy milk,No\r\n");
  });

  it("quotes cells with commas, quotes or line breaks", () => {
    expect(toCsv([["Eggs, milk", 'Say "hi"', "Line 1\nLine 2"]])).toBe(
      '"Eggs, milk","Say ""hi""","Line 1\nLine 2"\r\n',
    );
  });

  it("writes missing values as empty cells", () => {
    expect(toCsv([["a", null, undefined, "d"]])).toBe("a,,,d\r\n");
  });

  it("stops spreadsheets from running cells as formulas", () => {
    expect(toCsv([["=1+1", "+44 1234", "-5", "@SUM(A1)"]])).toBe("'=1+1,'+44 1234,'-5,'@SUM(A1)\r\n");
    // Normal text is left alone.
    expect(toCsv([["Email a=b"]])).toBe("Email a=b\r\n");
  });
});
