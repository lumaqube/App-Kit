// Optional: the app's own server side (runs inside the kit's server, in Node).
// Use it for what the page cannot do: keep a count, write a file, call another service, add an
// endpoint. Delete this file if the app needs none of it.
//   kit.watch.on('session' | 'page' | 'phase' | 'event' | 'templates', ...)   Q-Booth's changes
//   kit.client.send('camera/capture')                                    any Local API action
//   kit.route('GET', '/hello/stats', (req, res, { json }) => json(200, {...}))   your endpoint
//   kit.cfg()  the settings now;  kit.log(...)  goes to logs/app.log in the desktop app
export default function (kit) {
  let sessions = 0;
  kit.watch.on('session', ({ active, template }) => {
    if (active) { sessions++; kit.log(`session ${sessions} started with "${template?.name}"`); }
  });
  kit.route('GET', '/hello/stats', (req, res, { json }) => json(200, { sessions }));
}
