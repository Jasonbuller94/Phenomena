// Use the dotenv package, to create environment variables
require("dotenv").config();

// Create a constant variable, PORT, based on what's in process.env.PORT or fallback to 3000
const PORT = process.env.PORT || 3000;

// Import express, and create a server
const express = require("express");
const server = express();

// Require morgan and body-parser middleware
const morgan = require("morgan");
const bodyParser = require("body-parser");

// Have the server use morgan with setting 'dev'
server.use(morgan("dev"));

// Import cors
const cors = require("cors");

// Have the server use cors()
server.use(cors());

// Have the server use bodyParser.json()
server.use(bodyParser.json());

// Have the server use your api router with prefix '/api'
// server.use("/api", require("./api"));
const apiRouter = require("./api");
server.use("/api", apiRouter);

// Import the client from your db/index.js
const { client } = require("./db");

// Create custom 404 handler that sets the status code to 404.
server.all("*", (req, res) => {
  res.sendStatus(404);
});

// Create custom error handling that sets the status code to 500
// and returns the error as an object
server.use((err, req, res, next) => {
  res.status(500).json(err);
});

// Start the server listening on port PORT
// On success, connect to the database
server.listen(PORT, () => {
  client.connect();
  console.log("Server listening to port 3000");
});
