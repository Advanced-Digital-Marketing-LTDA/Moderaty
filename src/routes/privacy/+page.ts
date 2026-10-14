// APP_URL is runtime configuration on both supported deployment targets, and the
// canonical link needs it. Render at request time; hooks.server.ts keeps this
// page available without the database or a session.
export const prerender = false;
