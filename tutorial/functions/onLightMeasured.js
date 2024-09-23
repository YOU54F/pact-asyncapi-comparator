export default async function (event) {
  processEvent(event.payload);
}

export async function processEvent(payload) {
  const { id, lumens, sentAt } = payload;
  console.log(
    `Streetlight with id "${id}" updated its lighting information to ${lumens} lumens at ${sentAt}.`
  );
}
