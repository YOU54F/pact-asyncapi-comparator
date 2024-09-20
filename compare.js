import fs from 'fs';
import { fromURL, fromFile, Parser } from "@asyncapi/parser";
import {Ajv} from 'ajv'
const parser = new Parser();


const asyncApiLocation = process.argv[2];
const pactFile = fs.readFileSync(process.argv[3], 'utf8');

const asyncapiRawData = fromFile(parser,asyncApiLocation)
const results = await asyncapiRawData.validate()
if (results.length != 0){
    console.log(results)
    throw new Error("failed to parse AsyncAPI document")
}
const asyncApiData = await asyncapiRawData.parse()


// Read the Pact file
if (!pactFile){
    throw new Error("failed to parse Pact document")
}

// loop through and gather the messages in the asyncapi file
const allChannelMessages = []
for (const [index, channel] of asyncApiData.document.channels().entries()){
    console.log(`Processing channel at index ${index}`);
    for (const [index, message] of channel.messages().entries()) {
        console.log(`Processing message ${index}`);
        const { payload, contentType } = message.json();
        delete payload["x-parser-schema-id"];
        for (const key in payload["properties"]) {
            delete payload["properties"][key]["x-parser-schema-id"];
        }
        payload['additionalProperties'] = false; // we need to fail if the consumer pact has properties the api description does not declare
        allChannelMessages.push({payload: payload,contentType: contentType})
    }
}



// Parse the Pact file and AsyncAPI document
const pact = JSON.parse(pactFile);
// loop through the pact file. assumed v3
const pactSpecificationVersion = pact.metadata.pactSpecification.version
if (pactSpecificationVersion !== "3.0.0"){
    throw new Error(`only pact v3 pact files with messages are supported. supplied version: ${pactSpecificationVersion}`)
} else if (pactSpecificationVersion === "3.0.0" && !pact.messages){
    throw new Error("only pact v3 pact files with messages are supported")
}


const pactMessages = pact.messages


const numInteractions = pactMessages.length
console.log(`${numInteractions} interactions to process`)
const ajv = new Ajv();
for (const [index, message] of pactMessages.entries()){
    console.log(`Processing interaction ${index}`)
    const { pactContents = message.contents, pactContentType = message.metaData["content-type"] || message.metaData["contentType"] } = message;
    let isValid = false;
    let isContentTypeValid = false;

    if (allChannelMessages.length === 0) {
        throw new Error("No channel payloads found");
    }

    for (const message of allChannelMessages) {
        console.log(message.payload)
        console.log(pactContents)
        isValid = message.contentType === pactContentType;
        isValid = ajv.validate(message.payload, pactContents);
        if (!isValid) console.log(ajv.errors)
        break;
    }

    if (!isValid) {
        throw new Error("Failed to validate message");
    }

    console.log("Validation successful");
}


// const contentTypesMatch = firstAsyncAPIMessageContentType === firstPactMessageContentType

// console.log("do content types match?", {contentTypesMatch})

// const asyncMessageSchema = asyncApiData.document.channels()[0].json().messages["productUpdated.message"].payload;
// delete asyncMessageSchema["x-parser-schema-id"];
// for (const key in asyncMessageSchema["properties"]) {
//     delete asyncMessageSchema["properties"][key]["x-parser-schema-id"];
// }
// console.log(asyncMessageSchema);
// console.log(firstPactMessageContents)


// const ajv = new Ajv();

// // Validate the firstPactMessageContents against the asyncMessageSchema
// const isValid = ajv.validate(asyncMessageSchema, firstPactMessageContents);

// // Output the result
// console.log(`Is the firstPactMessageContents valid against the asyncMessageSchema? ${isValid}`);

