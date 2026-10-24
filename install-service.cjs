const Service = require('node-windows').Service;
const path = require('path');

// إنشاء كائن الخدمة
const svc = new Service({
  name: 'RemoProService',
  description: 'Remo Pro System Auto-Start Service',
  script: path.join(__dirname, 'start-windows.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

// عند الانتهاء من التثبيت
svc.on('install', function() {
  console.log('Service installed successfully!');
  svc.start();
});

// في حالة وجود خطأ
svc.on('alreadyinstalled', function() {
  console.log('Service is already installed.');
});

svc.install();
