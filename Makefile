v3_sns:
	node compare.js asyncapi/api-sns.yml pacts/v3-sns.json

v3_kafka:
	node compare.js asyncapi/api-sns.yml pacts/v3-kafka.json

v2_http:
	node compare.js asyncapi/api-sns.yml pacts/v2-http.json
