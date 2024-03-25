"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const express_1 = __importDefault(require("express"));
const fastest_levenshtein_1 = require("fastest-levenshtein");
const firebaseInit_1 = require("./firebaseInit");
const dotenv_1 = __importDefault(require("dotenv"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
dotenv_1.default.config();
// Middleware to check API key
function checkAPIKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const apiKeyFromEnv = process.env.API_KEY;
    const isTrue = (apiKey === apiKeyFromEnv);
    if (apiKey && apiKey === apiKeyFromEnv) {
        next();
    }
    else {
        res.status(401).json({ error: "Unauthorized", message: `${apiKeyFromEnv}` });
    }
}
app.use(checkAPIKey);
app.get('/', (req, res) => {
    res.send('Enpoints: \
            /workouts/all\
            /workouts/:id \
            /workouts/find/:input \
            ');
});
// Function to calculate match score with stricter criteria
function calculateMatchScore(attribute, searchString) {
    const lowerCaseAttribute = attribute.toLowerCase();
    const searchLength = searchString.length;
    const attributeLength = lowerCaseAttribute.length;
    // Check for direct substring match first
    if (lowerCaseAttribute.includes(searchString)) {
        return 1000; // higher means more strict
    }
    // Use Levenshtein distance as a secondary criterion
    const distance = (0, fastest_levenshtein_1.distance)(lowerCaseAttribute, searchString);
    // Calculate a score based on the proximity and length difference
    // The smaller the distance and the closer the lengths, the higher the score
    const lengthDifference = Math.abs(attributeLength - searchLength);
    if (distance < Math.min(attributeLength, searchLength) / 2) { // Adjust this ratio to control strictness
        return Math.max(0, 500 - distance * 10 - lengthDifference * 5);
    }
    return 0;
}
// get all workouts
app.get("/workouts/all", (req, res) => {
    const ref = firebaseInit_1.db.ref("/");
    ref.once("value", (snapshot) => {
        const workouts = snapshot.val();
        res.json(workouts);
    }, (errorObject) => {
        console.log("The read failed: " + errorObject.name);
        res.status(500).send(errorObject);
    });
});
// get the workout with the given id
app.get("/workouts/:id", (req, res) => {
    const id = req.params.id;
    const ref = firebaseInit_1.db.ref(`/${id}`);
    ref.once("value", (snapshot) => {
        const workout = snapshot.val();
        if (workout) {
            res.json(workout);
        }
        else {
            res.status(404).send("Workout not found.");
        }
    }, (errorObject) => {
        console.log("The read failed: " + errorObject.name);
        res.status(500).send(errorObject);
    });
});
// search by input
app.get("/workouts/find/:input", (req, res) => {
    const searchString = req.params.input.toLowerCase();
    const ref = firebaseInit_1.db.ref("/");
    ref.once("value", (snapshot) => {
        const workouts = snapshot.val();
        let matches = [];
        Object.entries(workouts).forEach(([id, workout]) => {
            let matchScore = 0;
            // Calculate match score with stricter criteria
            matchScore += calculateMatchScore(workout.bodyPart, searchString);
            matchScore += calculateMatchScore(workout.equipment, searchString);
            matchScore += calculateMatchScore(workout.target, searchString);
            matchScore += calculateMatchScore(workout.name, searchString);
            workout.secondaryMuscles.forEach(muscle => {
                matchScore += calculateMatchScore(muscle, searchString);
            });
            // Add to matches if score is above a certain threshold
            if (matchScore > 0) {
                matches.push(Object.assign(Object.assign({}, workout), { id, matchScore }));
            }
        });
        // Sort by matchScore descending
        matches.sort((a, b) => b.matchScore - a.matchScore);
        // Exclude matchScore from the final output
        const response = matches.map((_a) => {
            var { matchScore } = _a, rest = __rest(_a, ["matchScore"]);
            return rest;
        });
        if (response.length > 0) {
            res.json(response);
        }
        else {
            res.status(404).send("No matching workouts found.");
        }
    }, (errorObject) => {
        console.log("The read failed: " + errorObject.name);
        res.status(500).send(errorObject);
    });
});
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
exports.api = functions.https.onRequest(app);
