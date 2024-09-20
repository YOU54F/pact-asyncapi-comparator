v3_sns:
	node compare.js asyncapi/api-sns.yml pacts/v3-sns.json

v3_kafka:
	node compare.js asyncapi/api-sns.yml pacts/v3-kafka.json

v2_http:
	node compare.js asyncapi/api-sns.yml pacts/v2-http.json


tutorial_send_message:
	mqtt pub -t 'light/measured' -h 'test.mosquitto.org' -m '{"id": 1, "lumens": 3, "sentAt": "2017-06-07T12:34:32.000Z"}'

tutorial_run:
	cd tutorial && npm run dev