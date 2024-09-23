import { readFileSync } from "node:fs";
import { fromURL, fromFile, Parser, MessageInterface } from "@asyncapi/parser";
import { Ajv, ErrorObject } from "ajv";
import { Result } from "./types";

export const formatErrorMessage = (error: ErrorObject) =>
  error.keyword === "additionalProperties"
    ? `${error.message} - ${error.params.additionalProperty}`
    : error.message;

const main = async () => {
  if (!process.argv[2] || !process.argv[3]) {
    throw new Error("asyncapi + pactfile not provided");
  }
  const asyncApiLocation = process.argv[2];
  const pactFileLocation = process.argv[3];
  const pactFile = readFileSync(pactFileLocation, "utf8");
  const parser = new Parser();
  const asyncapiRawData = fromFile(parser, asyncApiLocation);
  const results = await asyncapiRawData.validate();
  if (results.length != 0) {
    console.error(results);
    process.exit(1);
  }
  const asyncApiData = await asyncapiRawData.parse();
  if (!asyncApiData.document) {
    throw new Error("failed to parse AsyncAPI document");
  }

  // Read the Pact file
  if (!pactFile) {
    throw new Error("failed to parse Pact document");
  }

  // loop through and gather the messages in the asyncapi file
  const allChannelMessages: MessageInterface[] = [];

  for (const [index, channel] of asyncApiData.document.channels().entries()) {
    //   console.log(`Processing channel at index ${index}`);
    for (const [index, message] of channel.messages().entries()) {
      // console.log(`Processing message ${index}`);
      const { payload, contentType } = message.json();
      delete payload["x-parser-schema-id"];
      for (const key in payload["properties"]) {
        delete payload["properties"][key]["x-parser-schema-id"];
      }
      payload["additionalProperties"] = false; // we need to fail if the consumer pact has properties the api description does not declare
      allChannelMessages.push(message);
    }
  }

  // Parse the Pact file and AsyncAPI document
  const pact = JSON.parse(pactFile);
  // loop through the pact file. assumed v3
  const pactSpecificationVersion = pact.metadata.pactSpecification.version;
  if (pactSpecificationVersion !== "3.0.0") {
    throw new Error(
      `only pact v3 pact files with messages are supported. supplied version: ${pactSpecificationVersion}`
    );
  } else if (pactSpecificationVersion === "3.0.0" && !pact.messages) {
    throw new Error("only pact v3 pact files with messages are supported");
  }

  const pactMessages = pact.messages;

  const numInteractions = pactMessages.length;
  // console.log(`${numInteractions} interactions to process`);
  const ajv = new Ajv();

  const errors: Result[] = [];
  const warnings: Result[] = [];

  for (const [index, message] of pactMessages.entries()) {
    //   console.log(`Processing interaction ${index}`);
    const {
      pactContents = message.contents,
      pactContentType = message.metaData["content-type"] ||
        message.metaData["contentType"],
    } = message;

    if (allChannelMessages.length === 0) {
      throw new Error("No channel payloads found");
    }

    for (const channelMessage of allChannelMessages) {
      // console.log(message.payload)
      // console.log(pactContents)
      const contentTypeMatchResult =
        channelMessage.json().contentType === pactContentType;
      if (!contentTypeMatchResult) {
        errors.push({
          code: "request.content-type.incompatible",
          message: `content-type does not match. expected in AsyncAPI: ${
            channelMessage.json().contentType
          }, actual in Pact: ${pactContentType}`,
          source: "spec-mock-validation",
          type: "error",
        });
      }
      const schemaValidationResult = ajv.validate(
        channelMessage.json().payload,
        pactContents
      );
      if (!schemaValidationResult) {
        if (!ajv.errors) {
          break;
        }
        ajv.errors.map((error) => {
          errors.push({
            code: "request.body.incompatible",
            message: formatErrorMessage(error) ?? "error",
            specDetails: {
              specFile: channelMessage.meta().asyncapi.source,
              location: channelMessage.meta().pointer,
              value: undefined,
              pathMethod: null,
              pathName: null,
            },
            mockDetails: {
              interactionDescription: message["description"],
              interactionState:
                message["providerState"] || message["providerStates"],
              mockFile: pactFileLocation,
              location: message["description"],
              value: undefined,
            },
            source: "spec-mock-validation",
            type: "error",
          });
        });
      }
      break;
    }
  }

  if (warnings.length > 0) console.warn(warnings);
  if (errors.length > 0) console.error(errors);

  if (errors.length > 0) {
    //   console.error(
    //     `Validation Failed. ${errors.length} Errors, ${warnings.length} Warnings`
    //   );
    process.exit(1);
  } else {
    //   console.warn(`${errors.length} Errors, ${warnings.length} Warnings`);
    //   console.log("Validation Success");
    process.exit(0);
  }
};

main();
