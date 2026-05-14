import { exec } from 'child_process';
import http from 'http';

console.log("Starting server for benchmark...");
const server = exec('node server.js');

server.stdout.on('data', (data) => {
  if (data.includes('listening')) {
    console.log("Server started. Running autocannon load test...");
    
    // Run autocannon
    const autocannon = exec('npx autocannon -c 20 -d 10 http://localhost:3000/tournaments');
    
    autocannon.stdout.on('data', (out) => process.stdout.write(out));
    autocannon.stderr.on('data', (err) => process.stderr.write(err));
    
    autocannon.on('close', () => {
      console.log("Benchmark complete. Shutting down server.");
      server.kill();
      process.exit(0);
    });
  }
  // Print warnings for slow queries
  if (data.includes('SLOW QUERY')) {
    process.stdout.write(data);
  }
});

server.stderr.on('data', (err) => {
  console.error(`Server error: ${err}`);
});
