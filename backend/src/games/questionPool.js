// src/games/questionPool.js

export const TRIVIA_QUESTIONS = [
  { id: 1, category: "Web Dev", difficulty: "Easy", question: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyperlink Text Language", "Home Tool Markup Language"], correctAnswer: "Hyper Text Markup Language" },
  { id: 2, category: "Computer Science", difficulty: "Medium", question: "Which data structure uses LIFO (Last In, First Out)?", options: ["Queue", "Stack", "Linked List", "Tree"], correctAnswer: "Stack" },
  { id: 3, category: "Web Dev", difficulty: "Easy", question: "What does CSS stand for?", options: ["Computer Style Sheets", "Cascading Style Sheets", "Creative Style System", "Color Style Sheets"], correctAnswer: "Cascading Style Sheets" },
  { id: 4, category: "Databases", difficulty: "Medium", question: "What does SQL stand for?", options: ["Structured Question Language", "Strong Query Language", "Structured Query Language", "System Query Logic"], correctAnswer: "Structured Query Language" },
  { id: 5, category: "JavaScript", difficulty: "Hard", question: "Which company originally developed JavaScript?", options: ["Microsoft", "Netscape", "Sun Microsystems", "Oracle"], correctAnswer: "Netscape" },
  { id: 6, category: "Networking", difficulty: "Medium", question: "What port does HTTPS typically use?", options: ["80", "21", "443", "8080"], correctAnswer: "443" },
  { id: 7, category: "Git", difficulty: "Medium", question: "Which git command saves your code locally without committing?", options: ["git push", "git stash", "git branch", "git clone"], correctAnswer: "git stash" },
  { id: 8, category: "React", difficulty: "Hard", question: "In React, what hook is used to perform side effects?", options: ["useState", "useMemo", "useEffect", "useContext"], correctAnswer: "useEffect" },
  { id: 9, category: "Linux", difficulty: "Medium", question: "Which command is used to list files in a directory?", options: ["cd", "pwd", "mkdir", "ls"], correctAnswer: "ls" },
  { id: 10, category: "General Tech", difficulty: "Easy", question: "Who is known as the father of the World Wide Web?", options: ["Steve Jobs", "Bill Gates", "Tim Berners-Lee", "Alan Turing"], correctAnswer: "Tim Berners-Lee" },
  { id: 11, category: "JavaScript", difficulty: "Medium", question: "What is the output of 'typeof null' in JavaScript?", options: ["null", "undefined", "object", "string"], correctAnswer: "object" },
  { id: 12, category: "Security", difficulty: "Hard", question: "What kind of attack intercepts communication between two parties?", options: ["DDoS", "Man-in-the-Middle", "Phishing", "SQL Injection"], correctAnswer: "Man-in-the-Middle" },
  { id: 13, category: "Docker", difficulty: "Medium", question: "What file is used to define a Docker image?", options: ["Dockerconfig", "Dockerfile", "docker-compose.yml", "Imagefile"], correctAnswer: "Dockerfile" },
  { id: 14, category: "Web Dev", difficulty: "Medium", question: "Which HTTP status code means 'Not Found'?", options: ["200", "403", "404", "500"], correctAnswer: "404" },
  { id: 15, category: "Architecture", difficulty: "Hard", question: "What does API stand for?", options: ["Application Programming Interface", "Advanced Program Integration", "Automated Protocol Interface", "Application Process Integration"], correctAnswer: "Application Programming Interface" }
];

export function getRandomQuestions(amount = 5) {
  const shuffled = [...TRIVIA_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, amount);
}
