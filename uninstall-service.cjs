const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'RemoProService',
  script: path.join(__dirname, 'start-windows.js')
});

svc.on('uninstall', function() {
  console.log('Service uninstalled successfully!');
  console.log('The service exists: ', svc.exists);
});

svc.uninstall();
