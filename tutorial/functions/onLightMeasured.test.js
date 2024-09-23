import {
  MessageConsumerPact,
  synchronousBodyHandler
} from '@pact-foundation/pact';
import { processEvent } from './onLightMeasured';

describe('test streetlights-subscriber', () => {
  it('should consume a message - Pact V3 Spec ', () => {
    const messagePact = new MessageConsumerPact({
      consumer: 'Streetlights-subscriber-v3',
      provider: 'Streetlights-publisher',
    });

    messagePact
      .expectsToReceive('a message')
      .withContent({ id: 1, lumens: 3, sentAt: '2017-06-07T12:34:32.000Z' })
      .verify(synchronousBodyHandler(processEvent));
  });
  it('should consume a message - Pact V4 Spec ', () => {
    const messagePact = new MessageConsumerPact({
      consumer: 'Streetlights-subscriber-v4',
      provider: 'Streetlights-publisher',
      spec: 4
    });

    messagePact
      .expectsToReceive('a message')
      .withContent({ id: 1, lumens: 3, sentAt: '2017-06-07T12:34:32.000Z' })
      .verify(synchronousBodyHandler(processEvent));
  });
});
