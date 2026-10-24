const fs = require('fs');

// We can't run DOM methods in node directly without JSDOM, but we can't easily install it if it takes too long.
// Let's just hide it via CSS as the most robust and immediate solution for Focus Mode styling requests.
