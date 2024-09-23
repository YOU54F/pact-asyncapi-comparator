import { readFileSync } from "node:fs";
import { fromFile, Parser, MessageInterface } from "@asyncapi/parser";
import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats"
import { Result } from "./types";

export const formatErrorMessage = (error: ErrorObject) =>
  error.keyword === "additionalProperties"
    ? `${error.message} - ${error.params.additionalProperty}`
    : error.message;

const validateAsyncApi = async (asyncApiLocation: string) => {
  const parser = new Parser();
  const asyncapiRawData = fromFile(parser, asyncApiLocation);
  const results = await asyncapiRawData.validate();
  if (results.length !== 0) {
    console.error(results);
    process.exit(1);
  }
  const asyncApiData = await asyncapiRawData.parse();
  if (!asyncApiData.document) {
    throw new Error("Failed to parse AsyncAPI document");
  }
  return asyncApiData;
};

const extractChannelMessages = (asyncApiData: any): MessageInterface[] => {
  const allChannelMessages: MessageInterface[] = [];
  for (const channel of asyncApiData.document.channels().values()) {
    for (const message of channel.messages().values()) {
      const { payload } = message.json();
      delete payload["x-parser-schema-id"];
      for (const key in payload["properties"]) {
        delete payload["properties"][key]["x-parser-schema-id"];
      }
      payload["additionalProperties"] = false;
      allChannelMessages.push(message);
    }
  }
  return allChannelMessages;
};

const validatePactFile = (pactFile: string) => {
  const pact = JSON.parse(pactFile);
  const pactSpecificationVersion = pact.metadata.pactSpecification.version;
  if (pactSpecificationVersion !== "3.0.0") {
    throw new Error(
      `Only Pact v3 files with messages are supported. Supplied version: ${pactSpecificationVersion}`
    );
  } else if (!pact.messages) {
    throw new Error("Only Pact v3 files with messages are supported");
  }
  return pact.messages;
};

const validateMessages = (
  pactMessages: any[],
  allChannelMessages: MessageInterface[],
  pactFileLocation: string
) => {
  const ajv = new Ajv();
  addFormats(ajv)
  const errors: Result[] = [];
  const warnings: Result[] = [];

  for (const pactMessage of pactMessages) {
    const pactContents = pactMessage["contents"]
    const pactContentType = pactMessage["metadata"]?.["contentType"] ?? pactMessage["metadata"]?.["content-type"] ?? undefined
    if (allChannelMessages.length === 0) {
      throw new Error("No channel payloads found");
    }

    for (const channelMessage of allChannelMessages) {
      const contentTypeMatchResult =
        channelMessage.json().contentType === pactContentType;
      if (!contentTypeMatchResult) {
        errors.push({
          code: "request.content-type.incompatible",
          message: `Content-type does not match. Expected in AsyncAPI: ${
            channelMessage.json().contentType
          }, actual in Pact: ${pactContentType}`,
          specDetails: {
            specFile: channelMessage.meta().asyncapi.source,
            location: channelMessage.meta().pointer,
            value: undefined,
            pathMethod: null,
            pathName: null,
          },
          mockDetails: {
            interactionDescription: pactMessage["description"],
            interactionState:
            pactMessage["providerState"] || pactMessage["providerStates"],
            mockFile: pactFileLocation,
            location: pactMessage["description"],
            value: undefined,
          },
          source: "spec-mock-validation",
          type: "error",
        });
      }
      const schemaValidationResult = ajv.validate(
        channelMessage.json().payload,
        pactContents
      );
      if (!schemaValidationResult && ajv.errors) {
        ajv.errors.forEach((error) => {
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
              interactionDescription: pactMessage["description"],
              interactionState:
              pactMessage["providerState"] || pactMessage["providerStates"],
              mockFile: pactFileLocation,
              location: pactMessage["description"],
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
    process.exit(1);
  } else {
    process.exit(0);
  }
};

const main = async () => {
  const { asyncApiLocation, pactFileLocation } = processArgs(process.argv);
  const pactFile = readFileSync(pactFileLocation, "utf8");

  if (!pactFile) {
    throw new Error("Failed to parse Pact document");
  }

  const asyncApiData = await validateAsyncApi(asyncApiLocation);
  const allChannelMessages = extractChannelMessages(asyncApiData);
  const pactMessages = validatePactFile(pactFile);

  validateMessages(pactMessages, allChannelMessages, pactFileLocation);
};

export const processArgs = (args: string[]) => {
  if (!args[2] && !args[3]) {
    throw new Error("AsyncAPI and Pact file not provided");
  }
  if (!args[2]) {
    throw new Error("AsyncAPI file not provided");
  }
  if (!args[3]) {
    throw new Error("Pact file not provided");
  }
  return {
    asyncApiLocation: args[2],
    pactFileLocation: args[3],
  };
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
