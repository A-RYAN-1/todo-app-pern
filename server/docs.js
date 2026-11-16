// API documentation: the OpenAPI spec at /openapi.json and Swagger UI at /docs.
// Everything is served from this origin, so the default helmet content security policy holds.
const express = require("express");
const swaggerUiPath = require("swagger-ui-dist").getAbsoluteFSPath();
const spec = require("./openapi.json");

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Todo API</title>
    <link rel="stylesheet" href="/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/assets/swagger-ui-bundle.js"></script>
    <script src="/docs/init.js"></script>
  </body>
</html>
`;

const INIT = `window.ui = SwaggerUIBundle({
  url: "/openapi.json",
  dom_id: "#swagger-ui",
  persistAuthorization: false,
});
`;

function docsRouter() {
  const router = express.Router();
  router.get("/openapi.json", (req, res) => res.json(spec));
  router.get("/docs", (req, res) => res.type("html").send(PAGE));
  router.get("/docs/init.js", (req, res) => res.type("js").send(INIT));
  router.use("/docs/assets", express.static(swaggerUiPath, { index: false }));
  return router;
}

module.exports = { docsRouter, spec };
