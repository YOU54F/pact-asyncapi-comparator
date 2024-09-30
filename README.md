# pact-asyncapi-comparator

> A WIP comparator CLI tool, used to determine if Message-Pact interactions, are a valid subset of a given AsyncAPI document.

For an OpenAPI flavoured version, please see https://github.com/pactflow/swagger-mock-validator

## Usage

```
npx pact-asyncapi-comparator <Pact File Location> <AsyncAPI File Location>'
```

## Supported Contract Types

### Pact

Supports `Message-Pact` interactions, in the following formats

- [X] V3 Asynchronous Messages
- [X] V4 Asynchronous Messages
- [ ] V4 Synchronous Messages

Note: V4 Pact files may contain mixed interactions, HTTP interactions are filtered.

### AsyncAPI

- [X] AsyncAPI 2.x
- [X] AsyncAPI 3.x
- [ ] [Bindings](https://github.com/asyncapi/bindings)
  - [ ] AMQP binding
  - [ ] AMQP 1.0 binding
  - [ ] Google Cloud Pub/Sub binding
  - [ ] HTTP binding
  - [ ] IBM MQ binding
  - [ ] JMS binding
  - [ ] Kafka binding
  - [ ] MQTT binding
  - [ ] MQTT5 binding
  - [ ] NATS binding
  - [ ] Pulsar
  - [ ] Redis binding
  - [ ] SNS binding
  - [ ] Solace binding
  - [ ] SQS binding
  - [ ] STOMP binding
  - [ ] WebSockets binding

## Features

- [X] Input Validation
  - [X] Check Pact or AsyncAPI is valid
- [X] Cross comparison
  - [X] Check Pact message is a subset of AsyncAPI description
  - [X] Check Content-Type if specified in Pact or AsyncAPI
    - [X] application/json

## Issues

Users may encounter issues, and are advised to raise an issue, along with the Pact & AsyncAPI file used for comparison.

If you are unable to provide your own, please provide a reproducible example using public data.

If you are unable to provide a reproduction, you are advised to fork the repository and attempt a fix yourself.
