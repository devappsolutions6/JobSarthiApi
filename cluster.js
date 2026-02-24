const cluster = require("cluster");
const os = require("os");

const totalCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Master process ${process.pid} started`);
  console.log(`Forking ${totalCPUs} workers for ${totalCPUs} CPU cores...`);

  // Fork one worker per CPU core
  for (let i = 0; i < totalCPUs; i++) {
    cluster.fork();
  }

  // If a worker crashes, restart it automatically
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`);
    cluster.fork();
  });

  cluster.on("online", (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });

} else {
  // Each worker runs the Express server
  require("./index.js");
}
