const express = require('express');
const schedule = require('node-schedule');

const app = express();
const port = 3000;

const times = {
  "regular": [
    { hour: 8, minute: 35 },
    { hour: 10, minute: 8 },
    { hour: 11, minute: 41 },
    { hour: 13, minute: 46 }
  ],
  "assembly" : [
    { hour: 8, minute: 35 },
    { hour: 9, minute: 57 },
    { hour: 11, minute: 19 },
    { hour: 13, minute: 55 }  
  ],
  "debug" : [
    { hour: 19, minute: 08 },
    { hour: 19, minute: 09 }
  ]
};

// Function to be executed at scheduled time
const executeTask = () => {
  console.log('Executing scheduled task at', new Date().toLocaleTimeString());
};

// Schedule the job using RecurrenceRule

times['debug'].forEach(time => {
  const rule = new schedule.RecurrenceRule();
  rule.hour = time.hour;
  rule.minute = time.minute;
  
  const job = schedule.scheduleJob(rule, executeTask);
});




app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
