#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fromFile, Parser, MessageInterface } from '@asyncapi/parser';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { Result } from './types';

export const formatErrorMessage = (error: ErrorObject) =>
  error.keyword === 'additionalProperties'
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
    throw new Error('Failed to parse AsyncAPI document');
  }
  return asyncApiData;
};

const extractChannelMessages = (asyncApiData: any): MessageInterface[] => {
  const allChannelMessages: MessageInterface[] = [];
  for (const channel of asyncApiData.document.channels().values()) {
    for (const message of channel.messages().values()) {
      const { payload } = message.json();
      delete payload['x-parser-schema-id'];
      for (const key in payload['properties']) {
        delete payload['properties'][key]['x-parser-schema-id'];
      }
      payload['additionalProperties'] = false;
      allChannelMessages.push(message);
    }
  }
  return allChannelMessages;
};

const validatePactFile = (pactFile: string) => {
  const pact = JSON.parse(pactFile);
  const pactSpecificationVersion = pact.metadata.pactSpecification.version;
  if (
    pactSpecificationVersion !== '3.0.0' &&
    pactSpecificationVersion !== '4.0'
  ) {
    throw new Error(
      `Only Pact v3/v4 files with messages are supported. Supplied version: ${pactSpecificationVersion}`
    );
  } else if (pactSpecificationVersion === '3.0.0') {
    return pact.messages.map((message: any) => {
      message.pactSpecificationVersion = pactSpecificationVersion;
      return message;
    });
  } else if (pactSpecificationVersion === '4.0') {
    return pact.interactions
      .map((interaction: any) => {
        interaction.pactSpecificationVersion = pactSpecificationVersion;
        return interaction;
      })
      .filter((interaction: any) => {
        return (
          interaction.type === 'Asynchronous/Messages' ||
          interaction.type === 'Synchronous/Messages'
        );
      });
  }
  throw new Error(`Unable to find valid interactions`);
};

const validateMessages = (
  pactMessages: any[],
  allChannelMessages: MessageInterface[],
  pactFileLocation: string
) => {
  const ajv = new Ajv();
  addFormats(ajv);
  const errors: Result[] = [];
  const warnings: Result[] = [];

  for (const pactMessage of pactMessages) {
    // console.log(pactMessage);
    // console.log(pactMessage.pactSpecificationVersion);
    const pactContents =
      pactMessage.pactSpecificationVersion === '4.0'
        ? pactMessage['contents']['content']
        : pactMessage['contents'];
    const pactContentType =
      pactMessage.pactSpecificationVersion === '4.0'
        ? pactMessage['contents']?.['contentType']
        : pactMessage['metadata']?.['contentType'] ??
          pactMessage['metadata']?.['content-type'] ??
          pactMessage['metaData']?.['contentType'] ??
          pactMessage['metaData']?.['content-type'] ??
          undefined;

    if (allChannelMessages.length === 0) {
      throw new Error('No channel payloads found');
    }

    for (const channelMessage of allChannelMessages) {
      const contentTypeMatchResult =
        channelMessage.json().contentType === pactContentType;
      if (!contentTypeMatchResult) {
        errors.push({
          code: 'request.content-type.incompatible',
          message: `Content-type does not match. Expected in AsyncAPI: ${
            channelMessage.json().contentType
          }, actual in Pact: ${pactContentType}`,
          specDetails: {
            specFile: channelMessage.meta().asyncapi.source,
            location: channelMessage.meta().pointer,
            value: undefined,
            pathMethod: null,
            pathName: null
          },
          mockDetails: {
            interactionDescription: pactMessage['description'],
            interactionState:
              pactMessage['providerState'] || pactMessage['providerStates'],
            mockFile: pactFileLocation,
            location: pactMessage['description'],
            value: undefined
          },
          source: 'spec-mock-validation',
          type: 'error'
        });
      }
      const schemaValidationResult = ajv.validate(
        channelMessage.json().payload,
        pactContents
      );
      if (!schemaValidationResult && ajv.errors) {
        ajv.errors.forEach((error) => {
          errors.push({
            code: 'request.body.incompatible',
            message: formatErrorMessage(error) ?? 'error',
            specDetails: {
              specFile: channelMessage.meta().asyncapi.source,
              location: channelMessage.meta().pointer,
              value: undefined,
              pathMethod: null,
              pathName: null
            },
            mockDetails: {
              interactionDescription: pactMessage['description'],
              interactionState:
                pactMessage['providerState'] || pactMessage['providerStates'],
              mockFile: pactFileLocation,
              location: pactMessage['description'],
              value: undefined
            },
            source: 'spec-mock-validation',
            type: 'error'
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
  const pactFile = readFileSync(pactFileLocation, 'utf8');

  if (!pactFile) {
    throw new Error('Failed to parse Pact document');
  }

  const asyncApiData = await validateAsyncApi(asyncApiLocation);
  const allChannelMessages = extractChannelMessages(asyncApiData);
  const pactMessages = validatePactFile(pactFile);

  validateMessages(pactMessages, allChannelMessages, pactFileLocation);
};

const USAGE_STRING = "\nUsage: program <Pact File> <AsyncAPI File>"
export const processArgs = (args: string[]) => {
  if (!args[2] && !args[3]) {
    throw new Error(`Pact file and AsyncAPI file not provided${USAGE_STRING}`);
  }
  if (!args[3]) {
    throw new Error(`AsyncAPI file not provided${USAGE_STRING}`);
  }
  if (!args[2]) {
    throw new Error(`Pact file not provided${USAGE_STRING}`);
  }
  return {
    asyncApiLocation: args[3],
    pactFileLocation: args[2],
  };
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
