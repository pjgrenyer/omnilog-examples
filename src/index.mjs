import { createApp } from "./server.mjs";

const port = process.env.PORT ?? 3000;
createApp().listen(port, () => console.log(`shop-demo listening on ${port}`));
