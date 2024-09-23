import { processArgs } from "./compare";
describe("It should test the comparator", () => {
  it("should process the incoming arguments", () => {
    const args = ["node", "script.js", "asyncapi.yaml", "pact.json"];
    const result = processArgs(args);
    expect(result).toEqual({
      asyncApiLocation: "asyncapi.yaml",
      pactFileLocation: "pact.json",
    });
  });

  it("should throw an error if asyncapi location is not provided", () => {
    const args = ["node", "script.js"];
    expect(() => processArgs(args)).toThrow(
      "AsyncAPI and Pact file not provided"
    );
  });

  it("should throw an error if pact file location is not provided", () => {
    const args = ["node", "script.js", "asyncapi.yaml"];
    expect(() => processArgs(args)).toThrow("Pact file not provided");
  });

  it("should throw an error if both asyncapi and pact file locations are not provided", () => {
    const args = ["node", "script.js"];
    expect(() => processArgs(args)).toThrow(
      "AsyncAPI and Pact file not provided"
    );
  });
});
