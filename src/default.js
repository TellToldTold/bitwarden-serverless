export const handler = (event, context, callback) => {
  console.log('Fallback handler triggered', JSON.stringify(event.path, null, 2));
  callback(null, {
    statusCode: 404,
    body: 'Not Found',
  });
};
