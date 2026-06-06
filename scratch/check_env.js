import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "FOUND" : "NOT FOUND");
console.log("VITE_GEMINI_API_KEY:", process.env.VITE_GEMINI_API_KEY ? "FOUND" : "NOT FOUND");
console.log("All env keys:", Object.keys(process.env).filter(k => k.includes("GEMINI") || k.includes("API")));
