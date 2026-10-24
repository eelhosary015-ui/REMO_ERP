import jwt from "jsonwebtoken";
const token = jwt.sign({ id: 1, role: "admin", username: "admin" }, process.env.JWT_SECRET || "your_secret_key");
const res = await fetch("http://localhost:3000/api/attendance?limit=100", {
  headers: { "Authorization": `Bearer ${token}` }
});
const text = await res.text();
console.log(text.includes("احمد") ? "Has Ahmed" : "No Ahmed");
console.log(text);
