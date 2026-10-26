import { parseCsv } from "./csv";
import { parseNhiaCsv } from "./nhia";

const HEADER = "District,Provider Name,Provider Type,Location";

describe("csv reader", () => {
  it("reads quotes, commas inside quotes, doubled quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["d", "e", "f"],
    ]);
  });

  it("drops a byte-order mark", () => {
    expect(parseCsv("﻿a,b")).toEqual([["a", "b"]]);
  });
});

describe("NHIA importer (Prompt 9, rule D1)", () => {
  it("keeps name, type, district and area as the file writes them", () => {
    const { facilities, rejected } = parseNhiaCsv(`${HEADER}\nABLEKUMA,DANSOMAN POLYCLINIC,POLY2005,DANSOMAN\n`, "f.csv");
    expect(rejected).toEqual([]);
    expect(facilities).toEqual([
      {
        source_ref: "f.csv#row-1",
        name: "DANSOMAN POLYCLINIC",
        nhia_type: "POLY2005",
        district: "ABLEKUMA",
        area: "DANSOMAN",
        phone: null,
      },
    ]);
  });

  it("never invents a phone: none unless the file has a phone column", () => {
    const { facilities } = parseNhiaCsv(`${HEADER}\nGA,A CLINIC,CLINIC,AMASAMAN\n`, "f.csv");
    expect(facilities[0]!.phone).toBeNull();
  });

  it("keeps a phone and NHIA code when the file has them; the code becomes source_ref", () => {
    const { facilities } = parseNhiaCsv(
      `${HEADER},Phone,NHIA Code\nGA,A CLINIC,CLINIC,AMASAMAN,030 000 0000,GA-123\n`,
      "f.csv",
    );
    expect(facilities[0]).toMatchObject({ phone: "030 000 0000", source_ref: "NHIA GA-123" });
  });

  it("a blank location is kept as unknown, not filled in", () => {
    const { facilities } = parseNhiaCsv(`${HEADER}\nAYAWASO,FAITH MEDICAL CENTRE,CLINIC,\n`, "f.csv");
    expect(facilities[0]!.area).toBeNull();
  });

  it("tidies spaces but keeps the wording", () => {
    const { facilities } = parseNhiaCsv(`${HEADER}\n ABLEKUMA ,"ALL-  LIFE   PHARMACY",Pharmacy, OBLOGO ROAD \n`, "f.csv");
    expect(facilities[0]).toMatchObject({ name: "ALL- LIFE PHARMACY", district: "ABLEKUMA", area: "OBLOGO ROAD" });
  });

  it("rows it can't read go to the report, not the facilities", () => {
    const { facilities, rejected } = parseNhiaCsv(
      [
        HEADER,
        "ABLEKUMA,,CLINIC,DANSOMAN", // no name
        ",A CLINIC,CLINIC,DANSOMAN", // no district
        "ABLEKUMA,B CLINIC,,DANSOMAN", // no type
        "OSU KLOTTEY,CASTLE CLINIC,5 B2,OSU", // a type we can't read
        "ABLEKUMA,C CLINIC,CLINIC", // a missing column
        "ABLEKUMA,GOOD CLINIC,CLINIC,DANSOMAN",
      ].join("\n"),
      "f.csv",
    );
    expect(facilities.map((f) => f.name)).toEqual(["GOOD CLINIC"]);
    expect(rejected.map((r) => [r.row, r.reason])).toEqual([
      [1, "no provider name"],
      [2, "no district"],
      [3, "no provider type"],
      [4, 'provider type "5 B2" is not one we can read'],
      [5, "has 3 columns, the header has 4"],
    ]);
    expect(rejected[3]!.raw).toEqual(["OSU KLOTTEY", "CASTLE CLINIC", "5 B2", "OSU"]);
  });

  it("a facility listed twice in a district is imported once; the second row goes to the report", () => {
    const { facilities, rejected } = parseNhiaCsv(
      `${HEADER}\nABLEKUMA,UNICOM CHEMIST LTD,Pharmacy,DANSOMAN\nABLEKUMA,Unicom Chemist Ltd.,Pharmacy,DANSOMAN CONTROL\n`,
      "f.csv",
    );
    expect(facilities).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ row: 2, reason: "the same name and district are listed earlier in the file" });
  });

  it("the same name in two districts is two facilities", () => {
    const { facilities } = parseNhiaCsv(`${HEADER}\nGA,ST JOHN CLINIC,CLINIC,X\nKPESHIE,ST JOHN CLINIC,CLINIC,Y\n`, "f.csv");
    expect(facilities).toHaveLength(2);
  });

  it("skips blank lines without counting them as bad rows", () => {
    const { facilities, rejected } = parseNhiaCsv(`${HEADER}\n\nGA,A CLINIC,CLINIC,X\n`, "f.csv");
    expect(facilities).toHaveLength(1);
    expect(rejected).toEqual([]);
  });

  it("refuses a file that isn't the provider list", () => {
    expect(() => parseNhiaCsv("Name,Phone\nX,1\n", "other.csv")).toThrow(/no District, Provider Name, Provider Type, Location column/);
  });
});
