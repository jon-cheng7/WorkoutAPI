
import * as functions from 'firebase-functions';
import express from "express";
import { distance as levenshteinDistance } from "fastest-levenshtein";
import { db } from "./firebaseInit";
import dotenv from "dotenv";

const app = express();

app.use(express.json());

dotenv.config();

// Middleware to check API key
function checkAPIKey(req : any, res : any, next : any) {
    const apiKey = req.headers['x-api-key'];
    const apiKeyFromEnv = process.env.API_KEY;

    const isTrue = (apiKey === apiKeyFromEnv);

    if (apiKey && apiKey === apiKeyFromEnv) {
        next();
    } else {
        res.status(401).json({ error: "Unauthorized", message: `${apiKeyFromEnv}`});
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

interface Workout {
    bodyPart: string;
    equipment: string;
    gifUrl: string;
    id: string;
    instructions: string[];
    name: string;
    secondaryMuscles: string[];
    target: string;
}

interface WorkoutWithScore extends Workout {
    matchScore: number;
}

// Function to calculate match score with stricter criteria
function calculateMatchScore(attribute: string, searchString: string): number {
    const lowerCaseAttribute = attribute.toLowerCase();
    const searchLength = searchString.length;
    const attributeLength = lowerCaseAttribute.length;

    // Check for direct substring match first
    if (lowerCaseAttribute.includes(searchString)) {
        return 1000; // higher means more strict
    }

    // Use Levenshtein distance as a secondary criterion
    const distance = levenshteinDistance(lowerCaseAttribute, searchString);
    
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
    const ref = db.ref("/");

    ref.once(
        "value",
        (snapshot) => {
            const workouts: { [key: string]: Workout } = snapshot.val();
            res.json(workouts);
        },
        (errorObject) => {
            console.log("The read failed: " + errorObject.name);
            res.status(500).send(errorObject);
        }
    );
});

// get the workout with the given id
app.get("/workouts/:id", (req, res) => {
    const id = req.params.id;
    const ref = db.ref(`/${id}`);

    ref.once(
        "value",
        (snapshot) => {
            const workout: Workout = snapshot.val();
            if (workout) {
                res.json(workout);
            } else {
                res.status(404).send("Workout not found.");
            }
        },
        (errorObject) => {
            console.log("The read failed: " + errorObject.name);
            res.status(500).send(errorObject);
        }
    );
});

// search by input
app.get("/workouts/find/:input", (req, res) => {
    const searchString = req.params.input.toLowerCase();
    const ref = db.ref("/");

    ref.once(
        "value",
        (snapshot) => {
            const workouts: { [key: string]: Workout } = snapshot.val();
            let matches: WorkoutWithScore[] = [];

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
                    matches.push({ ...workout, id, matchScore });
                }
            });

            // Sort by matchScore descending
            matches.sort((a, b) => b.matchScore - a.matchScore);

            // Exclude matchScore from the final output
            const response = matches.map(({ matchScore, ...rest }) => rest);

            if (response.length > 0) {
                res.json(response);
            } else {
                res.status(404).send("No matching workouts found.");
            }
        },
        (errorObject) => {
            console.log("The read failed: " + errorObject.name);
            res.status(500).send(errorObject);
        }
    );
});

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export const api = functions.https.onRequest(app);
