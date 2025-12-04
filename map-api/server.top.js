const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");
const turf = require("@turf/turf");

// NEW — load environment + OpenAI SDK
require("dotenv").config();
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- BEGIN ORIGINAL SERVER CODE AFTER THIS LINE ---
