const { spawn } = require('child_process');
const net = require('net');

// Check if PostgreSQL port is open before starting
function checkPort(port, host, callback) {
  const socket = new net.Socket();
  socket.setTimeout(2000);
  socket.on('connect', () => {
    socket.destroy();
    callback(true);
  });
  socket.on('timeout', () => {
    socket.destroy();
    callback(false);
  });
  socket.on('error', () => {
    socket.destroy();
    callback(false);
  });
  socket.connect(port, host);
}

console.log("Checking Database connection...");
checkPort(5432, '127.0.0.1', (isOpen) => {
  if (!isOpen) {
    console.warn("\n" + "!".repeat(60));
    console.warn("  WARNING: PostgreSQL (Port 5432) is NOT reachable on 127.0.0.1");
    console.warn("  تحذير: لا يمكن الوصول لقاعدة البيانات على المنفذ 5432");
    console.warn("  Please run CHECK_POSTGRES.bat or start PostgreSQL service.");
    console.warn("!".repeat(60) + "\n");
  }

  // تشغيل الأمر npx tsx server.ts بطريقة متوافقة مع ويندوز
  const child = spawn('npx.cmd', ['tsx', 'server.ts'], {
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    process.exit(code);
  });
});
