import {
  MessageConsumerPact,
  synchronousBodyHandler
} from '@pact-foundation/pact';
import { processEvent } from './onLightMeasured';

describe('test streetlights-subscriber', () => {
  it('should consume a message ', () => {
    const messagePact = new MessageConsumerPact({
      consumer: 'Streetlights-subscriber',
      provider: 'Streetlights-publisher'
    });

    messagePact
      .expectsToReceive('a message')
      .withContent({ id: 1, lumens: 3, sentAt: '2017-06-07T12:34:32.000Z' })
      .verify(synchronousBodyHandler(processEvent));
  });
});
